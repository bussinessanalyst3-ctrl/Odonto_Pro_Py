import { pgTable, uuid, varchar, text, timestamp, bigint, integer, date } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { patients } from './patients.ts';
import { users } from './users.ts';
import { services } from './services.ts';
import { appointments } from './appointments.ts';

export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  odontologistId: uuid('odontologist_id').references(() => users.id),
  quoteNumber: varchar('quote_number', { length: 50 }).notNull(),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(), // En PYG (Guaraníes)
  discountAmount: bigint('discount_amount', { mode: 'number' }).default(0).notNull(),
  finalAmount: bigint('final_amount', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 20 }).default('PENDIENTE').notNull(), // PENDIENTE, APROBADO, RECHAZADO, VENCIDO
  validUntil: date('valid_until'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const quoteItems = pgTable('quote_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id),
  serviceId: uuid('service_id').references(() => services.id),
  toothNumber: integer('tooth_number'),
  description: text('description').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
  subtotal: bigint('subtotal', { mode: 'number' }).notNull(),
});

export const treatments = pgTable('treatments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  quoteId: uuid('quote_id').references(() => quotes.id),
  title: varchar('title', { length: 200 }).notNull(),
  totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
  paidAmount: bigint('paid_amount', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 25 }).default('EN_PROGRESO').notNull(), // PLANIFICADO, EN_PROGRESO, COMPLETADO, SUSPENDIDO
  startDate: date('start_date'),
  completedDate: date('completed_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const cashRegisters = pgTable('cash_registers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  openedBy: uuid('opened_by').notNull().references(() => users.id),
  closedBy: uuid('closed_by').references(() => users.id),
  openingAmount: bigint('opening_amount', { mode: 'number' }).notNull(), // Apertura en PYG
  closingAmountExpected: bigint('closing_amount_expected', { mode: 'number' }),
  closingAmountReal: bigint('closing_amount_real', { mode: 'number' }),
  differenceAmount: bigint('difference_amount', { mode: 'number' }),
  status: varchar('status', { length: 20 }).default('ABIERTA').notNull(), // ABIERTA, CERRADA, ARQUEADA
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  observations: text('observations'),
});

export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  cashRegisterId: uuid('cash_register_id').notNull().references(() => cashRegisters.id),
  movementType: varchar('movement_type', { length: 20 }).notNull(), // INGRESO, EGRESO, AJUSTE
  amount: bigint('amount', { mode: 'number' }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // EFECTIVO, TARJETA_DEBITO, TARJETA_CREDITO, TRANSFERENCIA_SIPAP, QR
  concept: varchar('concept', { length: 255 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }), // Nro Comprobante SIPAP o Voucher
  performedBy: uuid('performed_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  treatmentId: uuid('treatment_id').references(() => treatments.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  cashMovementId: uuid('cash_movement_id').references(() => cashMovements.id),
  receiptNumber: varchar('receipt_number', { length: 50 }).notNull(), // Ej: REC-001-001-0001234
  invoiceNumber: varchar('invoice_number', { length: 50 }), // Factura Legal Paraguay: 001-001-0000123
  amount: bigint('amount', { mode: 'number' }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).default('COMPLETADO').notNull(),
  notes: text('notes'),
  receivedBy: uuid('received_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
