/**
 * Pillar 3: Weather & Crop Advisory Module
 *
 * Integrates weather data, forecasts, alerts, and crop-aware advisories.
 */

import { PillarModule } from '../../plugins/register-pillar.js';
import { weatherRoutes } from './routes.js';
import { createWeatherVoiceTools } from './voice-tools.js';
import { voiceDispatcher } from '../voice/dispatcher.js';

/**
 * Weather Module
 *
 * Provides:
 * - Current weather and forecasts via Open-Meteo
 * - Crop-aware agricultural advisories
 * - Voice AI tools for weather queries
 */
export const weatherModule: PillarModule = {
  prefix: '/weather',
  register: async (app, _opts) => {
    // 1. Register Fastify HTTP routes
    await weatherRoutes(app);

    // 2. Register Pillar 3 Voice AI tools with the platform voice dispatcher
    const tools = createWeatherVoiceTools();
    for (const tool of tools) {
      if (!voiceDispatcher.hasTool(tool.name)) {
        voiceDispatcher.registerTool(tool);
      }
    }
  },
};

// Re-export services for external use
export { weatherService } from './services/weather.service.js';
export { advisoryService } from './services/advisory.service.js';

// Re-export types
export * from './services/weather.service.js';
export * from './services/advisory.service.js';
export * from './providers/weather-provider.interface.js';