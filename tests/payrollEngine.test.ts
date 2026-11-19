import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInitialSeedData } from '../src/db/seeds/initial-seed.ts';
import {
  annulPayrollSettlementRecord,
  annulStaffPaymentRecord,
  approvePayrollSettlementRecord,
  createCommissionRuleRecord,
  createEmployeeRecord,
  createManualCommissionAdjustment,
  createPayrollSettlementRecord,
  evaluateCommissionsForEvent,
  getActiveSalaryForEmployee,
  getSalaryHistoryForEmployee,
  recordStaffPaymentRecord,
  reverseCommissionsForAnnulledPayment,
  submitSettlementForApprovalRecord,
  upsertEmployeeSalaryRecord,
} from '../src/db/payrollEngine.ts';

function makeSeedData() {
  return generateInitialSeedData() as any;
}

test('Registro de personal: áreas, vínculo opcional sin duplicar usuarios y rechazo de duplicados', () => {
  const data = makeSeedData();
  const orgId = data.organization.id;
  const branchId = data.branches[0].id;

  // Empleado comercial SIN usuario del sistema
  const commercialEmp = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    userId: null,
    firstName: 'Lucía',
    lastName: 'Gómez',
    documentNumber: '5.555.111',
    area: 'COMERCIAL',
    position: 'Asesora de Captación',
    remunerationModality: 'MIXTO',
    isAdvisor: true,
  });
  assert.equal(commercialEmp.userId, null);
  assert.equal(commercialEmp.isAdvisor, true);
  assert.equal(commercialEmp.area, 'COMERCIAL');

  // El usuario SUPER_ADMIN ya está vinculado a emp1Id en el seed -> debe rechazar doble vínculo
  const superAdmin = data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
  assert.throws(
    () =>
      createEmployeeRecord(data, {
        organizationId: orgId,
        branchId,
        userId: superAdmin.id,
        firstName: 'Otro',
        lastName: 'Usuario',
        documentNumber: '6.666.222',
        area: 'OPERATIVA',
        position: 'Recepcionista',
        remunerationModality: 'SALARIO_FIJO',
      }),
    /ya está vinculado/i
  );

  // Documento duplicado en la misma organización debe rechazarse
  assert.throws(
    () =>
      createEmployeeRecord(data, {
        organizationId: orgId,
        branchId,
        firstName: 'Duplicada',
        lastName: 'Gómez',
        documentNumber: '5555111',
        area: 'OPERATIVA',
        position: 'Auxiliar',
        remunerationModality: 'SALARIO_FIJO',
      }),
    /Ya existe un empleado registrado/i
  );
});

test('Historial salarial: preserva histórico e inmutabilidad de liquidaciones previas', () => {
  const data = makeSeedData();
  const orgId = data.organization.id;
  const branchId = data.branches[0].id;

  const emp = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    firstName: 'Carlos',
    lastName: 'Méndez',
    documentNumber: '7.123.456',
    area: 'OPERATIVA',
    position: 'Coordinador',
    remunerationModality: 'SALARIO_FIJO',
  });

  const sal1 = upsertEmployeeSalaryRecord(data, {
    employeeId: emp.id,
    baseSalary: 3500000,
    paymentFrequency: 'MENSUAL',
    effectiveDate: '2026-08-01',
    observations: 'Salario inicial',
  });
  assert.equal(sal1.status, 'VIGENTE');

  // Liquidación de agosto usando el salario de 3.500.000 PYG
  const { settlement: augSettlement } = createPayrollSettlementRecord(data, {
    employeeId: emp.id,
    periodYear: 2026,
    periodMonth: 8,
    includeBaseSalary: true,
  });
  assert.equal(augSettlement.baseSalarySnapshot, 3500000);
  assert.equal(augSettlement.netPayable, 3500000);

  // Cambio salarial en septiembre
  const sal2 = upsertEmployeeSalaryRecord(data, {
    employeeId: emp.id,
    baseSalary: 4200000,
    paymentFrequency: 'QUINCENAL',
    effectiveDate: '2026-09-01',
    observations: 'Reajuste salarial',
  });

  assert.equal(sal2.status, 'VIGENTE');
  assert.equal(sal1.status, 'HISTORICO');
  assert.equal(sal1.endDate, '2026-09-01');
  assert.equal(getActiveSalaryForEmployee(data, emp.id)?.id, sal2.id);
  assert.equal(getSalaryHistoryForEmployee(data, emp.id).length, 2);

  // Inmutabilidad: la liquidación de agosto NO debe alterarse
  assert.equal(augSettlement.baseSalarySnapshot, 3500000);
  assert.equal(augSettlement.netPayable, 3500000);
});

