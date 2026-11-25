import { PillarModule } from '../../plugins/register-pillar.js';
import { machineryRoutes } from './routes.js';

export const machineryModule: PillarModule = {
  prefix: '/machinery',
  register: async (app, opts) => {
    await machineryRoutes(app, opts);
  },
};
