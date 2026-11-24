import fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import authPlugin from './plugins/auth.js';
import dbPlugin from './plugins/db.js';
import registryPlugin from './plugins/module-registry.js';
import contextPlugin from './plugins/context.js';
import { soilModule } from './modules/soil/index.js';

export async function buildApp() {
  const app = fastify({
    logger: { level: 'info' },
  });

  // Core security & utility
  await app.register(sensible);
  await app.register(cors);
  await app.register(helmet);

  // OpenAPI / Swagger Documentation (registered before any API routes)
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'AgriVoice API',
        version: '1.0.0',
        description: 'AgriVoice Agricultural Services Backend API',
      },
      servers: [
        {
          url: '/',
          description: 'Current server environment',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter JWT bearer token for authorized access to protected endpoints.',
          },
        },
      },
    },
  });

  // Swagger UI (registered after Swagger, routePrefix /documentation)
  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });

  // Core Infrastructure
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(contextPlugin);
  await app.register(registryPlugin);

  // Pillar Modules
  app.registerPillar(soilModule);

  // Public Health Endpoint
  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'API Health Check',
      description: 'Returns operational status and timestamp of the AgriVoice API.',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
