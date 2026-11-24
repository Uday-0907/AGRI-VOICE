/**
 * Weather & Crop Advisory Database Schema
 *
 * Tables for weather data, forecasts, alerts, and crop advisories.
 * Follows existing Drizzle conventions and references canonical tables.
 */

import { pgTable, uuid, varchar, numeric, timestamp, boolean, text, integer, index, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { farms, fields, farmerProfiles, crops, cropSeasons } from './index.js';

/**
 * Weather Providers Configuration
 * Stores metadata about configured weather data sources
 */
export const weatherProviders = pgTable('weather_providers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull().unique(), // 'open-meteo', 'imd'
  displayName: varchar('display_name', { length: 128 }).notNull(),
  apiEndpoint: varchar('api_endpoint', { length: 512 }),
  apiKeyRequired: boolean('api_key_required').default(false),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(1), // 1 = primary
  rateLimitPerDay: integer('rate_limit_per_day'),
  attributionRequired: boolean('attribution_required').default(false),
  attributionText: text('attribution_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_weather_providers_active').on(table.isActive),
  index('idx_weather_providers_priority').on(table.priority),
]);

/**
 * Weather Observations
 * Current weather measurements for locations
 */
export const weatherObservations = pgTable('weather_observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id').notNull(), // References farms.id or fields.id
  locationType: varchar('location_type', { length: 16 }).notNull(), // 'farm' or 'field'
  providerId: uuid('provider_id').references(() => weatherProviders.id),

  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(), // Actual observation time
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),

  // Current conditions
  temperature: numeric('temperature', { precision: 5, scale: 2 }), // Celsius
  temperatureMin: numeric('temperatureMin', { precision: 5, scale: 2 }),
  temperatureMax: numeric('temperatureMax', { precision: 5, scale: 2 }),
  humidity: numeric('humidity', { precision: 5, scale: 2 }), // %
  windSpeed: numeric('windSpeed', { precision: 6, scale: 2 }), // km/h
  windDirection: varchar('wind_direction', { length: 8 }), // Cardinal direction
  windGusts: numeric('windGusts', { precision: 6, scale: 2 }), // km/h
  pressure: numeric('pressure', { precision: 7, scale: 2 }), // hPa
  cloudCover: numeric('cloudCover', { precision: 5, scale: 2 }), // %

  // Precipitation
  rainfall: numeric('rainfall', { precision: 6, scale: 2 }), // mm in last hour
  rainfallProbability: numeric('rainfallProbability', { precision: 5, scale: 2 }), // %
  precipitation: numeric('precipitation', { precision: 6, scale: 2 }), // mm

  // Weather status
  weatherCode: integer('weather_code'), // WMO weather codes
  weatherDescription: varchar('weather_description', { length: 128 }),

  // Data freshness tracking
  dataStatus: varchar('data_status', { length: 16 }).notNull().default('LIVE'), // 'LIVE', 'CACHED', 'STALE', 'UNAVAILABLE'
  sourceLatitude: numeric('sourceLatitude', { precision: 10, scale: 7 }), // Actual provider lookup coordinates
  sourceLongitude: numeric('sourceLongitude', { precision: 10, scale: 7 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_weather_obs_location').on(table.locationId, table.locationType),
  index('idx_weather_obs_observed').on(table.observedAt),
  index('idx_weather_obs_fetched').on(table.fetchedAt),
  index('idx_weather_obs_status').on(table.dataStatus),
]);

/**
 * Weather Forecasts
 * Future weather predictions with issue/valid time separation
 */
