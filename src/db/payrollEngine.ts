// ============================================================================
// MOTOR DE DOMINIO: GESTIÓN FINANCIERA DEL PERSONAL, SALARIOS Y COMISIONES
// Compartido entre Frontend Store (inMemoryStore.ts) y Backend API (server.ts)
// ============================================================================

export type StaffArea = 'OPERATIVA' | 'CLINICA' | 'COMERCIAL';
export type RemunerationModality = 'SALARIO_FIJO' | 'COMISION' | 'MIXTO' | 'HONORARIOS';
export type PaymentFrequency = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';
export type SalaryStatus = 'VIGENTE' | 'HISTORICO' | 'INACTIVO';
export type CommissionTriggerType =
  | 'ON_PAYMENT_COLLECTED'
  | 'ON_TREATMENT_COMPLETED'
  | 'ON_PATIENT_ACQUISITION'
  | 'ON_GOAL_ACHIEVED'
  | 'MANUAL';
export type CommissionCalculationMode =
  | 'PERCENTAGE'
  | 'FIXED_OPERATION'
  | 'FIXED_TREATMENT'
  | 'GOAL_BONUS'
  | 'MANUAL_ADJUSTMENT';
export type CommissionStatus = 'PENDIENTE' | 'EN_LIQUIDACION' | 'APROBADA' | 'PAGADA' | 'ANULADA';
export type SettlementStatus = 'BORRADOR' | 'PENDIENTE_APROBACION' | 'APROBADA' | 'PAGADA' | 'ANULADA';
export type StaffPaymentStatus = 'COMPLETADO' | 'ANULADO';

export const UNKNOWN_CREATOR_LABEL = 'Origen histórico / Desconocido';

export interface EmployeeRecord {
  id: string;
  organizationId: string;
  branchId: string | null;
  userId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string | null;
  email: string | null;
  area: StaffArea;
  position: string;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  remunerationModality: RemunerationModality;
  isAdvisor: boolean;
  observations: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface EmployeeSalaryRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  area: StaffArea;
  baseSalary: number;
  paymentFrequency: PaymentFrequency;
  effectiveDate: string;
  endDate: string | null;
  currency: 'PYG';
  status: SalaryStatus;
  observations: string | null;
  createdBy: string | null;
  createdAt: string | Date;
}

