import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';

export const roles = pgTable('roles', {
  id: varchar('id', { length: 50 }).primaryKey(), // SUPER_ADMIN, ADMIN_SUCURSAL, ODONTOLOGO, RECEPCION, CAJA
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  roleId: varchar('role_id', { length: 50 }).notNull().references(() => roles.id),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  professionalLicense: varchar('professional_license', { length: 50 }), // Registro Profesional MSPBS (Paraguay)
  specialty: varchar('specialty', { length: 100 }), // ej. Ortodoncia, Endodoncia
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const userBranches = pgTable('user_branches', {
  userId: uuid('user_id').notNull().references(() => users.id),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