export const weatherForecasts = pgTable('weather_forecasts', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id').notNull(),
  locationType: varchar('location_type', { length: 16 }).notNull(),
  providerId: uuid('provider_id').references(() => weatherProviders.id),

  issueAt: timestamp('issue_at', { withTimezone: true }).notNull(), // When forecast was generated
  validAt: timestamp('valid_at', { withTimezone: true }).notNull(), // When forecast applies

  forecastType: varchar('forecast_type', { length: 16 }).notNull(), // 'hourly', 'daily'

  // Temperature
  temperatureMin: numeric('temperatureMin', { precision: 5, scale: 2 }),
  temperatureMax: numeric('temperatureMax', { precision: 5, scale: 2 }),

  // Humidity and precipitation
  humidity: numeric('humidity', { precision: 5, scale: 2 }),
  rainfall: numeric('rainfall', { precision: 6, scale: 2 }),
  rainfallProbability: numeric('rainfallProbability', { precision: 5, scale: 2 }),
  precipitationSum: numeric('precipitationSum', { precision: 6, scale: 2 }),

  // Wind
  windSpeed: numeric('windSpeed', { precision: 6, scale: 2 }),
  windDirection: varchar('wind_direction', { length: 8 }),
  windGusts: numeric('windGusts', { precision: 6, scale: 2 }),

  // Cloud and weather
  cloudCover: numeric('cloudCover', { precision: 5, scale: 2 }),
  weatherCode: integer('weather_code'),
  weatherDescription: varchar('weather_description', { length: 128 }),

  // Sunshine and UV
  sunshineDuration: numeric('sunshineDuration', { precision: 8, scale: 2 }), // minutes
  uvIndex: numeric('uvIndex', { precision: 3, scale: 1 }),

  // Data status
  dataStatus: varchar('data_status', { length: 16 }).notNull().default('LIVE'),
  sourceLatitude: numeric('sourceLatitude', { precision: 10, scale: 7 }),
  sourceLongitude: numeric('sourceLongitude', { precision: 10, scale: 7 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_weather_fcst_location').on(table.locationId, table.locationType),
  index('idx_weather_fcst_valid').on(table.validAt),
  index('idx_weather_fcst_issue').on(table.issueAt),
  index('idx_weather_fcst_type').on(table.forecastType),
  // Unique constraint to prevent duplicate forecasts
  uniqueIndex('idx_weather_fcst_unique').on(
    table.locationId,
    table.locationType,
    table.providerId,
    table.issueAt,
    table.validAt,
    table.forecastType
  ),
]);

/**
 * Weather Alerts
 * Severe weather warnings and advisories
 */
export const weatherAlerts = pgTable('weather_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  locationId: uuid('location_id').notNull(),
  locationType: varchar('location_type', { length: 16 }).notNull(),
  providerId: uuid('provider_id').references(() => weatherProviders.id),

  alertType: varchar('alert_type', { length: 32 }).notNull(), // 'heat_wave', 'cold_wave', 'heavy_rain', 'strong_wind', 'flood', 'drought', 'thunderstorm'
  severity: varchar('severity', { length: 16 }).notNull(), // 'low', 'medium', 'high', 'severe'

  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }).notNull(),

  headline: varchar('headline', { length: 256 }).notNull(),
  description: text('description'),
  recommendedAction: text('recommended_action'),

  isActive: boolean('is_active').default(true),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  farmerId: uuid('farmer_id').references(() => farmerProfiles.id),

  providerAlertId: varchar('provider_alert_id', { length: 128 }), // External provider's alert ID

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_weather_alerts_location').on(table.locationId, table.locationType),
  index('idx_weather_alerts_valid').on(table.validFrom, table.validTo),
  index('idx_weather_alerts_active').on(table.isActive),
  index('idx_weather_alerts_type').on(table.alertType),
  index('idx_weather_alerts_severity').on(table.severity),
]);

/**
 * Advisory Rules
 * Deterministic agricultural advisory logic with evidence
 */
export const advisoryRules = pgTable('advisory_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  category: varchar('category', { length: 32 }).notNull(), // 'irrigation', 'fertilizer', 'pesticide', 'harvest', 'sowing', 'weather_alert', 'crop_protection', 'general'

  cropId: uuid('crop_id').references(() => crops.id),
  season: varchar('season', { length: 16 }), // 'kharif', 'rabi', 'zaid'
  growthStage: varchar('growth_stage', { length: 64 }), // e.g., 'vegetative', 'flowering', 'fruiting', 'harvest'

  // Trigger conditions
  conditionType: varchar('condition_type', { length: 64 }).notNull(), // 'temperature_above', 'temperature_below', 'rainfall_expected', 'humidity_above', etc.
  threshold: numeric('threshold', { precision: 10, scale: 4 }).notNull(),
  thresholdUnit: varchar('threshold_unit', { length: 32 }),
  logicalOperator: varchar('logical_operator', { length: 8 }).default('gte'), // 'gte', 'lte', 'gt', 'lt', 'eq'

  // Secondary condition (optional)
  condition2Type: varchar('condition2_type', { length: 64 }),
  condition2Threshold: numeric('condition2Threshold', { precision: 10, scale: 4 }),
  condition2Unit: varchar('condition2_unit', { length: 32 }),
  condition2Operator: varchar('condition2_operator', { length: 8 }),
  logicalCombinator: varchar('logical_combinator', { length: 8 }).default('AND'), // 'AND', 'OR'

  // Advisory content (language-neutral)
  advisoryText: text('advisory_text').notNull(),
  advisoryTextTe: text('advisory_text_te'), // Telugu
  advisoryTextHi: text('advisory_text_hi'), // Hindi

  severity: varchar('severity', { length: 16 }).default('info'), // 'info', 'warning', 'urgent'
  priority: integer('priority').default(0), // Higher = more important

  // Evidence
  sourceName: varchar('source_name', { length: 128 }),
  sourceUrl: varchar('source_url', { length: 512 }),
  sourcePublicationDate: timestamp('source_publication_date'),
  evidenceStrength: varchar('evidence_strength', { length: 32 }).default('preliminary'), // 'verified', 'recommended', 'preliminary'
  requiresHumanConfirmation: boolean('requires_human_confirmation').default(false),

  // Versioning
  version: integer('version').default(1),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  status: varchar('status', { length: 32 }).default('active'), // 'active', 'under_review', 'deprecated'

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_advisory_rules_crop').on(table.cropId),
  index('idx_advisory_rules_category').on(table.category),
  index('idx_advisory_rules_season').on(table.season),
  index('idx_advisory_rules_status').on(table.status),
  index('idx_advisory_rules_condition').on(table.conditionType),
]);

