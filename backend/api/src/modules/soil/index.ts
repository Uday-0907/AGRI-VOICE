import { PillarModule } from '../../plugins/register-pillar.js';
import { soilRoutes } from './routes.js';

/**
 * Pillar 6: Soil Health & Input Verification Module
 */
export const soilModule: PillarModule = {
  prefix: '/soil',
  register: soilRoutes,
};

export * from './contracts.js';
export * from './services/soil-report.service.js';
export * from './services/input-verification.service.js';
export * from './services/soil-voice.service.js';
export * from './providers/shc-provider.interface.js';
export * from './providers/input-verification-provider.interface.js';
