import fastify from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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

  // Core Infrastructure
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(contextPlugin);
  await app.register(registryPlugin);

  // Pillar Modules
  app.registerPillar(soilModule);

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
