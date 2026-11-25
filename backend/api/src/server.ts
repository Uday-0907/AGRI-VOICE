/**
 * AgriVoice Application Server Entry Point
 * Fastify HTTP server listener.
 */

import * as dotenvLib from 'dotenv';
import path from 'path';
import { buildApp } from './app.js';
import { initializeScheduler, stopScheduler } from './config/scheduler.js';

const dotenv = dotenvLib.default || dotenvLib;
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    const address = await app.listen({ port, host });
    app.log.info(`AgriVoice backend server listening at ${address}`);

    // Initialize background scheduled tasks
    initializeScheduler();

    // Register process signal handlers for graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await stopScheduler();
      try {
        await app.close();
      } catch (closeErr) {
        app.log.error(closeErr);
      }
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    app.log.error(err);
    await stopScheduler();
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
