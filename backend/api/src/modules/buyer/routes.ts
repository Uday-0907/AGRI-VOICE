import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc, ilike, gte, lte, count, inArray } from 'drizzle-orm';
import { db } from '../../database/db.js';
import {
  buyerProfiles,
  buyerListings,
  buyerSavedListings,
  farmerProfiles,
  purchaseRequests,
  notifications,
} from '../../database/schema/index.js';
import { assertBuyerContext } from '../../common/auth/ownership.js';
import { BadRequestError, NotFoundError } from '../../common/errors/index.js';

export const buyerRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Buyer Portal.' },
      });
    }
  });

  fastify.get('/dashboard', async (request) => {
    const user = (request as any).user;
    const buyer = await assertBuyerContext(user.id);

    const [openListingsRow] = await db
      .select({ val: count() })
      .from(buyerListings)
      .where(eq(buyerListings.status, 'open'));

    const allRequests = await db
      .select()
      .from(purchaseRequests)
      .where(eq(purchaseRequests.buyerId, buyer.id))
      .orderBy(desc(purchaseRequests.createdAt))
      .limit(10);

    const [unreadRow] = await db
      .select({ val: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return {
      data: {
        buyerProfile: buyer,
        summary: {
          availableProduceCount: Number(openListingsRow?.val ?? 0),
          pendingRequestsCount: allRequests.filter((r) => r.status === 'pending' || r.status === 'negotiating').length,
          acceptedOrdersCount: allRequests.filter((r) => r.status === 'accepted' || r.status === 'fulfilled').length,
          unreadNotificationsCount: Number(unreadRow?.val ?? 0),
        },
        recentRequests: allRequests.map((r) => ({
          ...r,
          requestedQuantityQuintals: Number(r.requestedQuantityQuintals),
          offeredPriceInr: Number(r.offeredPriceInr),
        })),
      },
    };
  });

  fastify.get('/profile', async (request) => {
    const user = (request as any).user;
    const buyer = await assertBuyerContext(user.id);
    return { data: buyer };
  });

  fastify.put<{
    Body: {
      businessName?: string;
      contactName?: string;
      businessType?: string;
      state?: string;
      district?: string;
      city?: string;
      pinCode?: string;
      gstOrLicenseNumber?: string;
    };
  }>(
    '/profile',
    {
      schema: {
        body: Type.Object({
          businessName: Type.Optional(Type.String({ minLength: 2, maxLength: 160 })),
          contactName: Type.Optional(Type.String({ minLength: 2, maxLength: 128 })),
          businessType: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          state: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          district: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          city: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          pinCode: Type.Optional(Type.String({ minLength: 4, maxLength: 10 })),
          gstOrLicenseNumber: Type.Optional(Type.String({ maxLength: 64 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);
      const [updated] = await db
        .update(buyerProfiles)
        .set({
          ...(request.body.businessName ? { businessName: request.body.businessName.trim() } : {}),
          ...(request.body.contactName ? { contactName: request.body.contactName.trim() } : {}),
          ...(request.body.businessType ? { businessType: request.body.businessType.trim() } : {}),
          ...(request.body.state ? { state: request.body.state.trim() } : {}),
          ...(request.body.district ? { district: request.body.district.trim() } : {}),
          ...(request.body.city ? { city: request.body.city.trim() } : {}),
          ...(request.body.pinCode ? { pinCode: request.body.pinCode.trim() } : {}),
          ...(request.body.gstOrLicenseNumber !== undefined
            ? { gstOrLicenseNumber: request.body.gstOrLicenseNumber.trim() || null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(buyerProfiles.id, buyer.id))
        .returning();
      return { data: updated };
    }
  );

  fastify.get<{
    Querystring: {
      crop?: string;
      district?: string;
      state?: string;
      minQty?: number;
      maxPrice?: number;
      limit?: number;
      offset?: number;
    };
  }>(
    '/listings',
    {
      schema: {
        querystring: Type.Object({
          crop: Type.Optional(Type.String()),
          district: Type.Optional(Type.String()),
          state: Type.Optional(Type.String()),
          minQty: Type.Optional(Type.Number({ minimum: 0 })),
          maxPrice: Type.Optional(Type.Number({ minimum: 0 })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          offset: Type.Optional(Type.Integer({ minimum: 0 })),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);
      const limit = request.query.limit ?? 20;
      const offset = request.query.offset ?? 0;

      const conditions = [eq(buyerListings.status, 'open')];
      if (request.query.crop?.trim()) {
        conditions.push(ilike(buyerListings.cropName, `%${request.query.crop.trim()}%`));
      }
      if (request.query.district?.trim()) {
        conditions.push(ilike(buyerListings.district, `%${request.query.district.trim()}%`));
      }
      if (request.query.state?.trim()) {
        conditions.push(ilike(buyerListings.state, `%${request.query.state.trim()}%`));
      }
      if (typeof request.query.minQty === 'number') {
        conditions.push(gte(buyerListings.quantityQuintals, request.query.minQty.toString()));
      }
      if (typeof request.query.maxPrice === 'number') {
        conditions.push(lte(buyerListings.expectedPriceInr, request.query.maxPrice.toString()));
      }

      const rows = await db
        .select({
          listing: buyerListings,
          sellerName: farmerProfiles.fullName,
        })
        .from(buyerListings)
        .innerJoin(farmerProfiles, eq(buyerListings.farmerId, farmerProfiles.id))
        .where(and(...conditions))
        .orderBy(desc(buyerListings.createdAt))
        .limit(limit)
        .offset(offset);

      const savedRows = await db
        .select({ listingId: buyerSavedListings.listingId })
        .from(buyerSavedListings)
        .where(eq(buyerSavedListings.buyerId, buyer.id));
      const savedSet = new Set(savedRows.map((s) => s.listingId));

      return {
        data: rows.map(({ listing, sellerName }) => ({
          id: listing.id,
          cropName: listing.cropName,
          variety: listing.variety,
          quantityQuintals: Number(listing.quantityQuintals),
          expectedPriceInr: Number(listing.expectedPriceInr),
          qualityGrade: listing.qualityGrade,
          district: listing.district,
          state: listing.state,
          status: listing.status,
          notes: listing.notes,
          sellerName,
          isSaved: savedSet.has(listing.id),
          createdAt: listing.createdAt.toISOString(),
        })),
      };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/listings/:id/save',
    { schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) } },
    async (request, reply) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);
      await db
        .insert(buyerSavedListings)
        .values({ buyerId: buyer.id, listingId: request.params.id })
        .onConflictDoNothing();
      reply.status(201);
      return { data: { saved: true, listingId: request.params.id } };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/listings/:id/save',
    { schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) } },
    async (request) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);
      await db
        .delete(buyerSavedListings)
        .where(
          and(
            eq(buyerSavedListings.buyerId, buyer.id),
            eq(buyerSavedListings.listingId, request.params.id)
          )
        );
      return { data: { saved: false, listingId: request.params.id } };
    }
  );

  fastify.get<{ Querystring: { status?: string } }>(
    '/requests',
    {
      schema: {
        querystring: Type.Object({ status: Type.Optional(Type.String()) }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);

      const conditions = [eq(purchaseRequests.buyerId, buyer.id)];
      if (request.query.status?.trim()) {
        conditions.push(eq(purchaseRequests.status, request.query.status.trim()));
      }

      const rows = await db
        .select({
          req: purchaseRequests,
          cropName: buyerListings.cropName,
          district: buyerListings.district,
          state: buyerListings.state,
          sellerName: farmerProfiles.fullName,
        })
        .from(purchaseRequests)
        .innerJoin(buyerListings, eq(purchaseRequests.listingId, buyerListings.id))
        .innerJoin(farmerProfiles, eq(purchaseRequests.farmerId, farmerProfiles.id))
        .where(and(...conditions))
        .orderBy(desc(purchaseRequests.createdAt));

      return {
        data: rows.map(({ req, cropName, district, state, sellerName }) => ({
          ...req,
          requestedQuantityQuintals: Number(req.requestedQuantityQuintals),
          offeredPriceInr: Number(req.offeredPriceInr),
          cropName,
          district,
          state,
          sellerName,
        })),
      };
    }
  );

  fastify.post<{
    Body: {
      listingId: string;
      requestType?: 'enquiry' | 'purchase_request';
      requestedQuantityQuintals: number;
      offeredPriceInr: number;
      message?: string;
    };
  }>(
    '/requests',
    {
      schema: {
        body: Type.Object({
          listingId: Type.String({ format: 'uuid' }),
          requestType: Type.Optional(Type.Union([Type.Literal('enquiry'), Type.Literal('purchase_request')])),
          requestedQuantityQuintals: Type.Number({ minimum: 0.1, maximum: 100000 }),
          offeredPriceInr: Type.Number({ minimum: 1, maximum: 1000000 }),
          message: Type.Optional(Type.String({ maxLength: 600 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);

      const [listing] = await db
        .select({
          listing: buyerListings,
          farmerUserId: farmerProfiles.userId,
        })
        .from(buyerListings)
        .innerJoin(farmerProfiles, eq(buyerListings.farmerId, farmerProfiles.id))
        .where(eq(buyerListings.id, request.body.listingId))
        .limit(1);

      if (!listing) {
        throw new NotFoundError('Produce listing not found.');
      }
      if (listing.listing.status !== 'open') {
        throw new BadRequestError('This produce listing is no longer open for new requests.');
      }

      const [created] = await db
        .insert(purchaseRequests)
        .values({
          listingId: listing.listing.id,
          buyerId: buyer.id,
          farmerId: listing.listing.farmerId,
          requestType: request.body.requestType || 'purchase_request',
          requestedQuantityQuintals: request.body.requestedQuantityQuintals.toString(),
          offeredPriceInr: request.body.offeredPriceInr.toString(),
          message: request.body.message?.trim() || null,
          status: 'pending',
        })
        .returning();

      await db.insert(notifications).values({
        userId: listing.farmerUserId,
        role: 'farmer',
        category: 'market',
        title: `New Buyer ${created.requestType === 'enquiry' ? 'Enquiry' : 'Purchase Request'}`,
        message: `${buyer.businessName} requested ${request.body.requestedQuantityQuintals} qtl of ${listing.listing.cropName} at ₹${request.body.offeredPriceInr}/qtl.`,
        relatedEntityId: created.id,
      });

      reply.status(201);
      return {
        data: {
          ...created,
          requestedQuantityQuintals: Number(created.requestedQuantityQuintals),
          offeredPriceInr: Number(created.offeredPriceInr),
        },
      };
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { status: 'cancelled' };
  }>(
    '/requests/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({ status: Type.Literal('cancelled') }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const buyer = await assertBuyerContext(user.id);
      const [updated] = await db
        .update(purchaseRequests)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(purchaseRequests.id, request.params.id), eq(purchaseRequests.buyerId, buyer.id)))
        .returning();
      if (!updated) {
        throw new NotFoundError('Purchase request not found or access denied.');
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

  fastify.get('/orders', async (request) => {
    const user = (request as any).user;
    const buyer = await assertBuyerContext(user.id);

    const rows = await db
      .select({
        req: purchaseRequests,
        cropName: buyerListings.cropName,
        district: buyerListings.district,
        state: buyerListings.state,
        sellerName: farmerProfiles.fullName,
      })
      .from(purchaseRequests)
      .innerJoin(buyerListings, eq(purchaseRequests.listingId, buyerListings.id))
      .innerJoin(farmerProfiles, eq(purchaseRequests.farmerId, farmerProfiles.id))
      .where(
        and(
          eq(purchaseRequests.buyerId, buyer.id),
          inArray(purchaseRequests.status, ['accepted', 'fulfilled'])
        )
      )
      .orderBy(desc(purchaseRequests.updatedAt));

    return {
      data: rows.map(({ req, cropName, district, state, sellerName }) => ({
        ...req,
        requestedQuantityQuintals: Number(req.requestedQuantityQuintals),
        offeredPriceInr: Number(req.offeredPriceInr),
        cropName,
        district,
        state,
        sellerName,
      })),
    };
  });
};
