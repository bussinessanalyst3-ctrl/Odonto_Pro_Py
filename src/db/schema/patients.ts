import { pgTable, uuid, varchar, text, timestamp, date } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  primaryBranchId: uuid('primary_branch_id').references(() => branches.id),
  documentType: varchar('document_type', { length: 20 }).default('CI').notNull(), // CI, RUC, PASAPORTE, OTRO
  documentNumber: varchar('document_number', { length: 50 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthDate: date('birth_date'),
  gender: varchar('gender', { length: 20 }), // MASCULINO, FEMENINO, OTRO, NO_ESPECIFICA
  phone: varchar('phone', { length: 30 }).notNull(), // +595...
  whatsapp: varchar('whatsapp', { length: 30 }),
  email: varchar('email', { length: 255 }),
  department: varchar('department', { length: 100 }), // Departamento de Paraguay
  city: varchar('city', { length: 100 }),
  neighborhood: varchar('neighborhood', { length: 100 }),
  address: text('address'),
  emergencyContactName: varchar('emergency_contact_name', { length: 150 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 30 }),
  bloodType: varchar('blood_type', { length: 10 }),
  allergies: text('allergies'),
  medicalConditions: text('medical_conditions'),
  medications: text('medications'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const patientBranches = pgTable('patient_branches', {
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  firstVisitDate: date('first_visit_date').defaultNow().notNull(),
  lastVisitDate: date('last_visit_date').defaultNow().notNull(),
});
