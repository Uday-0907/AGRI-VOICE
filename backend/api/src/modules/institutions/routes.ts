import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { institutionalSchemes, schemeApplications } from '../../database/schema/index.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import { NotFoundError } from '../../common/errors/index.js';

const REFERENCE_SCHEMES = [
  {
    schemeCode: 'PM-KISAN',
    title: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    category: 'subsidy',
    authority: 'Ministry of Agriculture & Farmers Welfare, Govt. of India',
    eligibilitySummary: 'Small and marginal landholding farmer families with cultivable land records.',
    benefitSummary: 'Direct income support of Rs. 6,000 per year in three equal installments.',
    applicationUrl: 'https://pmkisan.gov.in/',
    source: 'public_reference',
    isActive: true,
  },
  {
    schemeCode: 'PMFBY',
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    category: 'insurance',
    authority: 'Department of Agriculture & Farmers Welfare',
    eligibilitySummary: 'All farmers growing notified crops in notified areas (loanee and non-loanee).',
    benefitSummary: 'Comprehensive crop loss coverage for natural calamities, pests, and post-harvest losses.',
    applicationUrl: 'https://pmfby.gov.in/',
    source: 'public_reference',
    isActive: true,
  },
  {
    schemeCode: 'KCC-AGRI',
    title: 'Kisan Credit Card (KCC) Crop Loan Scheme',
    category: 'credit',
    authority: 'NABARD / Scheduled Commercial & Cooperative Banks',
    eligibilitySummary: 'Cultivating farmers, tenant farmers, oral lessees, and SHGs.',
    benefitSummary: 'Short-term crop cultivation credit with interest subvention for timely repayment.',
    applicationUrl: 'https://www.nabard.org/',
    source: 'public_reference',
    isActive: true,
  },
  {
    schemeCode: 'SHC-SUBSIDY',
    title: 'Soil Health Card & Micronutrient Assistance',
    category: 'advisory',
    authority: 'National Mission for Sustainable Agriculture (NMSA)',
    eligibilitySummary: 'Registered farmers seeking soil testing and balanced nutrient management.',
    benefitSummary: 'Periodic soil testing and crop-wise fertilizer recommendation support.',
    applicationUrl: 'https://soilhealth.dac.gov.in/',
    source: 'public_reference',
    isActive: true,
  },
];

async function ensureReferenceSchemes() {
  const existing = await db.select().from(institutionalSchemes).limit(1);
  if (existing.length === 0) {
    await db.insert(institutionalSchemes).values(REFERENCE_SCHEMES).onConflictDoNothing();
  }
}

export const institutionsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Institutions services.' },
      });
    }
  });

  fastify.get<{ Querystring: { category?: string } }>(
    '/schemes',
    {
      schema: {
        tags: ['Institutions'],
        querystring: Type.Object({ category: Type.Optional(Type.String()) }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      await assertFarmerContext(user.id);
      await ensureReferenceSchemes();
      const rows = request.query.category?.trim()
        ? await db
            .select()
            .from(institutionalSchemes)
            .where(eq(institutionalSchemes.category, request.query.category.trim()))
        : await db.select().from(institutionalSchemes);
      return { data: rows };
    }
  );

  fastify.get('/applications', async (request) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const rows = await db
      .select()
      .from(schemeApplications)
      .where(eq(schemeApplications.farmerId, profile.id))
      .orderBy(desc(schemeApplications.createdAt));
    return { data: rows };
  });

  fastify.post<{
    Body: { schemeCode: string; schemeTitle: string; category: string; farmId?: string; notes?: string };
  }>(
    '/applications',
    {
      schema: {
        tags: ['Institutions'],
        body: Type.Object({
          schemeCode: Type.String({ minLength: 2, maxLength: 48 }),
          schemeTitle: Type.String({ minLength: 2, maxLength: 160 }),
          category: Type.String({ minLength: 2, maxLength: 48 }),
          farmId: Type.Optional(Type.String({ format: 'uuid' })),
          notes: Type.Optional(Type.String({ maxLength: 500 })),
        }),
      },
    },
    async (request, reply) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [created] = await db
        .insert(schemeApplications)
        .values({
          farmerId: profile.id,
          schemeCode: request.body.schemeCode.trim(),
          schemeTitle: request.body.schemeTitle.trim(),
          category: request.body.category.trim(),
          farmId: request.body.farmId || null,
          status: 'submitted',
          notes: request.body.notes?.trim() || null,
        })
        .returning();
      reply.status(201);
      return { data: created };
    }
  );

  fastify.patch<{
    Params: { id: string };
    Body: { status: 'withdrawn' | 'submitted' };
  }>(
    '/applications/:id',
    {
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          status: Type.Union([Type.Literal('withdrawn'), Type.Literal('submitted')]),
        }),
      },
    },
    async (request) => {
      const user = (request as any).user;
      const profile = await assertFarmerContext(user.id);
      const [updated] = await db
        .update(schemeApplications)
        .set({ status: request.body.status, updatedAt: new Date() })
        .where(and(eq(schemeApplications.id, request.params.id), eq(schemeApplications.farmerId, profile.id)))
        .returning();
      if (!updated) {
        throw new NotFoundError('Scheme application not found or access denied.');
      }
      return { data: updated };
    }
  );
};