/**
 * Crop Advisories
 * Generated advisories linked to specific fields/crop seasons
 */
export const cropAdvisories = pgTable('crop_advisories', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleId: uuid('rule_id').references(() => advisoryRules.id),
  fieldId: uuid('field_id').references(() => fields.id),
  farmId: uuid('farm_id').references(() => farms.id),
  farmerId: uuid('farmer_id').references(() => farmerProfiles.id),
  cropSeasonId: uuid('crop_season_id').references(() => cropSeasons.id),

  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),

  advisoryText: text('advisory_text').notNull(),
  severity: varchar('severity', { length: 16 }),

  // Weather context that triggered this advisory
  temperatureAtGeneration: numeric('temperatureAtGeneration', { precision: 5, scale: 2 }),
  humidityAtGeneration: numeric('humidityAtGeneration', { precision: 5, scale: 2 }),
  rainfallAtGeneration: numeric('rainfallAtGeneration', { precision: 6, scale: 2 }),
  rainfallProbabilityAtGeneration: numeric('rainfallProbabilityAtGeneration', { precision: 5, scale: 2 }),
  forecastRainfall: numeric('forecastRainfall', { precision: 6, scale: 2 }),

  // Verification status (agricultural correctness)
  verificationStatus: varchar('verification_status', { length: 32 }).default('generated'), // 'generated', 'verified', 'requires_review', 'rejected'
  verificationNotes: text('verification_notes'),
  verifiedBy: uuid('verified_by'), // Admin user ID
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // Farmer interaction
  status: varchar('status', { length: 32 }).default('active'), // 'active', 'acknowledged', 'dismissed', 'expired'
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_crop_advisories_field').on(table.fieldId),
  index('idx_crop_advisories_farm').on(table.farmId),
  index('idx_crop_advisories_farmer').on(table.farmerId),
  index('idx_crop_advisories_crop_season').on(table.cropSeasonId),
  index('idx_crop_advisories_rule').on(table.ruleId),
  index('idx_crop_advisories_generated').on(table.generatedAt),
  index('idx_crop_advisories_status').on(table.status),
  index('idx_crop_advisories_verification').on(table.verificationStatus),
]);

/**
 * Weather Ingestion Jobs
 * Track background weather data fetching
 */
export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobType: varchar('job_type', { length: 32 }).notNull(), // 'weather_fetch', 'forecast_refresh', 'alert_poll'
  providerId: uuid('provider_id').references(() => weatherProviders.id),

  status: varchar('status', { length: 32 }).notNull(), // 'pending', 'running', 'completed', 'failed', 'partial'

  locationsRequested: integer('locations_requested'),
  locationsProcessed: integer('locations_processed'),
  locationsSucceeded: integer('locations_succeeded'),
  locationsFailed: integer('locations_failed'),

  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),

  errorMessage: text('error_message'),
  retryCount: integer('retry_count').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_ingestion_jobs_type').on(table.jobType),
  index('idx_ingestion_jobs_status').on(table.status),
  index('idx_ingestion_jobs_started').on(table.startedAt),
]);

// Type exports for TypeScript
export type WeatherProvider = typeof weatherProviders.$inferSelect;
export type NewWeatherProvider = typeof weatherProviders.$inferInsert;
export type WeatherObservation = typeof weatherObservations.$inferSelect;
export type NewWeatherObservation = typeof weatherObservations.$inferInsert;
export type WeatherForecast = typeof weatherForecasts.$inferSelect;
export type NewWeatherForecast = typeof weatherForecasts.$inferInsert;
export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type NewWeatherAlert = typeof weatherAlerts.$inferInsert;
export type AdvisoryRule = typeof advisoryRules.$inferSelect;
export type NewAdvisoryRule = typeof advisoryRules.$inferInsert;
export type CropAdvisory = typeof cropAdvisories.$inferSelect;
export type NewCropAdvisory = typeof cropAdvisories.$inferInsert;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type NewIngestionJob = typeof ingestionJobs.$inferInsert;