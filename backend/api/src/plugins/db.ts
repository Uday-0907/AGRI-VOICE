import fp from 'fastify-plugin';
import { db, pool } from '../database/db.js';

export default fp(async (fastify) => {
  fastify.decorate('db', db);
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});
