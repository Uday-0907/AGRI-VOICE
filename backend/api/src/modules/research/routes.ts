import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { extensionBulletins, farmerFieldQueries } from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';

const REFERENCE_BULLETINS = [
  {
    bulletinCode: 'ICAR-PADDY-AWD-01',
    title: 'Alternate Wetting and Drying (AWD) Irrigation in Transplanted Paddy',
    crop: 'Paddy',
    category: 'water',
    summary: 'Reduces irrigation water use by 15-25% without yield penalty during vegetative stage.',
    recommendationText: 'Maintain 2-3 cm standing water during transplanting and flowering; allow water to recede 10-15 cm below soil surface before next irrigation during mid-tillering.',
    sourceAuthority: 'ICAR-Indian Institute of Rice Research (Public Reference)',
    state: 'Andhra Pradesh',
  },
  {
    bulletinCode: 'KVK-CHILLI-IPM-02',
    title: 'Integrated Pest Management for Chilli Thrips and Mites',
    crop: 'Chilli',
    category: 'pest_management',
    summary: 'Use yellow/blue sticky traps and neem-based botanicals before targeted chemical sprays.',
    recommendationText: 'Install 10-12 blue sticky traps per acre; avoid indiscriminate synthetic pyrethroid sprays which trigger mite resurgence.',
    sourceAuthority: 'Krishi Vigyan Kendra (KVK) Extension Advisory (Public Reference)',
    state: 'Andhra Pradesh',
  },
  {
    bulletinCode: 'ICAR-COTTON-NUTRIENT-03',
    title: 'Split Nitrogen & Foliar Magnesium Management in Cotton',
    crop: 'Cotton',
    category: 'agronomy',
    summary: 'Prevents premature leaf reddening and improves boll retention in black cotton soils.',
    recommendationText: 'Apply nitrogen in 3 split doses (basal, squaring, boll development) and foliar spray 1% MgSO4 at 60 and 75 DAS if leaf reddening appears.',
    sourceAuthority: 'ICAR-Central Institute for Cotton Research (Public Reference)',
    state: 'Telangana',
  },
];

async function ensureReferenceBulletins() {
  const existing = await db.select().from(extensionBulletins).limit(1);
  if (existing.length === 0) {
    await db.insert(extensionBulletins).values(REFERENCE_BULLETINS).onConflictDoNothing();
  }
}

export const researchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Research & Extension services.' },
      });
    }
  });

  fastify.get<{ Querystring: { crop?: string; category?: string } }>(
    '/bulletins',
    {
      schema: {
        tags: ['Research'],
        querystring: Type.Object({
          crop: Type.Optional(Type.String()),
          category: Type.Optional(Type.String()),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      await assertFarmerContext(user.id);
      await ensureReferenceBulletins();
      const conditions = [];
      if (request.query.crop?.trim()) {
        conditions.push(ilike(extensionBulletins.crop, `%${request.query.crop.trim()}%`));
      }
      if (request.query.category?.trim()) {
        conditions.push(eq(extensionBulletins.category, request.query.category.trim()));
      }
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(extensionBulletins)
        .where(whereClause)
        .orderBy(desc(extensionBulletins.publishedDate));
      return { data: rows };
    }
  );

  fastify.get('/queries', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const rows = await db
      .select()
      .from(farmerFieldQueries)
      .where(eq(farmerFieldQueries.farmerId, profile.id))
      .orderBy(desc(farmerFieldQueries.createdAt));
    return { data: rows };
  });

  fastify.post<{ Body: { crop: string; topic: string; questionText: string } }>(
    '/queries',
    {
      schema: {
        tags: ['Research'],
        body: Type.Object({
          crop: Type.String({ minLength: 2, maxLength: 80 }),
          topic: Type.String({ minLength: 2, maxLength: 120 }),
          questionText: Type.String({ minLength: 5, maxLength: 1000 }),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [created] = await db
        .insert(farmerFieldQueries)
        .values({
          farmerId: profile.id,
          crop: request.body.crop.trim(),
          topic: request.body.topic.trim(),
          questionText: request.body.questionText.trim(),
          status: 'open',
        })
        .returning();
      reply.status(201);
      return { data: created };
    }
  );
};
