import { hasPermission } from '../../security/rbacHierarchy.ts';
import {
  annulPayrollSettlementRecord,
  annulStaffPaymentRecord,
  approvePayrollSettlementRecord,
  CommissionCalculationMode,
  CommissionTriggerType,
  computePayrollDashboardMetrics,
  createCommissionRuleRecord,
  createEmployeeRecord,
  createManualCommissionAdjustment,
  createPayrollSettlementRecord,
  ensurePayrollIntegrity,
  getActiveSalaryForEmployee,
  getSalaryHistoryForEmployee,
  listAdvisorEmployees,
  PaymentFrequency,
  recordStaffPaymentRecord,
  RemunerationModality,
  StaffArea,
  submitSettlementForApprovalRecord,
  toggleEmployeeStatusRecord,
  updateCommissionRuleRecord,
  updateEmployeeRecord,
  upsertEmployeeSalaryRecord,
} from '../payrollEngine.ts';
import type { StoreContext } from './types.ts';

export function getEmployeeLinkedToUser(ctx: StoreContext, userId?: string | null) {
  if (!userId) return null;
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  return (data.employees || []).find((e: any) => e.organizationId === orgId && e.userId === userId) || null;
}

export function getEmployees(
  ctx: StoreContext,
  filters?: { branchId?: string | null; area?: StaffArea | 'ALL'; status?: 'ACTIVE' | 'INACTIVE' | 'ALL'; search?: string }
) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  let list = (data.employees || []).filter((e: any) => e.organizationId === orgId);
  if (filters?.branchId) {
    list = list.filter((e: any) => e.branchId === filters.branchId || !e.branchId);
  }
  if (filters?.area && filters.area !== 'ALL') {
    list = list.filter((e: any) => e.area === filters.area);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((e: any) => e.status === filters.status);
  }
  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    list = list.filter(
      (e: any) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        (e.documentNumber || '').toLowerCase().includes(q) ||
        (e.employeeCode || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
    );
  }
  return list;
}

export function getAdvisorEmployees(ctx: StoreContext, branchId?: string | null) {
  const data = ctx.getData();
  return listAdvisorEmployees(data, data.organization?.id, branchId);
}

export function createEmployee(
  ctx: StoreContext,
  payload: {
    branchId?: string | null;
    userId?: string | null;
    employeeCode?: string;
    firstName: string;
    lastName: string;
    documentType?: string;
    documentNumber: string;
    phone?: string | null;
    email?: string | null;
    area: StaffArea;
    position: string;
    hireDate?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    remunerationModality: RemunerationModality;
    isAdvisor?: boolean;
    observations?: string | null;
    initialSalary?: number | null;
    paymentFrequency?: PaymentFrequency;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'staff.manage')) {
    throw new Error('403 Prohibido: No posee autorización para registrar personal.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const created = createEmployeeRecord(
    data,
    { ...payload, organizationId: data.organization.id },
    resolvedActorId
  );
  if (payload.initialSalary && payload.initialSalary > 0) {
    upsertEmployeeSalaryRecord(
      data,
      {
        employeeId: created.id,
        baseSalary: payload.initialSalary,
        paymentFrequency: payload.paymentFrequency || 'MENSUAL',
        effectiveDate: created.hireDate,
        observations: 'Salario inicial registrado al dar de alta al colaborador',
      },
      resolvedActorId
    );
  }
  ctx.notify();
  return created;
}

export function updateEmployee(ctx: StoreContext, employeeId: string, updates: any, actorUserId?: string | null) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'staff.manage')) {
    throw new Error('403 Prohibido: No posee autorización para modificar fichas de personal.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const updated = updateEmployeeRecord(data, employeeId, updates, resolvedActorId);
  ctx.notify();
  return updated;
}

export function toggleEmployeeStatus(
  ctx: StoreContext,
  employeeId: string,
  status?: 'ACTIVE' | 'INACTIVE',
  actorUserId?: string | null
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'staff.manage')) {
    throw new Error('403 Prohibido: No posee autorización para cambiar el estado del personal.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const updated = toggleEmployeeStatusRecord(data, employeeId, status, resolvedActorId);
  ctx.notify();
  return updated;
}

export function getEmployeeSalaries(ctx: StoreContext, employeeId?: string) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  if (employeeId) {
    return getSalaryHistoryForEmployee(data, employeeId);
  }
  return (data.employeeSalaries || []).filter((s: any) => s.organizationId === orgId);
}

export function getActiveSalary(ctx: StoreContext, employeeId: string) {
  return getActiveSalaryForEmployee(ctx.getData(), employeeId);
}

