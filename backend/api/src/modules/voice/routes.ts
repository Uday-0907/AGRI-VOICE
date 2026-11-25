import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SarvamSpeechService } from './sarvam.service.js';
import { VoiceAgentService } from './voice-agent.service.js';

export const voiceRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const sarvam = new SarvamSpeechService();
  const agent = new VoiceAgentService();

  /**
   * GET /voice/status
   * Public non-secret readiness status for telephony, Sarvam speech, and LLM providers.
   */
  fastify.get('/status', async () => {
    const telephonySid = process.env.TELEPHONY_ACCOUNT_SID?.trim();
    const telephonyKey = process.env.TELEPHONY_API_KEY?.trim();
    const virtualNum = process.env.TELEPHONY_VIRTUAL_NUMBER?.trim();
    const exotelConfigured = Boolean(
      telephonySid &&
        telephonyKey &&
        !telephonySid.includes('placeholder') &&
        !telephonyKey.includes('placeholder')
    );

    return {
      data: {
        wsEnabled: process.env.VOICE_WS_ENABLED !== 'false',
        wsPath: process.env.VOICE_WS_PATH || '/voice-stream',
        publicVoiceWsUrl: process.env.PUBLIC_VOICE_WS_URL || null,
        sarvamConfigured: sarvam.isConfigured(),
        exotelConfigured,
        virtualNumberConfigured: Boolean(virtualNum && virtualNum !== '+910000000000'),
        llmProviders: agent.getLlmStatuses(),
        supportedLanguages: ['te-IN', 'hi-IN', 'en-IN', 'ta-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'gu-IN', 'bn-IN'],
      },
    };
  });

  /**
   * POST /voice/ask
   * Authenticated web voice/text assistant endpoint backed by Gemini -> Claude -> OpenAI + VoiceDispatcher tools.
   */
  fastify.post<{ Body: { query: string; language?: string } }>(
    '/ask',
    {
      schema: {
        body: Type.Object({
          query: Type.String({ minLength: 1, maxLength: 1000 }),
          language: Type.Optional(Type.String({ maxLength: 16 })),
        }),
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          error: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required for Voice AI.' },
        });
      }

      const user = (request as any).user as { id: string; phone: string; role?: string };
      if (user.role === 'buyer') {
        return reply.status(403).send({
          error: { statusCode: 403, code: 'FORBIDDEN', message: 'Farmer account required for Voice AI assistant.' },
        });
      }

      const result = await agent.handleTurn(
        {
          sessionId: `web-${Date.now()}`,
          userId: user.id,
          phone: user.phone,
          language: request.body.language || 'en-IN',
        },
        request.body.query
      );

      return { data: result };
    }
  );
};
