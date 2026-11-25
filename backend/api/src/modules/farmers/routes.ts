import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { farmerProfiles, farms, fields } from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import { NotFoundError } from '../../common/errors/index.js';
import { initializeFarmerSampleHistory } from './sample-history.service.js';

export const farmersRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }
  });

  fastify.get('/me', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const farmerFarms = await db.select().from(farms).where(eq(farms.farmerId, profile.id));
    const farmIds = farmerFarms.map((f) => f.id);
    const farmerFields =
      farmIds.length > 0 ? await db.select().from(fields).where(inArray(fields.farmId, farmIds)) : [];
    return {
      data: {
        farmerProfile: profile,
        farms: farmerFarms.map((farm) => ({
          ...farm,
          fields: farmerFields.filter((fld) => fld.farmId === farm.id),
        })),
      },
    };
  });

  fastify.put<{
    Body: {
      fullName?: string;
      preferredLanguage?: string;
      state?: string;
      district?: string;
      mandal?: string;
      village?: string;
      pinCode?: string;
    };
  }>(
    '/me',
    {
      schema: {
        body: Type.Object({
          fullName: Type.Optional(Type.String({ minLength: 2, maxLength: 128 })),
          preferredLanguage: Type.Optional(Type.String({ minLength: 2, maxLength: 16 })),
          state: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          district: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          mandal: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          village: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          pinCode: Type.Optional(Type.String({ minLength: 4, maxLength: 10 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [updated] = await db
        .update(farmerProfiles)
        .set({
          ...(request.body.fullName ? { fullName: request.body.fullName.trim() } : {}),
          ...(request.body.preferredLanguage ? { preferredLanguage: request.body.preferredLanguage.trim() } : {}),
          ...(request.body.state ? { state: request.body.state.trim() } : {}),
          ...(request.body.district ? { district: request.body.district.trim() } : {}),
          ...(request.body.mandal ? { mandal: request.body.mandal.trim() } : {}),
          ...(request.body.village ? { village: request.body.village.trim() } : {}),
          ...(request.body.pinCode ? { pinCode: request.body.pinCode.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(farmerProfiles.id, profile.id))
        .returning();
      return { data: updated };
    }
  );

  fastify.post<{
    Body: { farmName: string; totalAreaAcres: number; ownershipType?: string };
  }>(
    '/farms',
    {
      schema: {
        body: Type.Object({
          farmName: Type.String({ minLength: 2, maxLength: 128 }),
          totalAreaAcres: Type.Number({ minimum: 0.1, maximum: 10000 }),
          ownershipType: Type.Optional(Type.Union([Type.Literal('owned'), Type.Literal('leased'), Type.Literal('shared')])),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [created] = await db
        .insert(farms)
        .values({
          farmerId: profile.id,
          farmName: request.body.farmName.trim(),
          totalAreaAcres: request.body.totalAreaAcres.toString(),
          ownershipType: request.body.ownershipType || 'owned',
        })
        .returning();
      reply.status(201);
      return { data: created };
    }
  );

  fastify.post<{
    Params: { farmId: string };
    Body: { fieldName: string; areaAcres: number; soilType?: string; irrigationSource?: string };
  }>(
    '/farms/:farmId/fields',
    {
      schema: {
        params: Type.Object({ farmId: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          fieldName: Type.String({ minLength: 2, maxLength: 128 }),
          areaAcres: Type.Number({ minimum: 0.1, maximum: 10000 }),
          soilType: Type.Optional(Type.String({ maxLength: 64 })),
          irrigationSource: Type.Optional(Type.String({ maxLength: 64 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [farm] = await db
        .select()
        .from(farms)
        .where(and(eq(farms.id, request.params.farmId), eq(farms.farmerId, profile.id)))
        .limit(1);
      if (!farm) {
        throw new NotFoundError('Farm not found or access denied.');
      }
      const [created] = await db
        .insert(fields)
        .values({
          farmId: farm.id,
          fieldName: request.body.fieldName.trim(),
          areaAcres: request.body.areaAcres.toString(),
          soilType: request.body.soilType?.trim() || null,
          irrigationSource: request.body.irrigationSource?.trim() || null,
        })
        .returning();
      reply.status(201);
      return { data: created };
    }
  );

  /**
   * POST /farmers/me/initialize-sample-history
   * Idempotently populates clearly-labelled [Sample Record] history under the authenticated farmer's ID.
   */
  fastify.post('/me/initialize-sample-history', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const result = await initializeFarmerSampleHistory(user.id, profile.id, profile.state, profile.district);
    return { data: result };
  });
};
