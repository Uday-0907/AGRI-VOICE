import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SoilVoiceService } from '../../../src/modules/soil/services/soil-voice.service.js';
import { SoilReportService } from '../../../src/modules/soil/services/soil-report.service.js';
import { InputVerificationService } from '../../../src/modules/soil/services/input-verification.service.js';
import * as ownership from '../../../src/common/auth/ownership.js';
import { ForbiddenError } from '../../../src/common/errors/index.js';

describe('SoilVoiceService — Phone & Voice AI Integration', () => {
  let soilReportService: SoilReportService;
  let inputService: InputVerificationService;
  let voiceService: SoilVoiceService;

  const mockFarmerProfile = {
    id: 'f0000000-0000-0000-0000-000000000001',
    userId: 'u0000000-0000-0000-0000-000000000001',
    fullName: 'Venkat Rao',
    state: 'Andhra Pradesh',
    district: 'Guntur',
    mandal: 'Tenali',
    village: 'Kollipara',
    pinCode: '522201',
    preferredLanguage: 'te',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    soilReportService = new SoilReportService();
    inputService = new InputVerificationService();
    voiceService = new SoilVoiceService(soilReportService, inputService);

    vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);
  });

  it('should return safe structured empty context with AI guidance when farmer has no soil reports', async () => {
    vi.spyOn(soilReportService, 'getDashboard').mockResolvedValue({
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
    });

    const result = await voiceService.getVoiceSoilContext('u0000000-0000-0000-0000-000000000001');

    expect(result.hasReport).toBe(false);
    expect(result.farmer.fullName).toBe('Venkat Rao');
    expect(result.missingMeasurements).toContain('all');
    expect(result.aiGuidance).toContain('No Soil Health Card is on file');
    expect(result.aiGuidance).toContain('Do not fabricate');
  });

  it('should return verified nutrient readings and anti-hallucination boundaries when report exists', async () => {
    const mockReport = {
      id: 'r0000000-0000-0000-0000-000000000001',
      farmerId: mockFarmerProfile.id,
      reportId: 'SHC-AP-2026-99',
      cardId: 'SHC-AP-2026-99',
      source: 'demo_mock_provider',
      sourceAuthority: 'AgriVoice Demo Soil Testing Laboratory',
      reportDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days old
      ph: 7.4,
      ec: 0.35,
      organicCarbon: 0.6,
      nitrogen: 210,
      phosphorus: 28,
      potassium: 310,
      zinc: null, // intentionally missing
      iron: null, // intentionally missing
      status: 'available' as const,
      isDemo: 'false',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recommendations: [{ crop: 'Paddy', fertilizer: 'Urea', dosageKgPerAcre: 40 }],
    };

    vi.spyOn(soilReportService, 'getDashboard').mockResolvedValue({
      hasReport: true,
      latestReport: mockReport as any,
      summary: {
        totalReports: 1,
        lastTestedDate: mockReport.reportDate,
        primarySoilType: 'black_cotton',
        overallStatus: 'available',
        availableNutrientCount: 6,
        criticalDeficiencies: [],
      },
      recentReports: [mockReport as any],
    });

    const result = await voiceService.getVoiceSoilContext('u0000000-0000-0000-0000-000000000001');

    expect(result.hasReport).toBe(true);
    expect(result.nutrients.ph).toBe(7.4);
    expect(result.nutrients.nitrogenKgPerHa).toBe(210);
    expect(result.dataFreshnessDays).toBeGreaterThanOrEqual(29);

    // Missing measurements explicitly listed so AI does not hallucinate them
    expect(result.missingMeasurements).toContain('zinc');
    expect(result.missingMeasurements).toContain('iron');
    expect(result.aiGuidance).toContain('Grounding Constraints');
    expect(result.aiGuidance).toContain('Do not invent fertilizer doses');
  });

  it('should verify agricultural inputs and provide neutral plain-text findings for phone calls', async () => {
    vi.spyOn(inputService, 'verifyAndSave').mockResolvedValue({
      id: 'v0000000-0000-0000-0000-000000000001',
      farmerId: mockFarmerProfile.id,
      productName: 'Gromor Urea',
      category: 'fertilizer',
      brand: 'Gromor',
      batchNumber: 'BATCH-123',
      registrationNumber: 'FCO-AP-2023',
      verificationStatus: 'verified',
      provider: 'demo_input_registry',
      createdAt: new Date().toISOString(),
    });

    const result = await voiceService.verifyInputForVoice('u0000000-0000-0000-0000-000000000001', {
      productName: 'Gromor Urea',
      category: 'fertilizer',
      batchNumber: 'BATCH-123',
    });

    expect(result.isAuthentic).toBe(true);
    expect(result.status).toBe('verified');
    expect(result.findingsSummary).toContain('officially registered and active');
    expect(result.aiGuidance).toContain('Do not make unverified accusations');
  });

  it('should fail closed when caller session has no active farmer profile', async () => {
    vi.spyOn(ownership, 'assertFarmerContext').mockRejectedValue(
      new ForbiddenError('Authenticated user does not have an active farmer profile')
    );

    await expect(voiceService.getVoiceSoilContext('anonymous-user-id')).rejects.toThrow(
      'Authenticated user does not have an active farmer profile'
    );
  });
});