export interface CommissionRuleRecord {
  id: string;
  organizationId: string;
  branchId: string | null;
  name: string;
  description: string | null;
  area: StaffArea;
  triggerType: CommissionTriggerType;
  calculationMode: CommissionCalculationMode;
  ratePercentage: number | null;
  fixedAmount: number | null;
  minThresholdAmount: number | null;
  serviceId: string | null;
  targetEmployeeId: string | null;
  requiresCollectedPayment: boolean;
  requiresCompletedTreatment: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface GeneratedCommissionRecord {
  id: string;
  organizationId: string;
  branchId: string | null;
  employeeId: string;
  ruleId: string | null;
  settlementId: string | null;
  area: StaffArea;
  triggerType: CommissionTriggerType;
  sourceType: 'PAYMENT' | 'TREATMENT' | 'PATIENT' | 'GOAL' | 'MANUAL';
  sourceId: string;
  dedupKey: string;
  patientId: string | null;
  quoteId: string | null;
  treatmentId: string | null;
  paymentId: string | null;
  serviceId: string | null;
  advisorSnapshotId: string | null;
  advisorSnapshotName: string | null;
  baseAmount: number;
  appliedRate: number | null;
  commissionAmount: number;
  currency: 'PYG';
  periodYear: number;
  periodMonth: number;
  status: CommissionStatus;
  concept: string;
  notes: string | null;
  earnedAt: string | Date;
  createdBy: string | null;
  createdAt: string | Date;
}

export interface PayrollSettlementRecord {
  id: string;
  organizationId: string;
  branchId: string | null;
  employeeId: string;
  settlementNumber: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  baseSalarySnapshot: number;
  commissionsTotal: number;
  bonusesTotal: number;
  advancesTotal: number;
  deductionsTotal: number;
  adjustmentsTotal: number;
  grossTotal: number;
  netPayable: number;
  paidAmount: number;
  balanceDue: number;
  currency: 'PYG';
  status: SettlementStatus;
  notes: string | null;
  createdBy: string | null;
  submittedAt: string | Date | null;
  approvedBy: string | null;
  approvedAt: string | Date | null;
  annulledBy: string | null;
  annulledAt: string | Date | null;
  annulledReason: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PayrollSettlementItemRecord {
  id: string;
  settlementId: string;
  itemType: 'SALARIO_BASE' | 'COMISION' | 'BONO' | 'ANTICIPO' | 'DESCUENTO' | 'AJUSTE';
  commissionId: string | null;
  concept: string;
  sign: 'CREDIT' | 'DEBIT';
  amount: number;
  notes: string | null;
  createdAt: string | Date;
}

export interface StaffPaymentRecord {
  id: string;
  organizationId: string;
  branchId: string | null;
  settlementId: string;
  employeeId: string;
  operationNumber: string;
  paymentDate: string;
  amount: number;
  currency: 'PYG';
  paymentMethod: string;
  referenceNumber: string | null;
  overpaymentOverride: boolean;
  overpaymentOverrideReason: string | null;
  status: StaffPaymentStatus;
  notes: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  annulledBy: string | null;
  annulledAt: string | Date | null;
  annulledReason: string | null;
  createdAt: string | Date;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toIsoDateOnly(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split('T')[0];
  const parsed = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
  return parsed.toISOString().split('T')[0];
}

function pushAudit(
  data: any,
  params: {
    organizationId: string;
    branchId?: string | null;
    userId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    oldValues?: any;
    newValues?: any;
    description: string;
  }
) {
  if (!Array.isArray(data.auditLogs)) data.auditLogs = [];
  data.auditLogs.unshift({
    id: makeUuid(),
    organizationId: params.organizationId,
    branchId: params.branchId || null,
    userId: params.userId || null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId || null,
    ipAddress: '127.0.0.1',
    userAgent: 'OdontoPro Payroll Engine',
    oldValues: params.oldValues ?? null,
    newValues: params.newValues ?? null,
    description: params.description,
    createdAt: new Date(),
  });
}

export function getUserDisplayName(user: any): string {
  if (!user) return UNKNOWN_CREATOR_LABEL;
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.username || user.email || UNKNOWN_CREATOR_LABEL;
}

export function getEmployeeDisplayName(emp: EmployeeRecord | any): string {
  if (!emp) return 'No asignado';
  return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.employeeCode || 'Empleado';
}

/**
 * Inicializa estructuras del módulo de Personal y migra pacientes históricos sin inventar creadores falsos.
 */
export function ensurePayrollIntegrity(data: any): void {
  if (!data) return;
  if (!Array.isArray(data.employees)) data.employees = [];
  if (!Array.isArray(data.employeeSalaries)) data.employeeSalaries = [];
  if (!Array.isArray(data.commissionRules)) data.commissionRules = [];
  if (!Array.isArray(data.generatedCommissions)) data.generatedCommissions = [];
  if (!Array.isArray(data.payrollSettlements)) data.payrollSettlements = [];
  if (!Array.isArray(data.payrollSettlementItems)) data.payrollSettlementItems = [];
  if (!Array.isArray(data.staffPayments)) data.staffPayments = [];

  if (Array.isArray(data.patients)) {
    for (const pat of data.patients) {
      if (pat.assignedAdvisorId === undefined) pat.assignedAdvisorId = null;
      if (pat.assignedAt === undefined) pat.assignedAt = null;
      if (pat.assignedByUserId === undefined) pat.assignedByUserId = null;
      if (pat.createdByUserId === undefined) pat.createdByUserId = null;
      if (!pat.createdByNameSnapshot || typeof pat.createdByNameSnapshot !== 'string' || !pat.createdByNameSnapshot.trim()) {
        if (pat.createdByUserId && Array.isArray(data.users)) {
          const creatorUser = data.users.find((u: any) => u.id === pat.createdByUserId);
          pat.createdByNameSnapshot = creatorUser ? getUserDisplayName(creatorUser) : UNKNOWN_CREATOR_LABEL;
        } else {
          pat.createdByNameSnapshot = UNKNOWN_CREATOR_LABEL;
        }
      }
    }
  }
}

export function listAdvisorEmployees(data: any, organizationId: string, branchId?: string | null): EmployeeRecord[] {
  ensurePayrollIntegrity(data);
  return (data.employees as EmployeeRecord[]).filter((emp) => {
    if (emp.organizationId !== organizationId) return false;
    if (emp.status !== 'ACTIVE') return false;
    if (!emp.isAdvisor) return false;
    if (branchId && emp.branchId && emp.branchId !== branchId) return false;
    return true;
  });
}

export function createEmployeeRecord(
  data: any,
  payload: {
    organizationId?: string;
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
  },
  actorUserId?: string | null
): EmployeeRecord {
  ensurePayrollIntegrity(data);
  const orgId = payload.organizationId || data.organization?.id;
  if (!orgId) throw new Error('Organización inválida para registrar empleado.');

  const firstName = (payload.firstName || '').trim();
  const lastName = (payload.lastName || '').trim();
  const documentNumber = (payload.documentNumber || '').trim();
  const position = (payload.position || '').trim();

  if (!firstName || !lastName) throw new Error('Nombre y apellido del empleado son obligatorios.');
  if (!documentNumber) throw new Error('El documento de identidad del empleado es obligatorio.');
  if (!position) throw new Error('El cargo o función es obligatorio.');
  if (!['OPERATIVA', 'CLINICA', 'COMERCIAL'].includes(payload.area)) {
    throw new Error('Área operativa inválida. Debe ser OPERATIVA, CLINICA o COMERCIAL.');
  }
  if (!['SALARIO_FIJO', 'COMISION', 'MIXTO', 'HONORARIOS'].includes(payload.remunerationModality)) {
    throw new Error('Modalidad de remuneración inválida.');
  }

  // Validación de vínculo opcional a usuario existente sin duplicar usuarios
  let linkedUserId: string | null = payload.userId ? payload.userId.trim() : null;
  if (linkedUserId) {
    const existingUser = (data.users || []).find((u: any) => u.id === linkedUserId);
    if (!existingUser) {
      throw new Error('El usuario del sistema seleccionado no existe.');
    }
    const alreadyLinked = (data.employees as EmployeeRecord[]).find(
      (e) => e.organizationId === orgId && e.userId === linkedUserId
    );
    if (alreadyLinked) {
      throw new Error(
        `El usuario seleccionado ya está vinculado al empleado ${getEmployeeDisplayName(alreadyLinked)} (${alreadyLinked.employeeCode}).`
      );
    }
  } else {
    linkedUserId = null;
  }

  const orgEmployees = (data.employees as EmployeeRecord[]).filter((e) => e.organizationId === orgId);
  const duplicateDoc = orgEmployees.find(
    (e) => e.documentNumber.replace(/\D/g, '') === documentNumber.replace(/\D/g, '')
  );
  if (duplicateDoc) {
    throw new Error(`Ya existe un empleado registrado con el documento ${documentNumber}.`);
  }

  const nextSeq = orgEmployees.length + 1;
  const employeeCode = (payload.employeeCode || '').trim() || `EMP-${String(nextSeq).padStart(4, '0')}`;
  if (orgEmployees.some((e) => e.employeeCode.toLowerCase() === employeeCode.toLowerCase())) {
    throw new Error(`El código de empleado "${employeeCode}" ya existe en la organización.`);
  }

  const record: EmployeeRecord = {
    id: makeUuid(),
    organizationId: orgId,
    branchId: payload.branchId || null,
    userId: linkedUserId,
    employeeCode,
    firstName,
    lastName,
    documentType: payload.documentType || 'CI',
    documentNumber,
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    area: payload.area,
    position,
    hireDate: payload.hireDate || toIsoDateOnly(new Date()),
    status: payload.status || 'ACTIVE',
    remunerationModality: payload.remunerationModality,
    isAdvisor: payload.isAdvisor !== undefined ? Boolean(payload.isAdvisor) : payload.area === 'COMERCIAL',
    observations: payload.observations?.trim() || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.employees.unshift(record);
  pushAudit(data, {
    organizationId: orgId,
    branchId: record.branchId,
    userId: actorUserId,
    action: 'CREATE_EMPLOYEE',
    entity: 'EMPLOYEE',
    entityId: record.id,
    newValues: {
      employeeCode: record.employeeCode,
      area: record.area,
      userId: record.userId,
      isAdvisor: record.isAdvisor,
      remunerationModality: record.remunerationModality,
    },
    description: `Alta de personal: ${getEmployeeDisplayName(record)} (${record.employeeCode}) - Área ${record.area}`,
  });

  return record;
}

export function updateEmployeeRecord(
  data: any,
  employeeId: string,
  updates: Partial<{
    branchId: string | null;
    userId: string | null;
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    phone: string | null;
    email: string | null;
    area: StaffArea;
    position: string;
    hireDate: string;
    status: 'ACTIVE' | 'INACTIVE';
    remunerationModality: RemunerationModality;
    isAdvisor: boolean;
    observations: string | null;
  }>,
  actorUserId?: string | null
): EmployeeRecord {
  ensurePayrollIntegrity(data);
  const idx = (data.employees as EmployeeRecord[]).findIndex((e) => e.id === employeeId);
  if (idx === -1) throw new Error('Empleado no encontrado.');

  const current = data.employees[idx] as EmployeeRecord;
  const orgId = current.organizationId;

  if (updates.userId !== undefined) {
    const nextUserId = updates.userId ? updates.userId.trim() : null;
    if (nextUserId) {
      const existingUser = (data.users || []).find((u: any) => u.id === nextUserId);
      if (!existingUser) throw new Error('El usuario del sistema seleccionado no existe.');
      const conflict = (data.employees as EmployeeRecord[]).find(
        (e) => e.organizationId === orgId && e.userId === nextUserId && e.id !== employeeId
      );
      if (conflict) {
        throw new Error(`Ese usuario ya está vinculado a ${getEmployeeDisplayName(conflict)}.`);
      }
    }
    updates.userId = nextUserId;
  }

  const updated: EmployeeRecord = {
    ...current,
    ...updates,
    updatedAt: new Date(),
  };
  data.employees[idx] = updated;

  pushAudit(data, {
    organizationId: orgId,
    branchId: updated.branchId,
    userId: actorUserId,
    action: 'UPDATE_EMPLOYEE',
    entity: 'EMPLOYEE',
    entityId: employeeId,
    oldValues: {
      area: current.area,
      position: current.position,
      userId: current.userId,
      isAdvisor: current.isAdvisor,
      status: current.status,
    },
    newValues: updates,
    description: `Actualización de ficha de empleado: ${getEmployeeDisplayName(updated)} (${updated.employeeCode})`,
  });

  return updated;
}

export function toggleEmployeeStatusRecord(
  data: any,
  employeeId: string,
  status?: 'ACTIVE' | 'INACTIVE',
  actorUserId?: string | null
): EmployeeRecord {
  ensurePayrollIntegrity(data);
  const emp = (data.employees as EmployeeRecord[]).find((e) => e.id === employeeId);
  if (!emp) throw new Error('Empleado no encontrado.');
  const prevStatus = emp.status;
  const nextStatus = status || (emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
  emp.status = nextStatus;
  emp.updatedAt = new Date();

  pushAudit(data, {
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    userId: actorUserId,
    action: 'STATUS_CHANGE',
    entity: 'EMPLOYEE',
    entityId: employeeId,
    oldValues: { status: prevStatus },
    newValues: { status: nextStatus },
    description: `Cambio de estado de ${getEmployeeDisplayName(emp)} (${emp.employeeCode}) a ${nextStatus}`,
  });

  return emp;
}

export function getActiveSalaryForEmployee(data: any, employeeId: string): EmployeeSalaryRecord | null {
  ensurePayrollIntegrity(data);
  return (
    (data.employeeSalaries as EmployeeSalaryRecord[]).find(
      (s) => s.employeeId === employeeId && s.status === 'VIGENTE'
    ) || null
  );
}

export function getSalaryHistoryForEmployee(data: any, employeeId: string): EmployeeSalaryRecord[] {
  ensurePayrollIntegrity(data);
  return (data.employeeSalaries as EmployeeSalaryRecord[])
    .filter((s) => s.employeeId === employeeId)
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
}

/**
 * Registra o actualiza el salario base de un empleado preservando historial completo
 * y sin modificar liquidaciones o pagos históricos ya generados.
 */
export function upsertEmployeeSalaryRecord(
  data: any,
  payload: {
    employeeId: string;
    baseSalary: number;
    paymentFrequency: PaymentFrequency;
    effectiveDate: string;
    observations?: string | null;
  },
  actorUserId?: string | null
): EmployeeSalaryRecord {
  ensurePayrollIntegrity(data);
  const emp = (data.employees as EmployeeRecord[]).find((e) => e.id === payload.employeeId);
  if (!emp) throw new Error('Empleado no encontrado para registrar salario.');
  if (typeof payload.baseSalary !== 'number' || Number.isNaN(payload.baseSalary) || payload.baseSalary < 0) {
    throw new Error('El salario base en PYG debe ser un número válido mayor o igual a 0.');
  }
  if (!['SEMANAL', 'QUINCENAL', 'MENSUAL'].includes(payload.paymentFrequency)) {
    throw new Error('Frecuencia de pago inválida (SEMANAL, QUINCENAL o MENSUAL).');
  }
  const effectiveDate = payload.effectiveDate || toIsoDateOnly(new Date());

  const previousActive = (data.employeeSalaries as EmployeeSalaryRecord[]).find(
    (s) => s.employeeId === emp.id && s.status === 'VIGENTE'
  );
  if (previousActive) {
    previousActive.status = 'HISTORICO';
    previousActive.endDate = effectiveDate;
  }

  const newSalary: EmployeeSalaryRecord = {
    id: makeUuid(),
    organizationId: emp.organizationId,
    employeeId: emp.id,
    area: emp.area,
    baseSalary: Math.round(payload.baseSalary),
    paymentFrequency: payload.paymentFrequency,
    effectiveDate,
    endDate: null,
    currency: 'PYG',
    status: 'VIGENTE',
    observations: payload.observations?.trim() || null,
    createdBy: actorUserId || null,
    createdAt: new Date(),
  };

  data.employeeSalaries.unshift(newSalary);

  pushAudit(data, {
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    userId: actorUserId,
    action: previousActive ? 'SALARY_UPDATED' : 'SALARY_REGISTERED',
    entity: 'EMPLOYEE_SALARY',
    entityId: newSalary.id,
    oldValues: previousActive
      ? { baseSalary: previousActive.baseSalary, frequency: previousActive.paymentFrequency, effectiveDate: previousActive.effectiveDate }
      : null,
    newValues: {
      baseSalary: newSalary.baseSalary,
      paymentFrequency: newSalary.paymentFrequency,
      effectiveDate: newSalary.effectiveDate,
    },
    description: `${previousActive ? 'Actualización salarial' : 'Registro salarial'} para ${getEmployeeDisplayName(emp)}: ₲ ${newSalary.baseSalary.toLocaleString('es-PY')} (${newSalary.paymentFrequency}) vigente desde ${effectiveDate}`,
  });

  return newSalary;
}

export function createCommissionRuleRecord(
  data: any,
  payload: {
    organizationId?: string;
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
    status?: 'ACTIVE' | 'INACTIVE';
  },
  actorUserId?: string | null
): CommissionRuleRecord {
  ensurePayrollIntegrity(data);
  const orgId = payload.organizationId || data.organization?.id;
  if (!orgId) throw new Error('Organización inválida.');
  if (!payload.name?.trim()) throw new Error('El nombre de la regla de comisión es obligatorio.');
  if (!['OPERATIVA', 'CLINICA', 'COMERCIAL'].includes(payload.area)) {
    throw new Error('Área inválida para la regla de comisión.');
  }

  if (payload.calculationMode === 'PERCENTAGE') {
    if (payload.ratePercentage === null || payload.ratePercentage === undefined || payload.ratePercentage <= 0 || payload.ratePercentage > 100) {
      throw new Error('Para reglas por porcentaje debe especificar una tasa entre 0.01% y 100%.');
    }
  } else {
    if (payload.fixedAmount === null || payload.fixedAmount === undefined || payload.fixedAmount < 0) {
      throw new Error('Para reglas de monto fijo o bono debe especificar un valor en PYG válido.');
    }
  }

  const rule: CommissionRuleRecord = {
    id: makeUuid(),
    organizationId: orgId,
    branchId: payload.branchId || null,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    area: payload.area,
    triggerType: payload.triggerType,
    calculationMode: payload.calculationMode,
    ratePercentage: payload.ratePercentage !== undefined && payload.ratePercentage !== null ? Number(payload.ratePercentage) : null,
    fixedAmount: payload.fixedAmount !== undefined && payload.fixedAmount !== null ? Math.round(Number(payload.fixedAmount)) : null,
    minThresholdAmount:
      payload.minThresholdAmount !== undefined && payload.minThresholdAmount !== null
        ? Math.round(Number(payload.minThresholdAmount))
        : null,
    serviceId: payload.serviceId || null,
    targetEmployeeId: payload.targetEmployeeId || null,
    requiresCollectedPayment:
      payload.requiresCollectedPayment !== undefined
        ? Boolean(payload.requiresCollectedPayment)
        : payload.triggerType === 'ON_PAYMENT_COLLECTED',
    requiresCompletedTreatment:
      payload.requiresCompletedTreatment !== undefined
        ? Boolean(payload.requiresCompletedTreatment)
        : payload.triggerType === 'ON_TREATMENT_COMPLETED',
    effectiveFrom: payload.effectiveFrom || null,
    effectiveTo: payload.effectiveTo || null,
    status: payload.status || 'ACTIVE',
    createdBy: actorUserId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.commissionRules.unshift(rule);

  pushAudit(data, {
    organizationId: orgId,
    branchId: rule.branchId,
    userId: actorUserId,
    action: 'CREATE_COMMISSION_RULE',
    entity: 'COMMISSION_RULE',
    entityId: rule.id,
    newValues: {
      name: rule.name,
      area: rule.area,
      triggerType: rule.triggerType,
      calculationMode: rule.calculationMode,
      ratePercentage: rule.ratePercentage,
      fixedAmount: rule.fixedAmount,
    },
    description: `Nueva regla de comisión configurada: "${rule.name}" (${rule.area} - ${rule.triggerType})`,
  });

  return rule;
}

export function updateCommissionRuleRecord(
  data: any,
  ruleId: string,
  updates: Partial<CommissionRuleRecord>,
  actorUserId?: string | null
): CommissionRuleRecord {
  ensurePayrollIntegrity(data);
  const idx = (data.commissionRules as CommissionRuleRecord[]).findIndex((r) => r.id === ruleId);
  if (idx === -1) throw new Error('Regla de comisión no encontrada.');

  const prev = data.commissionRules[idx];
  const next: CommissionRuleRecord = {
    ...prev,
    ...updates,
    id: prev.id,
    organizationId: prev.organizationId,
    updatedAt: new Date(),
  };
  data.commissionRules[idx] = next;

  pushAudit(data, {
    organizationId: next.organizationId,
    branchId: next.branchId,
    userId: actorUserId,
    action: 'UPDATE_COMMISSION_RULE',
    entity: 'COMMISSION_RULE',
    entityId: ruleId,
    oldValues: { status: prev.status, ratePercentage: prev.ratePercentage, fixedAmount: prev.fixedAmount },
    newValues: updates,
    description: `Actualización de regla de comisión "${next.name}"`,
  });

  return next;
}

export interface CommissionEvaluationEvent {
  eventType: 'PAYMENT_COLLECTED' | 'TREATMENT_COMPLETED' | 'PATIENT_ACQUISITION' | 'GOAL_ACHIEVED';
  organizationId: string;
  branchId?: string | null;
  patientId?: string | null;
  quoteId?: string | null;
  treatmentId?: string | null;
  paymentId?: string | null;
  serviceId?: string | null;
  amount?: number;
  odontologistUserId?: string | null;
  odontologistEmployeeId?: string | null;
  targetEmployeeId?: string | null;
  eventDate?: string;
  actorUserId?: string | null;
  conceptDetail?: string;
}

/**
 * Motor determinístico de evaluación y generación de comisiones.
 * - Respeta cero hardcoded percentages: únicamente usa reglas activas configuradas en BD.
 * - Impide comisiones en presupuestos no cobrados / tratamientos no finalizados cuando la regla lo exige.
 * - Utiliza dedupKey único (ruleId::sourceType::sourceId) evitando dobles comisiones.
 * - Congela snapshot del asesor al momento del evento sin verse alterado por cambios futuros en el paciente.
 */
export function evaluateCommissionsForEvent(
  data: any,
  event: CommissionEvaluationEvent
): GeneratedCommissionRecord[] {
  ensurePayrollIntegrity(data);

  const eventDate = event.eventDate || toIsoDateOnly(new Date());
  const eventDateObj = new Date(eventDate);
  const periodYear = eventDateObj.getUTCFullYear();
  const periodMonth = eventDateObj.getUTCMonth() + 1;

  const patient = event.patientId
    ? (data.patients || []).find((p: any) => p.id === event.patientId)
    : null;
  const treatment = event.treatmentId
    ? (data.treatments || []).find((t: any) => t.id === event.treatmentId)
    : null;
  const payment = event.paymentId
    ? (data.payments || []).find((p: any) => p.id === event.paymentId)
    : null;
  const quoteId = event.quoteId || treatment?.quoteId || null;
  const quote = quoteId ? (data.quotes || []).find((q: any) => q.id === quoteId) : null;
  const quoteItems = quoteId ? (data.quoteItems || []).filter((qi: any) => qi.quoteId === quoteId) : [];

  // Regla de integridad por tipo de evento
  if (event.eventType === 'PAYMENT_COLLECTED') {
    if (!payment || payment.status !== 'COMPLETADO' || Number(payment.amount || 0) <= 0) {
      return [];
    }
  }
  if (event.eventType === 'TREATMENT_COMPLETED') {
    if (!treatment || treatment.status !== 'COMPLETADO') {
      return [];
    }
  }

  const triggerMap: Record<CommissionEvaluationEvent['eventType'], CommissionTriggerType> = {
    PAYMENT_COLLECTED: 'ON_PAYMENT_COLLECTED',
    TREATMENT_COMPLETED: 'ON_TREATMENT_COMPLETED',
    PATIENT_ACQUISITION: 'ON_PATIENT_ACQUISITION',
    GOAL_ACHIEVED: 'ON_GOAL_ACHIEVED',
  };
  const expectedTrigger = triggerMap[event.eventType];

  const baseAmount =
    event.eventType === 'PAYMENT_COLLECTED'
      ? Number(payment?.amount ?? event.amount ?? 0)
      : event.eventType === 'TREATMENT_COMPLETED'
        ? Number(treatment?.totalAmount ?? event.amount ?? 0)
        : Number(event.amount ?? 0);

  const sourceType: GeneratedCommissionRecord['sourceType'] =
    event.eventType === 'PAYMENT_COLLECTED'
      ? 'PAYMENT'
      : event.eventType === 'TREATMENT_COMPLETED'
        ? 'TREATMENT'
        : event.eventType === 'PATIENT_ACQUISITION'
          ? 'PATIENT'
          : 'GOAL';

  const sourceId =
    (event.eventType === 'PAYMENT_COLLECTED'
      ? event.paymentId
      : event.eventType === 'TREATMENT_COMPLETED'
        ? event.treatmentId
        : event.eventType === 'PATIENT_ACQUISITION'
          ? event.patientId
          : `${event.targetEmployeeId || 'ORG'}-${periodYear}-${String(periodMonth).padStart(2, '0')}`) || makeUuid();

  const matchingRules = (data.commissionRules as CommissionRuleRecord[]).filter((rule) => {
    if (rule.organizationId !== event.organizationId) return false;
    if (rule.status !== 'ACTIVE') return false;
    if (rule.triggerType !== expectedTrigger) return false;
    if (rule.branchId && event.branchId && rule.branchId !== event.branchId) return false;
    if (rule.effectiveFrom && eventDate < rule.effectiveFrom) return false;
    if (rule.effectiveTo && eventDate > rule.effectiveTo) return false;
    if (rule.minThresholdAmount && baseAmount < rule.minThresholdAmount) return false;

    if (rule.requiresCollectedPayment && (!payment || payment.status !== 'COMPLETADO' || Number(payment.amount || 0) <= 0)) {
      return false;
    }
    if (rule.requiresCompletedTreatment && (!treatment || treatment.status !== 'COMPLETADO')) {
      return false;
    }

    if (rule.serviceId) {
      const hasMatchingService =
        event.serviceId === rule.serviceId ||
        quoteItems.some((qi: any) => qi.serviceId === rule.serviceId);
      if (!hasMatchingService) return false;
    }

    return true;
  });

  const created: GeneratedCommissionRecord[] = [];

  for (const rule of matchingRules) {
    // Resolver empleado destinatario según área y regla de trazabilidad
    let targetEmployee: EmployeeRecord | undefined;

    if (rule.area === 'COMERCIAL') {
      // ESTRICTO: Solo usa assignedAdvisorId del paciente (NUNCA createdByUserId)
      const advisorId = patient?.assignedAdvisorId || null;
      if (!advisorId) continue;
      if (rule.targetEmployeeId && rule.targetEmployeeId !== advisorId) continue;
      targetEmployee = (data.employees as EmployeeRecord[]).find(
        (e) => e.id === advisorId && e.organizationId === event.organizationId && e.status === 'ACTIVE'
      );
    } else if (rule.area === 'CLINICA') {
      if (rule.targetEmployeeId) {
        targetEmployee = (data.employees as EmployeeRecord[]).find(
          (e) => e.id === rule.targetEmployeeId && e.organizationId === event.organizationId && e.status === 'ACTIVE'
        );
      } else if (event.odontologistEmployeeId) {
        targetEmployee = (data.employees as EmployeeRecord[]).find(
          (e) => e.id === event.odontologistEmployeeId && e.organizationId === event.organizationId && e.status === 'ACTIVE'
        );
      } else {
        const odontoUserId = event.odontologistUserId || quote?.odontologistId || null;
        if (odontoUserId) {
          targetEmployee = (data.employees as EmployeeRecord[]).find(
            (e) =>
              e.userId === odontoUserId &&
              e.organizationId === event.organizationId &&
              e.status === 'ACTIVE' &&
              e.area === 'CLINICA'
          );
          if (!targetEmployee) {
            targetEmployee = (data.employees as EmployeeRecord[]).find(
              (e) => e.userId === odontoUserId && e.organizationId === event.organizationId && e.status === 'ACTIVE'
            );
          }
        }
      }
    } else {
      // OPERATIVA
      const empId = rule.targetEmployeeId || event.targetEmployeeId || null;
      if (!empId) continue;
      targetEmployee = (data.employees as EmployeeRecord[]).find(
        (e) => e.id === empId && e.organizationId === event.organizationId && e.status === 'ACTIVE'
      );
    }

    if (!targetEmployee) continue;

    // Anti-duplicación estricta
    const dedupKey = `${rule.id}::${sourceType}::${sourceId}`;
    const alreadyExists = (data.generatedCommissions as GeneratedCommissionRecord[]).some(
      (c) => c.organizationId === event.organizationId && c.dedupKey === dedupKey && c.status !== 'ANULADA'
    );
    if (alreadyExists) continue;

    let commissionAmount = 0;
    if (rule.calculationMode === 'PERCENTAGE') {
      const rate = Number(rule.ratePercentage || 0);
      if (rate <= 0 || baseAmount <= 0) continue;
      commissionAmount = Math.round((baseAmount * rate) / 100);
    } else {
      commissionAmount = Math.round(Number(rule.fixedAmount || 0));
    }

    if (commissionAmount <= 0) continue;

    const advisorSnapshotId = patient?.assignedAdvisorId || (rule.area === 'COMERCIAL' ? targetEmployee.id : null);
    const advisorSnapshotEmp = advisorSnapshotId
      ? (data.employees as EmployeeRecord[]).find((e) => e.id === advisorSnapshotId)
      : null;

    const patientLabel = patient ? `${patient.firstName} ${patient.lastName}` : 'Sin paciente vinculado';
    const record: GeneratedCommissionRecord = {
      id: makeUuid(),
      organizationId: event.organizationId,
      branchId: event.branchId || treatment?.branchId || patient?.primaryBranchId || targetEmployee.branchId || null,
      employeeId: targetEmployee.id,
      ruleId: rule.id,
      settlementId: null,
      area: rule.area,
      triggerType: rule.triggerType,
      sourceType,
      sourceId,
      dedupKey,
      patientId: event.patientId || null,
      quoteId,
      treatmentId: event.treatmentId || null,
      paymentId: event.paymentId || null,
      serviceId: event.serviceId || rule.serviceId || null,
      advisorSnapshotId,
      advisorSnapshotName: advisorSnapshotEmp ? getEmployeeDisplayName(advisorSnapshotEmp) : null,
      baseAmount,
      appliedRate: rule.calculationMode === 'PERCENTAGE' ? rule.ratePercentage : null,
      commissionAmount,
      currency: 'PYG',
      periodYear,
      periodMonth,
      status: 'PENDIENTE',
      concept: event.conceptDetail || `${rule.name} — ${patientLabel}`,
      notes: `Generado automáticamente por regla "${rule.name}" (${sourceType})`,
      earnedAt: new Date(eventDate),
      createdBy: event.actorUserId || null,
      createdAt: new Date(),
    };

    data.generatedCommissions.unshift(record);
    created.push(record);

    pushAudit(data, {
      organizationId: event.organizationId,
      branchId: record.branchId,
      userId: event.actorUserId,
      action: 'COMMISSION_GENERATED',
      entity: 'GENERATED_COMMISSION',
      entityId: record.id,
      newValues: {
        employeeId: targetEmployee.id,
        ruleId: rule.id,
        dedupKey,
        commissionAmount,
        patientId: record.patientId,
        quoteId: record.quoteId,
        treatmentId: record.treatmentId,
        paymentId: record.paymentId,
      },
      description: `Comisión generada de ₲ ${commissionAmount.toLocaleString('es-PY')} para ${getEmployeeDisplayName(targetEmployee)} (${rule.name})`,
    });
  }

  return created;
}

export function createManualCommissionAdjustment(
  data: any,
  payload: {
    employeeId: string;
    concept: string;
    commissionAmount: number;
    periodYear?: number;
    periodMonth?: number;
    notes?: string | null;
    ruleId?: string | null;
  },
  actorUserId?: string | null
): GeneratedCommissionRecord {
  ensurePayrollIntegrity(data);
  const emp = (data.employees as EmployeeRecord[]).find((e) => e.id === payload.employeeId);
  if (!emp) throw new Error('Empleado no encontrado.');
  if (!payload.concept?.trim()) throw new Error('El concepto de la comisión/bono manual es obligatorio.');
  if (!payload.commissionAmount || payload.commissionAmount <= 0) {
    throw new Error('El monto en PYG debe ser mayor a 0.');
  }

  const now = new Date();
  const id = makeUuid();
  const record: GeneratedCommissionRecord = {
    id,
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    employeeId: emp.id,
    ruleId: payload.ruleId || null,
    settlementId: null,
    area: emp.area,
    triggerType: 'MANUAL',
    sourceType: 'MANUAL',
    sourceId: id,
    dedupKey: `MANUAL::${id}`,
    patientId: null,
    quoteId: null,
    treatmentId: null,
    paymentId: null,
    serviceId: null,
    advisorSnapshotId: emp.isAdvisor ? emp.id : null,
    advisorSnapshotName: emp.isAdvisor ? getEmployeeDisplayName(emp) : null,
    baseAmount: Math.round(payload.commissionAmount),
    appliedRate: null,
    commissionAmount: Math.round(payload.commissionAmount),
    currency: 'PYG',
    periodYear: payload.periodYear || now.getUTCFullYear(),
    periodMonth: payload.periodMonth || now.getUTCMonth() + 1,
    status: 'PENDIENTE',
    concept: payload.concept.trim(),
    notes: payload.notes?.trim() || 'Ajuste o bono manual autorizado',
    earnedAt: now,
    createdBy: actorUserId || null,
    createdAt: now,
  };

  data.generatedCommissions.unshift(record);
  pushAudit(data, {
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    userId: actorUserId,
    action: 'COMMISSION_MANUAL_ADJUSTMENT',
    entity: 'GENERATED_COMMISSION',
    entityId: record.id,
    newValues: { employeeId: emp.id, commissionAmount: record.commissionAmount, concept: record.concept },
    description: `Comisión/Bono manual de ₲ ${record.commissionAmount.toLocaleString('es-PY')} asignado a ${getEmployeeDisplayName(emp)}: ${record.concept}`,
  });

  return record;
}

export function reverseCommissionsForAnnulledPayment(
  data: any,
  paymentId: string,
  reason: string,
  actorUserId?: string | null
): { annulledCount: number; alreadySettledCount: number } {
  ensurePayrollIntegrity(data);
  const linked = (data.generatedCommissions as GeneratedCommissionRecord[]).filter(
    (c) => c.paymentId === paymentId && c.status !== 'ANULADA'
  );

  let annulledCount = 0;
  let alreadySettledCount = 0;

  for (const comm of linked) {
    if (comm.status === 'PENDIENTE') {
      comm.status = 'ANULADA';
      comm.notes = `${comm.notes ? comm.notes + ' | ' : ''}[ANULADA POR REVERSIÓN DE COBRO]: ${reason}`;
      annulledCount++;
      pushAudit(data, {
        organizationId: comm.organizationId,
        branchId: comm.branchId,
        userId: actorUserId,
        action: 'COMMISSION_ANNULLED',
        entity: 'GENERATED_COMMISSION',
        entityId: comm.id,
        oldValues: { status: 'PENDIENTE' },
        newValues: { status: 'ANULADA', reason },
        description: `Comisión anulada automáticamente por anulación de pago ${paymentId}: ${reason}`,
      });
    } else {
      alreadySettledCount++;
    }
  }

  return { annulledCount, alreadySettledCount };
}

/**
 * Crea una liquidación de haberes consolidando salario base vigente (snapshot),
 * comisiones pendientes seleccionadas, bonos, anticipos y descuentos.
 */
export function createPayrollSettlementRecord(
  data: any,
  payload: {
    employeeId: string;
    periodYear: number;
    periodMonth: number;
    periodLabel?: string;
    includeBaseSalary?: boolean;
    baseSalaryOverride?: number | null;
    commissionIds?: string[];
    bonuses?: Array<{ concept: string; amount: number; notes?: string }>;
    advances?: Array<{ concept: string; amount: number; notes?: string }>;
    deductions?: Array<{ concept: string; amount: number; notes?: string }>;
    manualAdjustments?: Array<{ concept: string; sign: 'CREDIT' | 'DEBIT'; amount: number; notes?: string }>;
    submitForApproval?: boolean;
    notes?: string | null;
  },
  actorUserId?: string | null
): { settlement: PayrollSettlementRecord; items: PayrollSettlementItemRecord[] } {
  ensurePayrollIntegrity(data);
  const emp = (data.employees as EmployeeRecord[]).find((e) => e.id === payload.employeeId);
  if (!emp) throw new Error('Empleado no encontrado para liquidación.');

  const activeSalary = getActiveSalaryForEmployee(data, emp.id);
  const includeBase = payload.includeBaseSalary !== undefined ? payload.includeBaseSalary : emp.remunerationModality !== 'COMISION';
  const baseSalarySnapshot = includeBase
    ? Math.max(0, Math.round(payload.baseSalaryOverride ?? activeSalary?.baseSalary ?? 0))
    : 0;

  // Comisiones elegibles del empleado
  const requestedIds = Array.isArray(payload.commissionIds) ? payload.commissionIds : [];
  const attachedCommissions = (data.generatedCommissions as GeneratedCommissionRecord[]).filter((c) => {
    if (c.employeeId !== emp.id) return false;
    if (c.status !== 'PENDIENTE') return false;
    if (requestedIds.length > 0) return requestedIds.includes(c.id);
    return c.periodYear === payload.periodYear && c.periodMonth === payload.periodMonth;
  });

  const settlementId = makeUuid();
  const orgSettlementsCount = (data.payrollSettlements as PayrollSettlementRecord[]).filter(
    (s) => s.organizationId === emp.organizationId
  ).length;
  const settlementNumber = `LIQ-PER-${payload.periodYear}-${String(orgSettlementsCount + 1).padStart(4, '0')}`;

  const items: PayrollSettlementItemRecord[] = [];
  if (baseSalarySnapshot > 0) {
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'SALARIO_BASE',
      commissionId: null,
      concept: `Salario base vigente (${activeSalary?.paymentFrequency || 'MENSUAL'})`,
      sign: 'CREDIT',
      amount: baseSalarySnapshot,
      notes: activeSalary ? `Salario vigente desde ${activeSalary.effectiveDate}` : 'Monto manual asignado',
      createdAt: new Date(),
    });
  }

  let commissionsTotal = 0;
  for (const comm of attachedCommissions) {
    comm.status = 'EN_LIQUIDACION';
    comm.settlementId = settlementId;
    commissionsTotal += comm.commissionAmount;
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'COMISION',
      commissionId: comm.id,
      concept: comm.concept,
      sign: 'CREDIT',
      amount: comm.commissionAmount,
      notes: `Área ${comm.area} (${comm.sourceType})`,
      createdAt: new Date(),
    });
  }

