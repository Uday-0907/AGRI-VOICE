import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { db } from '../../../src/database/db.js';
import {
  users,
  farmerProfiles,
  buyerProfiles,
  farms,
  buyerListings,
  purchaseRequests,
  buyerSavedListings,
  notifications,
  soilReports,
  inputVerifications,
  marketPriceObservations,
  machineryListings,
  machineryBookings,
  schemeApplications,
  farmerFieldQueries,
} from '../../../src/database/schema/index.js';
import { inArray, eq } from 'drizzle-orm';

describe('Role-Based Access Control (Farmer vs Buyer), Buyer Portal & Farmer-to-Buyer Flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const farmerUserId = 'a1000000-0000-0000-0000-000000000011';
  const buyerUserId = 'b1000000-0000-0000-0000-000000000022';
  const farmerId = 'f1000000-0000-0000-0000-000000000011';
  const buyerId = 'c1000000-0000-0000-0000-000000000022';
  let farmerToken: string;
  let buyerToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    await db
      .insert(users)
      .values([
        { id: farmerUserId, phone: '+919888800011', role: 'farmer', status: 'active' },
        { id: buyerUserId, phone: '+919888800022', role: 'buyer', status: 'active' },
      ])
      .onConflictDoNothing();

    await db
      .insert(farmerProfiles)
      .values({
        id: farmerId,
        userId: farmerUserId,
        fullName: 'RBAC Test Farmer',
        preferredLanguage: 'en',
        state: 'Andhra Pradesh',
        district: 'Guntur',
        mandal: 'Tenali',
        village: 'Kollipara',
        pinCode: '522201',
      })
      .onConflictDoNothing();

    await db
      .insert(buyerProfiles)
      .values({
        id: buyerId,
        userId: buyerUserId,
        businessName: 'Krishna Agro Traders',
        contactName: 'Suresh Babu',
        businessType: 'wholesaler',
        state: 'Andhra Pradesh',
        district: 'Krishna',
        city: 'Vijayawada',
        pinCode: '520001',
      })
      .onConflictDoNothing();

    farmerToken = app.jwt.sign({ id: farmerUserId, phone: '+919888800011', role: 'farmer' });
    buyerToken = app.jwt.sign({ id: buyerUserId, phone: '+919888800022', role: 'buyer' });
  });

  afterAll(async () => {
    await db.delete(notifications).where(inArray(notifications.userId, [farmerUserId, buyerUserId]));
    await db.delete(purchaseRequests).where(eq(purchaseRequests.buyerId, buyerId));
    await db.delete(buyerSavedListings).where(eq(buyerSavedListings.buyerId, buyerId));
    await db.delete(buyerListings).where(eq(buyerListings.farmerId, farmerId));
    await db.delete(marketPriceObservations).where(eq(marketPriceObservations.reportedByFarmerId, farmerId));
    await db.delete(farmerFieldQueries).where(eq(farmerFieldQueries.farmerId, farmerId));
    await db.delete(schemeApplications).where(eq(schemeApplications.farmerId, farmerId));
    await db.delete(machineryBookings).where(eq(machineryBookings.renterFarmerId, farmerId));
    await db.delete(machineryListings).where(eq(machineryListings.ownerFarmerId, farmerId));
    await db.delete(inputVerifications).where(eq(inputVerifications.farmerId, farmerId));
    await db.delete(soilReports).where(eq(soilReports.farmerId, farmerId));
    await db.delete(farms).where(eq(farms.farmerId, farmerId));
    await db.delete(buyerProfiles).where(eq(buyerProfiles.id, buyerId));
    await db.delete(farmerProfiles).where(eq(farmerProfiles.id, farmerId));
    await db.delete(users).where(inArray(users.id, [farmerUserId, buyerUserId]));
    await app.close();
  });

  it('blocks Buyer from accessing any Farmer-only endpoint (403 Forbidden)', async () => {
    const farmerOnlyEndpoints = [
      '/farmers/me',
      '/soil/dashboard',
      '/weather/dashboard',
      '/markets/listings',
      '/machinery/listings',
      '/institutions/schemes',
      '/research/bulletins',
    ];
    for (const url of farmerOnlyEndpoints) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it('blocks Farmer from accessing Buyer-only endpoints (403 Forbidden)', async () => {
    const buyerOnlyEndpoints = ['/buyer/dashboard', '/buyer/profile', '/buyer/listings', '/buyer/requests', '/buyer/orders'];
    for (const url of buyerOnlyEndpoints) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it('completes end-to-end Farmer-to-Buyer listing, purchase request, farmer accept, and notifications', async () => {
    // 1. Farmer publishes a produce listing
    const listRes = await app.inject({
      method: 'POST',
      url: '/markets/listings',
      headers: { Authorization: `Bearer ${farmerToken}` },
      payload: {
        cropName: 'Paddy BPT-5204',
        quantityQuintals: 40,
        expectedPriceInr: 2400,
        district: 'Guntur',
        state: 'Andhra Pradesh',
      },
    });
    expect(listRes.statusCode).toBe(201);
    const listingId = listRes.json().data.id;

    // 2. Buyer browses open produce & sees the listing
    const browseRes = await app.inject({
      method: 'GET',
      url: '/buyer/listings?crop=BPT',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    expect(browseRes.statusCode).toBe(200);
    expect(browseRes.json().data.some((l: any) => l.id === listingId)).toBe(true);

    // 3. Buyer sends a purchase request
    const reqRes = await app.inject({
      method: 'POST',
      url: '/buyer/requests',
      headers: { Authorization: `Bearer ${buyerToken}` },
      payload: {
        listingId,
        requestType: 'purchase_request',
        requestedQuantityQuintals: 20,
        offeredPriceInr: 2350,
        message: 'Can pick up from Guntur within 48 hours.',
      },
    });
    expect(reqRes.statusCode).toBe(201);
    const requestId = reqRes.json().data.id;

    // 4. Farmer sees the incoming request and accepts it
    const incomingRes = await app.inject({
      method: 'GET',
      url: '/markets/requests/incoming',
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    expect(incomingRes.statusCode).toBe(200);
    expect(incomingRes.json().data.some((r: any) => r.id === requestId)).toBe(true);

    const respondRes = await app.inject({
      method: 'PATCH',
      url: `/markets/requests/${requestId}/respond`,
      headers: { Authorization: `Bearer ${farmerToken}` },
      payload: {
        status: 'accepted',
        farmerResponse: 'Accepted. Please coordinate pickup.',
      },
    });
    expect(respondRes.statusCode).toBe(200);
    expect(respondRes.json().data.status).toBe('accepted');

    // 5. Buyer sees accepted order in /buyer/orders and receives notification
    const ordersRes = await app.inject({
      method: 'GET',
      url: '/buyer/orders',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    expect(ordersRes.statusCode).toBe(200);
    expect(ordersRes.json().data.some((o: any) => o.id === requestId)).toBe(true);

    const notifRes = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    expect(notifRes.statusCode).toBe(200);
    expect(notifRes.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it('initializes Farmer sample history idempotently without duplicating records', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/farmers/me/initialize-sample-history',
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.initialized).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: '/farmers/me/initialize-sample-history',
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().data.initialized).toBe(false);
    expect(second.json().data.alreadyPresent).toBe(true);
  });
});