test('Comisiones comerciales y clínicas: exige cobro efectivo/tratamiento completado, usa asesor asignado y deduplica', () => {
  const data = makeSeedData();
  const orgId = data.organization.id;
  const branchId = data.branches[0].id;
  const adminUser = data.users[0];

  // Desactivar reglas del seed para probar configuración explícita desde cero
  data.commissionRules.forEach((r: any) => {
    r.status = 'INACTIVE';
  });

  const advisorA = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    firstName: 'Asesor',
    lastName: 'Uno',
    documentNumber: '8.001.001',
    area: 'COMERCIAL',
    position: 'Asesor Comercial',
    remunerationModality: 'COMISION',
    isAdvisor: true,
  });
  const advisorB = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    firstName: 'Asesor',
    lastName: 'Dos',
    documentNumber: '8.002.002',
    area: 'COMERCIAL',
    position: 'Asesor Comercial',
    remunerationModality: 'COMISION',
    isAdvisor: true,
  });
  const clinicDoc = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    firstName: 'Dra. Elena',
    lastName: 'Rojas',
    documentNumber: '8.003.003',
    area: 'CLINICA',
    position: 'Endodoncista',
    remunerationModality: 'HONORARIOS',
    isAdvisor: false,
  });

  // Regla comercial 12% sobre cobro efectivo
  const commRule = createCommissionRuleRecord(data, {
    organizationId: orgId,
    name: 'Comisión Comercial 12%',
    area: 'COMERCIAL',
    triggerType: 'ON_PAYMENT_COLLECTED',
    calculationMode: 'PERCENTAGE',
    ratePercentage: 12,
    requiresCollectedPayment: true,
  });

  // Regla clínica monto fijo 150.000 PYG por tratamiento finalizado
  const clinRule = createCommissionRuleRecord(data, {
    organizationId: orgId,
    name: 'Fijo Endodoncia Completada',
    area: 'CLINICA',
    triggerType: 'ON_TREATMENT_COMPLETED',
    calculationMode: 'FIXED_TREATMENT',
    fixedAmount: 150000,
    requiresCompletedTreatment: true,
  });

  // Paciente registrado por adminUser pero con assignedAdvisorId = advisorA
  const patientId = '99999999-1111-4111-8111-000000000001';
  data.patients.push({
    id: patientId,
    organizationId: orgId,
    primaryBranchId: branchId,
    firstName: 'Paciente',
    lastName: 'Comercial',
    documentType: 'CI',
    documentNumber: '4.111.222',
    phone: '+595981000111',
    assignedAdvisorId: advisorA.id,
    createdByUserId: adminUser.id,
    createdByNameSnapshot: 'Business Analyst Administrador Principal',
    status: 'ACTIVE',
  });

  // 1) Pago ANULADO o presupuesto sin pago -> NO debe generar comisión
  const pendingPayId = '99999999-2222-4222-8222-000000000001';
  data.payments.push({
    id: pendingPayId,
    organizationId: orgId,
    branchId,
    patientId,
    amount: 1000000,
    status: 'ANULADO',
  });
  const noComm = evaluateCommissionsForEvent(data, {
    eventType: 'PAYMENT_COLLECTED',
    organizationId: orgId,
    branchId,
    patientId,
    paymentId: pendingPayId,
    eventDate: '2026-10-10',
  });
  assert.equal(noComm.length, 0);

  // 2) Pago COMPLETADO -> genera 12% para advisorA (NO para adminUser)
  const validPayId = '99999999-2222-4222-8222-000000000002';
  data.payments.push({
    id: validPayId,
    organizationId: orgId,
    branchId,
    patientId,
    amount: 1000000,
    status: 'COMPLETADO',
  });
  const createdCom = evaluateCommissionsForEvent(data, {
    eventType: 'PAYMENT_COLLECTED',
    organizationId: orgId,
    branchId,
    patientId,
    paymentId: validPayId,
    eventDate: '2026-10-10',
  });
  assert.equal(createdCom.length, 1);
  assert.equal(createdCom[0].ruleId, commRule.id);
  assert.equal(createdCom[0].employeeId, advisorA.id);
  assert.equal(createdCom[0].advisorSnapshotId, advisorA.id);
  assert.equal(createdCom[0].commissionAmount, 120000);

  // 3) Re-evaluar el mismo pago NO duplica comisión (dedupKey)
  const dupCom = evaluateCommissionsForEvent(data, {
    eventType: 'PAYMENT_COLLECTED',
    organizationId: orgId,
    branchId,
    patientId,
    paymentId: validPayId,
    eventDate: '2026-10-10',
  });
  assert.equal(dupCom.length, 0);

  // 4) Reasignar el asesor comercial del paciente a advisorB NO altera la comisión histórica ya devengada
  const patObj = data.patients.find((p: any) => p.id === patientId);
  patObj.assignedAdvisorId = advisorB.id;
  assert.equal(createdCom[0].employeeId, advisorA.id);
  assert.equal(createdCom[0].advisorSnapshotId, advisorA.id);

  // 5) Tratamiento EN_PROGRESO NO genera comisión clínica; COMPLETADO sí genera
  const treatId = '99999999-3333-4333-8333-000000000001';
  data.treatments.push({
    id: treatId,
    organizationId: orgId,
    branchId,
    patientId,
    title: 'Endodoncia Pieza 16',
    totalAmount: 900000,
    status: 'EN_PROGRESO',
  });
  const noClin = evaluateCommissionsForEvent(data, {
    eventType: 'TREATMENT_COMPLETED',
    organizationId: orgId,
    branchId,
    patientId,
    treatmentId: treatId,
    odontologistEmployeeId: clinicDoc.id,
    eventDate: '2026-10-11',
  });
  assert.equal(noClin.length, 0);

  data.treatments.find((t: any) => t.id === treatId).status = 'COMPLETADO';
  const yesClin = evaluateCommissionsForEvent(data, {
    eventType: 'TREATMENT_COMPLETED',
    organizationId: orgId,
    branchId,
    patientId,
    treatmentId: treatId,
    odontologistEmployeeId: clinicDoc.id,
    eventDate: '2026-10-11',
  });
  assert.equal(yesClin.length, 1);
  assert.equal(yesClin[0].ruleId, clinRule.id);
  assert.equal(yesClin[0].employeeId, clinicDoc.id);
  assert.equal(yesClin[0].commissionAmount, 150000);

  // 6) Aislamiento multi-tenant: evento en otra organización no lee pacientes de orgId
  const crossTenantCom = evaluateCommissionsForEvent(data, {
    eventType: 'TREATMENT_COMPLETED',
    organizationId: 'other-org-uuid',
    patientId,
    treatmentId: treatId,
    eventDate: '2026-10-11',
  });
  assert.equal(crossTenantCom.length, 0);

  // 7) Reversión al anular un cobro pendiente
  const rev = reverseCommissionsForAnnulledPayment(data, validPayId, 'Error en cobro de prueba');
  assert.equal(rev.annulledCount, 1);
  assert.equal(createdCom[0].status, 'ANULADA');
});

