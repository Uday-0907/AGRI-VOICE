import { pgTable, uuid, varchar, numeric, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { farmerProfiles } from './farmers.js';
import { geometryPoint, geometryPolygon } from './types.js';

/**
 * Farms Table
 * Agricultural landholding owned or managed by a farmer.
 * Enforces ownership referential integrity via farmerId foreign key.
 */
export const farms = pgTable('farms', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'restrict' }),
  farmName: varchar('farm_name', { length: 128 }).notNull(),
  location: geometryPoint('location'), // Centroid / main farm coordinate (Point, 4326)
  totalAreaAcres: numeric('total_area_acres', { precision: 10, scale: 2 }),
  ownershipType: varchar('ownership_type', { length: 32 }).notNull().default('owned'), // 'owned', 'leased', 'shared'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_farms_farmer_id').on(table.farmerId),
  index('idx_farms_location').using('gist', table.location),
  check('chk_farms_area', sql`${table.totalAreaAcres} > 0`),
  check('chk_farms_ownership', sql`${table.ownershipType} IN ('owned', 'leased', 'shared')`),
  check('chk_farms_location_valid', sql`${table.location} IS NULL OR (NOT ST_IsEmpty(${table.location}) AND ST_X(${table.location}) BETWEEN -180 AND 180 AND ST_Y(${table.location}) BETWEEN -90 AND 90)`),
]);

/**
 * Fields Table
 * Specific cultivation plots or subdivisions within a farm.
 * Uses PostGIS 2D Point (marker) and Polygon (boundary perimeter) geometries with GIST spatial indexing.
 */
export const fields = pgTable('fields', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmId: uuid('farm_id').notNull().references(() => farms.id, { onDelete: 'cascade' }),
  fieldName: varchar('field_name', { length: 128 }).notNull(),
  areaAcres: numeric('area_acres', { precision: 10, scale: 2 }),
  location: geometryPoint('location'), // Specific field marker coordinate (Point, 4326)
  boundary: geometryPolygon('boundary'), // PostGIS polygon perimeter (Polygon, 4326)
  soilType: varchar('soil_type', { length: 64 }), // e.g. 'black_cotton', 'red_loamy', 'alluvial'
  irrigationSource: varchar('irrigation_source', { length: 64 }), // e.g. 'borewell', 'canal', 'rainfed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_fields_farm_id').on(table.farmId),
  index('idx_fields_location').using('gist', table.location),
  index('idx_fields_boundary').using('gist', table.boundary),
  check('chk_fields_area', sql`${table.areaAcres} > 0`),
  check('chk_fields_location_valid', sql`${table.location} IS NULL OR (NOT ST_IsEmpty(${table.location}) AND ST_X(${table.location}) BETWEEN -180 AND 180 AND ST_Y(${table.location}) BETWEEN -90 AND 90)`),
  check('chk_fields_boundary_valid', sql`${table.boundary} IS NULL OR (ST_IsValid(${table.boundary}) AND NOT ST_IsEmpty(${table.boundary}))`),
]);
