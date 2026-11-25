import { db } from '../../../database/db.js';
import { soilReports, farms, fields, farmerProfiles } from '../../../database/schema/index.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { ISHCProvider } from '../providers/shc-provider.interface.js';
import { GovernmentSHCProvider } from '../providers/gov-shc.provider.js';
import { MockSHCProvider } from '../providers/mock-shc.provider.js';
import {
  SoilLookupRequest,
  ManualSoilReportRequest,
  SoilReportResponse,
  SoilDashboardResponse,
  SoilReportListQuery
} from '../contracts.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../common/errors/index.js';

export class SoilReportService {
  private govProvider: ISHCProvider;
  private mockProvider: ISHCProvider;

  constructor(
    govProvider?: ISHCProvider,
    mockProvider?: ISHCProvider
  ) {
    this.govProvider = govProvider || new GovernmentSHCProvider();
    this.mockProvider = mockProvider || new MockSHCProvider();
  }

  /**
   * Resolves the appropriate provider based on providerMode and system configuration.
   */
  private getProvider(mode?: 'auto' | 'government' | 'demo'): ISHCProvider {
    if (mode === 'demo') {
      return this.mockProvider;
    }
    if (mode === 'government') {
      return this.govProvider;
    }
    // Auto: default to government unless unconfigured in development
    const hasGovKey = process.env.GOV_DATA_API_KEY && process.env.GOV_DATA_API_KEY !== 'your_gov_data_api_key_placeholder';
    if (!hasGovKey && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      return this.mockProvider;
    }
    return this.govProvider;
  }