test('Flujo completo de liquidaciones y pagos al personal (aprobación, sobrepago, pagos parciales y anulación lógica)', () => {
  const data = makeSeedData();
  const orgId = data.organization.id;
  const branchId = data.branches[0].id;

  const emp = createEmployeeRecord(data, {
    organizationId: orgId,
    branchId,
    firstName: 'Roberto',
    lastName: 'Benítez',
    documentNumber: '7.987.654',
    area: 'COMERCIAL',
    position: 'Asesor',
    remunerationModality: 'MIXTO',
    isAdvisor: true,
  });

  upsertEmployeeSalaryRecord(data, {
    employeeId: emp.id,
    baseSalary: 3000000,
    paymentFrequency: 'MENSUAL',
    effectiveDate: '2026-10-01',
  });

  const manualComm = createManualCommissionAdjustment(data, {
    employeeId: emp.id,
    concept: 'Bono cierre trimestral',
    commissionAmount: 500000,
    periodYear: 2026,
    periodMonth: 10,
  });

  // Crear liquidación en BORRADOR: base 3.000.000 + comisión 500.000 + bono 200.000 - anticipo 400.000 - descuento 100.000 = 3.200.000 PYG
  const { settlement, items } = createPayrollSettlementRecord(data, {
    employeeId: emp.id,
    periodYear: 2026,
    periodMonth: 10,
    commissionIds: [manualComm.id],
    bonuses: [{ concept: 'Bono puntualidad', amount: 200000 }],
    advances: [{ concept: 'Anticipo quincena', amount: 400000 }],
    deductions: [{ concept: 'IPS aporte', amount: 100000 }],
  });

  assert.equal(settlement.status, 'BORRADOR');
  assert.equal(settlement.grossTotal, 3700000);
  assert.equal(settlement.netPayable, 3200000);
  assert.equal(settlement.balanceDue, 3200000);
  assert.equal(items.length, 5);
  assert.equal(manualComm.status, 'EN_LIQUIDACION');

  // No se puede pagar en BORRADOR
  assert.throws(
    () =>
      recordStaffPaymentRecord(data, {
        settlementId: settlement.id,
        amount: 1000000,
        paymentMethod: 'EFECTIVO',
      }),
    /Requiere estado APROBADA/i
  );

  submitSettlementForApprovalRecord(data, settlement.id);
  assert.equal(settlement.status, 'PENDIENTE_APROBACION');

  approvePayrollSettlementRecord(data, settlement.id);
  assert.equal(settlement.status, 'APROBADA');
  assert.equal(manualComm.status, 'APROBADA');

  // Pago parcial 1: 2.000.000 PYG
  const pay1 = recordStaffPaymentRecord(data, {
    settlementId: settlement.id,
    amount: 2000000,
    paymentMethod: 'TRANSFERENCIA_SIPAP',
  });
  assert.equal(settlement.paidAmount, 2000000);
  assert.equal(settlement.balanceDue, 1200000);
  assert.equal(settlement.status, 'APROBADA');

  // Bloqueo de sobrepago sin autorización o sin permiso
  assert.throws(
    () =>
      recordStaffPaymentRecord(data, {
        settlementId: settlement.id,
        amount: 1500000,
        paymentMethod: 'EFECTIVO',
        overpaymentOverride: true,
        canOverrideBalance: false,
        overpaymentOverrideReason: 'Justificación de prueba larga',
      }),
    /excede el saldo pendiente/i
  );

  // Pago final exacto: 1.200.000 PYG -> liquidación y comisión pasan a PAGADA
  const pay2 = recordStaffPaymentRecord(data, {
    settlementId: settlement.id,
    amount: 1200000,
    paymentMethod: 'EFECTIVO',
  });
  assert.equal(settlement.paidAmount, 3200000);
  assert.equal(settlement.balanceDue, 0);
  assert.equal(settlement.status, 'PAGADA');
  assert.equal(manualComm.status, 'PAGADA');

  // No se puede anular liquidación con pagos vigentes
  assert.throws(
    () => annulPayrollSettlementRecord(data, settlement.id, 'Motivo de prueba válido'),
    /posee pagos vigentes/i
  );

  // Anular pago 2 -> restaura saldo y revierte liquidación/comisión a APROBADA
  annulStaffPaymentRecord(data, pay2.payment.id, 'Comprobante bancario duplicado');
  assert.equal(pay2.payment.status, 'ANULADO');
  assert.equal(settlement.paidAmount, 2000000);
  assert.equal(settlement.balanceDue, 1200000);
  assert.equal(settlement.status, 'APROBADA');
  assert.equal(manualComm.status, 'APROBADA');

  // Anular pago 1 y luego anular liquidación -> libera comisión a PENDIENTE
  annulStaffPaymentRecord(data, pay1.payment.id, 'Reversión de lote completo');
  annulPayrollSettlementRecord(data, settlement.id, 'Recálculo completo de período');
  assert.equal(settlement.status, 'ANULADA');
  assert.equal(manualComm.status, 'PENDIENTE');
  assert.equal(manualComm.settlementId, null);
});
