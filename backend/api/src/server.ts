/**
 * AgriVoice Application Server Entry Point
 * Fastify HTTP server listener.
 */

import * as dotenvLib from 'dotenv';
import path from 'path';
import { buildApp } from './app.js';

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
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