  /**
   * Format database row into canonical SoilReportResponse
   */
  private formatReport(row: typeof soilReports.$inferSelect): SoilReportResponse {
    return {
      id: row.id,
      farmerId: row.farmerId,
      farmId: row.farmId || undefined,
      fieldId: row.fieldId || undefined,
      cardId: row.cardId || undefined,
      reportId: row.reportId,
      source: row.source,
      sourceAuthority: row.sourceAuthority || undefined,
      sampleDate: row.sampleDate ? row.sampleDate.toISOString() : undefined,
      testingDate: row.testingDate ? row.testingDate.toISOString() : undefined,
      reportDate: row.reportDate.toISOString(),
      state: row.state || undefined,
      district: row.district || undefined,
      mandal: row.mandal || undefined,
      village: row.village || undefined,
      soilType: row.soilType || undefined,

      ph: row.ph !== null ? parseFloat(row.ph) : null,
      ec: row.ec !== null ? parseFloat(row.ec) : null,
      organicCarbon: row.organicCarbon !== null ? parseFloat(row.organicCarbon) : null,
      nitrogen: row.nitrogen !== null ? parseFloat(row.nitrogen) : null,
      phosphorus: row.phosphorus !== null ? parseFloat(row.phosphorus) : null,
      potassium: row.potassium !== null ? parseFloat(row.potassium) : null,
      sulphur: row.sulphur !== null ? parseFloat(row.sulphur) : null,
      zinc: row.zinc !== null ? parseFloat(row.zinc) : null,
      iron: row.iron !== null ? parseFloat(row.iron) : null,
      copper: row.copper !== null ? parseFloat(row.copper) : null,
      manganese: row.manganese !== null ? parseFloat(row.manganese) : null,
      boron: row.boron !== null ? parseFloat(row.boron) : null,

      nutrientRatings: row.nutrientRatings || undefined,
      recommendations: row.recommendations || undefined,
      status: row.status as any,
      isDemo: row.isDemo || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves dashboard summary for the authenticated farmer.
   */
  async getDashboard(farmerId: string): Promise<SoilDashboardResponse> {
    const reports = await db
      .select()
      .from(soilReports)
      .where(eq(soilReports.farmerId, farmerId))
      .orderBy(desc(soilReports.reportDate))
      .limit(5);

    const [countResult] = await db
      .select({ val: count() })
      .from(soilReports)
      .where(eq(soilReports.farmerId, farmerId));

    const totalReports = countResult ? Number(countResult.val) : 0;
    const latest = reports[0];

    if (!latest) {
      return {
        hasReport: false,
        latestReport: null,
        summary: {
          totalReports: 0,
          lastTestedDate: null,
          primarySoilType: null,
          overallStatus: 'NOT_REQUESTED',
          availableNutrientCount: 0,
          criticalDeficiencies: [],
        },
        recentReports: [],
      };
    }

    // Analyze nutrient ratings for deficiencies
    const ratings = (latest.nutrientRatings as Record<string, string>) || {};
    const criticalDeficiencies: string[] = [];
    let availableCount = 0;

    const nutrientKeys: (keyof typeof latest)[] = [
      'ph', 'ec', 'organicCarbon', 'nitrogen', 'phosphorus', 'potassium', 'sulphur', 'zinc', 'iron', 'copper', 'manganese', 'boron'
    ];
    for (const k of nutrientKeys) {
      if (latest[k] !== null && latest[k] !== undefined) {
        availableCount++;
      }
    }

    for (const [nutrient, rating] of Object.entries(ratings)) {
      if (rating === 'DEFICIENT' || rating === 'LOW' || rating === 'VERY_LOW') {
        criticalDeficiencies.push(nutrient);
      }
    }

    return {
      hasReport: true,
      latestReport: this.formatReport(latest),
      summary: {
        totalReports,
        lastTestedDate: latest.testingDate ? latest.testingDate.toISOString() : latest.reportDate.toISOString(),
        primarySoilType: latest.soilType || null,
        overallStatus: latest.status,
        availableNutrientCount: availableCount,
        criticalDeficiencies,
      },
      recentReports: reports.map((r) => this.formatReport(r)),
    };
  }

  /**
   * Retrieves a single soil report by ID with farmer ownership enforcement.
   */
  async getReportById(farmerId: string, reportId: string): Promise<SoilReportResponse> {
    const [row] = await db
      .select()
      .from(soilReports)
      .where(and(eq(soilReports.id, reportId), eq(soilReports.farmerId, farmerId)))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Soil report ${reportId} not found or access denied.`);
    }

    return this.formatReport(row);
  }

  /**
   * Lists soil reports for a farmer with pagination and optional farm/field filtering.
   */
  async listReports(
    farmerId: string,
    query: SoilReportListQuery
  ): Promise<{ data: SoilReportResponse[]; total: number; limit: number; offset: number }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    const conditions = [eq(soilReports.farmerId, farmerId)];
    if (query.farmId) {
      conditions.push(eq(soilReports.farmId, query.farmId));
    }
    if (query.fieldId) {
      conditions.push(eq(soilReports.fieldId, query.fieldId));
    }

    const rows = await db
      .select()
      .from(soilReports)
      .where(and(...conditions))
      .orderBy(desc(soilReports.reportDate))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ val: count() })
      .from(soilReports)
      .where(and(...conditions));

    return {
      data: rows.map((r) => this.formatReport(r)),
      total: totalRow ? Number(totalRow.val) : 0,
      limit,
      offset,
    };
  }

  /**
   * Initiates Soil Health Card lookup and persists canonical normalized result.
   */
  async lookupAndSaveCard(farmerId: string, req: SoilLookupRequest): Promise<SoilReportResponse> {
    // 1. Verify Farm and Field ownership if provided
    if (req.farmId) {
      const [farm] = await db
        .select()
        .from(farms)
        .where(and(eq(farms.id, req.farmId), eq(farms.farmerId, farmerId)))
        .limit(1);
      if (!farm) {
        throw new ForbiddenError(`Farm ${req.farmId} does not belong to the authenticated farmer.`);
      }
    }

    if (req.fieldId) {
      const fieldConditions = [
        eq(fields.id, req.fieldId),
        eq(farms.farmerId, farmerId),
      ];
      if (req.farmId) {
        fieldConditions.push(eq(fields.farmId, req.farmId));
      }

      const [field] = await db
        .select({ fieldId: fields.id, farmId: fields.farmId })
        .from(fields)
        .innerJoin(farms, eq(fields.farmId, farms.id))
        .where(and(...fieldConditions))
        .limit(1);

      if (!field) {
        throw new ForbiddenError(
          req.farmId
            ? `Field ${req.fieldId} does not belong to farm ${req.farmId} owned by the authenticated farmer.`
            : `Field ${req.fieldId} does not belong to a farm owned by the authenticated farmer.`
        );
      }
    }

    // 2. Select and invoke provider
    const provider = this.getProvider(req.providerMode);
    const lookupResult = await provider.lookupCard(req.cardId);

    // 3. Persist normalized report to DB
    const [inserted] = await db
      .insert(soilReports)
      .values({
        farmerId,
        farmId: req.farmId || null,
        fieldId: req.fieldId || null,
        cardId: req.cardId,
        reportId: lookupResult.reportId,
        source: lookupResult.source,
        sourceAuthority: lookupResult.sourceAuthority || null,
        sampleDate: lookupResult.sampleDate ? new Date(lookupResult.sampleDate) : null,
        testingDate: lookupResult.testingDate ? new Date(lookupResult.testingDate) : null,
        reportDate: new Date(lookupResult.reportDate),
        state: lookupResult.state || null,
        district: lookupResult.district || null,
        mandal: lookupResult.mandal || null,
        village: lookupResult.village || null,
        soilType: lookupResult.soilType || null,

        ph: lookupResult.ph !== undefined && lookupResult.ph !== null ? lookupResult.ph.toString() : null,
        ec: lookupResult.ec !== undefined && lookupResult.ec !== null ? lookupResult.ec.toString() : null,
        organicCarbon: lookupResult.organicCarbon !== undefined && lookupResult.organicCarbon !== null ? lookupResult.organicCarbon.toString() : null,
        nitrogen: lookupResult.nitrogen !== undefined && lookupResult.nitrogen !== null ? lookupResult.nitrogen.toString() : null,
        phosphorus: lookupResult.phosphorus !== undefined && lookupResult.phosphorus !== null ? lookupResult.phosphorus.toString() : null,
        potassium: lookupResult.potassium !== undefined && lookupResult.potassium !== null ? lookupResult.potassium.toString() : null,
        sulphur: lookupResult.sulphur !== undefined && lookupResult.sulphur !== null ? lookupResult.sulphur.toString() : null,
        zinc: lookupResult.zinc !== undefined && lookupResult.zinc !== null ? lookupResult.zinc.toString() : null,
        iron: lookupResult.iron !== undefined && lookupResult.iron !== null ? lookupResult.iron.toString() : null,
        copper: lookupResult.copper !== undefined && lookupResult.copper !== null ? lookupResult.copper.toString() : null,
        manganese: lookupResult.manganese !== undefined && lookupResult.manganese !== null ? lookupResult.manganese.toString() : null,
        boron: lookupResult.boron !== undefined && lookupResult.boron !== null ? lookupResult.boron.toString() : null,

        nutrientRatings: lookupResult.nutrientRatings || null,
        recommendations: lookupResult.recommendations || null,
        status: lookupResult.status,
        isDemo: lookupResult.isDemo ? 'true' : 'false',
      })
      .returning();

    return this.formatReport(inserted);
  }

  /**
   * Refreshes a soil report from upstream provider without destroying historical entries.
   */
  async refreshReport(farmerId: string, reportId: string): Promise<SoilReportResponse> {
    const [existing] = await db
      .select()
      .from(soilReports)
      .where(and(eq(soilReports.id, reportId), eq(soilReports.farmerId, farmerId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundError(`Soil report ${reportId} not found or access denied.`);
    }

    if (!existing.cardId) {
      throw new BadRequestError(`Soil report ${reportId} has no associated Soil Health Card ID to refresh.`);
    }

    // Call lookupAndSaveCard to record updated version
    return this.lookupAndSaveCard(farmerId, {
      cardId: existing.cardId,
      farmId: existing.farmId || undefined,
      fieldId: existing.fieldId || undefined,
      providerMode: existing.isDemo === 'true' ? 'demo' : 'auto',
    });
  }

  /**
   * Persists a farmer-submitted soil test record with ICAR-aligned nutrient ratings & crop recommendations.
   */
  async createManualReport(farmerId: string, req: ManualSoilReportRequest): Promise<SoilReportResponse> {
    if (req.farmId) {
      const [farm] = await db
        .select()
        .from(farms)
        .where(and(eq(farms.id, req.farmId), eq(farms.farmerId, farmerId)))
        .limit(1);
      if (!farm) {
        throw new ForbiddenError(`Farm ${req.farmId} does not belong to the authenticated farmer.`);
      }
    }

    const ratings: Record<string, string> = {};
    const recommendations: Array<{ crop: string; fertilizer: string; dosageKgPerAcre: string; note: string }> = [];

    if (typeof req.ph === 'number') {
      ratings.ph = req.ph < 6.0 ? 'ACIDIC' : req.ph > 8.0 ? 'ALKALINE' : 'OPTIMAL';
      if (req.ph < 6.0) {
        recommendations.push({
          crop: 'General Field Crops',
          fertilizer: 'Agricultural Lime',
          dosageKgPerAcre: '200 kg/acre',
          note: 'Soil pH is acidic; apply lime prior to sowing to improve nutrient uptake.',
        });
      } else if (req.ph > 8.2) {
        recommendations.push({
          crop: 'General Field Crops',
          fertilizer: 'Gypsum',
          dosageKgPerAcre: '250 kg/acre',
          note: 'Soil pH is alkaline; gypsum and organic matter help buffer root-zone pH.',
        });
      }
    }

    if (typeof req.organicCarbon === 'number') {
      ratings.organicCarbon = req.organicCarbon < 0.5 ? 'LOW' : req.organicCarbon > 0.75 ? 'HIGH' : 'MEDIUM';
    }
    if (typeof req.nitrogen === 'number') {
      ratings.nitrogen = req.nitrogen < 280 ? 'LOW' : req.nitrogen > 560 ? 'HIGH' : 'MEDIUM';
      if (req.nitrogen < 280) {
        recommendations.push({
          crop: 'Paddy / Maize / Cotton',
          fertilizer: 'Urea (46% N)',
          dosageKgPerAcre: '45 kg/acre',
          note: 'Nitrogen is low; apply in 2-3 split doses aligned with irrigation.',
        });
      }
    }
    if (typeof req.phosphorus === 'number') {
      ratings.phosphorus = req.phosphorus < 11 ? 'LOW' : req.phosphorus > 25 ? 'HIGH' : 'MEDIUM';
      if (req.phosphorus < 11) {
        recommendations.push({
          crop: 'Pulses / Cereals',
          fertilizer: 'DAP (18-46-0) or SSP',
          dosageKgPerAcre: '30 kg/acre',
          note: 'Phosphorus is low; incorporate as basal dose near root zone.',
        });
      }
    }
    if (typeof req.potassium === 'number') {
      ratings.potassium = req.potassium < 110 ? 'LOW' : req.potassium > 280 ? 'HIGH' : 'MEDIUM';
      if (req.potassium < 110) {
        recommendations.push({
          crop: 'Horticulture / Paddy',
          fertilizer: 'Muriate of Potash (MOP)',
          dosageKgPerAcre: '20 kg/acre',
          note: 'Potassium is low; improves grain filling and drought tolerance.',
        });
      }
    }
    if (typeof req.zinc === 'number') {
      ratings.zinc = req.zinc < 0.6 ? 'DEFICIENT' : 'SUFFICIENT';
      if (req.zinc < 0.6) {
        recommendations.push({
          crop: 'Paddy / Wheat',
          fertilizer: 'Zinc Sulphate (21%)',
          dosageKgPerAcre: '10 kg/acre',
          note: 'Zinc deficiency detected; apply Zinc Sulphate as soil basal application.',
        });
      }
    }

    const reportId = req.cardId?.trim() || `FARMER-LAB-${Date.now()}`;
    const [inserted] = await db
      .insert(soilReports)
      .values({
        farmerId,
        farmId: req.farmId || null,
        fieldId: req.fieldId || null,
        cardId: req.cardId?.trim() || null,
        reportId,
        source: 'farmer_submitted',
        sourceAuthority: 'Farmer-Submitted Laboratory Report',
        testingDate: req.testingDate ? new Date(req.testingDate) : new Date(),
        reportDate: new Date(),
        state: req.state || null,
        district: req.district || null,
        village: req.village || null,
        soilType: req.soilType || null,
        ph: req.ph !== undefined ? req.ph.toString() : null,
        ec: req.ec !== undefined ? req.ec.toString() : null,
        organicCarbon: req.organicCarbon !== undefined ? req.organicCarbon.toString() : null,
        nitrogen: req.nitrogen !== undefined ? req.nitrogen.toString() : null,
        phosphorus: req.phosphorus !== undefined ? req.phosphorus.toString() : null,
        potassium: req.potassium !== undefined ? req.potassium.toString() : null,
        sulphur: req.sulphur !== undefined ? req.sulphur.toString() : null,
        zinc: req.zinc !== undefined ? req.zinc.toString() : null,
        iron: req.iron !== undefined ? req.iron.toString() : null,
        boron: req.boron !== undefined ? req.boron.toString() : null,
        nutrientRatings: ratings,
        recommendations,
        status: 'available',
        isDemo: 'false',
      })
      .returning();

    return this.formatReport(inserted);
  }
}
