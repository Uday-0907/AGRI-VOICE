import { pgTable, uuid, varchar, integer, numeric, date, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { fields } from './farms.js';
import { farmerProfiles } from './farmers.js';

/**
 * Crops Table
 * Foundational agricultural crop catalog.
 */
export const crops = pgTable('crops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(), // e.g. 'Paddy / Rice', 'Cotton', 'Chilli', 'Groundnut', 'Red Gram'
  scientificName: varchar('scientific_name', { length: 128 }), // e.g. 'Oryza sativa'
  category: varchar('category', { length: 64 }).notNull(), // 'cereal', 'pulse', 'oilseed', 'commercial', 'horticulture', 'vegetable', 'fruit'
  typicalDurationDays: integer('typical_duration_days'), // Standard crop lifecycle duration in days
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_crops_category').on(table.category),
  check('chk_crops_duration', sql`${table.typicalDurationDays} > 0`),
]);

/**
 * Crop Seasons Table
 * Cultivation cycle associating a farmer, field plot, and crop for a given agricultural season.
 */
export const cropSeasons = pgTable('crop_seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  fieldId: uuid('field_id').notNull().references(() => fields.id, { onDelete: 'cascade' }),
  cropId: uuid('crop_id').notNull().references(() => crops.id, { onDelete: 'restrict' }),
  season: varchar('season', { length: 32 }).notNull(), // 'kharif', 'rabi', 'zaid'
  sowingDate: date('sowing_date'),
  expectedHarvestDate: date('expected_harvest_date'),
  actualHarvestDate: date('actual_harvest_date'),
  areaPlantedAcres: numeric('area_planted_acres', { precision: 10, scale: 2 }),
  status: varchar('status', { length: 32 }).notNull().default('planned'), // 'planned', 'sown', 'growing', 'harvested', 'failed', 'abandoned'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_crop_seasons_field_id').on(table.fieldId),
  index('idx_crop_seasons_crop_id').on(table.cropId),
  index('idx_crop_seasons_season_status').on(table.season, table.status),
  index('idx_crop_seasons_sowing_date').on(table.sowingDate),
  check('chk_crop_seasons_area', sql`${table.areaPlantedAcres} > 0`),
  check('chk_crop_seasons_season', sql`${table.season} IN ('kharif', 'rabi', 'zaid')`),
  check('chk_crop_seasons_status', sql`${table.status} IN ('planned', 'sown', 'growing', 'harvested', 'failed', 'abandoned')`),
  check('chk_crop_seasons_expected_harvest', sql`${table.expectedHarvestDate} >= ${table.sowingDate}`),
  check('chk_crop_seasons_actual_harvest', sql`${table.actualHarvestDate} >= ${table.sowingDate}`),
]);
