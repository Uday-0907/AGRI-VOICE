/**
 * Weather Service
 *
 * Canonical weather service for retrieving and storing weather data.
 * Independent of provider implementation.
 */

import { db } from '../../../database/db.js';
import { weatherObservations, weatherForecasts, weatherProviders, weatherAlerts, farms, fields } from '../../../database/schema/index.js';
import { eq, and, desc, gte, lt, or, sql } from 'drizzle-orm';
import { createWeatherProvider } from '../providers/open-meteo.provider.js';
import type { WeatherProvider } from '../providers/weather-provider.interface.js';

export type DataStatus = 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';

export interface WeatherDataResponse {
  id: string;
  locationId: string;
  locationType: 'farm' | 'field';
  dataStatus: DataStatus;
  provider: string;
  observedAt: Date;
  fetchedAt: Date;

  temperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  windGusts: number | null;
  pressure: number | null;
  cloudCover: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
}

export interface ForecastDataResponse {
  id: string;
  locationId: string;
  locationType: 'farm' | 'field';
  dataStatus: DataStatus;
  provider: string;
  forecastType: 'hourly' | 'daily';
  issueAt: Date;
  validAt: Date;

  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  precipitationSum: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  cloudCover: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  sunshineDuration: number | null;
  uvIndex: number | null;
}

export interface LocationContext {
  farmId: string;
  fieldId?: string;
  latitude: number;
  longitude: number;
}

export function parseLocationCoordinates(location: string | { x: number; y: number } | null | undefined): { latitude: number; longitude: number } | null {
  if (!location) return null;

  if (typeof location === 'object' && 'x' in location && 'y' in location) {
    const { x, y } = location;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    if (y < -90 || y > 90 || x < -180 || x > 180) return null;
    return { longitude: x, latitude: y };
  }

  if (typeof location === 'string') {
    const coordMatch = location.match(/POINT\s*\(\s*(\S+)\s+(\S+)\s*\)/i);
    if (coordMatch) {
      const lonRaw = coordMatch[1];
      const latRaw = coordMatch[2];
      // Reject strings that are not purely numeric (e.g. "80.5abc")
      if (!/^-?\d+(\.\d+)?$/.test(lonRaw) || !/^-?\d+(\.\d+)?$/.test(latRaw)) {
        return null;
      }
      const lon = parseFloat(lonRaw);
      const lat = parseFloat(latRaw);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
      return { longitude: lon, latitude: lat };
    }
  }

  return null;
}

export class WeatherService {
  private provider: WeatherProvider;
  private readonly ALERT_POLLING_LOCK_ID = 3001; // Deterministic ID for Pillar 3 advisory locks

  constructor(providerType: string = 'open-meteo') {
    this.provider = createWeatherProvider(providerType);
  }

