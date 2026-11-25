import { PillarModule } from '../../plugins/register-pillar.js';
import { soilRoutes } from './routes.js';
import { createSoilVoiceTools } from './voice-tools.js';
import { voiceDispatcher } from '../voice/dispatcher.js';

/**
 * Pillar 6: Soil Health & Input Verification Module
 */
export const soilModule: PillarModule = {
  prefix: '/soil',
  register: async (app, opts) => {
    // 1. Register Fastify HTTP routes
    await soilRoutes(app, opts);

    // 2. Register Pillar 6 Voice AI tools with the platform voice dispatcher
    const tools = createSoilVoiceTools();
    for (const tool of tools) {
      if (!voiceDispatcher.hasTool(tool.name)) {
        voiceDispatcher.registerTool(tool);
      }
    }
  },
};

export * from './contracts.js';
export * from './services/soil-report.service.js';
export * from './services/input-verification.service.js';
export * from './services/soil-voice.service.js';
export * from './providers/shc-provider.interface.js';
export * from './providers/input-verification-provider.interface.js';
export * from './voice-tools.js';
