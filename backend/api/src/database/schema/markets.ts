import { pgTable, uuid, varchar, numeric, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { farmerProfiles } from './farmers.js';
import { buyerProfiles } from './buyers.js';

export const marketPriceObservations = pgTable('market_price_observations', {
  id: uuid('id').defaultRandom().primaryKey(),
  commodity: varchar('commodity', { length: 80 }).notNull(),
  variety: varchar('variety', { length: 80 }),
  state: varchar('state', { length: 64 }).notNull(),
  district: varchar('district', { length: 64 }).notNull(),
  marketName: varchar('market_name', { length: 120 }).notNull(),
  minPriceInr: numeric('min_price_inr', { precision: 10, scale: 2 }).notNull(),
  maxPriceInr: numeric('max_price_inr', { precision: 10, scale: 2 }).notNull(),
  modalPriceInr: numeric('modal_price_inr', { precision: 10, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 32 }).notNull().default('Rs/Quintal'),
  priceDate: timestamp('price_date', { withTimezone: true }).defaultNow().notNull(),
  source: varchar('source', { length: 64 }).notNull().default('farmer_reported'),
  sourceAuthority: varchar('source_authority', { length: 128 }),
  reportedByFarmerId: uuid('reported_by_farmer_id').references(() => farmerProfiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_market_prices_commodity_district').on(table.commodity, table.district),
]);

export const buyerListings = pgTable('buyer_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  cropName: varchar('crop_name', { length: 80 }).notNull(),
  variety: varchar('variety', { length: 80 }),
  quantityQuintals: numeric('quantity_quintals', { precision: 10, scale: 2 }).notNull(),
  expectedPriceInr: numeric('expected_price_inr', { precision: 10, scale: 2 }).notNull(),
  qualityGrade: varchar('quality_grade', { length: 32 }).default('FAQ'),
  district: varchar('district', { length: 64 }).notNull(),
  state: varchar('state', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('open'), // 'open', 'matched', 'closed'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_buyer_listings_farmer').on(table.farmerId),
  index('idx_buyer_listings_status').on(table.status),
]);

export const purchaseRequests = pgTable('purchase_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id').notNull().references(() => buyerListings.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').notNull().references(() => buyerProfiles.id, { onDelete: 'cascade' }),
  farmerId: uuid('farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  requestType: varchar('request_type', { length: 32 }).notNull().default('purchase_request'), // 'enquiry' | 'purchase_request'
  requestedQuantityQuintals: numeric('requested_quantity_quintals', { precision: 10, scale: 2 }).notNull(),
  offeredPriceInr: numeric('offered_price_inr', { precision: 10, scale: 2 }).notNull(),
  message: text('message'),
  farmerResponse: text('farmer_response'),
  status: varchar('status', { length: 32 }).notNull().default('pending'), // 'pending', 'negotiating', 'accepted', 'rejected', 'cancelled', 'fulfilled'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_purchase_requests_buyer').on(table.buyerId),
  index('idx_purchase_requests_farmer').on(table.farmerId),
  index('idx_purchase_requests_listing').on(table.listingId),
]);

export const buyerSavedListings = pgTable('buyer_saved_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  buyerId: uuid('buyer_id').notNull().references(() => buyerProfiles.id, { onDelete: 'cascade' }),
  listingId: uuid('listing_id').notNull().references(() => buyerListings.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_buyer_saved_listing').on(table.buyerId, table.listingId),
]);
