/**
 * Weather Module Routes
 *
 * Fastify HTTP routes for Pillar 3 - Weather & Crop Advisory
 */

import { FastifyInstance, FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { Type } from '@sinclair/typebox';
import { weatherService } from './services/weather.service.js';
import { advisoryService, AdvisoryCategory } from './services/advisory.service.js';
import { assertFarmOwnership, assertFieldOwnership, assertFarmerContext } from '../../common/auth/ownership.js';
import { db } from '../../database/db.js';
import { farms, weatherAlerts } from '../../database/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';

// Request/Response Schemas
const FarmParams = Type.Object({
  farmId: Type.String({ format: 'uuid' }),
});

const FieldParams = Type.Object({
  fieldId: Type.String({ format: 'uuid' }),
});

// NOTE: For type=hourly the Open-Meteo provider caps requests at 48 h (2 days).
// The service enforces max=2 days when hourly is requested; daily supports up to 14 days.
const ForecastQuery = Type.Object({
  days: Type.Optional(Type.Integer({ minimum: 1, maximum: 14, default: 7 })),
  type: Type.Optional(Type.Union([Type.Literal('hourly'), Type.Literal('daily')], { default: 'daily' })),
});

const AdvisoryQuery = Type.Object({
  category: Type.Optional(Type.Union([
    Type.Literal('irrigation'),
    Type.Literal('fertilizer'),
    Type.Literal('pesticide'),
    Type.Literal('harvest'),
    Type.Literal('sowing'),
    Type.Literal('weather_alert'),
    Type.Literal('crop_protection'),
    Type.Literal('general'),
  ])),
});

const RefreshBody = Type.Object({
  farmId: Type.Optional(Type.String({ format: 'uuid' })),
  force: Type.Optional(Type.Boolean({ default: false })),
});

// Route handler wrapper for authentication
async function withAuth<T extends RouteGenericInterface>(
  request: FastifyRequest<T>,
  reply: FastifyReply,
  handler: (userId: string) => Promise<any>
) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }
  const userId = (request.user as any).id;
  return await handler(userId);
}

