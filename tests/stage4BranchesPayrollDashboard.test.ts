import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { dbStore } from '../src/db/inMemoryStore.ts';
import {
  collectUniqueRevenueEntries,
  isDateInReportPeriod,
  toAsuncionDateISO,
  getPeriodLabel,
} from '../src/utils/reportPeriod.ts';

async function apiRequest(
  baseUrl: string,
  endpoint: string,
  opts: { method?: string; body?: string; headers?: Record<string, string>; cookie?: string } = {}
) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  if (opts.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json
  }
  const setCookie = res.headers.get('set-cookie');
  const sidMatch = setCookie?.match(/odontopro_sid=([^;]+)/);
  return {
    status: res.status,
    json,
    text,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

function resetStoreAsSuperAdmin() {
  const snap = dbStore.getSnapshot();
  const sa = snap.users.find((u) => u.roleId === 'SUPER_ADMIN') || snap.users[0];
  dbStore.resetToSeed({
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
  });
}

test('Etapa 4 — Sucursales y Sillones: persistencia real, horarios válidos, código único y protección de última sucursal', () => {
  resetStoreAsSuperAdmin();
  const initialSnap = dbStore.getSnapshot();
  const firstBranch = initialSnap.branches[0];
  const sa = initialSnap.users[0];
  const service = initialSnap.services[0];
  const actorCtx = {
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
    allowedBranchIds: initialSnap.branches.map((b: any) => b.id),
  };

  // 1) No debe permitir inactivar la última sucursal activa
  assert.throws(
    () => dbStore.toggleBranchStatus(firstBranch.id, actorCtx),
    /única sucursal operativa/i
  );

  // 2) No debe permitir horario inválido (apertura >= cierre)
  assert.throws(
    () =>
      dbStore.addBranch(
        {
          name: 'Sucursal Inválida',
          code: 'INV-01',
          department: 'Central',
          city: 'Luque',
          address: 'Av. Principal 100',
          phone: '+595981100200',
          openingTime: '18:00',
          closingTime: '08:00',
        },
        actorCtx
      ),
    /cierre.*posterior.*apertura/i
  );

  // 3) Crear sucursal válida: crea Sillón 1 por defecto, guarda email vacío como null e inmuta array branches
  const prevBranchesRef = dbStore.getSnapshot().branches;
  const newBranch = dbStore.addBranch(
    {
      name: 'Sucursal Luque Centro',
      code: 'LUQ-01',
      department: 'Central',
      city: 'Luque',
      address: 'Av. General Aquino 250',
      phone: '+595981222333',
      email: '',
      openingTime: '08:00',
      closingTime: '19:00',
    },
    actorCtx
  );
  assert.notEqual(dbStore.getSnapshot().branches, prevBranchesRef);
  assert.equal(newBranch.email, null);

  const createdChairs = dbStore.getDentalChairs(newBranch.id);
  assert.equal(createdChairs.length, 1, 'addBranch debe crear un sillón inicial activo');
  assert.equal(createdChairs[0].status, 'ACTIVE');

  // 4) Rechazar código duplicado de sucursal
  assert.throws(
    () =>
      dbStore.addBranch(
        {
          name: 'Otra Sucursal',
          code: 'luq-01',
          department: 'Central',
          city: 'Luque',
          address: 'Otra dirección',
          phone: '+595981444555',
        },
        actorCtx
      ),
    /ya existe una sucursal con el código/i
  );

  // 5) Crear paciente y cita histórica en el sillón inicial para validar soft-delete de sillones
  const pat = dbStore.addPatient({
    firstName: 'Sofía',
    lastName: 'Paredes',
    documentType: 'CI',
    documentNumber: '4.111.222',
    phone: '+595981999111',
    primaryBranchId: newBranch.id,
    modality: 'PARTICULAR',
    actorUserId: sa.id,
  });
  dbStore.addAppointment({
    branchId: newBranch.id,
    patientId: pat.id,
    odontologistId: sa.id,
    dentalChairId: createdChairs[0].id,
    serviceId: service.id,
    appointmentDate: '2024-06-15',
    startTime: '09:00',
    endTime: '09:30',
    durationMin: 30,
    reason: 'Control histórico',
    actorUserId: sa.id,
  });

  // Guardar sillones: quitar el sillón con historial y agregar Sillón 2 y Sillón 3
  const savedChairs = dbStore.saveBranchDentalChairs(
    newBranch.id,
    [
      { name: 'Sillón 2 - Cirugía', status: 'ACTIVE' },
      { name: 'Sillón 3 - Mantenimiento', status: 'MAINTENANCE' },
    ],
    actorCtx
  );
  assert.equal(savedChairs.length, 2);

  // El sillón con cita histórica debe conservarse en el store como INACTIVE (no borrarse)
  const rawChairWithHistory = dbStore
    .getSnapshot()
    .dentalChairs.find((c: any) => c.id === createdChairs[0].id);
  assert.ok(rawChairWithHistory, 'Sillón con citas históricas no debe eliminarse físicamente');
  assert.equal(rawChairWithHistory.status, 'INACTIVE');

  // Ahora sí puede inactivarse la segunda sucursal porque sigue quedando la principal activa
  const toggled = dbStore.toggleBranchStatus(newBranch.id, actorCtx);
  assert.equal(toggled.status, 'INACTIVE');
});

test('Etapa 4 — Nómina y Comisiones: fechas históricas en período correcto, commissionIds vacío respetado y CI único al editar', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const branch = snap.branches[0];
  const sa = snap.users[0];

  // Crear 2 colaboradores
  const emp1 = dbStore.createEmployee({
    firstName: 'Lucía',
    lastName: 'Mendoza',
    documentType: 'CI',
    documentNumber: '3.222.111',
    branchId: branch.id,
    area: 'COMERCIAL',
    position: 'Asesora Comercial',
    remunerationModality: 'MIXTO',
    isAdvisor: true,
    initialSalary: 2800000,
  });

  const emp2 = dbStore.createEmployee({
    firstName: 'Carlos',
    lastName: 'Rojas',
    documentType: 'CI',
    documentNumber: '4.333.222',
    branchId: branch.id,
    area: 'CLINICA',
    position: 'Odontólogo',
    remunerationModality: 'COMISION',
    isAdvisor: false,
  });

  // 1) updateEmployee debe rechazar CI duplicada (normalizada)
  assert.throws(
    () =>
      dbStore.updateEmployee(emp2.id, {
        documentNumber: '3222111',
      }),
    /ya existe otro empleado.*documento/i
  );

  // 2) Crear regla de comisión comercial por pago cobrado (10%)
  dbStore.createCommissionRule({
    name: 'Comisión Comercial 10%',
    area: 'COMERCIAL',
    triggerType: 'ON_PAYMENT_COLLECTED',
    calculationMode: 'PERCENTAGE',
    ratePercentage: 10,
    requiresCollectedPayment: true,
  });

  // 3) Crear paciente asignado a emp1, tratamiento y cobro con FECHA HISTÓRICA 2024-05-10
  const pat = dbStore.addPatient({
    firstName: 'Pedro',
    lastName: 'Giménez',
    documentType: 'CI',
    documentNumber: '5.100.200',
    phone: '+595981555666',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    assignedAdvisorId: emp1.id,
    actorUserId: sa.id,
  });

  const service = snap.services[0];
  const quote = dbStore.createQuote({
    branchId: branch.id,
    patientId: pat.id,
    odontologistId: sa.id,
    items: [
      {
        serviceId: service.id,
        description: service.name,
        quantity: 1,
        unitPrice: 500000,
        subtotal: 500000,
      },
    ],
    actorUserId: sa.id,
  });
  dbStore.updateQuoteStatus(quote.id, 'APROBADO', sa.id, true);
  const treatment = dbStore
    .getSnapshot()
    .treatments.find((t: any) => t.quoteId === quote.id);
  assert.ok(treatment, 'Al aprobar presupuesto debe generarse el tratamiento vinculado');

  dbStore.openCashRegister({
    branchId: branch.id,
    actorUserId: sa.id,
    openingAmount: 0,
  });

  dbStore.recordTreatmentPayment(
    treatment.id,
    500000,
    'EFECTIVO',
    'REC-2024-001',
    sa.id,
    '2024-05-10'
  );

  const emp1Comms = dbStore.getGeneratedCommissions({ employeeId: emp1.id });
  assert.equal(emp1Comms.length, 1, 'Debe generarse 1 comisión comercial por el cobro');
  assert.equal(emp1Comms[0].commissionAmount, 50000);
  assert.equal(emp1Comms[0].periodYear, 2024, 'La comisión histórica debe pertenecer al año 2024');
  assert.equal(emp1Comms[0].periodMonth, 5, 'La comisión histórica debe pertenecer al mes 5 (mayo)');

  // 4) Liquidación con commissionIds: [] (explícitamente vacío) NO debe adjuntar comisiones pendientes
  const salaryOnlyResult = dbStore.createPayrollSettlement({
    employeeId: emp1.id,
    periodYear: 2024,
    periodMonth: 5,
    includeBaseSalary: true,
    commissionIds: [],
    submitForApproval: false,
  });
  assert.equal(
    salaryOnlyResult.settlement.commissionsTotal,
    0,
    'No debe adjuntar comisiones si commissionIds es []'
  );
  assert.equal(salaryOnlyResult.settlement.baseSalarySnapshot, 2800000);
  assert.equal(
    dbStore.getGeneratedCommissions({ employeeId: emp1.id })[0].status,
    'PENDIENTE',
    'La comisión deseleccionada debe permanecer PENDIENTE'
  );

  // 5) Aprobar y registrar pago con fecha histórica 2024-05-31 -> comprobante lleva año 2024
  dbStore.submitPayrollSettlement(salaryOnlyResult.settlement.id);
  dbStore.approvePayrollSettlement(salaryOnlyResult.settlement.id);
  const staffPayResult = dbStore.recordStaffPayment({
    settlementId: salaryOnlyResult.settlement.id,
    amount: 2800000,
    paymentMethod: 'TRANSFERENCIA_SIPAP',
    paymentDate: '2024-05-31',
  });
  assert.ok(
    staffPayResult.payment.operationNumber.startsWith('PAG-PER-2024-'),
    `El número de pago debe corresponder al año de paymentDate (recibido: ${staffPayResult.payment.operationNumber})`
  );
});

