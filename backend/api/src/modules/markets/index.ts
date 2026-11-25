import { PillarModule } from '../../plugins/register-pillar.js';
import { marketsRoutes } from './routes.js';

export const marketsModule: PillarModule = {
  prefix: '/markets',
  register: async (app, opts) => {
    await marketsRoutes(app, opts);
  },
};
