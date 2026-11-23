import fastify from 'fastify';

/**
 * AgriVoice Application Backend
 * Core application initialization with Fastify.
 */
export async function buildApp() {
  const app = fastify({
    logger: {
      level: 'info',
    },
  });

  // TODO: Register core plugins (auth, db, telemetry)

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}
