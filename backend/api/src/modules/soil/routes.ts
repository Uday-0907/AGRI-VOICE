import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { SoilReportService } from './services/soil-report.service.js';
import { InputVerificationService } from './services/input-verification.service.js';
import { SoilVoiceService } from './services/soil-voice.service.js';
import { assertFarmerContext } from '../../common/auth/ownership.js';
import {
  SoilLookupRequestSchema,
  SoilLookupRequest,
  SoilReportListQuerySchema,
  SoilReportListQuery,
  InputVerificationRequestSchema,
  InputVerificationRequest,
  InputVerificationListQuerySchema,
  InputVerificationListQuery,
  InputCategory,
} from './contracts.js';
import { Type } from '@sinclair/typebox';

export const soilRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const soilReportService = new SoilReportService();
  const inputService = new InputVerificationService();
  const voiceService = new SoilVoiceService(soilReportService, inputService);

  // Authentication hook for all routes in this pillar module
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        error: {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access Soil Health & Input Verification services.',
        },
      });
    }
  });

  // ============================================================================
  // Soil Health APIs (Web)
  // ============================================================================

  /**
   * GET /soil/dashboard
   * Returns latest report, soil summary KPIs, and recent test history.
   */
  fastify.get('/dashboard', async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const dashboard = await soilReportService.getDashboard(profile.id);
    return { data: dashboard };
  });

  /**
   * POST /soil/lookup
   * Initiates a Soil Health Card lookup and persists normalized results.
   */
  fastify.post<{ Body: SoilLookupRequest }>('/lookup', {
    schema: {
      body: SoilLookupRequestSchema,
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const report = await soilReportService.lookupAndSaveCard(profile.id, request.body);
    reply.status(201);
    return { data: report };
  });

  /**
   * GET /soil/reports
   * Lists historical soil reports with pagination and optional farm/field filter.
   */
  fastify.get<{ Querystring: SoilReportListQuery }>('/reports', {
    schema: {
      querystring: SoilReportListQuerySchema,
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const result = await soilReportService.listReports(profile.id, request.query);
    return {
      data: result.data,
      meta: {
        pagination: {
          limit: result.limit,
          offset: result.offset,
          total: result.total,
        },
        timestamp: new Date().toISOString(),
      },
    };
  });

  /**
   * GET /soil/reports/:id
   * Retrieves single soil report details by ID with ownership enforcement.
   */
  fastify.get<{ Params: { id: string } }>('/reports/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const report = await soilReportService.getReportById(profile.id, request.params.id);
    return { data: report };
  });

  /**
   * POST /soil/reports/:id/refresh
   * Re-queries the upstream source for the specified report without dropping historical versions.
   */
  fastify.post<{ Params: { id: string } }>('/reports/:id/refresh', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const refreshed = await soilReportService.refreshReport(profile.id, request.params.id);
    return { data: refreshed };
  });

  // ============================================================================
  // Agricultural Input Verification APIs (Web)
  // ============================================================================

  /**
   * POST /soil/inputs/verify
   * Submits a seed, fertilizer, or pesticide for license and batch verification.
   */
  fastify.post<{ Body: InputVerificationRequest }>('/inputs/verify', {
    schema: {
      body: InputVerificationRequestSchema,
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const result = await inputService.verifyAndSave(profile.id, request.body);
    reply.status(201);
    return { data: result };
  });

  /**
   * GET /soil/inputs/verifications
   * Lists farmer's input verification history.
   */
  fastify.get<{ Querystring: InputVerificationListQuery }>('/inputs/verifications', {
    schema: {
      querystring: InputVerificationListQuerySchema,
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const result = await inputService.listVerifications(profile.id, request.query);
    return {
      data: result.data,
      meta: {
        pagination: {
          limit: result.limit,
          offset: result.offset,
          total: result.total,
        },
        timestamp: new Date().toISOString(),
      },
    };
  });

  /**
   * GET /soil/inputs/verifications/:id
   * Retrieves single input verification record by ID with ownership enforcement.
   */
  fastify.get<{ Params: { id: string } }>('/inputs/verifications/:id', {
    schema: {
      params: Type.Object({
        id: Type.String({ format: 'uuid' }),
      }),
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const profile = await assertFarmerContext(user.id);
    const record = await inputService.getVerificationById(profile.id, request.params.id);
    return { data: record };
  });

  // ============================================================================
  // Voice AI Backend Tools / Operations
  // ============================================================================

  /**
   * GET /soil/voice/context
   * Returns structured soil health facts, data freshness, and AI guidance for phone calls.
   */
  fastify.get('/voice/context', async (request, reply) => {
    const user = (request as any).user;
    const voiceContext = await voiceService.getVoiceSoilContext(user.id);
    return { data: voiceContext };
  });

  /**
   * POST /soil/voice/verify-input
   * Voice tool operation to verify inputs directly from telephone speech flow.
   */
  fastify.post<{
    Body: {
      productName: string;
      category: any;
      brand?: string;
      batchNumber?: string;
      providerMode?: any;
    };
  }>('/voice/verify-input', {
    schema: {
      body: Type.Object({
        productName: Type.String({ minLength: 1 }),
        category: InputCategory,
        brand: Type.Optional(Type.String()),
        batchNumber: Type.Optional(Type.String()),
        providerMode: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('official'), Type.Literal('demo')])),
      }),
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const voiceVerification = await voiceService.verifyInputForVoice(user.id, request.body);
    return { data: voiceVerification };
  });
};
