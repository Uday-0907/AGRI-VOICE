import { PillarModule } from '../../plugins/register-pillar.js';
import { institutionsRoutes } from './routes.js';

export const institutionsModule: PillarModule = {
  prefix: '/institutions',
  register: async (app, opts) => {
    await institutionsRoutes(app, opts);
  },
};
