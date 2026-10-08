import { pgTable, uuid, varchar, text, timestamp, integer, bigint, boolean } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { patients } from './patients.ts';

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

export const insurancePlans = pgTable('insurance_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('ACTIVO').notNull(), // ACTIVO, INACTIVO
  coverageTerms: text('coverage_terms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const planServicePrices = pgTable('plan_service_prices', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').notNull().references(() => insurancePlans.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  price: bigint('price', { mode: 'number' }).notNull(), // Precio en PYG para este plan (0 si es 100% cubierto)
  notes: varchar('notes', { length: 255 }), // Ej: 'Cobertura 100%', 'Copago Gs. 40.000'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const insuranceClaims = pgTable('insurance_claims', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  planId: uuid('plan_id').notNull().references(() => insurancePlans.id),
  claimNumber: varchar('claim_number', { length: 50 }).notNull(), // Ej: CLM-ASM-2026-0001
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  treatmentId: uuid('treatment_id'),
  serviceId: uuid('service_id').references(() => services.id),
  patientMemberNumber: varchar('patient_member_number', { length: 80 }),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  toothNumber: integer('tooth_number'),
  originalListPrice: bigint('original_list_price', { mode: 'number' }).notNull(),
  copayAmount: bigint('copay_amount', { mode: 'number' }).notNull(),
  coveredAmount: bigint('covered_amount', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 30 }).default('PENDIENTE_ENVIO').notNull(), // PENDIENTE_ENVIO, EN_AUDITORIA, APROBADO, LIQUIDADO_COBRADO, RECHAZADO
  submissionDate: timestamp('submission_date', { withTimezone: true }),
  settledDate: timestamp('settled_date', { withTimezone: true }),
  settlementReference: varchar('settlement_reference', { length: 100 }), // ej. SIPAP-981248-ASISMED
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
