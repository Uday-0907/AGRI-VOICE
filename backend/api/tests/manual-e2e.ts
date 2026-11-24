import { buildApp } from '../src/app.js';
import { db, pool } from '../src/database/db.js';
import {
  users,
  farmerProfiles,
  farms,
  fields,
  soilReports,
  inputVerifications
} from '../src/database/schema/index.js';
import { voiceDispatcher } from '../src/modules/voice/dispatcher.js';
import { eq, or } from 'drizzle-orm';

async function runManualE2E() {
  console.log('================================================================');
  console.log('AGRIVOICE PILLAR 6 — MANUAL END-TO-END VERIFICATION SUITE');
  console.log('================================================================');

  const app = await buildApp();
  await app.ready();
  console.log('[Setup] Fastify application initialized and ready.');

  // Test Farmers data
  const userAId = 'a0000000-0000-0000-0000-000000000001';
  const farmerAProfileId = 'a1111111-1111-1111-1111-111111111111';
  const farmAId = 'af000000-0000-0000-0000-000000000001';
  const fieldAId = 'af111111-1111-1111-1111-111111111111';

  const userBId = 'b0000000-0000-0000-0000-000000000002';
  const farmerBProfileId = 'b1111111-1111-1111-1111-111111111111';
  const farmBId = 'bf000000-0000-0000-0000-000000000002';
  const fieldBId = 'bf111111-1111-1111-1111-111111111112';

  try {
    // 0. Seed Test Users and Farmers in Real PostgreSQL
    console.log('[Setup] Seeding test accounts into PostgreSQL...');
    await db.delete(soilReports).where(or(eq(soilReports.farmerId, farmerAProfileId), eq(soilReports.farmerId, farmerBProfileId)));
    await db.delete(inputVerifications).where(or(eq(inputVerifications.farmerId, farmerAProfileId), eq(inputVerifications.farmerId, farmerBProfileId)));
    await db.delete(fields).where(or(eq(fields.id, fieldAId), eq(fields.id, fieldBId)));
    await db.delete(farms).where(or(eq(farms.id, farmAId), eq(farms.id, farmBId)));
    await db.delete(farmerProfiles).where(or(eq(farmerProfiles.id, farmerAProfileId), eq(farmerProfiles.id, farmerBProfileId)));
    await db.delete(users).where(or(eq(users.id, userAId), eq(users.id, userBId)));

    // Insert User A and B
    await db.insert(users).values([
      { id: userAId, phone: '+919876543201', status: 'active' },
      { id: userBId, phone: '+919876543202', status: 'active' },
    ]);

    // Insert Farmer Profiles
    await db.insert(farmerProfiles).values([
      {
        id: farmerAProfileId,
        userId: userAId,
        fullName: 'Farmer Ramesh (Test A)',
        preferredLanguage: 'te',
        state: 'Andhra Pradesh',
        district: 'Guntur',
        mandal: 'Tenali',
        village: 'Kollipara',
        pinCode: '522201',
      },
      {
        id: farmerBProfileId,
        userId: userBId,
        fullName: 'Farmer Suresh (Test B)',
        preferredLanguage: 'te',
        state: 'Telangana',
        district: 'Warangal',
        mandal: 'Hanamkonda',
        village: 'Madikonda',
        pinCode: '506001',
      },
    ]);

    // Insert Farms
    await db.insert(farms).values([
      { id: farmAId, farmerId: farmerAProfileId, farmName: 'Ramesh Farm A', ownershipType: 'owned' },
      { id: farmBId, farmerId: farmerBProfileId, farmName: 'Suresh Farm B', ownershipType: 'owned' },
    ]);

    // Insert Fields
    await db.insert(fields).values([
      { id: fieldAId, farmId: farmAId, fieldName: 'Ramesh North Plot' },
      { id: fieldBId, farmId: farmBId, fieldName: 'Suresh South Plot' },
    ]);

    console.log('[Setup] Test accounts seeded successfully.');

    // Generate JWT Tokens
    const tokenA = app.jwt.sign({ id: userAId, phone: '+919876543201' });
    const tokenB = app.jwt.sign({ id: userBId, phone: '+919876543202' });

    // ========================================================================
    // MANUAL TEST A — Soil Health Workflow
    // ========================================================================
    console.log('\n--- MANUAL TEST A: Soil Health Workflow ---');

    // 1. Get Dashboard before any report exists (Expect empty state)
    const dash1 = await app.inject({
      method: 'GET',
      url: '/soil/dashboard',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('1. GET /soil/dashboard (Initial): HTTP', dash1.statusCode);
    const dash1Body = JSON.parse(dash1.body);
    if (dash1.statusCode !== 200 || dash1Body.data.hasReport !== false) throw new Error('Initial dashboard failed');

    // 2. Perform Soil Health Card lookup (Demo Mode)
    const lookup1 = await app.inject({
      method: 'POST',
      url: '/soil/lookup',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        cardId: 'SHC-AP-GNT-2026',
        farmId: farmAId,
        fieldId: fieldAId,
        providerMode: 'demo',
      },
    });
    console.log('2. POST /soil/lookup (Valid): HTTP', lookup1.statusCode);
    const lookup1Body = JSON.parse(lookup1.body);
    if (lookup1.statusCode !== 201 || !lookup1Body.data.id) throw new Error('Lookup failed');
    const createdReportId = lookup1Body.data.id;
    console.log('   -> Created Report ID:', createdReportId, '| pH:', lookup1Body.data.ph, '| N:', lookup1Body.data.nitrogen, 'kg/ha');

    // 3. Verify in PostgreSQL
    const [dbReport] = await db.select().from(soilReports).where(eq(soilReports.id, createdReportId));
    if (!dbReport || dbReport.farmerId !== farmerAProfileId) throw new Error('DB persistence verification failed');
    console.log('3. DB Verification: Found soil report in PostgreSQL, farmerId matches Farmer A.');

    // 4. Retrieve by ID
    const getReport = await app.inject({
      method: 'GET',
      url: `/soil/reports/${createdReportId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('4. GET /soil/reports/:id: HTTP', getReport.statusCode);
    if (getReport.statusCode !== 200) throw new Error('Get report by ID failed');

    // 5. Retrieve Reports List
    const listReports = await app.inject({
      method: 'GET',
      url: `/soil/reports?farmId=${farmAId}&limit=10`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('5. GET /soil/reports: HTTP', listReports.statusCode, '| Total count:', JSON.parse(listReports.body).meta.pagination.total);

    // 6. Refresh Report
    const refreshRes = await app.inject({
      method: 'POST',
      url: `/soil/reports/${createdReportId}/refresh`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('6. POST /soil/reports/:id/refresh: HTTP', refreshRes.statusCode);
    if (refreshRes.statusCode !== 200) throw new Error('Report refresh failed');

    // 7. Verify History Preserved (Expect 2 reports in DB for Farmer A)
    const farmerAReports = await db.select().from(soilReports).where(eq(soilReports.farmerId, farmerAProfileId));
    console.log('7. History Preserved: Farmer A now has', farmerAReports.length, 'records (versions preserved).');
    if (farmerAReports.length < 2) throw new Error('History preservation failed');

    // 8. Test Invalid Field/Farm association (Cross-farmer farm ID)
    const badLookup = await app.inject({
      method: 'POST',
      url: '/soil/lookup',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        cardId: 'SHC-AP-GNT-2026',
        farmId: farmBId, // Farm owned by Farmer B!
        providerMode: 'demo',
      },
    });
    console.log('8. POST /soil/lookup with Farm B ID: HTTP', badLookup.statusCode, '(Expected 403 Forbidden)');
    if (badLookup.statusCode !== 403) throw new Error('Cross-farmer farm association was not rejected');

    // ========================================================================
    // MANUAL TEST B — Agricultural Input Verification Workflow
    // ========================================================================
    console.log('\n--- MANUAL TEST B: Input Verification Workflow ---');

    // 1. Submit input verification (Certified Seed)
    const verifySeed = await app.inject({
      method: 'POST',
      url: '/soil/inputs/verify',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        productName: 'Cotton Hybrid Seed Jaadoo BG-II',
        category: 'seed',
        batchNumber: 'KAVERI-JAADOO-SEED',
        providerMode: 'demo',
      },
    });
    console.log('1. POST /soil/inputs/verify (Certified Seed): HTTP', verifySeed.statusCode);
    const verifySeedBody = JSON.parse(verifySeed.body);
    console.log('   -> Status:', verifySeedBody.data.verificationStatus, '| Provider:', verifySeedBody.data.provider);
    if (verifySeed.statusCode !== 201 || verifySeedBody.data.verificationStatus !== 'verified') throw new Error('Seed verification failed');
    const verificationId = verifySeedBody.data.id;

    // 2. Submit Vigilance Recall Alert Test Sample
    const verifyAlert = await app.inject({
      method: 'POST',
      url: '/soil/inputs/verify',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        productName: 'Suspected Chlorpyrifos',
        category: 'pesticide',
        batchNumber: 'ALERT-RECALL-FAKE',
        providerMode: 'demo',
      },
    });
    console.log('2. POST /soil/inputs/verify (Recall Alert Sample): HTTP', verifyAlert.statusCode);
    const verifyAlertBody = JSON.parse(verifyAlert.body);
    console.log('   -> Status:', verifyAlertBody.data.verificationStatus, '| Notice:', verifyAlertBody.data.notes);
    if (verifyAlert.statusCode !== 201 || verifyAlertBody.data.verificationStatus !== 'recall_alert') throw new Error('Recall alert mapping failed');

    // 3. List Verifications
    const listVerif = await app.inject({
      method: 'GET',
      url: '/soil/inputs/verifications',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('3. GET /soil/inputs/verifications: HTTP', listVerif.statusCode, '| Count:', JSON.parse(listVerif.body).meta.pagination.total);

    // 4. Get by ID
    const getVerif = await app.inject({
      method: 'GET',
      url: `/soil/inputs/verifications/${verificationId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    console.log('4. GET /soil/inputs/verifications/:id: HTTP', getVerif.statusCode);
    if (getVerif.statusCode !== 200) throw new Error('Get verification by ID failed');

    // ========================================================================
    // MANUAL TEST C — Security & Cross-Farmer Data Isolation
    // ========================================================================
    console.log('\n--- MANUAL TEST C: Cross-Farmer Security & IDOR Isolation ---');

    // 1. Farmer B attempts to access Farmer A's Soil Report
    const idorReport = await app.inject({
      method: 'GET',
      url: `/soil/reports/${createdReportId}`,
      headers: { authorization: `Bearer ${tokenB}` }, // Farmer B!
    });
    console.log('1. Farmer B -> GET /soil/reports/:id of Farmer A: HTTP', idorReport.statusCode, '(Expected 404 Not Found)');
    if (idorReport.statusCode !== 404) throw new Error('IDOR on soil report was not blocked');

    // 2. Farmer B attempts to refresh Farmer A's Soil Report
    const idorRefresh = await app.inject({
      method: 'POST',
      url: `/soil/reports/${createdReportId}/refresh`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    console.log('2. Farmer B -> POST /soil/reports/:id/refresh of Farmer A: HTTP', idorRefresh.statusCode, '(Expected 404 Not Found)');
    if (idorRefresh.statusCode !== 404) throw new Error('IDOR on refresh was not blocked');

    // 3. Farmer B attempts to view Farmer A's Input Verification record
    const idorVerif = await app.inject({
      method: 'GET',
      url: `/soil/inputs/verifications/${verificationId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    console.log('3. Farmer B -> GET /soil/inputs/verifications/:id of Farmer A: HTTP', idorVerif.statusCode, '(Expected 404 Not Found)');
    if (idorVerif.statusCode !== 404) throw new Error('IDOR on input verification was not blocked');

    // 4. Unauthenticated request to /soil/dashboard
    const unauth = await app.inject({
      method: 'GET',
      url: '/soil/dashboard',
    });
    console.log('4. Unauthenticated -> GET /soil/dashboard: HTTP', unauth.statusCode, '(Expected 401 Unauthorized)');
    if (unauth.statusCode !== 401) throw new Error('Unauthenticated access was not rejected');

    // ========================================================================
    // MANUAL TEST D — Voice AI Orchestration & Dispatcher Integration
    // ========================================================================
    console.log('\n--- MANUAL TEST D: Voice AI Dispatcher & Anti-Hallucination ---');

    // 1. Check tools registration in voiceDispatcher
    const voiceTools = voiceDispatcher.getTools();
    console.log('1. Registered Voice Dispatcher Tools Count:', voiceTools.length);
    console.log('   Tools:', voiceTools.map((t) => t.name).join(', '));
    if (!voiceDispatcher.hasTool('get_farmer_soil_health_context') || !voiceDispatcher.hasTool('verify_agricultural_input_product')) {
      throw new Error('Voice tools not registered in voiceDispatcher');
    }

    // 2. Dispatch get_farmer_soil_health_context for Farmer A
    const voiceRes = await voiceDispatcher.dispatch(
      { sessionId: 'voice-call-session-901', userId: userAId, phone: '+919876543201', language: 'te' },
      'get_farmer_soil_health_context',
      {}
    );
    console.log('2. Voice Dispatcher get_farmer_soil_health_context: Success =', voiceRes.success);
    console.log('   Farmer Name:', voiceRes.result.farmer.fullName, '| pH:', voiceRes.result.nutrients.ph);
    console.log('   AI Guidance Constraints:', voiceRes.result.aiGuidance);
    if (!voiceRes.success || !voiceRes.result.hasReport) throw new Error('Voice dispatcher execution failed');

    // 3. Dispatch verify_agricultural_input_product via Voice
    const voiceVerifRes = await voiceDispatcher.dispatch(
      { sessionId: 'voice-call-session-901', userId: userAId, phone: '+919876543201', language: 'te' },
      'verify_agricultural_input_product',
      {
        productName: 'Gromor Urea 46% N',
        category: 'fertilizer',
        batchNumber: 'CORO-UREA-2026',
      }
    );
    console.log('3. Voice Dispatcher verify_agricultural_input_product: Success =', voiceVerifRes.success);
    console.log('   Speech Findings Summary:', voiceRes.result ? voiceVerifRes.result.findingsSummary : 'none');
    if (!voiceVerifRes.success || !voiceVerifRes.result.isAuthentic) throw new Error('Voice input verification failed');

    // 4. Test Unauthenticated Caller Session in Voice Dispatcher
    const unauthVoice = await voiceDispatcher.dispatch(
      { sessionId: 'bad-session', userId: '', phone: '' },
      'get_farmer_soil_health_context',
      {}
    );
    console.log('4. Voice Dispatcher with empty userId: Success =', unauthVoice.success, '| Error Code:', unauthVoice.error?.code);
    if (unauthVoice.success !== false || unauthVoice.error?.code !== 'UNAUTHORIZED_CALLER_SESSION') {
      throw new Error('Voice dispatcher allowed unverified session');
    }

    // ========================================================================
    // MANUAL TEST E — Regression Verification
    // ========================================================================
    console.log('\n--- MANUAL TEST E: Regression & Root Endpoints ---');
    const health = await app.inject({ method: 'GET', url: '/health' });
    console.log('1. GET /health: HTTP', health.statusCode, '| Status:', JSON.parse(health.body).status);
    if (health.statusCode !== 200) throw new Error('Root health check failed');

    console.log('\n================================================================');
    console.log('ALL MANUAL END-TO-END TESTS PASSED SUCCESSFULLY! (100% VERIFIED)');
    console.log('================================================================');
  } finally {
    // Clean up seeded test records safely
    console.log('[Cleanup] Cleaning up temporary test records...');
    await db.delete(soilReports).where(or(eq(soilReports.farmerId, farmerAProfileId), eq(soilReports.farmerId, farmerBProfileId)));
    await db.delete(inputVerifications).where(or(eq(inputVerifications.farmerId, farmerAProfileId), eq(inputVerifications.farmerId, farmerBProfileId)));
    await db.delete(fields).where(or(eq(fields.id, fieldAId), eq(fields.id, fieldBId)));
    await db.delete(farms).where(or(eq(farms.id, farmAId), eq(farms.id, farmBId)));
    await db.delete(farmerProfiles).where(or(eq(farmerProfiles.id, farmerAProfileId), eq(farmerProfiles.id, farmerBProfileId)));
    await db.delete(users).where(or(eq(users.id, userAId), eq(users.id, userBId)));
    await app.close();
    console.log('[Cleanup] Cleanup complete. Database restored to pristine state.');
  }
}

runManualE2E().catch((err) => {
  console.error('[FATAL ERROR in Manual E2E]:', err);
  process.exit(1);
});
