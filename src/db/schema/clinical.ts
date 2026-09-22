import { pgTable, uuid, varchar, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { patients } from './patients.ts';
import { users } from './users.ts';
import { appointments } from './appointments.ts';

export const clinicalRecords = pgTable('clinical_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  odontologistId: uuid('odontologist_id').notNull().references(() => users.id),
  appointmentId: uuid('appointment_id').references(() => appointments.id),
  reasonForConsultation: text('reason_for_consultation'),
  diagnosis: text('diagnosis').notNull(),
  treatmentPerformed: text('treatment_performed').notNull(),
  prescriptions: text('prescriptions'),
  recommendations: text('recommendations'),
  internalNotes: text('internal_notes'),
  attachments: jsonb('attachments'), // [{ name, url, type, size }]
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const odontograms = pgTable('odontograms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  odontologistId: uuid('odontologist_id').notNull().references(() => users.id),
  clinicalRecordId: uuid('clinical_record_id').references(() => clinicalRecords.id),
  version: integer('version').default(1).notNull(),
  odontogramType: varchar('odontogram_type', { length: 20 }).default('ADULTO').notNull(), // ADULTO (FDI 11-48), PEDIATRICO (FDI 51-85)
  generalObservations: text('general_observations'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const odontogramItems = pgTable('odontogram_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  odontogramId: uuid('odontogram_id').notNull().references(() => odontograms.id),
  toothNumber: integer('tooth_number').notNull(), // Código FDI: 11 a 48, 51 a 85
  surface: varchar('surface', { length: 20 }).default('GENERAL').notNull(), // OCLUSAL, MESIAL, DISTAL, VESTIBULAR, LINGUAL, PALATINA, GENERAL
  condition: varchar('condition', { length: 50 }).notNull(), // SANO, CARIES, OBTURACION, CORONA, ENDODONCIA, AUSENTE, PROTESIS, IMPLANTE
  material: varchar('material', { length: 50 }), // Resina, Amalgama, Zirconio, etc.
  notes: text('notes'),
  colorCode: varchar('color_code', { length: 10 }), // #EF4444 (rojo: patología), #3B82F6 (azul: tratamiento realizado)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
