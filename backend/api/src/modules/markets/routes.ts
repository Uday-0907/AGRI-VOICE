import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc, ilike, count } from 'drizzle-orm';
import { db } from '../../database/db.js';
import {
  marketPriceObservations,
  buyerListings,
  purchaseRequests,
  buyerProfiles,
  notifications,
} from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import { NotFoundError } from '../../common/errors/index.js';

export const marketsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Markets services.' },
      });
    }
  });

  fastify.get<{
    Querystring: { commodity?: string; district?: string; limit?: number; offset?: number };
  }>(
    '/prices',
    {
      schema: {
        tags: ['Markets'],
        querystring: Type.Object({
          commodity: Type.Optional(Type.String()),
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
      if (request.query.commodity?.trim()) {
        conditions.push(ilike(marketPriceObservations.commodity, `%${request.query.commodity.trim()}%`));
      }
      if (request.query.district?.trim()) {
        conditions.push(ilike(marketPriceObservations.district, `%${request.query.district.trim()}%`));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(marketPriceObservations)
        .where(whereClause)
        .orderBy(desc(marketPriceObservations.priceDate))
        .limit(limit)
        .offset(offset);

      const [totalRow] = await db.select({ val: count() }).from(marketPriceObservations).where(whereClause);

      return {
        data: rows.map((r) => ({
          ...r,
          minPriceInr: Number(r.minPriceInr),
          maxPriceInr: Number(r.maxPriceInr),
          modalPriceInr: Number(r.modalPriceInr),
        })),
        meta: { pagination: { limit, offset, total: Number(totalRow?.val ?? 0) } },
      };
    }
  );

  fastify.post<{
    Body: {
      commodity: string;
      variety?: string;
      state: string;
      district: string;
      marketName: string;
      minPriceInr: number;
      maxPriceInr: number;
      modalPriceInr: number;
    };
  }>(
    '/prices',
    {
      schema: {
        tags: ['Markets'],
        body: Type.Object({
          commodity: Type.String({ minLength: 2, maxLength: 80 }),
          variety: Type.Optional(Type.String({ maxLength: 80 })),
          state: Type.String({ minLength: 2, maxLength: 64 }),
          district: Type.String({ minLength: 2, maxLength: 64 }),
          marketName: Type.String({ minLength: 2, maxLength: 120 }),
          minPriceInr: Type.Number({ minimum: 1 }),
          maxPriceInr: Type.Number({ minimum: 1 }),
          modalPriceInr: Type.Number({ minimum: 1 }),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [inserted] = await db
        .insert(marketPriceObservations)
        .values({
          commodity: request.body.commodity.trim(),
          variety: request.body.variety?.trim() || null,
          state: request.body.state.trim(),
          district: request.body.district.trim(),
          marketName: request.body.marketName.trim(),
          minPriceInr: request.body.minPriceInr.toString(),
          maxPriceInr: request.body.maxPriceInr.toString(),
          modalPriceInr: request.body.modalPriceInr.toString(),
          source: 'farmer_reported',
          sourceAuthority: 'Farmer Mandi Price Observation',
          reportedByFarmerId: profile.id,
        })
        .returning();
      reply.status(201);
      return {
        data: {
          ...inserted,
          minPriceInr: Number(inserted.minPriceInr),
          maxPriceInr: Number(inserted.maxPriceInr),
          modalPriceInr: Number(inserted.modalPriceInr),
        },
      };
    }
  );

  fastify.get<{ Querystring: { scope?: 'mine' | 'all'; limit?: number; offset?: number } }>(
    '/listings',
    {
      schema: {
        tags: ['Markets'],
        querystring: Type.Object({
          scope: Type.Optional(Type.Union([Type.Literal('mine'), Type.Literal('all')])),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          offset: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;
      const whereClause =
        request.query.scope === 'all'
          ? eq(buyerListings.status, 'open')
          : eq(buyerListings.farmerId, profile.id);

      const rows = await db
        .select()
        .from(buyerListings)
        .where(whereClause)
        .orderBy(desc(buyerListings.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: rows.map((r) => ({
          ...r,
          quantityQuintals: Number(r.quantityQuintals),
          expectedPriceInr: Number(r.expectedPriceInr),
        })),
      };
    }
  );

  fastify.post<{
    Body: {
      cropName: string;
      variety?: string;
      quantityQuintals: number;
      expectedPriceInr: number;
      qualityGrade?: string;
      district: string;
      state: string;
      notes?: string;
    };
  }>(
    '/listings',
    {
      schema: {
        tags: ['Markets'],
        body: Type.Object({
          cropName: Type.String({ minLength: 2, maxLength: 80 }),
          variety: Type.Optional(Type.String({ maxLength: 80 })),
          quantityQuintals: Type.Number({ minimum: 0.1, maximum: 100000 }),
          expectedPriceInr: Type.Number({ minimum: 1, maximum: 1000000 }),
          qualityGrade: Type.Optional(Type.String({ maxLength: 32 })),
          district: Type.String({ minLength: 2, maxLength: 64 }),
          state: Type.String({ minLength: 2, maxLength: 64 }),
          notes: Type.Optional(Type.String({ maxLength: 500 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [created] = await db
        .insert(buyerListings)
        .values({
          farmerId: profile.id,
          cropName: request.body.cropName.trim(),
          variety: request.body.variety?.trim() || null,
          quantityQuintals: request.body.quantityQuintals.toString(),
          expectedPriceInr: request.body.expectedPriceInr.toString(),
          qualityGrade: request.body.qualityGrade?.trim() || 'FAQ',
          district: request.body.district.trim(),
          state: request.body.state.trim(),
          notes: request.body.notes?.trim() || null,
          status: 'open',
        })
        .returning();
      reply.status(201);
      return {
        data: {
          ...created,
          quantityQuintals: Number(created.quantityQuintals),
          expectedPriceInr: Number(created.expectedPriceInr),
        },
      };
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { status?: 'open' | 'matched' | 'closed'; expectedPriceInr?: number };
  }>(
    '/listings/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          status: Type.Optional(Type.Union([Type.Literal('open'), Type.Literal('matched'), Type.Literal('closed')])),
          expectedPriceInr: Type.Optional(Type.Number({ minimum: 1 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [updated] = await db
        .update(buyerListings)
        .set({
          ...(request.body.status ? { status: request.body.status } : {}),
          ...(request.body.expectedPriceInr ? { expectedPriceInr: request.body.expectedPriceInr.toString() } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(buyerListings.id, request.params.id), eq(buyerListings.farmerId, profile.id)))
        .returning();

      if (!updated) {
        throw new NotFoundError('Listing not found or access denied.');
      }
      return {
        data: {
          ...updated,
          quantityQuintals: Number(updated.quantityQuintals),
          expectedPriceInr: Number(updated.expectedPriceInr),
        },
      };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/listings/:id',
    {
      schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [deleted] = await db
        .delete(buyerListings)
        .where(and(eq(buyerListings.id, request.params.id), eq(buyerListings.farmerId, profile.id)))
        .returning();
      if (!deleted) {
        throw new NotFoundError('Listing not found or access denied.');
      }
      return { data: { deleted: true, id: deleted.id } };
    }
  );

  /**
   * GET /markets/requests/incoming
   * Lists purchase enquiries and requests sent by Buyers for this Farmer's produce listings.
   */
  fastify.get('/requests/incoming', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);

    const rows = await db
      .select({
        req: purchaseRequests,
        cropName: buyerListings.cropName,
        buyerBusinessName: buyerProfiles.businessName,
        buyerContactName: buyerProfiles.contactName,
        buyerCity: buyerProfiles.city,
        buyerDistrict: buyerProfiles.district,
      })
      .from(purchaseRequests)
      .innerJoin(buyerListings, eq(purchaseRequests.listingId, buyerListings.id))
      .innerJoin(buyerProfiles, eq(purchaseRequests.buyerId, buyerProfiles.id))
      .where(eq(purchaseRequests.farmerId, profile.id))
      .orderBy(desc(purchaseRequests.createdAt));

    return {
      data: rows.map(({ req, cropName, buyerBusinessName, buyerContactName, buyerCity, buyerDistrict }) => ({
        ...req,
        requestedQuantityQuintals: Number(req.requestedQuantityQuintals),
        offeredPriceInr: Number(req.offeredPriceInr),
        cropName,
        buyerBusinessName,
        buyerContactName,
        buyerLocation: `${buyerCity}, ${buyerDistrict}`,
      })),
    };
  });

  /**
   * PATCH /markets/requests/:id/respond
   * Farmer responds to an incoming Buyer purchase request/enquiry.
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      status: 'negotiating' | 'accepted' | 'rejected' | 'fulfilled';
      farmerResponse?: string;
    };
  }>(
    '/requests/:id/respond',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          status: Type.Union([
            Type.Literal('negotiating'),
            Type.Literal('accepted'),
            Type.Literal('rejected'),
            Type.Literal('fulfilled'),
          ]),
          farmerResponse: Type.Optional(Type.String({ maxLength: 600 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);

      const [updated] = await db
        .update(purchaseRequests)
        .set({
          status: request.body.status,
          ...(request.body.farmerResponse !== undefined
            ? { farmerResponse: request.body.farmerResponse.trim() || null }
            : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(purchaseRequests.id, request.params.id), eq(purchaseRequests.farmerId, profile.id)))
        .returning();

      if (!updated) {
        throw new NotFoundError('Incoming purchase request not found or access denied.');
      }

      if (request.body.status === 'accepted') {
        await db
          .update(buyerListings)
          .set({ status: 'matched', updatedAt: new Date() })
          .where(and(eq(buyerListings.id, updated.listingId), eq(buyerListings.farmerId, profile.id)));
      }

      const [buyerRow] = await db
        .select({ userId: buyerProfiles.userId })
        .from(buyerProfiles)
        .where(eq(buyerProfiles.id, updated.buyerId))
        .limit(1);

      if (buyerRow) {
        await db.insert(notifications).values({
          userId: buyerRow.userId,
          role: 'buyer',
          category: 'market',
          title: `Farmer Updated Request (${updated.status})`,
          message: `${profile.fullName} marked your purchase request as ${updated.status}.${updated.farmerResponse ? ` Note: ${updated.farmerResponse}` : ''}`,
          relatedEntityId: updated.id,
        });
      }

      return {
        data: {
          ...updated,
          requestedQuantityQuintals: Number(updated.requestedQuantityQuintals),
          offeredPriceInr: Number(updated.offeredPriceInr),
        },
      };
    }
  );
};
