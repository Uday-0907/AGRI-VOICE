import { PillarModule } from '../../plugins/register-pillar.js';
import { authRoutes } from './routes.js';

export const authModule: PillarModule = {
  prefix: '/auth',
  register: async (app) => {
    await app.register(authRoutes);
  },
};
