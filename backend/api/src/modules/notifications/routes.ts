import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { notifications } from '../../database/schema/index.js';
import { NotFoundError } from '../../common/errors/index.js';

export const notificationsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Notifications.' },
      });
    }
  });

  fastify.get('/', async (request) => {
    const user = (request as any).user;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return { data: rows };
  });

  fastify.patch<{ Params: { id: string } }>(
    '/:id/read',
    { schema: { params: Type.Object({ id: Type.String({ format: 'uuid' }) }) } },
    async (request) => {
      const user = (request as any).user;
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, request.params.id), eq(notifications.userId, user.id)))
        .returning();
      if (!updated) {
        throw new NotFoundError('Notification not found.');
      }
      return { data: updated };
    }
  );

  fastify.post('/read-all', async (request) => {
    const user = (request as any).user;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, user.id));
    return { data: { updated: true } };
  });
};
