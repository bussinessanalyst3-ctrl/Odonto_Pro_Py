import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { users } from './users.ts';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  branchId: uuid('branch_id').references(() => branches.id),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, EXPORT, CANCEL
  entity: varchar('entity', { length: 50 }).notNull(), // PATIENT, APPOINTMENT, CLINICAL_RECORD, PAYMENT, etc.
  entityId: varchar('entity_id', { length: 50 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
