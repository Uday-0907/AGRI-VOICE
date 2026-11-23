import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

// Define a common interface for pillar modules
export interface PillarModule {
  prefix: string;
  register: FastifyPluginAsync;
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('registerPillar', async (module: PillarModule) => {
    fastify.register(module.register, { prefix: module.prefix });
  });
});