  let bonusesTotal = 0;
  for (const b of payload.bonuses || []) {
    const amt = Math.round(Number(b.amount || 0));
    if (amt <= 0) continue;
    bonusesTotal += amt;
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'BONO',
      commissionId: null,
      concept: b.concept.trim() || 'Bono de desempeño',
      sign: 'CREDIT',
      amount: amt,
      notes: b.notes || null,
      createdAt: new Date(),
    });
  }

  let advancesTotal = 0;
  for (const a of payload.advances || []) {
    const amt = Math.round(Number(a.amount || 0));
    if (amt <= 0) continue;
    advancesTotal += amt;
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'ANTICIPO',
      commissionId: null,
      concept: a.concept.trim() || 'Anticipo de salario',
      sign: 'DEBIT',
      amount: amt,
      notes: a.notes || null,
      createdAt: new Date(),
    });
  }

  let deductionsTotal = 0;
  for (const d of payload.deductions || []) {
    const amt = Math.round(Number(d.amount || 0));
    if (amt <= 0) continue;
    deductionsTotal += amt;
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'DESCUENTO',
      commissionId: null,
      concept: d.concept.trim() || 'Descuento administrativo',
      sign: 'DEBIT',
      amount: amt,
      notes: d.notes || null,
      createdAt: new Date(),
    });
  }

  let adjustmentsNet = 0;
  for (const adj of payload.manualAdjustments || []) {
    const amt = Math.round(Number(adj.amount || 0));
    if (amt <= 0) continue;
    adjustmentsNet += adj.sign === 'CREDIT' ? amt : -amt;
    items.push({
      id: makeUuid(),
      settlementId,
      itemType: 'AJUSTE',
      commissionId: null,
      concept: adj.concept.trim() || 'Ajuste manual',
      sign: adj.sign,
      amount: amt,
      notes: adj.notes || null,
      createdAt: new Date(),
    });
  }

  const grossTotal = baseSalarySnapshot + commissionsTotal + bonusesTotal + Math.max(0, adjustmentsNet);
  const totalDebits = advancesTotal + deductionsTotal + Math.max(0, -adjustmentsNet);
  const netPayable = Math.max(0, grossTotal - totalDebits);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const periodLabel =
    payload.periodLabel?.trim() ||
    `${monthNames[(payload.periodMonth - 1 + 12) % 12]} ${payload.periodYear}`;

  const status: SettlementStatus = payload.submitForApproval ? 'PENDIENTE_APROBACION' : 'BORRADOR';

  const settlement: PayrollSettlementRecord = {
    id: settlementId,
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    employeeId: emp.id,
    settlementNumber,
    periodYear: payload.periodYear,
    periodMonth: payload.periodMonth,
    periodLabel,
    baseSalarySnapshot,
    commissionsTotal,
    bonusesTotal,
    advancesTotal,
    deductionsTotal,
    adjustmentsTotal: adjustmentsNet,
    grossTotal,
    netPayable,
    paidAmount: 0,
    balanceDue: netPayable,
    currency: 'PYG',
    status,
    notes: payload.notes?.trim() || null,
    createdBy: actorUserId || null,
    submittedAt: payload.submitForApproval ? new Date() : null,
    approvedBy: null,
    approvedAt: null,
    annulledBy: null,
    annulledAt: null,
    annulledReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.payrollSettlements.unshift(settlement);
  data.payrollSettlementItems.push(...items);

  pushAudit(data, {
    organizationId: emp.organizationId,
    branchId: emp.branchId,
    userId: actorUserId,
    action: 'PAYROLL_SETTLEMENT_CREATED',
    entity: 'PAYROLL_SETTLEMENT',
    entityId: settlement.id,
    newValues: {
      settlementNumber,
      employeeId: emp.id,
      periodLabel,
      netPayable,
      status,
      commissionsCount: attachedCommissions.length,
    },
    description: `Liquidación ${settlementNumber} creada para ${getEmployeeDisplayName(emp)} (${periodLabel}) — Neto a pagar: ₲ ${netPayable.toLocaleString('es-PY')}`,
  });

  return { settlement, items };
}

