import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

export default fp(async (fastify) => {
  fastify.register(cors);
  fastify.register(helmet);
});
