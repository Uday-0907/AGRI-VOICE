import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 24 }).notNull(), // 'farmer' | 'buyer'
  category: varchar('category', { length: 48 }).notNull(), // 'market', 'weather', 'soil', 'machinery', 'scheme', 'system'
  title: varchar('title', { length: 160 }).notNull(),
  message: text('message').notNull(),
  relatedEntityId: uuid('related_entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_notifications_user_read').on(table.userId, table.isRead),
]);