export function submitSettlementForApprovalRecord(
  data: any,
  settlementId: string,
  actorUserId?: string | null
): PayrollSettlementRecord {
  ensurePayrollIntegrity(data);
  const settlement = (data.payrollSettlements as PayrollSettlementRecord[]).find((s) => s.id === settlementId);
  if (!settlement) throw new Error('Liquidación no encontrada.');
  if (settlement.status !== 'BORRADOR') {
    throw new Error(`Solo se pueden enviar a aprobación liquidaciones en estado BORRADOR (estado actual: ${settlement.status}).`);
  }
  settlement.status = 'PENDIENTE_APROBACION';
  settlement.submittedAt = new Date();
  settlement.updatedAt = new Date();

  pushAudit(data, {
    organizationId: settlement.organizationId,
    branchId: settlement.branchId,
    userId: actorUserId,
    action: 'PAYROLL_SETTLEMENT_SUBMITTED',
    entity: 'PAYROLL_SETTLEMENT',
    entityId: settlementId,
    oldValues: { status: 'BORRADOR' },
    newValues: { status: 'PENDIENTE_APROBACION' },
    description: `Liquidación ${settlement.settlementNumber} enviada a aprobación.`,
  });

  return settlement;
}

export function approvePayrollSettlementRecord(
  data: any,
  settlementId: string,
  actorUserId?: string | null
): PayrollSettlementRecord {
  ensurePayrollIntegrity(data);
  const settlement = (data.payrollSettlements as PayrollSettlementRecord[]).find((s) => s.id === settlementId);
  if (!settlement) throw new Error('Liquidación no encontrada.');
  if (settlement.status !== 'BORRADOR' && settlement.status !== 'PENDIENTE_APROBACION') {
    throw new Error(`La liquidación ${settlement.settlementNumber} no puede aprobarse desde el estado ${settlement.status}.`);
  }

  const prevStatus = settlement.status;
  settlement.status = 'APROBADA';
  settlement.approvedBy = actorUserId || null;
  settlement.approvedAt = new Date();
  settlement.updatedAt = new Date();

  for (const comm of data.generatedCommissions as GeneratedCommissionRecord[]) {
    if (comm.settlementId === settlementId && comm.status === 'EN_LIQUIDACION') {
      comm.status = 'APROBADA';
    }
  }

  pushAudit(data, {
    organizationId: settlement.organizationId,
    branchId: settlement.branchId,
    userId: actorUserId,
    action: 'PAYROLL_SETTLEMENT_APPROVED',
    entity: 'PAYROLL_SETTLEMENT',
    entityId: settlementId,
    oldValues: { status: prevStatus },
    newValues: { status: 'APROBADA', netPayable: settlement.netPayable },
    description: `Liquidación ${settlement.settlementNumber} aprobada para pago por ₲ ${settlement.netPayable.toLocaleString('es-PY')}.`,
  });

  return settlement;
}