export async function weatherRoutes(fastify: FastifyInstance) {

  const dashboardSchema = {
    schema: {
      tags: ['Weather'],
      summary: 'Weather dashboard',
      description: 'Get weather overview for authenticated farmer',
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({
          data: Type.Object({
            farmId: Type.String(),
            farmName: Type.String(),
            currentWeather: Type.Object({
              temperature: Type.Union([Type.Number(), Type.Null()]),
              humidity: Type.Union([Type.Number(), Type.Null()]),
              rainfall: Type.Number(),
              windSpeed: Type.Union([Type.Number(), Type.Null()]),
              dataStatus: Type.String(),
            }),
            todayForecast: Type.Union([
              Type.Null(),
              Type.Object({
                high: Type.Union([Type.Number(), Type.Null()]),
                low: Type.Union([Type.Number(), Type.Null()]),
                rainfallProb: Type.Union([Type.Number(), Type.Null()]),
              }),
            ]),
            advisories: Type.Array(Type.Object({
              id: Type.String(),
              category: Type.String(),
              severity: Type.String(),
              advisoryText: Type.String(),
              generatedAt: Type.Union([Type.String(), Type.Any()]),
            })),
            lastUpdated: Type.String(),
          }),
        }),
      },
    },
  };

  const handleDashboard = async (request: FastifyRequest, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const profile = await assertFarmerContext(userId);

      // Get farmer's first farm
      const [farm] = await db
        .select()
        .from(farms)
        .where(eq(farms.farmerId, profile.id))
        .limit(1);

      if (!farm) {
        return reply.status(404).send({
          error: { code: 'NO_FARM', message: 'No farm found for farmer' }
        });
      }

      const weather = await weatherService.getCurrentWeather(farm.id);
      const forecast = await weatherService.getForecast(farm.id, undefined, 1, 'daily');
      const advisories = await advisoryService.getAdvisories(farm.id);

      return {
        data: {
          farmId: farm.id,
          farmName: farm.farmName,
          currentWeather: {
            temperature: weather.temperature,
            humidity: weather.humidity,
            rainfall: weather.rainfall || 0,
            windSpeed: weather.windSpeed,
            dataStatus: weather.dataStatus,
          },
          todayForecast: forecast.length > 0 ? {
            high: forecast[0].temperatureMax,
            low: forecast[0].temperatureMin,
            rainfallProb: forecast[0].rainfallProbability,
          } : null,
          advisories: advisories.slice(0, 5).map(a => ({
            id: a.id,
            category: a.category,
            severity: a.severity,
            advisoryText: a.advisoryText,
            generatedAt: a.generatedAt ? new Date(a.generatedAt).toISOString() : new Date().toISOString(),
          })),
          lastUpdated: new Date().toISOString(),
        },
      };
    });
  };

  // Canonical path: /weather/dashboard (prefix /weather + route /dashboard)
  fastify.get('/dashboard', dashboardSchema, handleDashboard);

  /**
   * GET /farms/:farmId/current
   * Current weather for specific farm
   */
  const farmCurrentSchema = {
    schema: {
      tags: ['Weather'],
      summary: 'Current weather for farm',
      params: FarmParams,
      security: [{ bearerAuth: [] }],
    },
  };

  const handleFarmCurrent = async (request: FastifyRequest<{ Params: { farmId: string } }>, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const { farm } = await assertFarmOwnership(userId, request.params.farmId);
      const weather = await weatherService.getCurrentWeather(farm.id);

      return {
        data: {
          ...weather,
          farmName: farm.farmName,
        },
      };
    });
  };

  fastify.get('/farms/:farmId/current', farmCurrentSchema, handleFarmCurrent);

  /**
   * GET /fields/:fieldId/forecast
   * Forecast for specific field
   */
  const fieldForecastSchema = {
    schema: {
      tags: ['Weather'],
      summary: 'Weather forecast for field',
      params: FieldParams,
      querystring: ForecastQuery,
      security: [{ bearerAuth: [] }],
    },
  };

  const handleFieldForecast = async (request: FastifyRequest<{ Params: { fieldId: string }, Querystring: { days?: number, type?: 'hourly' | 'daily' } }>, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const { field, farm } = await assertFieldOwnership(userId, request.params.fieldId);
      const { days = 7, type = 'daily' } = request.query;

      const forecast = await weatherService.getForecast(farm.id, field.id, days, type);

      return {
        data: {
          fieldId: field.id,
          fieldName: field.fieldName,
          forecast,
        },
      };
    });
  };

  fastify.get('/fields/:fieldId/forecast', fieldForecastSchema, handleFieldForecast);

  /**
   * GET /alerts
   * Active weather alerts for farmer's farms
   */
  const alertsSchema = {
    schema: {
      tags: ['Weather'],
      summary: 'Weather alerts',
      security: [{ bearerAuth: [] }],
    },
  };

  const handleAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const profile = await assertFarmerContext(userId);

      const farmerFarms = await db
        .select({ id: farms.id })
        .from(farms)
        .where(eq(farms.farmerId, profile.id));

      if (farmerFarms.length === 0) {
        return {
          data: {
            alerts: [],
          },
        };
      }

      const farmIds = farmerFarms.map(f => f.id);
      const alerts = await db
        .select()
        .from(weatherAlerts)
        .where(
          and(
            inArray(weatherAlerts.locationId, farmIds),
            eq(weatherAlerts.isActive, true)
          )
        );

      return {
        data: {
          alerts: alerts.map(a => ({
            id: a.id,
            alertType: a.alertType,
            severity: a.severity,
            headline: a.headline,
            description: a.description,
            recommendedAction: a.recommendedAction,
            validFrom: a.validFrom,
            validTo: a.validTo,
          })),
        },
      };
    });
  };

  fastify.get('/alerts', alertsSchema, handleAlerts);

  /**
   * GET /advisory/farms/:farmId
   * Crop advisories for farm
   */
  const advisorySchema = {
    schema: {
      tags: ['Advisory'],
      summary: 'Crop advisories for farm',
      params: FarmParams,
      querystring: AdvisoryQuery,
      security: [{ bearerAuth: [] }],
    },
  };

  const handleAdvisories = async (request: FastifyRequest<{ Params: { farmId: string }, Querystring: { category?: string } }>, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const { farm } = await assertFarmOwnership(userId, request.params.farmId);

      // Generate any fresh advisories for today, then return active advisories (with optional category filter)
      await advisoryService.generateAdvisories(farm.id);
      const advisories = await advisoryService.getAdvisories(
        farm.id,
        request.query.category as AdvisoryCategory | undefined
      );

      return {
        data: {
          farmId: farm.id,
          farmName: farm.farmName,
          advisories: advisories.map(a => ({
            id: a.id,
            category: a.category,
            severity: a.severity,
            advisoryText: a.advisoryText,
            validFrom: a.validFrom,
            validTo: a.validTo,
            evidenceSource: a.evidenceSource,
            evidenceStrength: a.evidenceStrength,
            verificationStatus: a.verificationStatus,
            generatedAt: a.generatedAt,
          })),
        },
      };
    });
  };

  // Canonical path: /weather/advisory/farms/:farmId. The former plural alias
  // was an accidental duplicate and has been removed.
  fastify.get('/advisory/farms/:farmId', advisorySchema, handleAdvisories);

  /**
   * POST /webhook/exotel
   * Inbound Exotel telephony webhook (Template)
   */
  const exotelSchema = {
    schema: {
      tags: ['Voice'],
      summary: 'Exotel Inbound Webhook',
      description: 'Handles inbound telephony webhooks from Exotel.',
      body: Type.Object({
        CallSid: Type.String(),
        From: Type.String(),
        To: Type.String(),
        CallStatus: Type.String(),
      }),
    },
  };

  const handleExotel = async (request: FastifyRequest, reply: FastifyReply) => {
    const { CallSid, From } = request.body as any;

    // 1. Signature Verification: Placeholder for provider-specific security
    // TODO: Verify Exotel webhook signature here if provider documentation provides one

    // 2. Normalize Caller
    const callerId = From ? From.replace(/\D/g, '') : '';

    // 3. Idempotency Check: Log event ID or check session
    console.log(`[Webhook] Inbound call received. SID: ${CallSid}, From: ${callerId}`);

    return reply.status(200).send({
      message: 'Webhook received',
    });
  };

  fastify.post('/webhook/exotel', exotelSchema, handleExotel);

  /**
   * POST /refresh
   * Manual weather data refresh
   */
  const refreshSchema = {
    schema: {
      tags: ['Weather'],
      summary: 'Refresh weather data',
      body: RefreshBody,
      security: [{ bearerAuth: [] }],
    },
  };

  const handleRefresh = async (request: FastifyRequest<{ Body: { farmId?: string, force?: boolean } }>, reply: FastifyReply) => {
    return withAuth(request, reply, async (userId) => {
      const profile = await assertFarmerContext(userId);
      let targetFarmId: string;

      if (request.body?.farmId) {
        const { farm } = await assertFarmOwnership(userId, request.body.farmId);
        targetFarmId = farm.id;
      } else {
        const [farm] = await db
          .select({ id: farms.id })
          .from(farms)
          .where(eq(farms.farmerId, profile.id))
          .limit(1);

        if (!farm) {
          return reply.status(404).send({
            error: { code: 'NO_FARM', message: 'No farm found for farmer' },
          });
        }
        targetFarmId = farm.id;
      }

      // Execute actual refresh — force=true bypasses cache and fetches from provider
      const isForce = Boolean(request.body?.force);
      await weatherService.getCurrentWeather(targetFarmId, undefined, isForce);

      return {
        data: {
          status: 'refreshed',
          forced: isForce,
          message: isForce
            ? 'Weather data fetched directly from provider (cache bypassed)'
            : 'Weather data refreshed (served from cache if data was recent)',
        },
      };
    });
  };

  fastify.post('/refresh', refreshSchema, handleRefresh);
}