  /**
   * Run ingestion for all farms
   */
  async runIngestion(): Promise<void> {
    const lockId = 12345; // Deterministic lock ID
    // Note: 'db' is a drizzle-orm instance, 'db.client' accesses the underlying pg driver pool/client
    const client = await (db as any).client.connect();
    try {
      // Acquire session-level lock
      const lockRes = await client.query('SELECT pg_try_advisory_lock($1)', [lockId]);
      if (!lockRes.rows[0].pg_try_advisory_lock) {
        console.log('[Scheduler] Another instance holds the lock, skipping...');
        return;
      }

      try {
        // Run ingestion logic
        const farmsList = await db.select().from(farms);
        for (const farm of farmsList) {
          try {
            // Robust coordinate parsing
            const coords = parseLocationCoordinates(farm.location);
            if (coords) {
              await this.fetchAndStoreCurrentWeather({ farmId: farm.id, latitude: coords.latitude, longitude: coords.longitude }, farm.id, 'farm');
            }
          } catch (farmErr) {
            console.error(`[Scheduler] Ingestion failed for farm ${farm.id}:`, farmErr);
          }
        }
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Poll for new weather alerts from the provider.
   *
   * IMPLEMENTATION STATUS: STUB — no alert-discovery is performed.
   *
   * The Open-Meteo provider does not supply weather alerts. A production
   * implementation would query a secondary alert provider here and persist
   * new records to the weather_alerts table. Until that provider is configured,
   * this method is intentionally a no-op. The scheduler calls
   * alertProcessorService.processActiveAlerts() separately to expire stale
   * persisted alerts regardless of this stub.
   */
  async pollAlerts(): Promise<void> {
    // No-op: alert discovery requires a secondary provider not yet configured.
    // See: Remaining External Dependencies in the Pillar 3 handoff notes.
    console.log('[WeatherService] pollAlerts(): alert discovery stub — no provider configured, skipping.');
  }

  /**
   * Get location context from farm or field
   */
  async resolveLocation(farmId: string, fieldId?: string): Promise<LocationContext> {
    let latitude: number;
    let longitude: number;

    if (fieldId) {
      // Get field location
      const [field] = await db
        .select({ location: fields.location })
        .from(fields)
        .where(eq(fields.id, fieldId))
        .limit(1);

      if (!field || !field.location) {
        throw new Error('Field not found or has no location');
      }

      // Extract coordinates from PostGIS point
      const coords = parseLocationCoordinates(field.location);
      if (!coords) {
        throw new Error('Invalid field location format');
      }

      longitude = coords.longitude;
      latitude = coords.latitude;
    } else {
      // Get farm location
      const [farm] = await db
        .select({ location: farms.location })
        .from(farms)
        .where(eq(farms.id, farmId))
        .limit(1);

      if (!farm || !farm.location) {
        throw new Error('Farm not found or has no location');
      }

      const coords = parseLocationCoordinates(farm.location);
      if (!coords) {
        throw new Error('Invalid farm location format');
      }

      longitude = coords.longitude;
      latitude = coords.latitude;
    }

    return { farmId, fieldId, latitude, longitude };
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(farmId: string, fieldId?: string, forceRefresh: boolean = false): Promise<WeatherDataResponse> {
    const location = await this.resolveLocation(farmId, fieldId);
    const locationId = fieldId || farmId;
    const locationType = fieldId ? 'field' : 'farm';

    if (!forceRefresh) {
      // Check for recent cached data first (within 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const [recentObservation] = await db
        .select()
        .from(weatherObservations)
        .where(
          and(
            eq(weatherObservations.locationId, locationId),
            eq(weatherObservations.locationType, locationType),
            gte(weatherObservations.fetchedAt, fifteenMinutesAgo)
          )
        )
        .orderBy(desc(weatherObservations.fetchedAt))
        .limit(1);

      if (recentObservation) {
        // Data fetched within the last 15 minutes: return as CACHED (not LIVE).
        // LIVE is reserved for data fetched directly from the provider in this call.
        return this.mapObservationToResponse(recentObservation, 'CACHED');
      }

      // Check for stale data (within 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [staleObservation] = await db
        .select()
        .from(weatherObservations)
        .where(
          and(
            eq(weatherObservations.locationId, locationId),
            eq(weatherObservations.locationType, locationType),
            gte(weatherObservations.fetchedAt, twentyFourHoursAgo)
          )
        )
        .orderBy(desc(weatherObservations.fetchedAt))
        .limit(1);

      if (staleObservation) {
        // Fetch fresh data in background, return stale for now
        this.fetchAndStoreCurrentWeather(location, locationId, locationType).catch(console.error);
        return this.mapObservationToResponse(staleObservation, 'STALE');
      }
    }

    // No cached data or forced refresh, fetch fresh
    try {
      const weather = await this.provider.getCurrentWeather({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      // Store the new observation
      const [stored] = await this.storeCurrentWeather(weather, locationId, locationType);
      return this.mapObservationToResponse(stored, 'LIVE');
    } catch (error) {
      // No data available
      throw new Error(`Weather unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get forecast for a location
   */
  async getForecast(farmId: string, fieldId?: string, days: number = 7, type: 'hourly' | 'daily' = 'daily'): Promise<ForecastDataResponse[]> {
    const location = await this.resolveLocation(farmId, fieldId);
    const locationId = fieldId || farmId;
    const locationType = fieldId ? 'field' : 'farm';

    // Hourly forecasts are capped at 48 h (2 days) by the Open-Meteo provider.
    // Reject requests that would silently return fewer records than requested.
    if (type === 'hourly' && days > 2) {
      throw new Error(
        `Hourly forecast supports a maximum of 2 days (48 hours). ` +
        `Requested ${days} days. Use type=daily for longer horizons.`
      );
    }

    const hours = type === 'hourly' ? days * 24 : days;

    // Check for recent cached forecast
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentForecast] = await db
      .select()
      .from(weatherForecasts)
      .where(
        and(
          eq(weatherForecasts.locationId, locationId),
          eq(weatherForecasts.locationType, locationType),
          eq(weatherForecasts.forecastType, type),
          gte(weatherForecasts.issueAt, oneHourAgo)
        )
      )
      .orderBy(desc(weatherForecasts.issueAt))
      .limit(1);

    let forecasts: any[];

    if (recentForecast) {
      // Use cached
      const storedForecasts = await db
        .select()
        .from(weatherForecasts)
        .where(
          and(
            eq(weatherForecasts.locationId, locationId),
            eq(weatherForecasts.locationType, locationType),
            eq(weatherForecasts.forecastType, type),
            eq(weatherForecasts.issueAt, recentForecast.issueAt)
          )
        )
        .orderBy(weatherForecasts.validAt)
        .limit(type === 'hourly' ? hours : days);

      return storedForecasts.map(f => this.mapForecastToResponse(f, 'CACHED'));
    }

    // Fetch fresh
    try {
      if (type === 'hourly') {
        const forecastResponse = await this.provider.getHourlyForecast(
          { latitude: location.latitude, longitude: location.longitude },
          hours
        );

        await this.storeForecasts(forecastResponse, locationId, locationType, 'hourly');

        return forecastResponse.forecasts.slice(0, hours).map(f => ({
          id: '',
          locationId,
          locationType,
          dataStatus: 'LIVE' as DataStatus,
          provider: forecastResponse.provider,
          forecastType: 'hourly' as const,
          issueAt: forecastResponse.issueAt,
          validAt: f.validAt,
          temperatureMin: f.temperatureMin ?? f.temperature ?? null,
          temperatureMax: f.temperatureMax ?? f.temperature ?? null,
          humidity: f.humidity,
          rainfall: f.rainfall,
          rainfallProbability: f.rainfallProbability,
          precipitationSum: f.precipitationSum,
          windSpeed: f.windSpeed,
          windDirection: f.windDirection,
          cloudCover: f.cloudCover,
          weatherCode: f.weatherCode,
          weatherDescription: f.weatherDescription,
          sunshineDuration: f.sunshineDuration,
          uvIndex: f.uvIndex,
        }));
      } else {
        const forecastResponse = await this.provider.getDailyForecast(
          { latitude: location.latitude, longitude: location.longitude },
          days
        );

        await this.storeForecasts(forecastResponse, locationId, locationType, 'daily');

        return forecastResponse.forecasts.slice(0, days).map(f => ({
          id: '',
          locationId,
          locationType,
          dataStatus: 'LIVE' as DataStatus,
          provider: forecastResponse.provider,
          forecastType: 'daily' as const,
          issueAt: forecastResponse.issueAt,
          validAt: f.validAt,
          temperatureMin: f.temperatureMin,
          temperatureMax: f.temperatureMax,
          humidity: f.humidity,
          rainfall: f.rainfall,
          rainfallProbability: f.rainfallProbability,
          precipitationSum: f.precipitationSum,
          windSpeed: f.windSpeed,
          windDirection: f.windDirection,
          cloudCover: f.cloudCover,
          weatherCode: f.weatherCode,
          weatherDescription: f.weatherDescription,
          sunshineDuration: f.sunshineDuration,
          uvIndex: f.uvIndexMax,
        }));
      }
    } catch (error) {
      throw new Error(`Forecast unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch and store current weather from provider
   */
  private async fetchAndStoreCurrentWeather(location: LocationContext, locationId: string, locationType: string) {
    try {
      const weather = await this.provider.getCurrentWeather({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      await this.storeCurrentWeather(weather, locationId, locationType);
    } catch (error) {
      console.error('Background weather fetch failed:', error);
    }
  }

  /**
   * Store current weather observation
   */
  private async storeCurrentWeather(weather: any, locationId: string, locationType: string) {
    const [provider] = await db
      .select()
      .from(weatherProviders)
      .where(eq(weatherProviders.name, 'open-meteo'))
      .limit(1);

    return db.insert(weatherObservations).values({
      locationId,
      locationType,
      providerId: provider?.id,
      observedAt: weather.observedAt,
      fetchedAt: new Date(),
      temperature: weather.temperature,
      temperatureMin: weather.temperatureMin,
      temperatureMax: weather.temperatureMax,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection,
      windGusts: weather.windGusts,
      pressure: weather.pressure,
      cloudCover: weather.cloudCover,
      rainfall: weather.rainfall,
      rainfallProbability: weather.rainfallProbability,
      weatherCode: weather.weatherCode,
      weatherDescription: weather.weatherDescription,
      dataStatus: 'LIVE',
      sourceLatitude: weather.location.latitude,
      sourceLongitude: weather.location.longitude,
    }).returning();
  }

  /**
   * Store forecasts
   */
  private async storeForecasts(forecastResponse: any, locationId: string, locationType: string, forecastType: 'hourly' | 'daily' = 'daily') {
    const [provider] = await db
      .select()
      .from(weatherProviders)
      .where(eq(weatherProviders.name, 'open-meteo'))
      .limit(1);

    const forecasts = forecastResponse.forecasts.map((f: any) => ({
      locationId,
      locationType,
      providerId: provider?.id,
      issueAt: forecastResponse.issueAt,
      validAt: f.validAt,
      forecastType,
      temperatureMin: f.temperatureMin ?? f.temperature ?? null,
      temperatureMax: f.temperatureMax ?? f.temperature ?? null,
      humidity: f.humidity,
      rainfall: f.rainfall,
      rainfallProbability: f.rainfallProbability,
      precipitationSum: f.precipitationSum,
      windSpeed: f.windSpeed,
      windDirection: f.windDirection,
      windGusts: f.windGusts,
      cloudCover: f.cloudCover,
      weatherCode: f.weatherCode,
      weatherDescription: f.weatherDescription,
      sunshineDuration: f.sunshineDuration,
      uvIndex: f.uvIndex ?? f.uvIndexMax,
      dataStatus: 'LIVE',
      sourceLatitude: forecastResponse.location.latitude,
      sourceLongitude: forecastResponse.location.longitude,
    }));

    await db.insert(weatherForecasts).values(forecasts).onConflictDoNothing();
  }

  private mapObservationToResponse(obs: any, status: DataStatus): WeatherDataResponse {
    return {
      id: obs.id,
      locationId: obs.locationId,
      locationType: obs.locationType,
      dataStatus: status,
      provider: 'open-meteo',
      observedAt: obs.observedAt,
      fetchedAt: obs.fetchedAt,
      temperature: obs.temperature,
      temperatureMin: obs.temperatureMin,
      temperatureMax: obs.temperatureMax,
      humidity: obs.humidity,
      windSpeed: obs.windSpeed,
      windDirection: obs.windDirection,
      windGusts: obs.windGusts,
      pressure: obs.pressure,
      cloudCover: obs.cloudCover,
      rainfall: obs.rainfall,
      rainfallProbability: obs.rainfallProbability,
      weatherCode: obs.weatherCode,
      weatherDescription: obs.weatherDescription,
    };
  }

  private mapForecastToResponse(fcst: any, status: DataStatus): ForecastDataResponse {
    return {
      id: fcst.id,
      locationId: fcst.locationId,
      locationType: fcst.locationType,
      dataStatus: status,
      provider: 'open-meteo',
      forecastType: fcst.forecastType,
      issueAt: fcst.issueAt,
      validAt: fcst.validAt,
      temperatureMin: fcst.temperatureMin,
      temperatureMax: fcst.temperatureMax,
      humidity: fcst.humidity,
      rainfall: fcst.rainfall,
      rainfallProbability: fcst.rainfallProbability,
      precipitationSum: fcst.precipitationSum,
      windSpeed: fcst.windSpeed,
      windDirection: fcst.windDirection,
      cloudCover: fcst.cloudCover,
      weatherCode: fcst.weatherCode,
      weatherDescription: fcst.weatherDescription,
      sunshineDuration: fcst.sunshineDuration,
      uvIndex: fcst.uvIndex,
    };
  }
}

export const weatherService = new WeatherService();