import { ForbiddenError, NotFoundError } from '../errors/index.js';
import { db } from '../../database/db.js';
import {
  users,
  farms,
  fields,
  farmerProfiles,
  buyerProfiles,
  soilReports,
  inputVerifications,
} from '../../database/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Resolves and verifies that the authenticated user has the 'farmer' role and an active farmer profile.
 */
export async function assertFarmerContext(userId: string) {
  const [user] = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user && user.role === 'buyer') {
    throw new ForbiddenError('Farmer role required. Buyer accounts cannot access Farmer resources.');
  }

  const [profile] = await db
    .select()
    .from(farmerProfiles)
    .where(eq(farmerProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new ForbiddenError('Authenticated user does not have an active farmer profile');
  }

  return profile;
}

/**
 * Resolves and verifies that the authenticated user has the 'buyer' role and an active buyer profile.
 */
export async function assertBuyerContext(userId: string) {
  const [user] = await db
    .select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.role !== 'buyer') {
    throw new ForbiddenError('Buyer role required to access Buyer Portal resources.');
  }

  const [profile] = await db
    .select()
    .from(buyerProfiles)
    .where(eq(buyerProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new ForbiddenError('Authenticated user does not have an active buyer profile');
  }

  return profile;
}

/**
 * Validates that a farm belongs to the authenticated user's farmer profile.
 */
export async function assertFarmOwnership(userId: string, farmId: string) {
  const profile = await assertFarmerContext(userId);

  const [farm] = await db
    .select()
    .from(farms)
    .where(and(eq(farms.id, farmId), eq(farms.farmerId, profile.id)))
    .limit(1);

  if (!farm) {
    throw new NotFoundError('Farm not found or access denied');
  }

  return { farm, profile };
}

/**
 * Validates that a field belongs to a farm owned by the authenticated user's farmer profile.
 * If expectedFarmId is provided, also enforces that the field belongs to that specific farm.
 */
export async function assertFieldOwnership(userId: string, fieldId: string, expectedFarmId?: string) {
  const profile = await assertFarmerContext(userId);

  const conditions = [
    eq(fields.id, fieldId),
    eq(farms.farmerId, profile.id),
  ];
  if (expectedFarmId) {
    conditions.push(eq(fields.farmId, expectedFarmId));
  }

  const [result] = await db
    .select({
      field: fields,
      farm: farms,
    })
    .from(fields)
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .where(and(...conditions))
    .limit(1);

  if (!result) {
    throw new NotFoundError(
      expectedFarmId
        ? `Field not found or does not belong to farm ${expectedFarmId}`
        : 'Field not found or access denied'
    );
  }

  return { field: result.field, farm: result.farm, profile };
}

/**
 * Validates that a soil report belongs to the authenticated user's farmer profile.
 */
export async function assertSoilReportOwnership(userId: string, reportId: string) {
  const profile = await assertFarmerContext(userId);

  const [report] = await db
    .select()
    .from(soilReports)
    .where(and(eq(soilReports.id, reportId), eq(soilReports.farmerId, profile.id)))
    .limit(1);

  if (!report) {
    throw new NotFoundError('Soil report not found or access denied');
  }

  return { report, profile };
}

/**
 * Validates that an input verification record belongs to the authenticated user's farmer profile.
 */
export async function assertInputVerificationOwnership(userId: string, verificationId: string) {
  const profile = await assertFarmerContext(userId);

  const [verification] = await db
    .select()
    .from(inputVerifications)
    .where(and(eq(inputVerifications.id, verificationId), eq(inputVerifications.farmerId, profile.id)))
    .limit(1);

  if (!verification) {
    throw new NotFoundError('Input verification record not found or access denied');
  }

  return { verification, profile };
}
