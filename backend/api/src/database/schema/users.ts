import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users Table
 * Root identity entity for web and telephony callers.
 * Decoupled from agricultural domain data via User UUID.
 * Strictly foundational: NO authentication secrets, OTP, PIN, sessions, or JWT logic.
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 16 }).notNull().unique(), // E.164 normalized format (+91XXXXXXXXXX)
  role: varchar('role', { length: 24 }).notNull().default('farmer'), // 'farmer' | 'buyer'
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'pending_verification', 'active', 'suspended', 'deactivated'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_users_status').on(table.status),
  check('chk_users_status', sql`${table.status} IN ('pending_verification', 'active', 'suspended', 'deactivated')`),
  check('chk_users_role', sql`${table.role} IN ('farmer', 'buyer')`),
]);
