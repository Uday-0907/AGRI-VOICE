import { PillarModule } from '../../plugins/register-pillar.js';
import { voiceRoutes } from './routes.js';
import { registerPlatformVoiceTools } from './voice-tools-registry.js';

export const voiceModule: PillarModule = {
  prefix: '/voice',
  register: async (app, opts) => {
    registerPlatformVoiceTools();
    await voiceRoutes(app, opts);
  },
};

export * from './dispatcher.js';
export * from './audio-utils.js';
export * from './sarvam.service.js';
export * from './llm.service.js';
export * from './voice-agent.service.js';
export * from './voice-tools-registry.js';
export * from './exotel-ws.js';
