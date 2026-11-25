import { PillarModule } from '../../plugins/register-pillar.js';
import { researchRoutes } from './routes.js';

export const researchModule: PillarModule = {
  prefix: '/research',
  register: async (app, opts) => {
    await researchRoutes(app, opts);
  },
};
