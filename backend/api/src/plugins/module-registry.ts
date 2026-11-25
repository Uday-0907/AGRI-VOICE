import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Pillar Module Registry Plugin
 * Standardizes route registration across the six agricultural pillars.
 */
export interface PillarModule {
  prefix: string;
  register: FastifyPluginAsync;
}

export default fp(async (fastify: FastifyInstance) => {
  const modules: PillarModule[] = [];

  fastify.decorate('registerPillar', (mod: PillarModule) => {
    fastify.register(mod.register, { prefix: mod.prefix });
    modules.push(mod);
    fastify.log.info(`[Registry] Registered pillar module at ${mod.prefix}`);
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    registerPillar: (mod: PillarModule) => void;
  }
}
