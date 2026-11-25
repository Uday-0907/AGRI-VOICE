import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Authentication Sessions
 * Minimal session storage for Phase 3 identity foundation.
 * Security: Tokens are hashed before storage.
 */
export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), // Hashed session token
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_auth_sessions_user_id').on(table.userId),
]);

/**
 * OTP Requests
 * Temporary storage for verification challenges.
 */
export const otpRequests = pgTable('otp_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  phone: varchar('phone', { length: 16 }).notNull(),
  otpHash: text('otp_hash').notNull(), // Hashed OTP
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_otp_requests_phone').on(table.phone),
]);