export function annulPayrollSettlementRecord(
  data: any,
  settlementId: string,
  reason: string,
  actorUserId?: string | null
): PayrollSettlementRecord {
  ensurePayrollIntegrity(data);
  if (!reason || reason.trim().length < 5) {
    throw new Error('Debe especificar un motivo de anulación (mínimo 5 caracteres).');
  }
  const settlement = (data.payrollSettlements as PayrollSettlementRecord[]).find((s) => s.id === settlementId);
  if (!settlement) throw new Error('Liquidación no encontrada.');
  if (settlement.status === 'ANULADA') throw new Error('La liquidación ya se encuentra anulada.');

  const activePayments = (data.staffPayments as StaffPaymentRecord[]).filter(
    (p) => p.settlementId === settlementId && p.status === 'COMPLETADO'
  );
  if (activePayments.length > 0 || settlement.paidAmount > 0) {
    throw new Error(
      'No se puede anular una liquidación que posee pagos vigentes. Anule primero los pagos registrados.'
    );
  }

  const prevStatus = settlement.status;
  settlement.status = 'ANULADA';
  settlement.annulledBy = actorUserId || null;
  settlement.annulledAt = new Date();
  settlement.annulledReason = reason.trim();
  settlement.updatedAt = new Date();

  // Liberar comisiones ligadas para que puedan volver a liquidarse limpiamente
  for (const comm of data.generatedCommissions as GeneratedCommissionRecord[]) {
    if (comm.settlementId === settlementId && comm.status !== 'ANULADA') {
      comm.status = 'PENDIENTE';
      comm.settlementId = null;
    }
  }

  pushAudit(data, {
    organizationId: settlement.organizationId,
    branchId: settlement.branchId,
    userId: actorUserId,
    action: 'PAYROLL_SETTLEMENT_ANNULLED',
    entity: 'PAYROLL_SETTLEMENT',
    entityId: settlementId,
    oldValues: { status: prevStatus },
    newValues: { status: 'ANULADA', reason: settlement.annulledReason },
    description: `Anulación lógica de liquidación ${settlement.settlementNumber}: ${settlement.annulledReason}`,
  });

  return settlement;
}

