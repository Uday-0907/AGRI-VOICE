import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { FastifyInstance } from 'fastify';
import * as ownership from '../../../src/common/auth/ownership.js';
import { SoilReportService } from '../../../src/modules/soil/services/soil-report.service.js';
import { InputVerificationService } from '../../../src/modules/soil/services/input-verification.service.js';
import { NotFoundError, ForbiddenError } from '../../../src/common/errors/index.js';

describe('Pillar 6: Cross-Farmer Ownership & Authorization Security', () => {
  let app: FastifyInstance;
  let farmerAToken: string;
  let farmerBToken: string;

  const farmerA = {
    id: 'fa000000-0000-0000-0000-000000000001',
    userId: 'ua000000-0000-0000-0000-000000000001',
    fullName: 'Farmer A (Ramesh)',
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

  const farmerB = {
    id: 'fb000000-0000-0000-0000-000000000002',
    userId: 'ub000000-0000-0000-0000-000000000002',
    fullName: 'Farmer B (Suresh)',
    state: 'Telangana',
    district: 'Warangal',
    mandal: 'Hanamkonda',
    village: 'Madikonda',
    pinCode: '506001',
    preferredLanguage: 'te',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    farmerAToken = app.jwt.sign({ id: farmerA.userId, phone: '+919876543210' });
    farmerBToken = app.jwt.sign({ id: farmerB.userId, phone: '+919876543211' });

    // Mock assertFarmerContext based on requesting userId
    vi.spyOn(ownership, 'assertFarmerContext').mockImplementation(async (userId: string) => {
      if (userId === farmerA.userId) return farmerA;
      if (userId === farmerB.userId) return farmerB;
      throw new ForbiddenError('Authenticated user does not have an active farmer profile');
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should deny Farmer A from retrieving Farmer B report (404/Access Denied)', async () => {
    const reportBId = '00000000-0000-0000-0000-000000000002';

    // Mock service enforcing farmerId check
    vi.spyOn(SoilReportService.prototype, 'getReportById').mockImplementation(async (farmerId, reportId) => {
      if (farmerId === farmerB.id && reportId === reportBId) {
        return { id: reportBId, farmerId: farmerB.id } as any;
      }
      throw new NotFoundError(`Soil report ${reportId} not found or access denied.`);
    });

    const res = await app.inject({
      method: 'GET',
      url: `/soil/reports/${reportBId}`,
      headers: { authorization: `Bearer ${farmerAToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should deny Farmer A from refreshing Farmer B report', async () => {
    const reportBId = '00000000-0000-0000-0000-000000000002';

    vi.spyOn(SoilReportService.prototype, 'refreshReport').mockImplementation(async (farmerId, reportId) => {
      if (farmerId !== farmerB.id) {
        throw new NotFoundError(`Soil report ${reportId} not found or access denied.`);
      }
      return { id: reportBId } as any;
    });

    const res = await app.inject({
      method: 'POST',
      url: `/soil/reports/${reportBId}/refresh`,
      headers: { authorization: `Bearer ${farmerAToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should deny Farmer A from viewing Farmer B input verification records', async () => {
    const verifBId = '00000000-0000-0000-0000-000000000002';

    vi.spyOn(InputVerificationService.prototype, 'getVerificationById').mockImplementation(async (farmerId, verifId) => {
      if (farmerId !== farmerB.id) {
        throw new NotFoundError(`Input verification record ${verifId} not found or access denied.`);
      }
      return { id: verifBId } as any;
    });

    const res = await app.inject({
      method: 'GET',
      url: `/soil/inputs/verifications/${verifBId}`,
      headers: { authorization: `Bearer ${farmerAToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should reject card lookup with Farm owned by another farmer (403 Forbidden)', async () => {
    const farmBOwnedId = '00000000-0000-0000-0000-000000000002';

    vi.spyOn(SoilReportService.prototype, 'lookupAndSaveCard').mockImplementation(async (farmerId, req) => {
      if (req.farmId === farmBOwnedId && farmerId === farmerA.id) {
        throw new ForbiddenError(`Farm ${req.farmId} does not belong to the authenticated farmer.`);
      }
      return {} as any;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/soil/lookup',
      headers: { authorization: `Bearer ${farmerAToken}` },
      payload: {
        cardId: 'SHC-123',
        farmId: farmBOwnedId,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should reject card lookup with field belonging to another farm of the same farmer (403 Forbidden)', async () => {
    const farm1Id = '00000000-0000-0000-0000-000000000001';
    const fieldFromFarm2Id = '00000000-0000-0000-0000-000000000002';

    vi.spyOn(SoilReportService.prototype, 'lookupAndSaveCard').mockImplementation(async (farmerId, req) => {
      if (req.farmId === farm1Id && req.fieldId === fieldFromFarm2Id) {
        throw new ForbiddenError(`Field ${req.fieldId} does not belong to farm ${req.farmId} owned by the authenticated farmer.`);
      }
      return {} as any;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/soil/lookup',
      headers: { authorization: `Bearer ${farmerAToken}` },
      payload: {
        cardId: 'SHC-123',
        farmId: farm1Id,
        fieldId: fieldFromFarm2Id,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should reject card lookup with field belonging to another farmer (403 Forbidden)', async () => {
    const fieldBOwnedId = '00000000-0000-0000-0000-000000000003';

    vi.spyOn(SoilReportService.prototype, 'lookupAndSaveCard').mockImplementation(async (farmerId, req) => {
      if (req.fieldId === fieldBOwnedId && farmerId === farmerA.id) {
        throw new ForbiddenError(`Field ${req.fieldId} does not belong to a farm owned by the authenticated farmer.`);
      }
      return {} as any;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/soil/lookup',
      headers: { authorization: `Bearer ${farmerAToken}` },
      payload: {
        cardId: 'SHC-123',
        fieldId: fieldBOwnedId,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('should fail closed when user has no active farmer profile (403 Forbidden)', async () => {
    const unprofiledToken = app.jwt.sign({ id: 'user-without-profile-id', phone: '+919999999999' });

    const res = await app.inject({
      method: 'GET',
      url: '/soil/dashboard',
      headers: { authorization: `Bearer ${unprofiledToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
