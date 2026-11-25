import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { farmerProfiles } from './farmers.js';

export const extensionBulletins = pgTable('extension_bulletins', {
  id: uuid('id').defaultRandom().primaryKey(),
  bulletinCode: varchar('bulletin_code', { length: 48 }).notNull().unique(),
  title: varchar('title', { length: 180 }).notNull(),
  crop: varchar('crop', { length: 80 }).notNull(),
  category: varchar('category', { length: 48 }).notNull(), // 'agronomy', 'pest_management', 'water', 'post_harvest', 'climate'
  summary: text('summary').notNull(),
  recommendationText: text('recommendation_text').notNull(),
  sourceAuthority: varchar('source_authority', { length: 128 }).notNull(),
  state: varchar('state', { length: 64 }),
  publishedDate: timestamp('published_date', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_extension_bulletins_crop').on(table.crop),
]);

export const farmerFieldQueries = pgTable('farmer_field_queries', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  crop: varchar('crop', { length: 80 }).notNull(),
  topic: varchar('topic', { length: 120 }).notNull(),
  questionText: text('question_text').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('open'), // 'open', 'answered'
  answerText: text('answer_text'),
  answeredBy: varchar('answered_by', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_farmer_field_queries_farmer').on(table.farmerId),
]);