export function recordStaffPaymentRecord(
  data: any,
  payload: {
    settlementId: string;
    amount: number;
    paymentMethod: string;
    paymentDate?: string;
    referenceNumber?: string | null;
    notes?: string | null;
    overpaymentOverride?: boolean;
    overpaymentOverrideReason?: string | null;
    canOverrideBalance?: boolean;
    responsibleUserName?: string | null;
  },
  actorUserId?: string | null
): { payment: StaffPaymentRecord; settlement: PayrollSettlementRecord } {
  ensurePayrollIntegrity(data);
  const settlement = (data.payrollSettlements as PayrollSettlementRecord[]).find(
    (s) => s.id === payload.settlementId
  );
  if (!settlement) throw new Error('Liquidación no encontrada.');

  if (settlement.status !== 'APROBADA') {
    throw new Error(
      `No se pueden registrar pagos sobre una liquidación en estado "${settlement.status}". Requiere estado APROBADA.`
    );
  }

  const amount = Math.round(Number(payload.amount || 0));
  if (!amount || amount <= 0) {
    throw new Error('El monto del pago al personal debe ser superior a ₲ 0.');
  }

  const isOverpayment = amount > settlement.balanceDue;
  if (isOverpayment) {
    if (!payload.overpaymentOverride || !payload.canOverrideBalance) {
      throw new Error(
        `El pago (₲ ${amount.toLocaleString('es-PY')}) excede el saldo pendiente de la liquidación (₲ ${settlement.balanceDue.toLocaleString('es-PY')}).`
      );
    }
    if (!payload.overpaymentOverrideReason || payload.overpaymentOverrideReason.trim().length < 10) {
      throw new Error(
        'La autorización excepcional de excedente de saldo requiere una justificación de al menos 10 caracteres.'
      );
    }
  }

  const orgPaymentsCount = (data.staffPayments as StaffPaymentRecord[]).filter(
    (p) => p.organizationId === settlement.organizationId
  ).length;
  const year = new Date().getUTCFullYear();
  const operationNumber = `PAG-PER-${year}-${String(orgPaymentsCount + 1).padStart(4, '0')}`;

  const actorUser = actorUserId ? (data.users || []).find((u: any) => u.id === actorUserId) : null;
  const responsibleUserName = payload.responsibleUserName || getUserDisplayName(actorUser);

  const payment: StaffPaymentRecord = {
    id: makeUuid(),
    organizationId: settlement.organizationId,
    branchId: settlement.branchId,
    settlementId: settlement.id,
    employeeId: settlement.employeeId,
    operationNumber,
    paymentDate: payload.paymentDate || toIsoDateOnly(new Date()),
    amount,
    currency: 'PYG',
    paymentMethod: payload.paymentMethod || 'TRANSFERENCIA_SIPAP',
    referenceNumber: payload.referenceNumber?.trim() || null,
    overpaymentOverride: Boolean(isOverpayment && payload.overpaymentOverride),
    overpaymentOverrideReason: isOverpayment ? payload.overpaymentOverrideReason?.trim() || null : null,
    status: 'COMPLETADO',
    notes: payload.notes?.trim() || null,
    responsibleUserId: actorUserId || null,
    responsibleUserName,
    annulledBy: null,
    annulledAt: null,
    annulledReason: null,
    createdAt: new Date(),
  };

  data.staffPayments.unshift(payment);

  settlement.paidAmount = Math.round((settlement.paidAmount || 0) + amount);
  settlement.balanceDue = Math.max(0, settlement.netPayable - settlement.paidAmount);
  if (settlement.balanceDue === 0) {
    settlement.status = 'PAGADA';
    for (const comm of data.generatedCommissions as GeneratedCommissionRecord[]) {
      if (comm.settlementId === settlement.id && comm.status === 'APROBADA') {
        comm.status = 'PAGADA';
      }
    }
  }
  settlement.updatedAt = new Date();

  const emp = (data.employees as EmployeeRecord[]).find((e) => e.id === settlement.employeeId);

  pushAudit(data, {
    organizationId: settlement.organizationId,
    branchId: settlement.branchId,
    userId: actorUserId,
    action: isOverpayment ? 'STAFF_PAYMENT_OVERPAYMENT_OVERRIDE' : 'STAFF_PAYMENT_RECORDED',
    entity: 'STAFF_PAYMENT',
    entityId: payment.id,
    newValues: {
      operationNumber,
      settlementId: settlement.id,
      amount,
      paymentMethod: payment.paymentMethod,
      balanceDue: settlement.balanceDue,
      settlementStatus: settlement.status,
      overpaymentOverride: payment.overpaymentOverride,
      overpaymentOverrideReason: payment.overpaymentOverrideReason,
    },
    description: `Pago ${operationNumber} por ₲ ${amount.toLocaleString('es-PY')} (${payment.paymentMethod}) a ${getEmployeeDisplayName(emp)} sobre ${settlement.settlementNumber}. Saldo restante: ₲ ${settlement.balanceDue.toLocaleString('es-PY')}`,
  });

  return { payment, settlement };
}

