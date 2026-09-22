import { pgTable, uuid, varchar, text, timestamp, boolean, integer, bigint, time, date, jsonb } from 'drizzle-orm/pg-core';

// ============================================================================
// 1. ORGANIZACIONES Y SUCURSALES (Multi-Tenant Core)
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  taxId: varchar('tax_id', { length: 50 }), // RUC Paraguay
  countryCode: varchar('country_code', { length: 3 }).default('PRY').notNull(),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('PYG').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('America/Asuncion').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 30 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  neighborhood: varchar('neighborhood', { length: 100 }),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  whatsapp: varchar('whatsapp', { length: 30 }),
  email: varchar('email', { length: 255 }),
  openingTime: time('opening_time').default('07:30:00').notNull(),
  closingTime: time('closing_time').default('19:30:00').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const branchSettings = pgTable('branch_settings', {
  branchId: uuid('branch_id').primaryKey().references(() => branches.id),
  appointmentDurationDefault: integer('appointment_duration_default').default(30).notNull(),
  slotInterval: integer('slot_interval').default(15).notNull(),
  allowDoubleBooking: boolean('allow_double_booking').default(false).notNull(),
  requireDocumentOnBooking: boolean('require_document_on_booking').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
