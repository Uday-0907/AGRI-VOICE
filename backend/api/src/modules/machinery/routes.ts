import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { machineryListings, machineryBookings } from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/index.js';

export const machineryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Machinery services.' },
      });
    }
  });

  fastify.get<{
    Querystring: { category?: string; district?: string; limit?: number; offset?: number };
  }>(
    '/listings',
    {
      schema: {
        tags: ['Machinery'],
        querystring: Type.Object({
          category: Type.Optional(Type.String()),
          district: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          offset: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      await assertFarmerContext(user.id);
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      const conditions = [];
      if (request.query.category?.trim()) {
        conditions.push(eq(machineryListings.category, request.query.category.trim()));
      }
      if (request.query.district?.trim()) {
        conditions.push(ilike(machineryListings.district, `%${request.query.district.trim()}%`));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(machineryListings)
        .where(whereClause)
        .orderBy(desc(machineryListings.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: rows.map((r) => ({
          ...r,
          hourlyRateInr: Number(r.hourlyRateInr),
          dailyRateInr: r.dailyRateInr ? Number(r.dailyRateInr) : null,
        })),
      };
    }
  );

  fastify.post<{
    Body: {
      equipmentName: string;
      category: string;
      hourlyRateInr: number;
      dailyRateInr?: number;
      district: string;
      state: string;
      description?: string;
    };
  }>(
    '/listings',
    {
      schema: {
        tags: ['Machinery'],
        body: Type.Object({
          equipmentName: Type.String({ minLength: 2, maxLength: 120 }),
          category: Type.Union([
            Type.Literal('tractor'),
            Type.Literal('harvester'),
            Type.Literal('sprayer'),
            Type.Literal('seeder'),
            Type.Literal('drone'),
            Type.Literal('pump'),
            Type.Literal('other'),
          ]),
          hourlyRateInr: Type.Number({ minimum: 1, maximum: 50000 }),
          dailyRateInr: Type.Optional(Type.Number({ minimum: 1, maximum: 200000 })),
          district: Type.String({ minLength: 2, maxLength: 64 }),
          state: Type.String({ minLength: 2, maxLength: 64 }),
          description: Type.Optional(Type.String({ maxLength: 500 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [created] = await db
        .insert(machineryListings)
        .values({
          ownerFarmerId: profile.id,
          equipmentName: request.body.equipmentName.trim(),
          category: request.body.category,
          hourlyRateInr: request.body.hourlyRateInr.toString(),
          dailyRateInr: request.body.dailyRateInr ? request.body.dailyRateInr.toString() : null,
          district: request.body.district.trim(),
          state: request.body.state.trim(),
          description: request.body.description?.trim() || null,
          availabilityStatus: 'available',
        })
        .returning();
      reply.status(201);
      return {
        data: {
          ...created,
          hourlyRateInr: Number(created.hourlyRateInr),
          dailyRateInr: created.dailyRateInr ? Number(created.dailyRateInr) : null,
        },
      };
    }
  );

  fastify.get('/bookings', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const rows = await db
      .select()
      .from(machineryBookings)
      .where(eq(machineryBookings.renterFarmerId, profile.id))
      .orderBy(desc(machineryBookings.createdAt));
    return { data: rows };
  });

  fastify.post<{
    Body: { listingId: string; farmId?: string; startDate: string; endDate: string; notes?: string };
  }>(
    '/bookings',
    {
      schema: {
        tags: ['Machinery'],
        body: Type.Object({
          listingId: Type.String({ format: 'uuid' }),
          farmId: Type.Optional(Type.String({ format: 'uuid' })),
          startDate: Type.String({ minLength: 8 }),
          endDate: Type.String({ minLength: 8 }),
          notes: Type.Optional(Type.String({ maxLength: 500 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);

      const start = new Date(request.body.startDate);
      const end = new Date(request.body.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new BadRequestError('End date must be a valid date after start date.');
      }

      const [listing] = await db
        .select()
        .from(machineryListings)
        .where(eq(machineryListings.id, request.body.listingId))
        .limit(1);
      if (!listing) {
        throw new NotFoundError('Machinery listing not found.');
      }

      const [created] = await db
        .insert(machineryBookings)
        .values({
          listingId: listing.id,
          renterFarmerId: profile.id,
          farmId: request.body.farmId || null,
          startDate: start,
          endDate: end,
          status: 'requested',
          notes: request.body.notes?.trim() || null,
        })
        .returning();
      reply.status(201);
      return { data: created };
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { status: 'cancelled' | 'confirmed' | 'completed' };
  }>(
    '/bookings/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          status: Type.Union([Type.Literal('cancelled'), Type.Literal('confirmed'), Type.Literal('completed')]),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);

      const [booking] = await db
        .select()
        .from(machineryBookings)
        .where(eq(machineryBookings.id, request.params.id))
        .limit(1);
      if (!booking) {
        throw new NotFoundError('Booking not found.');
      }
      if (booking.renterFarmerId !== profile.id) {
        const [listing] = await db
          .select()
          .from(machineryListings)
          .where(and(eq(machineryListings.id, booking.listingId), eq(machineryListings.ownerFarmerId, profile.id)))
          .limit(1);
        if (!listing) {
          throw new ForbiddenError('Access denied to update this machinery booking.');
        }
      }

      const [updated] = await db
        .update(machineryBookings)
        .set({ status: request.body.status, updatedAt: new Date() })
        .where(eq(machineryBookings.id, booking.id))
        .returning();
      return { data: updated };
    }
  );
};
