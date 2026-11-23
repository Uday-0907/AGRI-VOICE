import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';

export interface UserContext {
  id: string;
  phone: string;
  farmerId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userContext?: UserContext;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  // Global hook to attach user context if JWT is verified
  fastify.decorateRequest('userContext', undefined);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    // If request has JWT payload, populate user context
    if ((request as any).user) {
      request.userContext = {
        id: (request as any).user.id,
        phone: (request as any).user.phone,
      };
    }
  });
});
