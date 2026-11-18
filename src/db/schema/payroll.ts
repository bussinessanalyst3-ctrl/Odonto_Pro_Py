import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, date, numeric, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations, branches } from './organizations.ts';
import { users } from './users.ts';
import { services } from './services.ts';
import { patients } from './patients.ts';
import { quotes, treatments } from './financial.ts';
import { payments } from './financial.ts';

// ============================================================================
// GESTIÓN FINANCIERA DEL PERSONAL: EMPLEADOS, SALARIOS, COMISIONES Y PAGOS
// ============================================================================

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  employeeCode: varchar('employee_code', { length: 40 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  documentType: varchar('document_type', { length: 20 }).default('CI').notNull(),
  documentNumber: varchar('document_number', { length: 50 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  email: varchar('email', { length: 255 }),
  area: varchar('area', { length: 20 }).notNull(), // OPERATIVA, CLINICA, COMERCIAL
  position: varchar('position', { length: 120 }).notNull(),
  hireDate: date('hire_date').notNull(),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE, INACTIVE
  remunerationModality: varchar('remuneration_modality', { length: 30 }).default('SALARIO_FIJO').notNull(), // SALARIO_FIJO, COMISION, MIXTO, HONORARIOS
  isAdvisor: boolean('is_advisor').default(false).notNull(),
  observations: text('observations'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('uq_employee_org_code').on(table.organizationId, table.employeeCode),
]);

export const employeeSalaries = pgTable('employee_salaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  area: varchar('area', { length: 20 }).notNull(), // OPERATIVA, CLINICA, COMERCIAL
  baseSalary: bigint('base_salary', { mode: 'number' }).notNull(), // Guaraníes (PYG)
  paymentFrequency: varchar('payment_frequency', { length: 20 }).default('MENSUAL').notNull(), // SEMANAL, QUINCENAL, MENSUAL
  effectiveDate: date('effective_date').notNull(),
  endDate: date('end_date'),
  currency: varchar('currency', { length: 3 }).default('PYG').notNull(),
  status: varchar('status', { length: 20 }).default('VIGENTE').notNull(), // VIGENTE, HISTORICO, INACTIVO
  observations: text('observations'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const commissionRules = pgTable('commission_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 180 }).notNull(),
  area: varchar('area', { length: 20 }).notNull(), // OPERATIVA, CLINICA, COMERCIAL
  targetType: varchar('target_type', { length: 20 }).default('AREA').notNull(), // EMPLOYEE, AREA, ROLE
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  targetRoleId: varchar('target_role_id', { length: 50 }),
  serviceId: uuid('service_id').references(() => services.id, { onDelete: 'set null' }),
  concept: varchar('concept', { length: 50 }).notNull(), // CAPTACION_PACIENTE, VENTA_TRATAMIENTO, CUMPLIMIENTO_OBJETIVO, OPERACION_COBRADA, TRATAMIENTO_REALIZADO, PROCEDIMIENTO_FINALIZADO, SERVICIO_PRESTADO, BONO_PRODUCTIVIDAD, AJUSTE_MANUAL
  calculationMode: varchar('calculation_mode', { length: 30 }).notNull(), // PERCENTAGE, FIXED_PER_OPERATION, FIXED_PER_TREATMENT, GOAL_BONUS, MANUAL_ADJUSTMENT
  percentageRate: numeric('percentage_rate', { precision: 6, scale: 2 }).default('0').notNull(),
  fixedAmount: bigint('fixed_amount', { mode: 'number' }).default(0).notNull(),
  calculationBase: varchar('calculation_base', { length: 30 }).default('AMOUNT_COLLECTED').notNull(), // AMOUNT_COLLECTED, TREATMENT_TOTAL, QUOTE_TOTAL, PER_UNIT, GOAL_TARGET
  triggerCondition: varchar('trigger_condition', { length: 40 }).default('ON_PAYMENT_COLLECTED').notNull(), // ON_PAYMENT_COLLECTED, ON_TREATMENT_COMPLETED, ON_PATIENT_ACQUISITION, MANUAL_OR_GOAL
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(), // ACTIVE, INACTIVE
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const generatedCommissions = pgTable('generated_commissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  ruleId: uuid('rule_id').references(() => commissionRules.id, { onDelete: 'set null' }),
  area: varchar('area', { length: 20 }).notNull(),
  sourceType: varchar('source_type', { length: 30 }).notNull(), // PAYMENT, TREATMENT, QUOTE, PATIENT, MANUAL, GOAL
  sourceId: varchar('source_id', { length: 80 }).notNull(),
  dedupKey: varchar('dedup_key', { length: 200 }).notNull(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  treatmentId: uuid('treatment_id').references(() => treatments.id, { onDelete: 'set null' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  advisorSnapshotId: uuid('advisor_snapshot_id'),
  advisorSnapshotName: varchar('advisor_snapshot_name', { length: 200 }),
  concept: varchar('concept', { length: 255 }).notNull(),
  baseAmount: bigint('base_amount', { mode: 'number' }).default(0).notNull(),
  appliedRate: varchar('applied_rate', { length: 60 }),
  commissionAmount: bigint('commission_amount', { mode: 'number' }).notNull(),
  period: varchar('period', { length: 10 }).notNull(), // YYYY-MM
  status: varchar('status', { length: 25 }).default('PENDIENTE').notNull(), // PENDIENTE, EN_LIQUIDACION, APROBADA, PAGADA, ANULADA
  settlementId: uuid('settlement_id'),
  isManualAdjustment: boolean('is_manual_adjustment').default(false).notNull(),
  notes: text('notes'),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payrollSettlements = pgTable('payroll_settlements', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  settlementNumber: varchar('settlement_number', { length: 60 }).notNull(),
  area: varchar('area', { length: 20 }).notNull(),
  period: varchar('period', { length: 10 }).notNull(), // YYYY-MM
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  baseSalaryAmount: bigint('base_salary_amount', { mode: 'number' }).default(0).notNull(),
  commissionsAmount: bigint('commissions_amount', { mode: 'number' }).default(0).notNull(),
  bonusesAmount: bigint('bonuses_amount', { mode: 'number' }).default(0).notNull(),
  advancesAmount: bigint('advances_amount', { mode: 'number' }).default(0).notNull(),
  deductionsAmount: bigint('deductions_amount', { mode: 'number' }).default(0).notNull(),
  manualAdjustmentsAmount: bigint('manual_adjustments_amount', { mode: 'number' }).default(0).notNull(),
  grossTotal: bigint('gross_total', { mode: 'number' }).default(0).notNull(),
  netPayable: bigint('net_payable', { mode: 'number' }).default(0).notNull(),
  paidAmount: bigint('paid_amount', { mode: 'number' }).default(0).notNull(),
  balanceDue: bigint('balance_due', { mode: 'number' }).default(0).notNull(),
  status: varchar('status', { length: 30 }).default('BORRADOR').notNull(), // BORRADOR, PENDIENTE_APROBACION, APROBADA, PAGADA, ANULADA
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedByUserId: uuid('approved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  annulledByUserId: uuid('annulled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  annulledAt: timestamp('annulled_at', { withTimezone: true }),
  annulmentReason: text('annulment_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_payroll_settlement_org_num').on(table.organizationId, table.settlementNumber),
]);

export const payrollSettlementItems = pgTable('payroll_settlement_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  settlementId: uuid('settlement_id').notNull().references(() => payrollSettlements.id, { onDelete: 'cascade' }),
  itemType: varchar('item_type', { length: 25 }).notNull(), // BASE_SALARY, COMMISSION, BONUS, ADVANCE, DEDUCTION, ADJUSTMENT
  description: varchar('description', { length: 255 }).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  generatedCommissionId: uuid('generated_commission_id').references(() => generatedCommissions.id, { onDelete: 'set null' }),
  sourceReference: varchar('source_reference', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const staffPayments = pgTable('staff_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'restrict' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'restrict' }),
  settlementId: uuid('settlement_id').notNull().references(() => payrollSettlements.id, { onDelete: 'restrict' }),
  operationNumber: varchar('operation_number', { length: 60 }).notNull(),
  paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(), // EFECTIVO, TRANSFERENCIA_SIPAP, QR_BANCARIO, TARJETA_DEBITO, TARJETA_CREDITO, BILLETERA_DIGITAL, CHEQUE
  referenceNumber: varchar('reference_number', { length: 120 }),
  responsibleUserId: uuid('responsible_user_id').references(() => users.id, { onDelete: 'set null' }),
  responsibleUserName: varchar('responsible_user_name', { length: 180 }).notNull(),
  status: varchar('status', { length: 20 }).default('COMPLETADO').notNull(), // COMPLETADO, ANULADO
  overpaymentOverride: boolean('overpayment_override').default(false).notNull(),
  overpaymentOverrideReason: text('overpayment_override_reason'),
  annulledByUserId: uuid('annulled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  annulledAt: timestamp('annulled_at', { withTimezone: true }),
  annulmentReason: text('annulment_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('uq_staff_payment_org_op').on(table.organizationId, table.operationNumber),
]);
