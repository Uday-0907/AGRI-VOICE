import { pgTable, uuid, varchar, numeric, jsonb, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { fields, farms } from './farms.js';
import { farmerProfiles } from './farmers.js';

/**
 * Soil Reports Table
 * Canonical persistence for Soil Health Card data, laboratory reports, and nutrient measurements.
 */
export const soilReports = pgTable('soil_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'restrict' }),
  farmId: uuid('farm_id').references(() => farms.id, { onDelete: 'cascade' }),
  fieldId: uuid('field_id').references(() => fields.id, { onDelete: 'cascade' }),

  // Card & Report Identifiers
  cardId: varchar('card_id', { length: 64 }), // Government Soil Health Card ID (e.g. SHC-AP-GNT-109283)
  reportId: varchar('report_id', { length: 128 }).notNull(), // Unique Report reference
  source: varchar('source', { length: 64 }).notNull(), // 'government_shc_api', 'lab_direct', 'demo'
  sourceAuthority: varchar('source_authority', { length: 128 }), // e.g. 'Department of Agriculture, Govt of AP'

  // Temporal Metadata
  sampleDate: timestamp('sample_date', { withTimezone: true }),
  testingDate: timestamp('testing_date', { withTimezone: true }),
  reportDate: timestamp('report_date', { withTimezone: true }).notNull(),

  // Location Metadata
  state: varchar('state', { length: 64 }),
  district: varchar('district', { length: 64 }),
  mandal: varchar('mandal', { length: 64 }),
  village: varchar('village', { length: 64 }),
  soilType: varchar('soil_type', { length: 64 }), // e.g. 'black_cotton', 'red_loamy'

  // Primary Chemical Measurements (Nullable with preserved units)
  ph: numeric('ph', { precision: 4, scale: 2 }), // pH (0-14)
  ec: numeric('ec', { precision: 6, scale: 3 }), // Electrical Conductivity (dS/m)
  organicCarbon: numeric('organic_carbon', { precision: 5, scale: 2 }), // Organic Carbon (%)

  // Macro Nutrients (kg/ha or source unit)
  nitrogen: numeric('nitrogen', { precision: 10, scale: 2 }), // Available N (kg/ha)
  phosphorus: numeric('phosphorus', { precision: 10, scale: 2 }), // Available P (kg/ha)
  potassium: numeric('potassium', { precision: 10, scale: 2 }), // Available K (kg/ha)
  sulphur: numeric('sulphur', { precision: 10, scale: 2 }), // Available S (ppm or kg/ha)

  // Micronutrients (ppm)
  zinc: numeric('zinc', { precision: 8, scale: 2 }),
  iron: numeric('iron', { precision: 8, scale: 2 }),
  copper: numeric('copper', { precision: 8, scale: 2 }),
  manganese: numeric('manganese', { precision: 8, scale: 2 }),
  boron: numeric('boron', { precision: 8, scale: 2 }),

  // Ratings & Recommendations provided directly by the source authority
  nutrientRatings: jsonb('nutrient_ratings'), // e.g. { nitrogen: 'LOW', phosphorus: 'MEDIUM', potassium: 'HIGH' }
  recommendations: jsonb('recommendations'), // e.g. [{ crop: 'Paddy', fertilizer: 'Urea', dosageKgPerAcre: 50, note: 'Apply in 2 splits' }]

  // Lifecycle Status
  status: varchar('status', { length: 32 }).notNull().default('available'), // 'available', 'pending', 'partial', 'not_found', 'failed', 'provider_unavailable', 'demo'
  isDemo: varchar('is_demo', { length: 16 }).default('false'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_soil_reports_farmer').on(table.farmerId),
  index('idx_soil_reports_field').on(table.fieldId),
  index('idx_soil_reports_farm').on(table.farmId),
  index('idx_soil_reports_card_id').on(table.cardId),
  check('chk_soil_ph', sql`${table.ph} IS NULL OR (${table.ph} >= 0 AND ${table.ph} <= 14)`),
  check('chk_soil_status', sql`${table.status} IN ('available', 'pending', 'partial', 'not_found', 'failed', 'provider_unavailable', 'demo')`),
]);

/**
 * Agricultural Input Verifications Table
 * Tracks verification requests and authoritative provenance for seeds, fertilizers, and crop chemicals.
 */
export const inputVerifications = pgTable('input_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'restrict' }),

  // Product Metadata
  productName: varchar('product_name', { length: 256 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(), // 'fertilizer', 'seed', 'pesticide', 'bio_stimulant', 'other'
  brand: varchar('brand', { length: 128 }),
  manufacturer: varchar('manufacturer', { length: 128 }),
  batchNumber: varchar('batch_number', { length: 128 }),
  registrationNumber: varchar('registration_number', { length: 128 }), // Central Insecticides Board (CIB) or FCO number

  // Verification Outcome & Evidence
  verificationStatus: varchar('verification_status', { length: 32 }).notNull(), // 'verified', 'not_verified', 'inconclusive', 'not_found', 'expired', 'recall_alert', 'provider_unavailable', 'demo'
  provider: varchar('provider', { length: 64 }).notNull(), // 'national_input_portal', 'cibrc_registry', 'demo'
  evidence: jsonb('evidence'), // e.g. { certifiedDate: '...', expiryDate: '...', registeredFor: ['Paddy', 'Chilli'] }
  notes: varchar('notes', { length: 512 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_input_verifications_farmer').on(table.farmerId),
  index('idx_input_verifications_batch').on(table.batchNumber),
  check('chk_input_verification_status', sql`${table.verificationStatus} IN ('verified', 'not_verified', 'inconclusive', 'not_found', 'expired', 'recall_alert', 'provider_unavailable', 'demo')`),
  check('chk_input_category', sql`${table.category} IN ('fertilizer', 'seed', 'pesticide', 'bio_stimulant', 'other')`),
]);
