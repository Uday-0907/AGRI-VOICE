import { PillarModule } from '../../plugins/register-pillar.js';
import { buyerRoutes } from './routes.js';

export const buyerModule: PillarModule = {
  prefix: '/buyer',
  register: async (app, opts) => {
    await buyerRoutes(app, opts);
  },
};
