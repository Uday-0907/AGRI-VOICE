import { SoilReportService } from './soil-report.service.js';
import { InputVerificationService } from './input-verification.service.js';
import { assertFarmerContext } from '../../../common/auth/ownership.js';
import {
  VoiceSoilContext,
  VoiceInputVerification,
  InputCategoryType
} from '../contracts.js';

export class SoilVoiceService {
  constructor(
    private soilReportService: SoilReportService = new SoilReportService(),
    private inputService: InputVerificationService = new InputVerificationService()
  ) {}

  /**
   * Retrieves structured, verified soil health context for the authenticated caller's session.
   * Bound securely to the verified farmer profile.
   */
  async getVoiceSoilContext(userId: string): Promise<VoiceSoilContext> {
    const profile = await assertFarmerContext(userId);
    const dashboard = await this.soilReportService.getDashboard(profile.id);
    const latest = dashboard.latestReport;

    if (!latest) {
      return {
        farmer: {
          farmerId: profile.id,
          fullName: profile.fullName,
          district: profile.district,
          state: profile.state,
        },
        hasReport: false,
        reportId: null,
        cardId: null,
        reportDate: null,
        dataFreshnessDays: null,
        sourceAuthority: null,
        isDemo: false,
        status: 'not_found',
        nutrients: {
          ph: null,
          ec: null,
          organicCarbonPercent: null,
          nitrogenKgPerHa: null,
          phosphorusKgPerHa: null,
          potassiumKgPerHa: null,
          zincPpm: null,
          ironPpm: null,
        },
        missingMeasurements: ['all'],
        sourceRecommendations: [],
        aiGuidance: 'No Soil Health Card is on file for this farmer. Inform the farmer that no test records exist and offer to initiate a card lookup using their 12-digit Soil Health Card ID. Do not fabricate soil measurements.',
      };
    }

    // Compute data freshness
    const reportDate = new Date(latest.reportDate);
    const now = new Date();
    const dataFreshnessDays = Math.max(0, Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Track missing measurements
    const missing: string[] = [];
    if (latest.ph === null || latest.ph === undefined) missing.push('pH');
    if (latest.ec === null || latest.ec === undefined) missing.push('electrical_conductivity');
    if (latest.organicCarbon === null || latest.organicCarbon === undefined) missing.push('organic_carbon');
    if (latest.nitrogen === null || latest.nitrogen === undefined) missing.push('nitrogen');
    if (latest.phosphorus === null || latest.phosphorus === undefined) missing.push('phosphorus');
    if (latest.potassium === null || latest.potassium === undefined) missing.push('potassium');
    if (latest.zinc === null || latest.zinc === undefined) missing.push('zinc');
    if (latest.iron === null || latest.iron === undefined) missing.push('iron');
    if (latest.boron === null || latest.boron === undefined) missing.push('boron');

    return {
      farmer: {
        farmerId: profile.id,
        fullName: profile.fullName,
        district: profile.district,
        state: profile.state,
      },
      hasReport: true,
      reportId: latest.reportId,
      cardId: latest.cardId || null,
      reportDate: latest.reportDate,
      dataFreshnessDays,
      sourceAuthority: latest.sourceAuthority || null,
      isDemo: latest.isDemo === 'true',
      status: latest.status,
      nutrients: {
        ph: latest.ph ?? null,
        ec: latest.ec ?? null,
        organicCarbonPercent: latest.organicCarbon ?? null,
        nitrogenKgPerHa: latest.nitrogen ?? null,
        phosphorusKgPerHa: latest.phosphorus ?? null,
        potassiumKgPerHa: latest.potassium ?? null,
        zincPpm: latest.zinc ?? null,
        ironPpm: latest.iron ?? null,
      },
      missingMeasurements: missing,
      sourceRecommendations: Array.isArray(latest.recommendations) ? latest.recommendations : [],
      aiGuidance: `Grounding Constraints: State only the verified readings listed in nutrients. The test report is ${dataFreshnessDays} days old. If a nutrient is in missingMeasurements (${missing.join(', ')}), state that it was not tested. Do not invent fertilizer doses.`,
    };
  }

  /**
   * Verifies an agricultural input for an authenticated voice session.
   */
  async verifyInputForVoice(
    userId: string,
    params: {
      productName: string;
      category: InputCategoryType;
      brand?: string;
      batchNumber?: string;
      providerMode?: 'auto' | 'official' | 'demo';
    }
  ): Promise<VoiceInputVerification> {
    const profile = await assertFarmerContext(userId);

    const result = await this.inputService.verifyAndSave(profile.id, {
      productName: params.productName,
      category: params.category,
      brand: params.brand,
      batchNumber: params.batchNumber,
      providerMode: params.providerMode,
    });

    const isAuthentic = result.verificationStatus === 'verified';
    let findingsSummary = '';

    switch (result.verificationStatus) {
      case 'verified':
        findingsSummary = `Product is officially registered and active under license ${result.registrationNumber || 'CIBRC-REG'}.`;
        break;
      case 'expired':
        findingsSummary = 'Product batch shelf-life has expired according to official registry records. Do not apply.';
        break;
      case 'recall_alert':
        findingsSummary = 'OFFICIAL WARNING: This batch has an active recall notice or quality alert from agricultural enforcement.';
        break;
      case 'not_found':
        findingsSummary = 'No official gazette record found for this batch/product. Advise checking the physical seal and contacting the Mandal Agriculture Officer.';
        break;
      case 'inconclusive':
        findingsSummary = 'Manufacturer registration was located, but batch quality test certificates are unconfirmed.';
        break;
      default:
        findingsSummary = `Verification returned status: ${result.verificationStatus}.`;
    }

    return {
      productName: result.productName,
      category: result.category,
      brand: result.brand || null,
      batchNumber: result.batchNumber || null,
      status: result.verificationStatus,
      provider: result.provider,
      isAuthentic,
      findingsSummary,
      aiGuidance: 'Explain the verification findings neutrally. Do not make unverified accusations if status is not_found or inconclusive. Clearly relay official warnings if recall_alert or expired.',
    };
  }
}
