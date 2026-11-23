import { pgTable, uuid, varchar, integer, text, jsonb, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Transactional Outbox Table
 * Foundational event publication mechanism ensuring reliable domain event persistence
 * and cross-service eventual consistency without dual-write race conditions.
 */
export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  aggregateType: varchar('aggregate_type', { length: 64 }).notNull(), // e.g. 'user', 'farmer_profile', 'farm', 'field', 'crop_season'
  aggregateId: varchar('aggregate_id', { length: 64 }).notNull(), // Target entity UUID
  eventType: varchar('event_type', { length: 128 }).notNull(), // e.g. 'FarmerRegistered', 'FarmCreated', 'FieldBoundaryUpdated', 'CropSeasonCreated'
  payload: jsonb('payload').notNull(), // Structured domain event payload
  status: varchar('status', { length: 32 }).notNull().default('pending'), // 'pending', 'processing', 'published', 'failed'
  retryCount: integer('retry_count').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(5),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
}, (table) => [
  index('idx_outbox_status_created_at').on(table.status, table.createdAt),
  index('idx_outbox_aggregate').on(table.aggregateType, table.aggregateId),
  index('idx_outbox_event_type').on(table.eventType),
  check('chk_outbox_status', sql`${table.status} IN ('pending', 'processing', 'published', 'failed')`),
  check('chk_outbox_retry_count', sql`${table.retryCount} >= 0`),
  check('chk_outbox_max_retries', sql`${table.maxRetries} >= 0`),
]);