export function registerEmployeeSalary(
  ctx: StoreContext,
  payload: {
    employeeId: string;
    baseSalary: number;
    paymentFrequency: PaymentFrequency;
    effectiveDate: string;
    observations?: string | null;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'salaries.manage')) {
    throw new Error('403 Prohibido: No posee autorización para registrar o actualizar salarios.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const salary = upsertEmployeeSalaryRecord(data, payload, resolvedActorId);
  ctx.notify();
  return salary;
}

export function getCommissionRules(
  ctx: StoreContext,
  filters?: { area?: StaffArea | 'ALL'; status?: 'ACTIVE' | 'INACTIVE' | 'ALL' }
) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  let rules = (data.commissionRules || []).filter((r: any) => r.organizationId === orgId);
  if (filters?.area && filters.area !== 'ALL') {
    rules = rules.filter((r: any) => r.area === filters.area);
  }
  if (filters?.status && filters.status !== 'ALL') {
    rules = rules.filter((r: any) => r.status === filters.status);
  }
  return rules;
}

export function createCommissionRule(
  ctx: StoreContext,
  payload: {
    branchId?: string | null;
    name: string;
    description?: string | null;
    area: StaffArea;
    triggerType: CommissionTriggerType;
    calculationMode: CommissionCalculationMode;
    ratePercentage?: number | null;
    fixedAmount?: number | null;
    minThresholdAmount?: number | null;
    serviceId?: string | null;
    targetEmployeeId?: string | null;
    requiresCollectedPayment?: boolean;
    requiresCompletedTreatment?: boolean;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'commissions.rules_manage')) {
    throw new Error('403 Prohibido: No posee autorización para configurar reglas de comisiones.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const rule = createCommissionRuleRecord(
    data,
    { ...payload, organizationId: data.organization.id },
    resolvedActorId
  );
  ctx.notify();
  return rule;
}

export function updateCommissionRule(ctx: StoreContext, ruleId: string, updates: any, actorUserId?: string | null) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'commissions.rules_manage')) {
    throw new Error('403 Prohibido: No posee autorización para modificar reglas de comisiones.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const updated = updateCommissionRuleRecord(data, ruleId, updates, resolvedActorId);
  ctx.notify();
  return updated;
}

export function getGeneratedCommissions(
  ctx: StoreContext,
  filters?: {
    employeeId?: string | null;
    area?: StaffArea | 'ALL';
    status?: string | 'ALL';
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
  }
) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  let list = (data.generatedCommissions || []).filter((c: any) => c.organizationId === orgId);
  if (filters?.employeeId) {
    list = list.filter((c: any) => c.employeeId === filters.employeeId);
  }
  if (filters?.area && filters.area !== 'ALL') {
    list = list.filter((c: any) => c.area === filters.area);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((c: any) => c.status === filters.status);
  }
  if (filters?.periodYear && filters.periodYear !== 'ALL') {
    list = list.filter((c: any) => c.periodYear === filters.periodYear);
  }
  if (filters?.periodMonth && filters.periodMonth !== 'ALL') {
    list = list.filter((c: any) => c.periodMonth === filters.periodMonth);
  }
  return list;
}

export function createManualCommission(
  ctx: StoreContext,
  payload: {
    employeeId: string;
    concept: string;
    commissionAmount: number;
    periodYear?: number;
    periodMonth?: number;
    notes?: string | null;
    ruleId?: string | null;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.create') && !hasPermission(actor, 'commissions.rules_manage')) {
    throw new Error('403 Prohibido: No posee autorización para asignar bonos o comisiones manuales.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const rec = createManualCommissionAdjustment(data, payload, resolvedActorId);
  ctx.notify();
  return rec;
}

export function getPayrollSettlements(
  ctx: StoreContext,
  filters?: {
    employeeId?: string | null;
    status?: string | 'ALL';
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
    branchId?: string | null;
    area?: StaffArea | 'ALL';
  }
) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  const employees = data.employees || [];
  let list = (data.payrollSettlements || []).filter((s: any) => s.organizationId === orgId);
  if (filters?.employeeId) {
    list = list.filter((s: any) => s.employeeId === filters.employeeId);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((s: any) => s.status === filters.status);
  }
  if (filters?.periodYear && filters.periodYear !== 'ALL') {
    list = list.filter((s: any) => s.periodYear === filters.periodYear);
  }
  if (filters?.periodMonth && filters.periodMonth !== 'ALL') {
    list = list.filter((s: any) => s.periodMonth === filters.periodMonth);
  }
  if (filters?.branchId) {
    list = list.filter((s: any) => s.branchId === filters.branchId);
  }
  if (filters?.area && filters.area !== 'ALL') {
    list = list.filter((s: any) => {
      const emp = employees.find((e: any) => e.id === s.employeeId);
      return emp?.area === filters.area;
    });
  }
  return list;
}

export function getPayrollSettlementItems(ctx: StoreContext, settlementId: string) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  return (data.payrollSettlementItems || []).filter((i: any) => i.settlementId === settlementId);
}

