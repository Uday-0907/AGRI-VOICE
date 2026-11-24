import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { FastifyInstance } from 'fastify';
import * as ownership from '../../../src/common/auth/ownership.js';
import { SoilReportService } from '../../../src/modules/soil/services/soil-report.service.js';
import { InputVerificationService } from '../../../src/modules/soil/services/input-verification.service.js';

describe('Pillar 6: Soil Health & Input Verification HTTP APIs', () => {
  let app: FastifyInstance;
  let testToken: string;

  const mockFarmerProfile = {
    id: 'f0000000-0000-0000-0000-000000000001',
    userId: 'u0000000-0000-0000-0000-000000000001',
    fullName: 'Ramesh Reddy',
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

  const sampleReport = {
    id: 'f0000000-0000-0000-0000-000000000099',
    farmerId: mockFarmerProfile.id,
    reportId: 'SHC-AP-1001',
    cardId: 'SHC-AP-1001',
    source: 'demo_mock_provider',
    sourceAuthority: 'ANGRAU Research Station',
    reportDate: new Date().toISOString(),
    ph: 7.5,
    ec: 0.4,
    organicCarbon: 0.55,
    nitrogen: 190,
    phosphorus: 25,
    potassium: 320,
    zinc: 0.6,
    status: 'available' as const,
    isDemo: 'true',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleVerification = {
    id: 'v0000000-0000-0000-0000-000000000001',
    farmerId: mockFarmerProfile.id,
    productName: 'Gromor Urea 46% N',
    category: 'fertilizer',
    brand: 'Gromor',
    batchNumber: 'CORO-UREA-2026',
    registrationNumber: 'FCO-AP-2023-9941',
    verificationStatus: 'verified' as const,
    provider: 'demo_input_registry',
    evidence: { targetCrops: ['Paddy'] },
    notes: 'Certified Neem Coated Urea',
    createdAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Generate valid test JWT
    testToken = app.jwt.sign({
      id: mockFarmerProfile.userId,
      phone: '+919876543210',
    });

    // Mock farmer ownership resolution
    vi.spyOn(ownership, 'assertFarmerContext').mockResolvedValue(mockFarmerProfile);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated request to /soil/dashboard with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/soil/dashboard',
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject unauthenticated request to /soil/lookup with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/soil/lookup',
        payload: { cardId: 'SHC-123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject unauthenticated request to /soil/inputs/verify with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/soil/inputs/verify',
        payload: { productName: 'Urea', category: 'fertilizer' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Soil Health Endpoints (Authenticated)', () => {
    it('GET /soil/dashboard should return 200 with dashboard summary', async () => {
      vi.spyOn(SoilReportService.prototype, 'getDashboard').mockResolvedValueOnce({
        hasReport: true,
        latestReport: sampleReport as any,
        summary: {
          totalReports: 1,
          lastTestedDate: sampleReport.reportDate,
          primarySoilType: 'black_cotton',
          overallStatus: 'available',
          availableNutrientCount: 6,
          criticalDeficiencies: ['nitrogen'],
        },
        recentReports: [sampleReport as any],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/soil/dashboard',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.hasReport).toBe(true);
      expect(json.data.latestReport.cardId).toBe('SHC-AP-1001');
      expect(json.data.summary.totalReports).toBe(1);
    });

    it('POST /soil/lookup should validate schema and return 201 Created', async () => {
      vi.spyOn(SoilReportService.prototype, 'lookupAndSaveCard').mockResolvedValueOnce(sampleReport as any);

      const res = await app.inject({
        method: 'POST',
        url: '/soil/lookup',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          cardId: 'SHC-AP-1001',
          providerMode: 'demo',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.reportId).toBe('SHC-AP-1001');
      expect(json.data.ph).toBe(7.5);
    });

    it('POST /soil/lookup should reject invalid cardId (too short)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/soil/lookup',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          cardId: '1', // minLength is 3
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('GET /soil/reports should return paginated list', async () => {
      vi.spyOn(SoilReportService.prototype, 'listReports').mockResolvedValueOnce({
        data: [sampleReport as any],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/soil/reports?limit=10&offset=0',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta.pagination.total).toBe(1);
    });

    it('GET /soil/reports/:id should return single report', async () => {
      vi.spyOn(SoilReportService.prototype, 'getReportById').mockResolvedValueOnce(sampleReport as any);

      const res = await app.inject({
        method: 'GET',
        url: `/soil/reports/${sampleReport.id}`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.id).toBe(sampleReport.id);
    });

    it('POST /soil/reports/:id/refresh should refresh report successfully', async () => {
      vi.spyOn(SoilReportService.prototype, 'refreshReport').mockResolvedValueOnce(sampleReport as any);

      const res = await app.inject({
        method: 'POST',
        url: `/soil/reports/${sampleReport.id}/refresh`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.id).toBe(sampleReport.id);
    });
  });

  describe('Agricultural Input Verification Endpoints', () => {
    const sampleVerification = {
      id: 'v0000000-0000-0000-0000-000000000001',
      farmerId: mockFarmerProfile.id,
      productName: 'Gromor Urea 46% N',
      category: 'fertilizer',
      brand: 'Gromor',
      batchNumber: 'CORO-UREA-2026',
      registrationNumber: 'FCO-AP-2023-9941',
      verificationStatus: 'verified' as const,
      provider: 'demo_input_registry',
      evidence: { targetCrops: ['Paddy'] },
      notes: 'Certified Neem Coated Urea',
      createdAt: new Date().toISOString(),
    };

    it('POST /soil/inputs/verify should verify product and return 201 Created', async () => {
      vi.spyOn(InputVerificationService.prototype, 'verifyAndSave').mockResolvedValueOnce(sampleVerification);

      const res = await app.inject({
        method: 'POST',
        url: '/soil/inputs/verify',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          productName: 'Gromor Urea 46% N',
          category: 'fertilizer',
          batchNumber: 'CORO-UREA-2026',
          providerMode: 'demo',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.data.verificationStatus).toBe('verified');
      expect(json.data.provider).toBe('demo_input_registry');
    });

    it('GET /soil/inputs/verifications should return list with pagination meta', async () => {
      vi.spyOn(InputVerificationService.prototype, 'listVerifications').mockResolvedValueOnce({
        data: [sampleVerification],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/soil/inputs/verifications',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.length).toBe(1);
      expect(json.meta.pagination.total).toBe(1);
    });
  });

  describe('Voice AI Endpoints', () => {
    it('GET /soil/voice/context should return structured voice response', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/soil/voice/context',
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.farmer.fullName).toBe('Ramesh Reddy');
      expect(json.data.aiGuidance).toBeDefined();
    });

    it('POST /soil/voice/verify-input should verify and return plain-text guidance for speech', async () => {
      vi.spyOn(InputVerificationService.prototype, 'verifyAndSave').mockResolvedValueOnce(sampleVerification);

      const res = await app.inject({
        method: 'POST',
        url: '/soil/voice/verify-input',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          productName: 'Gromor Urea 46% N',
          category: 'fertilizer',
          batchNumber: 'CORO-UREA-2026',
          providerMode: 'demo',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.data.isAuthentic).toBe(true);
      expect(json.data.findingsSummary).toContain('registered and active');
    });
  });
});
