import { PillarModule } from '../../plugins/register-pillar.js';
import { farmersRoutes } from './routes.js';

export const farmersModule: PillarModule = {
  prefix: '/farmers',
  register: async (app, opts) => {
    await farmersRoutes(app, opts);
  },
};
