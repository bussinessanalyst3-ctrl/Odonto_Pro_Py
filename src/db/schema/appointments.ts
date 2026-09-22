import { pgTable, uuid, varchar, text, timestamp, date, time, integer, boolean } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { patients } from './patients.ts';
import { users } from './users.ts';
import { services } from './services.ts';

export const dentalChairs = pgTable('dental_chairs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  name: varchar('name', { length: 100 }).notNull(), // ej. "Sillón 1 (Principal)", "Sillón 2 (Quirúrgico)"
  code: varchar('code', { length: 20 }).notNull(), // ej. "S1", "S2"
  room: varchar('room', { length: 50 }), // Consultorio A, Sala 2
  status: varchar('status', { length: 20 }).default('OPERATIVE').notNull(), // OPERATIVE, MAINTENANCE, INACTIVE
  colorTag: varchar('color_tag', { length: 20 }).default('teal'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  dentalChairId: uuid('dental_chair_id').references(() => dentalChairs.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  odontologistId: uuid('odontologist_id').notNull().references(() => users.id),
  serviceId: uuid('service_id').references(() => services.id),
  appointmentDate: date('appointment_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  status: varchar('status', { length: 25 }).default('PENDIENTE').notNull(), // PENDIENTE, CONFIRMADA, EN_SALA, EN_ATENCION, FINALIZADA, CANCELADA, NO_ASISTIO
  reason: text('reason'),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
