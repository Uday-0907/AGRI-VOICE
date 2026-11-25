/**
 * Independent Live HTTP Manual Verification Runner for Pillar 6
 *
 * Spawns a real Fastify HTTP server instance on port 4001 over TCP,
 * connects to real PostgreSQL (Docker container on port 5433),
 * issues genuine HTTP requests over TCP socket via native fetch / HTTP client,
 * and asserts strict adherence to:
 * 1. Demo safety invariants (never claiming official status for synthetic fixtures)
 * 2. Multi-tenant security (401 unauthenticated, 404 cross-farmer isolation)
 * 3. Farmer/farm/field ownership enforcement (403 forbidden for mismatched fields)
 * 4. Voice contextual guidance and disclaimers
 * 5. Clean teardown and zero zombie processes
 *
 * SAFEGUARDS:
 * 1. Aborts immediately if DATABASE_URL or POSTGRES_DB does not contain 'test'
 * 2. Requires explicit 'AGRIVOICE_ALLOW_DESTRUCTIVE_TESTS=true' to execute
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { db, pool } from '../src/database/db.js';
import {
  users,
  farmerProfiles,
  farms,
  fields,
  soilReports,
  inputVerifications
} from '../src/database/schema/index.js';
import { eq, or } from 'drizzle-orm';
import * as dotenvLib from 'dotenv';
import fastifyJwt from '@fastify/jwt';
import fastify from 'fastify';

const dotenv = dotenvLib.default || dotenvLib;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

// --- SAFEGUARD CHECK ---
const dbConfigStr = (process.env.DATABASE_URL || '').toLowerCase() + (process.env.POSTGRES_DB || '').toLowerCase();
if (!dbConfigStr.includes('test')) {
  console.error('CRITICAL: Refusing to run destructive tests on non-test database.');
  process.exit(1);
}
if (process.env.AGRIVOICE_ALLOW_DESTRUCTIVE_TESTS !== 'true') {
  console.error('CRITICAL: Destructive test mode not enabled. Set AGRIVOICE_ALLOW_DESTRUCTIVE_TESTS=true.');
  process.exit(1);
}
// -----------------------

const BASE_URL = 'http://127.0.0.1:4001';

// Test IDs
const userAId = 'a0000000-0000-0000-0000-000000000001';
const farmerAProfileId = 'a1111111-1111-1111-1111-111111111111';
const farmAId = 'af000000-0000-0000-0000-000000000001';
const farmA2Id = 'af000000-0000-0000-0000-000000000003';
const fieldAId = 'af111111-1111-1111-1111-111111111111';
const fieldA2Id = 'af111111-1111-1111-1111-111111111113';

const userBId = 'b0000000-0000-0000-0000-000000000002';
const farmerBProfileId = 'b1111111-1111-1111-1111-111111111111';
const farmBId = 'bf000000-0000-0000-0000-000000000002';
const fieldBId = 'bf111111-1111-1111-1111-111111111112';

let serverProcess: ChildProcess | null = null;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(retries = 30): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        return true;
      }
    } catch {
      // Waiting for server to bind
    }
    await sleep(500);
  }
  return false;
}

async function generateTokens() {
  const secret = process.env.JWT_SECRET || process.env.APP_SECRET || 'dev-secret-only';
  const dummyApp = fastify();
  await dummyApp.register(fastifyJwt, { secret });
  const tokenA = dummyApp.jwt.sign({ id: userAId, phone: '+919876543201' });
  const tokenB = dummyApp.jwt.sign({ id: userBId, phone: '+919876543202' });
  await dummyApp.close();
  return { tokenA, tokenB };
}

async function seedDatabase() {
  console.log('[Setup] Cleaning old test data from PostgreSQL...');
  await db.delete(soilReports).where(or(eq(soilReports.farmerId, farmerAProfileId), eq(soilReports.farmerId, farmerBProfileId)));
  await db.delete(inputVerifications).where(or(eq(inputVerifications.farmerId, farmerAProfileId), eq(inputVerifications.farmerId, farmerBProfileId)));
  await db.delete(fields).where(or(eq(fields.id, fieldAId), eq(fields.id, fieldA2Id), eq(fields.id, fieldBId)));
  await db.delete(farms).where(or(eq(farms.id, farmAId), eq(farms.id, farmA2Id), eq(farms.id, farmBId)));
  await db.delete(farmerProfiles).where(or(eq(farmerProfiles.id, farmerAProfileId), eq(farmerProfiles.id, farmerBProfileId)));
  await db.delete(users).where(or(eq(users.id, userAId), eq(users.id, userBId)));

  console.log('[Setup] Seeding test users and profiles...');
  await db.insert(users).values([
    { id: userAId, phone: '+919876543201', status: 'active' },
    { id: userBId, phone: '+919876543202', status: 'active' },
  ]);

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

  await db.insert(farms).values([
    { id: farmAId, farmerId: farmerAProfileId, farmName: 'Ramesh Farm A-Main', ownershipType: 'owned' },
    { id: farmA2Id, farmerId: farmerAProfileId, farmName: 'Ramesh Farm A-Secondary', ownershipType: 'owned' },
    { id: farmBId, farmerId: farmerBProfileId, farmName: 'Suresh Farm B', ownershipType: 'owned' },
  ]);

  await db.insert(fields).values([
    { id: fieldAId, farmId: farmAId, fieldName: 'Ramesh North Plot' },
    { id: fieldA2Id, farmId: farmA2Id, fieldName: 'Ramesh South Plot' },
    { id: fieldBId, farmId: farmBId, fieldName: 'Suresh East Plot' },
  ]);
  console.log('[Setup] PostgreSQL test state initialized.');
}

async function cleanupDatabase() {
  console.log('[Teardown] Cleaning up PostgreSQL test state...');
  await db.delete(soilReports).where(or(eq(soilReports.farmerId, farmerAProfileId), eq(soilReports.farmerId, farmerBProfileId)));
  await db.delete(inputVerifications).where(or(eq(inputVerifications.farmerId, farmerAProfileId), eq(inputVerifications.farmerId, farmerBProfileId)));
  await db.delete(fields).where(or(eq(fields.id, fieldAId), eq(fields.id, fieldA2Id), eq(fields.id, fieldBId)));
  await db.delete(farms).where(or(eq(farms.id, farmAId), eq(farms.id, farmA2Id), eq(farms.id, farmBId)));
  await db.delete(farmerProfiles).where(or(eq(farmerProfiles.id, farmerAProfileId), eq(farmerProfiles.id, farmerBProfileId)));
  await db.delete(users).where(or(eq(users.id, userAId), eq(users.id, userBId)));
  await pool.end();
  console.log('[Teardown] Teardown complete.');
}

async function runLiveHttpTests() {
  console.log('================================================================');
  console.log('AGRIVOICE PILLAR 6 — INDEPENDENT LIVE HTTP VERIFICATION SUITE');
  console.log('================================================================');

  await seedDatabase();
  const { tokenA, tokenB } = await generateTokens();

  // Start live server process
  console.log('[Server] Spawning live backend server process on port 4001...');
  const serverPath = path.resolve(process.cwd(), 'dist/server.js