export function annulStaffPaymentRecord(
  data: any,
  paymentId: string,
  reason: string,
  actorUserId?: string | null
): { payment: StaffPaymentRecord; settlement: PayrollSettlementRecord } {
  ensurePayrollIntegrity(data);
  if (!reason || reason.trim().length < 5) {
    throw new Error('Debe especificar un motivo válido de anulación (mínimo 5 caracteres).');
  }
  const payment = (data.staffPayments as StaffPaymentRecord[]).find((p) => p.id === paymentId);
  if (!payment) throw new Error('Pago al personal no encontrado.');
  if (payment.status === 'ANULADO') throw new Error('Este pago ya fue anulado.');

  const settlement = (data.payrollSettlements as PayrollSettlementRecord[]).find(
    (s) => s.id === payment.settlementId
  );
  if (!settlement) throw new Error('Liquidación asociada no encontrada.');

  payment.status = 'ANULADO';
  payment.annulledBy = actorUserId || null;
  payment.annulledAt = new Date();
  payment.annulledReason = reason.trim();

  settlement.paidAmount = Math.max(0, (settlement.paidAmount || 0) - payment.amount);
  settlement.balanceDue = Math.max(0, settlement.netPayable - settlement.paidAmount);
  if (settlement.status === 'PAGADA' && settlement.balanceDue > 0) {
    settlement.status = 'APROBADA';
    for (const comm of data.generatedCommissions as GeneratedCommissionRecord[]) {
      if (comm.settlementId === settlement.id && comm.status === 'PAGADA') {
        comm.status = 'APROBADA';
      }
    }
  }
  settlement.updatedAt = new Date();

  pushAudit(data, {
    organizationId: payment.organizationId,
    branchId: payment.branchId,
    userId: actorUserId,
    action: 'STAFF_PAYMENT_ANNULLED',
    entity: 'STAFF_PAYMENT',
    entityId: payment.id,
    oldValues: { status: 'COMPLETADO', amount: payment.amount },
    newValues: { status: 'ANULADO', reason: payment.annulledReason, restoredBalanceDue: settlement.balanceDue },
    description: `Anulación lógica del pago ${payment.operationNumber} (₲ ${payment.amount.toLocaleString('es-PY')}): ${payment.annulledReason}`,
  });

  return { payment, settlement };
}

