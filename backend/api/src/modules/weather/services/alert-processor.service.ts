import { db } from '../../../database/db.js';
import { weatherAlerts } from '../../../database/schema/weather.js';
import { eq, and, lte } from 'drizzle-orm';

export class AlertProcessorService {
  /**
   * Processes active weather alerts to ensure they remain relevant
   * or marks them as inactive if they have expired.
   */
  async processActiveAlerts(): Promise<void> {
    const now = new Date();

    // Mark alerts as inactive if validTo is in the past
    await db
      .update(weatherAlerts)
      .set({ isActive: false })
      .where(and(eq(weatherAlerts.isActive, true), lte(weatherAlerts.validTo, now)));
  }

  /**
   * Retrieves active alerts for a specific location.
   */
  async getActiveAlerts(locationId: string) {
    return await db
      .select()
      .from(weatherAlerts)
      .where(and(eq(weatherAlerts.locationId, locationId), eq(weatherAlerts.isActive, true)));
  }
}
