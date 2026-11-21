/**
 * AgriVoice Application Server Entry Point
 * Fastify HTTP server listener placeholder.
 */

import { buildApp } from './app.js';

async function start() {
  const app = await buildApp();
  console.log('AgriVoice backend server placeholder:', app);
}

if (process.env.NODE_ENV !== 'test') {
  start();
}
