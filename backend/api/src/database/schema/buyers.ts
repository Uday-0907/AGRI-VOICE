import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const buyerProfiles = pgTable('buyer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'restrict' }),
  businessName: varchar('business_name', { length: 160 }).notNull(),
  contactName: varchar('contact_name', { length: 128 }).notNull(),
  businessType: varchar('business_type', { length: 64 }).notNull().default('wholesaler'), // 'wholesaler', 'processor', 'exporter', 'fpo_buyer', 'retailer'
  state: varchar('state', { length: 64 }).notNull(),
  district: varchar('district', { length: 64 }).notNull(),
  city: varchar('city', { length: 64 }).notNull(),
  pinCode: varchar('pin_code', { length: 10 }).notNull(),
  gstOrLicenseNumber: varchar('gst_or_license_number', { length: 64 }),
  verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('self_declared'), // 'self_declared', 'pending_review', 'verified'
  status: varchar('status', { length: 32 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_buyer_profiles_location').on(table.state, table.district),
  check('chk_buyer_profiles_status', sql`${table.status} IN ('incomplete', 'active', 'archived')`),
]);
