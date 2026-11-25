import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Farmer Profiles Table
 * Domain entity representing registered farmer details, separated from authentication identity.
 * Contains only foundational agricultural profile fields; excludes unnecessary personal,
 * biometric, identity card, or financial account details.
 */
export const farmerProfiles = pgTable('farmer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'restrict' }),
  fullName: varchar('full_name', { length: 128 }).notNull(),
  preferredLanguage: varchar('preferred_language', { length: 16 }).notNull().default('te'), // 'te', 'hi', 'en', 'ta', 'kn'
  state: varchar('state', { length: 64 }).notNull(),
  district: varchar('district', { length: 64 }).notNull(),
  mandal: varchar('mandal', { length: 64 }).notNull(),
  village: varchar('village', { length: 64 }).notNull(),
  pinCode: varchar('pin_code', { length: 10 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'incomplete', 'active', 'archived'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_farmer_profiles_location').on(table.state, table.district, table.mandal),
  check('chk_farmer_profiles_status', sql`${table.status} IN ('incomplete', 'active', 'archived')`),
]);