test('Etapa 4 — Reportes y Dashboard: sin doble contabilización, exclusión de anulados y zona horaria America/Asuncion', () => {
  // 1) Conversión de fecha en Paraguay: 2024-05-11T01:30:00Z = 2024-05-10 21:30 en Asunción (UTC-4)
  assert.equal(toAsuncionDateISO('2024-05-11T01:30:00.000Z'), '2024-05-10');
  assert.equal(toAsuncionDateISO('2024-05-10'), '2024-05-10');

  // 2) Filtros de período
  assert.equal(
    isDateInReportPeriod('2024-05-10', { preset: 'CUSTOM_MONTH', customYear: 2024, customMonth: 5 }, '2026-09-20'),
    true
  );
  assert.equal(
    isDateInReportPeriod('2024-06-01', { preset: 'CUSTOM_MONTH', customYear: 2024, customMonth: 5 }, '2026-09-20'),
    false
  );
  assert.equal(isDateInReportPeriod('2024-05-10', { preset: 'ALL' }, '2026-09-20'), true);
  assert.equal(getPeriodLabel({ preset: 'CUSTOM_MONTH', customYear: 2024, customMonth: 5 }), 'Mayo 2024');

  // 3) collectUniqueRevenueEntries: pago con cashMovementId vinculado NO se cuenta doble;
  //    pago ANULADO se excluye; ingreso manual sin pago vinculado SÍ se incluye.
  const cashRegisters = [{ id: 'cr-1', branchId: 'br-1' }];
  const payments = [
    {
      id: 'pay-1',
      branchId: 'br-1',
      amount: 350000,
      paymentMethod: 'EFECTIVO',
      status: 'COMPLETADO',
      cashMovementId: 'cm-linked-1',
      createdAt: '2024-05-10T16:00:00.000Z',
    },
    {
      id: 'pay-annulled',
      branchId: 'br-1',
      amount: 900000,
      paymentMethod: 'EFECTIVO',
      status: 'ANULADO',
      cashMovementId: 'cm-annulled-1',
      createdAt: '2024-05-10T17:00:00.000Z',
    },
  ];
  const cashMovements = [
    {
      id: 'cm-linked-1',
      cashRegisterId: 'cr-1',
      movementType: 'INGRESO',
      amount: 350000,
      paymentMethod: 'EFECTIVO',
      createdAt: '2024-05-10T16:00:00.000Z',
    },
    {
      id: 'cm-annulled-1',
      cashRegisterId: 'cr-1',
      movementType: 'INGRESO',
      amount: 900000,
      paymentMethod: 'EFECTIVO',
      createdAt: '2024-05-10T17:00:00.000Z',
    },
    {
      id: 'cm-standalone-1',
      cashRegisterId: 'cr-1',
      movementType: 'INGRESO',
      amount: 100000,
      paymentMethod: 'TRANSFERENCIA_SIPAP',
      createdAt: '2024-05-10T18:00:00.000Z',
    },
    {
      id: 'cm-egreso-1',
      cashRegisterId: 'cr-1',
      movementType: 'EGRESO',
      amount: 50000,
      paymentMethod: 'EFECTIVO',
      createdAt: '2024-05-10T18:30:00.000Z',
    },
  ];

  const entries = collectUniqueRevenueEntries({
    payments,
    cashMovements,
    cashRegisters,
    branchId: 'br-1',
    period: { preset: 'CUSTOM_MONTH', customYear: 2024, customMonth: 5 },
    todayIso: '2026-09-20',
  });

  assert.equal(entries.length, 2, 'Solo deben contabilizarse pay-1 y cm-standalone-1');
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  assert.equal(total, 450000, 'Total neto debe ser 350.000 + 100.000 = 450.000 (sin duplicar ni incluir anulado)');
});

