import { pgTable, uuid, varchar, numeric, text, timestamp, index } from 'drizzle-orm/pg-core';
import { farmerProfiles } from './farmers.js';
import { farms } from './farms.js';

export const machineryListings = pgTable('machinery_listings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerFarmerId: uuid('owner_farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  equipmentName: varchar('equipment_name', { length: 120 }).notNull(),
  category: varchar('category', { length: 48 }).notNull(), // 'tractor', 'harvester', 'sprayer', 'seeder', 'drone', 'pump', 'other'
  hourlyRateInr: numeric('hourly_rate_inr', { precision: 10, scale: 2 }).notNull(),
  dailyRateInr: numeric('daily_rate_inr', { precision: 10, scale: 2 }),
  district: varchar('district', { length: 64 }).notNull(),
  state: varchar('state', { length: 64 }).notNull(),
  availabilityStatus: varchar('availability_status', { length: 32 }).notNull().default('available'), // 'available', 'booked', 'maintenance'
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_machinery_category_district').on(table.category, table.district),
  index('idx_machinery_owner').on(table.ownerFarmerId),
]);

export const machineryBookings = pgTable('machinery_bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id').notNull().references(() => machineryListings.id, { onDelete: 'cascade' }),
  renterFarmerId: uuid('renter_farmer_id').notNull().references(() => farmerProfiles.id, { onDelete: 'cascade' }),
  farmId: uuid('farm_id').references(() => farms.id, { onDelete: 'set null' }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('requested'), // 'requested', 'confirmed', 'completed', 'cancelled'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_machinery_bookings_renter').on(table.renterFarmerId),
  index('idx_machinery_bookings_listing').on(table.listingId),
]);
