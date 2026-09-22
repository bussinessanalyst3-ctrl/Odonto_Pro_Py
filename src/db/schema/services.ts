import { pgTable, uuid, varchar, text, timestamp, integer, bigint, boolean } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';

export const services = pgTable('services', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  category: varchar('category', { length: 100 }).notNull(),
  code: varchar('code', { length: 30 }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  defaultDurationMin: integer('default_duration_min').default(30).notNull(),
  basePrice: bigint('base_price', { mode: 'number' }).notNull(), // Guaraníes (PYG) sin centavos
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const branchServices = pgTable('branch_services', {
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  customPrice: bigint('custom_price', { mode: 'number' }).notNull(), // Precio por sucursal en PYG
  isAvailable: boolean('is_available').default(true).notNull(),
});
