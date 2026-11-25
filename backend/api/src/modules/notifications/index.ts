import { PillarModule } from '../../plugins/register-pillar.js';
import { notificationsRoutes } from './routes.js';

export const notificationsModule: PillarModule = {
  prefix: '/notifications',
  register: async (app, opts) => {
    await notificationsRoutes(app, opts);
  },
};