test('Etapa 4 E2E — API de cobro histórico genera comisión en período 2024-05 y vincula cashMovement sin duplicar ingresos', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-stage4-e2e-'));
  process.env.DATA_DIR = tmpDir;
  process.env.NODE_ENV = 'production';

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const state = getServerDbState();
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN')!;
    const hash = createPbkdf2Hash('Stage4Test#2026');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    const branch = state.data.branches[0];

    // Preparar empleado asesor + regla comercial en el estado del servidor
    const advisorId = 'emp-stage4-advisor';
    state.data.employees.push({
      id: advisorId,
      organizationId: state.data.organization.id,
      branchId: branch.id,
      userId: null,
      employeeCode: 'EMP-999',
      firstName: 'Andrea',
      lastName: 'Vega',
      documentType: 'CI',
      documentNumber: '4888777',
      area: 'COMERCIAL',
      position: 'Asesora',
      remunerationModality: 'MIXTO',
      isAdvisor: true,
      status: 'ACTIVE',
      hireDate: '2024-01-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.data.commissionRules.push({
      id: 'rule-stage4-com',
      organizationId: state.data.organization.id,
      branchId: null,
      area: 'COMERCIAL',
      name: 'Comercial 10% E2E',
      triggerType: 'ON_PAYMENT_COLLECTED',
      calculationMode: 'PERCENTAGE',
      ratePercentage: 10,
      fixedAmount: null,
      requiresCollectedPayment: true,
      requiresCompletedTreatment: false,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.username || superAdmin.email,
        password: 'Stage4Test#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.sidCookie;

    // Crear paciente con asesor comercial
    const patRes = await apiRequest(baseUrl, '/api/patients', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        firstName: 'Diego',
        lastName: 'Ferreira',
        documentType: 'CI',
        documentNumber: '5.777.888',
        phone: '+595981222444',
        primaryBranchId: branch.id,
        modality: 'PARTICULAR',
        assignedAdvisorId: advisorId,
      }),
    });
    assert.equal(patRes.status, 201);
    const patient = patRes.json.patient;

    // Crear presupuesto de ₲ 550.000 vía /api/db/delta y aprobarlo vía POST /api/quotes/:id/approve
    const service = state.data.services[0];
    const quoteId = 'quote-stage4-e2e-1';
    const quoteItemId = 'qi-stage4-e2e-1';
    const deltaQuoteRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        upserts: {
          quotes: [
            {
              id: quoteId,
              organizationId: state.data.organization.id,
              branchId: branch.id,
              patientId: patient.id,
              odontologistId: superAdmin.id,
              quoteNumber: 'PRES-2023-0001',
              status: 'PENDIENTE',
              totalAmount: 550000,
              discountAmount: 0,
              finalAmount: 550000,
              createdAt: '2023-03-14T15:00:00.000Z',
            },
          ],
          quoteItems: [
            {
              id: quoteItemId,
              quoteId,
              serviceId: service.id,
              description: service.name,
              quantity: 1,
              unitPrice: 550000,
              subtotal: 550000,
            },
          ],
        },
        deletes: {},
      }),
    });
    assert.equal(deltaQuoteRes.status, 200);

    const approveRes = await apiRequest(baseUrl, `/api/quotes/${quoteId}/approve`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({}),
    });
    assert.equal(approveRes.status, 200);
    const treatmentId = approveRes.json.treatment.id;

    // Abrir caja si no hay una abierta en la sucursal
    const hasOpenCash = state.data.cashRegisters.some(
      (cr: any) => cr.branchId === branch.id && cr.status === 'ABIERTA'
    );
    if (!hasOpenCash) {
      const cashOpenRes = await apiRequest(baseUrl, '/api/cash-registers/open', {
        method: 'POST',
        cookie,
        body: JSON.stringify({ branchId: branch.id, openingAmount: 0 }),
      });
      assert.equal(cashOpenRes.status, 201);
    }

    const revBeforeHist = collectUniqueRevenueEntries({
      payments: state.data.payments,
      cashMovements: state.data.cashMovements,
      cashRegisters: state.data.cashRegisters,
      branchId: branch.id,
      period: { preset: 'CUSTOM_MONTH', customYear: 2023, customMonth: 3 },
    }).reduce((s, e) => s + e.amount, 0);

    // 1) Registrar cobro histórico (2023-03-14) de ₲ 400.000
    const payRes = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        amount: 400000,
        paymentMethod: 'EFECTIVO',
        paymentDate: '2023-03-14',
      }),
    });
    assert.equal(payRes.status, 201);

    // Verificar que TODAS las comisiones generadas por el cobro histórico cayeron en Marzo 2023 (NO en hoy)
    const comms = state.data.generatedCommissions.filter((c: any) => c.employeeId === advisorId);
    assert.ok(comms.length >= 1, 'Debe generarse al menos 1 comisión comercial por el cobro');
    for (const c of comms) {
      assert.equal(c.periodYear, 2023, 'La comisión histórica debe quedar en el año 2023');
      assert.equal(c.periodMonth, 3, 'La comisión histórica debe quedar en el mes 3 (marzo)');
    }
    const targetComm = comms.find((c: any) => c.ruleId === 'rule-stage4-com');
    assert.ok(targetComm, 'Debe existir la comisión de la regla rule-stage4-com');
    assert.equal(targetComm.commissionAmount, 40000);

    const revAfterHist = collectUniqueRevenueEntries({
      payments: state.data.payments,
      cashMovements: state.data.cashMovements,
      cashRegisters: state.data.cashRegisters,
      branchId: branch.id,
      period: { preset: 'CUSTOM_MONTH', customYear: 2023, customMonth: 3 },
    }).reduce((s, e) => s + e.amount, 0);
    assert.equal(
      revAfterHist - revBeforeHist,
      400000,
      'El cobro histórico debe sumar exactamente ₲ 400.000 en Marzo 2023'
    );

    // 2) Registrar saldo restante de ₲ 150.000 HOY (crea movimiento en caja abierta vinculado por cashMovementId)
    const revBeforeToday = collectUniqueRevenueEntries({
      payments: state.data.payments,
      cashMovements: state.data.cashMovements,
      cashRegisters: state.data.cashRegisters,
      branchId: branch.id,
      period: { preset: 'TODAY' },
    }).reduce((s, e) => s + e.amount, 0);

    const payTodayRes = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        amount: 150000,
        paymentMethod: 'EFECTIVO',
      }),
    });
    assert.equal(payTodayRes.status, 201);
    assert.ok(payTodayRes.json.payment.cashMovementId, 'El cobro de hoy debe vincular cashMovementId');

    const revAfterToday = collectUniqueRevenueEntries({
      payments: state.data.payments,
      cashMovements: state.data.cashMovements,
      cashRegisters: state.data.cashRegisters,
      branchId: branch.id,
      period: { preset: 'TODAY' },
    }).reduce((s, e) => s + e.amount, 0);

    assert.equal(
      revAfterToday - revBeforeToday,
      150000,
      'El cobro de hoy vinculado a caja debe sumarse UNA sola vez (₲ 150.000, nunca ₲ 300.000)'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