export function createPayrollSettlement(
  ctx: StoreContext,
  payload: Parameters<typeof createPayrollSettlementRecord>[1] & { actorUserId?: string | null }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.create')) {
    throw new Error('403 Prohibido: No posee autorización para generar liquidaciones de personal.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const res = createPayrollSettlementRecord(data, payload, resolvedActorId);
  ctx.notify();
  return res;
}

export function submitPayrollSettlement(ctx: StoreContext, settlementId: string, actorUserId?: string | null) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.create')) {
    throw new Error('403 Prohibido: No posee autorización para enviar liquidaciones a aprobación.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const res = submitSettlementForApprovalRecord(data, settlementId, resolvedActorId);
  ctx.notify();
  return res;
}

export function approvePayrollSettlement(ctx: StoreContext, settlementId: string, actorUserId?: string | null) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.approve')) {
    throw new Error('403 Prohibido: No posee autorización para aprobar liquidaciones de haberes.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const res = approvePayrollSettlementRecord(data, settlementId, resolvedActorId);
  ctx.notify();
  return res;
}

export function annulPayrollSettlement(
  ctx: StoreContext,
  settlementId: string,
  reason: string,
  actorUserId?: string | null
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.approve') && !hasPermission(actor, 'payroll.create')) {
    throw new Error('403 Prohibido: No posee autorización para anular liquidaciones.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const res = annulPayrollSettlementRecord(data, settlementId, reason, resolvedActorId);
  ctx.notify();
  return res;
}

export function getStaffPayments(
  ctx: StoreContext,
  filters?: { employeeId?: string | null; settlementId?: string | null; status?: string | 'ALL' }
) {
  const data = ctx.getData();
  ensurePayrollIntegrity(data);
  const orgId = data.organization?.id;
  let list = (data.staffPayments || []).filter((p: any) => p.organizationId === orgId);
  if (filters?.employeeId) {
    list = list.filter((p: any) => p.employeeId === filters.employeeId);
  }
  if (filters?.settlementId) {
    list = list.filter((p: any) => p.settlementId === filters.settlementId);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((p: any) => p.status === filters.status);
  }
  return list;
}

export function recordStaffPayment(
  ctx: StoreContext,
  payload: {
    settlementId: string;
    amount: number;
    paymentMethod: string;
    paymentDate?: string;
    referenceNumber?: string | null;
    notes?: string | null;
    overpaymentOverride?: boolean;
    overpaymentOverrideReason?: string | null;
    actorUserId?: string | null;
  }
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.pay')) {
    throw new Error('403 Prohibido: No posee autorización para registrar pagos al personal.');
  }
  const resolvedActorId = payload.actorUserId || actor?.userId || data.users[0]?.id || null;
  const canOverrideBalance = actor ? hasPermission(actor, 'payroll.override_balance') : true;
  const res = recordStaffPaymentRecord(
    data,
    {
      ...payload,
      canOverrideBalance,
    },
    resolvedActorId
  );
  ctx.notify();
  return res;
}

export function annulStaffPayment(
  ctx: StoreContext,
  paymentId: string,
  reason: string,
  actorUserId?: string | null
) {
  const data = ctx.getData();
  const actor = ctx.getEffectiveActor();
  if (actor && !hasPermission(actor, 'payroll.pay') && !hasPermission(actor, 'payroll.approve')) {
    throw new Error('403 Prohibido: No posee autorización para anular pagos al personal.');
  }
  const resolvedActorId = actorUserId || actor?.userId || data.users[0]?.id || null;
  const res = annulStaffPaymentRecord(data, paymentId, reason, resolvedActorId);
  ctx.notify();
  return res;
}

export function getPayrollDashboardMetrics(
  ctx: StoreContext,
  filters?: {
    branchId?: string | null;
    area?: StaffArea | 'ALL';
    employeeId?: string | null;
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
    status?: string | 'ALL';
  }
) {
  const data = ctx.getData();
  return computePayrollDashboardMetrics(data, {
    organizationId: data.organization?.id,
    ...filters,
  });
}
