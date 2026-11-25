import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { db } from '../../../src/database/db.js';
import {
  users,
  farmerProfiles,
  farms,
  soilReports,
  marketPriceObservations,
  buyerListings,
  machineryListings,
  machineryBookings,
  schemeApplications,
  farmerFieldQueries,
} from '../../../src/database/schema/index.js';
import { eq, inArray } from 'drizzle-orm';

describe('All-Pillars Integration & Persistence Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const userAId = 'd1000000-0000-0000-0000-000000000001';
  const userBId = 'd2000000-0000-0000-0000-000000000002';
  const farmerAId = 'e1000000-0000-0000-0000-000000000001';
  const farmerBId = 'e2000000-0000-0000-0000-000000000002';
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    await db
      .insert(users)
      .values([
        { id: userAId, phone: '+919999900001', status: 'active' },
        { id: userBId, phone: '+919999900002', status: 'active' },
      ])
      .onConflictDoNothing();

    await db
      .insert(farmerProfiles)
      .values([
        {
          id: farmerAId,
          userId: userAId,
          fullName: 'Test Farmer A',
          preferredLanguage: 'en',
          state: 'Andhra Pradesh',
          district: 'Guntur',
          mandal: 'Tenali',
          village: 'Kollipara',
          pinCode: '522201',
        },
        {
          id: farmerBId,
          userId: userBId,
          fullName: 'Test Farmer B',
          preferredLanguage: 'en',
          state: 'Telangana',
          district: 'Nalgonda',
          mandal: 'Miryalaguda',
          village: 'Vemulapally',
          pinCode: '508207',
        },
      ])
      .onConflictDoNothing();

    tokenA = app.jwt.sign({ id: userAId, phone: '+919999900001' });
    tokenB = app.jwt.sign({ id: userBId, phone: '+919999900002' });
  });

  afterAll(async () => {
    const fIds = [farmerAId, farmerBId];
    await db.delete(farmerFieldQueries).where(inArray(farmerFieldQueries.farmerId, fIds));
    await db.delete(schemeApplications).where(inArray(schemeApplications.farmerId, fIds));
    await db.delete(machineryBookings).where(inArray(machineryBookings.renterFarmerId, fIds));
    await db.delete(machineryListings).where(inArray(machineryListings.ownerFarmerId, fIds));
    await db.delete(buyerListings).where(inArray(buyerListings.farmerId, fIds));
    await db.delete(marketPriceObservations).where(inArray(marketPriceObservations.reportedByFarmerId, fIds));
    await db.delete(soilReports).where(inArray(soilReports.farmerId, fIds));
    await db.delete(farms).where(inArray(farms.farmerId, fIds));
    await db.delete(farmerProfiles).where(inArray(farmerProfiles.id, fIds));
    await db.delete(users).where(inArray(users.id, [userAId, userBId]));
    await app.close();
  });

  it('rejects unauthenticated requests across all new pillar endpoints with 401', async () => {
    const paths = ['/farmers/me', '/markets/prices', '/machinery/listings', '/institutions/schemes', '/research/bulletins'];
    for (const url of paths) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(401);
    }
  });

  it('persists farmer-submitted soil test report with ICAR ratings and recommendations', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/soil/reports',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        cardId: 'LAB-TEST-01',
        soilType: 'Black Cotton',
        ph: 7.4,
        nitrogen: 180,
        phosphorus: 9,
        potassium: 220,
        zinc: 0.4,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.source).toBe('farmer_submitted');
    expect(body.data.nutrientRatings.nitrogen).toBe('LOW');
    expect(body.data.nutrientRatings.zinc).toBe('DEFICIENT');
    expect(Array.isArray(body.data.recommendations)).toBe(true);
    expect(body.data.recommendations.length).toBeGreaterThanOrEqual(2);
  });

  it('persists markets prices, sell listings, and enforces cross-farmer ownership', async () => {
    const priceRes = await app.inject({
      method: 'POST',
      url: '/markets/prices',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        commodity: 'Paddy',
        state: 'Andhra Pradesh',
        district: 'Guntur',
        marketName: 'Tenali APMC',
        minPriceInr: 2100,
        maxPriceInr: 2300,
        modalPriceInr: 2200,
      },
    });
    expect(priceRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'POST',
      url: '/markets/listings',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        cropName: 'Paddy MTU-1010',
        quantityQuintals: 25,
        expectedPriceInr: 2250,
        district: 'Guntur',
        state: 'Andhra Pradesh',
      },
    });
    expect(listRes.statusCode).toBe(201);
    const listingId = listRes.json().data.id;

    // Cross-farmer modification must fail with 404
    const crossPatch = await app.inject({
      method: 'PATCH',
      url: `/markets/listings/${listingId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { status: 'closed' },
    });
    expect(crossPatch.statusCode).toBe(404);
  });

  it('persists machinery listings and validates booking dates', async () => {
    const mRes = await app.inject({
      method: 'POST',
      url: '/machinery/listings',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        equipmentName: 'John Deere 5050D',
        category: 'tractor',
        hourlyRateInr: 900,
        district: 'Guntur',
        state: 'Andhra Pradesh',
      },
    });
    expect(mRes.statusCode).toBe(201);
    const listingId = mRes.json().data.id;

    const badBook = await app.inject({
      method: 'POST',
      url: '/machinery/bookings',
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        listingId,
        startDate: '2026-12-10T10:00:00Z',
        endDate: '2026-12-09T10:00:00Z',
      },
    });
    expect(badBook.statusCode).toBe(400);

    const goodBook = await app.inject({
      method: 'POST',
      url: '/machinery/bookings',
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: {
        listingId,
        startDate: '2026-12-10T10:00:00Z',
        endDate: '2026-12-11T10:00:00Z',
      },
    });
    expect(goodBook.statusCode).toBe(201);
  });

  it('returns public-reference schemes and ICAR/KVK bulletins and persists applications/queries', async () => {
    const schemesRes = await app.inject({
      method: 'GET',
      url: '/institutions/schemes',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(schemesRes.statusCode).toBe(200);
    expect(schemesRes.json().data.length).toBeGreaterThanOrEqual(4);

    const appRes = await app.inject({
      method: 'POST',
      url: '/institutions/applications',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        schemeCode: 'PM-KISAN',
        schemeTitle: 'PM-KISAN',
        category: 'subsidy',
      },
    });
    expect(appRes.statusCode).toBe(201);

    const bulRes = await app.inject({
      method: 'GET',
      url: '/research/bulletins?crop=Paddy',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(bulRes.statusCode).toBe(200);
    expect(bulRes.json().data.length).toBeGreaterThanOrEqual(1);

    const qryRes = await app.inject({
      method: 'POST',
      url: '/research/queries',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: {
        crop: 'Paddy',
        topic: 'Nitrogen split dose',
        questionText: 'When should I apply second urea split in MTU-1010?',
      },
    });
    expect(qryRes.statusCode).toBe(201);
  });
});
