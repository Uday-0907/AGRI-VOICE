import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Pillar Module Registry Plugin
 * Standardizes route registration across the six agricultural pillars.
 */
export interface PillarModule {
  prefix: string;
  register: (app: FastifyInstance) => Promise<void>;
}

export default fp(async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
  const modules: PillarModule[] = [];

  fastify.decorate('registerPillar', (mod: PillarModule) => {
    fastify.register(mod.register, { prefix: mod.prefix });
    modules.push(mod);
    fastify.log.info(`Registered pillar module: ${mod.prefix}`);
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    registerPillar: (mod: PillarModule) => void;
  }
}