export interface PayrollDashboardFilters {
  organizationId: string;
  branchId?: string | null;
  area?: StaffArea | 'ALL';
  employeeId?: string | null;
  periodYear?: number | 'ALL';
  periodMonth?: number | 'ALL';
  status?: string | 'ALL';
}

export function computePayrollDashboardMetrics(data: any, filters: PayrollDashboardFilters) {
  ensurePayrollIntegrity(data);
  const employees = (data.employees as EmployeeRecord[]).filter(
    (e) =>
      e.organizationId === filters.organizationId &&
      (!filters.branchId || e.branchId === filters.branchId) &&
      (!filters.area || filters.area === 'ALL' || e.area === filters.area) &&
      (!filters.employeeId || e.id === filters.employeeId)
  );
  const employeeIds = new Set(employees.map((e) => e.id));

  const settlements = (data.payrollSettlements as PayrollSettlementRecord[]).filter((s) => {
    if (s.organizationId !== filters.organizationId) return false;
    if (!employeeIds.has(s.employeeId)) return false;
    if (filters.periodYear && filters.periodYear !== 'ALL' && s.periodYear !== filters.periodYear) return false;
    if (filters.periodMonth && filters.periodMonth !== 'ALL' && s.periodMonth !== filters.periodMonth) return false;
    if (filters.status && filters.status !== 'ALL' && s.status !== filters.status) return false;
    return true;
  });

  const nonAnnulledSettlements = settlements.filter((s) => s.status !== 'ANULADA');
  const activeEmployeesCount = employees.filter((e) => e.status === 'ACTIVE').length;

  const totalSalaries = nonAnnulledSettlements.reduce((sum, s) => sum + (s.baseSalarySnapshot || 0), 0);
  const totalCommissionsInSettlements = nonAnnulledSettlements.reduce((sum, s) => sum + (s.commissionsTotal || 0), 0);
  const pendingUnsettledCommissions = (data.generatedCommissions as GeneratedCommissionRecord[])
    .filter(
      (c) =>
        c.organizationId === filters.organizationId &&
        employeeIds.has(c.employeeId) &&
        c.status === 'PENDIENTE' &&
        (!filters.periodYear || filters.periodYear === 'ALL' || c.periodYear === filters.periodYear) &&
        (!filters.periodMonth || filters.periodMonth === 'ALL' || c.periodMonth === filters.periodMonth)
    )
    .reduce((sum, c) => sum + c.commissionAmount, 0);

  const totalBonuses = nonAnnulledSettlements.reduce((sum, s) => sum + (s.bonusesTotal || 0), 0);
  const totalAdvancesAndDeductions = nonAnnulledSettlements.reduce(
    (sum, s) => sum + (s.advancesTotal || 0) + (s.deductionsTotal || 0),
    0
  );
  const totalPendingToPay = nonAnnulledSettlements.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const totalPaid = nonAnnulledSettlements.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const pendingApprovalCount = nonAnnulledSettlements.filter(
    (s) => s.status === 'BORRADOR' || s.status === 'PENDIENTE_APROBACION'
  ).length;

  const byArea = (['COMERCIAL', 'CLINICA', 'OPERATIVA'] as StaffArea[]).map((area) => {
    const areaEmpIds = new Set(employees.filter((e) => e.area === area).map((e) => e.id));
    const areaSettlements = nonAnnulledSettlements.filter((s) => areaEmpIds.has(s.employeeId));
    return {
      area,
      staffCount: areaEmpIds.size,
      netPayable: areaSettlements.reduce((sum, s) => sum + s.netPayable, 0),
      paidAmount: areaSettlements.reduce((sum, s) => sum + s.paidAmount, 0),
      balanceDue: areaSettlements.reduce((sum, s) => sum + s.balanceDue, 0),
    };
  });

  return {
    activeEmployeesCount,
    totalSalaries,
    totalCommissionsEarned: totalCommissionsInSettlements + pendingUnsettledCommissions,
    pendingUnsettledCommissions,
    totalBonuses,
    totalAdvancesAndDeductions,
    totalPendingToPay,
    totalPaid,
    pendingApprovalCount,
    byArea,
  };
}
