import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { farmerProfiles } from './farmers.js';
import { farms } from './farms.js';

export const institutionalSchemes = pgTable('institutional_schemes', {
  id: uuid('id').defaultRandom().primaryKey(),
  schemeCode: varchar('scheme_code', { length: 48 }).notNull().unique(),
  title: varchar('title', { length: 160 }).notNull(),
  category: varchar('category', { length: 48 }).notNull(), // 'credit', 'insurance', 'subsidy', 'fpo', 'advisory'
  authority: varchar('authority', { length: 128 }).notNull(),
  eligibilitySummary: text('eligibility_summary').notNull(),
  benefitSummary: text('benefit_summary').notNull(),
  applicationUrl: varchar('application_url', { length: 255 }),
  source: varchar('source', { length: 64 }).notNull().default('public_reference'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const schemeApplications = pgTable('scheme_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  schemeCode: varchar('scheme_code', { length: 48 }).notNull(),
  schemeTitle: varchar('scheme_title', { length: 160 }).notNull(),
  category: varchar('category', { length: 48 }).notNull(),
  farmId: uuid('farm_id').references(() => farms.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('submitted'), // 'draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'
  notes: text('notes'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scheme_applications_farmer').on(table.farmerId),
]);
