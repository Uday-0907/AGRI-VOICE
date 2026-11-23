import { ForbiddenError, NotFoundError } from '../errors/index.js';
import { db } from '../../database/db.js';
import { farms, fields, cropSeasons, farmerProfiles } from '../../database/schema/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Validates that a farm belongs to the authenticated user's farmer profile.
 */
export async function assertFarmOwnership(userId: string, farmId: string) {
  // Resolve farmer profile
  const profile = await db.query.farmerProfiles.findFirst({
    where: eq(farmerProfiles.userId, userId),
  });

  if (!profile) {
    throw new ForbiddenError('User does not have an active farmer profile');
  }

  const farm = await db.query.farms.findFirst({
    where: and(eq(farms.id, farmId), eq(farms.farmerId, profile.id)),
  });

  if (!farm) {
    throw new NotFoundError('Farm not found or access denied');
  }

  return { farm, profile };
}
