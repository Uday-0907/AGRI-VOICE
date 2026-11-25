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
      aiGuidance: latest.isDemo === 'true'
        ? `DEMONSTRATION NOTICE: This report is a synthetic reference sample for testing and development. Explicitly inform the caller that this is sample demonstration data and NOT an official government Soil Health Card. Grounding Constraints: State only the verified readings listed in nutrients. The test report date is ${latest.reportDate}. If a nutrient is in missingMeasurements (${missing.join(', ')}), state that it was not tested. Do not invent fertilizer doses.`
        : `Grounding Constraints: State only the verified readings listed in nutrients. The test report is ${dataFreshnessDays} days old. If a nutrient is in missingMeasurements (${missing.join(', ')}), state that it was not tested. Do not invent fertilizer doses.`,
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

    const isDemo = result.provider === 'demo_input_registry' || result.verificationStatus === 'demo';
    const isAuthentic = !isDemo && result.verificationStatus === 'verified';
    let findingsSummary = '';

    if (isDemo) {
      const scenario = result.evidence?.simulatedScenario;
      if (scenario === 'simulated_recall_alert') {
        findingsSummary = `DEMONSTRATION NOTICE: ${result.productName} is flagged for a simulated safety advisory test scenario in the demo catalog. This is synthetic test data only — not an official government recall.`;
      } else if (scenario === 'simulated_expired') {
        findingsSummary = `DEMONSTRATION NOTICE: ${result.productName} is marked with an expired shelf-life in the demo catalog. This is synthetic test data only — not an official regulatory determination.`;
      } else if (scenario === 'unregistered_sample') {
        findingsSummary = `DEMONSTRATION NOTICE: ${result.productName} was not found in the demo test catalog. This is a synthetic test query, not an official registry search.`;
      } else {
        findingsSummary = `DEMONSTRATION NOTICE: ${result.productName} was checked against our demonstration test database only. This is sample data for development and testing — not an official government verification or regulatory determination.`;
      }
    } else {
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
        case 'provider_unavailable':
          findingsSummary = 'The official agricultural input verification registry is currently unavailable. Please try again later.';
          break;
        default:
          findingsSummary = `Verification returned status: ${result.verificationStatus}.`;
      }
    }

    const aiGuidance = isDemo
      ? 'Grounding Constraints: This is demonstration sample data. Explicitly inform the caller that this is sample testing data and NOT an official government verification. Never make real-world certification or regulatory claims.'
      : 'Explain the verification findings neutrally. Do not make unverified accusations if status is not_found or inconclusive. Clearly relay official warnings if recall_alert or expired.';

    return {
      productName: result.productName,
      category: result.category,
      brand: result.brand || null,
      batchNumber: result.batchNumber || null,
      status: result.verificationStatus,
      provider: result.provider,
      isAuthentic,
      findingsSummary,
      aiGuidance,
    };
  }
}
