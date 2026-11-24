import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { dbStore } from '../src/db/inMemoryStore.ts';
import { getTodayAsuncionISO } from '../src/config/appBrand.ts';

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

test('Etapa 2 — Presupuestos: modalidad Particular explícita, bloqueo de edición tras aprobar y validación de descuentos', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const branch = snap.branches[0];
  const actorUserId = snap.users[0]?.id;
  const service = snap.services[0];

  // Crear un plan de seguro y asignarlo al paciente
  const plan = dbStore.createInsurancePlan({
    code: 'TEST-SEG-01',
    name: 'Seguro Dental Test',
    coverageTerms: 'Cobertura de prueba',
    actorUserId,
  });

  const insuredPatient = dbStore.addPatient({
    firstName: 'Carlos',
    lastName: 'Asegurado',
    documentType: 'CI',
    documentNumber: '5123456',
    phone: '+595981222333',
    primaryBranchId: branch.id,
    modality: 'PLAN_SEGURO',
    insurancePlanId: plan.id,
    insuranceMemberNumber: 'SEG-999',
    actorUserId,
  });

  // 1) Descuento mayor al subtotal bruto debe ser rechazado
  assert.throws(
    () =>
      dbStore.createQuote({
        branchId: branch.id,
        patientId: insuredPatient.id,
        odontologistId: actorUserId,
        planId: null,
        discountAmount: 500000,
        items: [
          {
            serviceId: service.id,
            description: service.name,
            quantity: 1,
            unitPrice: 200000,
            subtotal: 200000,
            appliedModality: 'PARTICULAR',
            originalListPrice: 200000,
          },
        ],
        actorUserId,
      }),
    /descuento/i
  );

  // 2) Crear presupuesto explícitamente PARTICULAR (planId: null) para paciente CON seguro
  const prevQuotesRef = dbStore.getSnapshot().quotes;
  const particularQuote = dbStore.createQuote({
    branchId: branch.id,
    patientId: insuredPatient.id,
    odontologistId: actorUserId,
    planId: null,
    discountAmount: 15000,
    items: [
      {
        serviceId: service.id,
        description: service.name,
        quantity: 1,
        unitPrice: 250000,
        subtotal: 250000,
        appliedModality: 'PARTICULAR',
        originalListPrice: 250000,
      },
    ],
    actorUserId,
  });

  assert.notEqual(dbStore.getSnapshot().quotes, prevQuotesRef, 'quotes debe reemplazarse inmutablemente');
  assert.equal(particularQuote.planId, null);
  assert.equal(particularQuote.planName ?? null, null);
  assert.equal(particularQuote.finalAmount, 235000);

  // 3) Editar catálogo luego de emitir presupuesto NO altera el presupuesto existente
  dbStore.updateService(service.id, { basePrice: 410000 }, actorUserId, { syncBranchPrices: 'matching_only' });
  const quoteAfterCatalogEdit = dbStore.getQuotes().find((q) => q.id === particularQuote.id)!;
  assert.equal(quoteAfterCatalogEdit.finalAmount, 235000);

  // 4) Aprobar presupuesto Particular genera tratamiento PARTICULAR (no crea reclamo de seguro)
  const claimsBefore = dbStore.getSnapshot().insuranceClaims.length;
  const approval = dbStore.updateQuoteStatus(particularQuote.id, 'APROBADO', actorUserId, true);
  assert.ok(approval?.treatment);
  assert.equal(approval.treatment.appliedModality, 'PARTICULAR');
  assert.equal(approval.treatment.appliedPlanId, null);
  assert.equal(approval.treatment.totalAmount, 235000);
  assert.equal(approval.treatment.startDate, getTodayAsuncionISO());
  assert.equal(dbStore.getSnapshot().insuranceClaims.length, claimsBefore);

  // 5) No se puede editar un presupuesto ya APROBADO
  assert.throws(
    () =>
      dbStore.updateQuote(particularQuote.id, {
        notes: 'Intento de alterar presupuesto aprobado',
        actorUserId,
      }),
    /APROBADO/i
  );
});

test('Etapa 2 — Caja y Cobros Históricos en Store: sin paciente fantasma y sin alterar caja de hoy', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const branch = snap.branches[0];
  const actorUserId = snap.users[0]?.id;
  const service = snap.services[0];

  const pat1 = dbStore.addPatient({
    firstName: 'Ana',
    lastName: 'Primera',
    documentType: 'CI',
    documentNumber: '3111111',
    phone: '+595981000111',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    actorUserId,
  });

  // Abrir caja con monto entero válido (rechaza decimal/negativo)
  assert.throws(
    () =>
      dbStore.openCashRegister({
        branchId: branch.id,
        openingAmount: -1000,
        actorUserId,
      }),
    /mayor o igual a ₲ 0/i
  );
  assert.throws(
    () =>
      dbStore.openCashRegister({
        branchId: branch.id,
        openingAmount: 100000.5,
        actorUserId,
      }),
    /decimales/i
  );

  const register = dbStore.openCashRegister({
    branchId: branch.id,
    openingAmount: 300000,
    actorUserId,
  });

  // 1) Ingreso de caja SIN paciente vinculado NO debe crear recibo asignado a patients[0]
  const paymentsBefore = dbStore.getPayments().length;
  const movNoPatient = dbStore.addCashMovement({
    cashRegisterId: register.id,
    movementType: 'INGRESO',
    amount: 75000,
    paymentMethod: 'EFECTIVO',
    concept: 'Reposición de cambio menor',
    actorUserId,
  });
  assert.ok(movNoPatient.id);
  assert.equal(
    dbStore.getPayments().length,
    paymentsBefore,
    'Un ingreso sin paciente no debe generar un recibo fantasma asignado al primer paciente'
  );

  // 2) Tratamiento histórico con cobro de fecha pasada (2024-05-10) mientras caja de hoy está abierta
  const treatment = dbStore.addTreatment({
    patientId: pat1.id,
    branchId: branch.id,
    serviceId: service.id,
    title: 'Tratamiento Histórico 2024',
    totalAmount: 400000,
    paidAmount: 0,
    odontologistId: actorUserId,
    status: 'EN_PROGRESO',
    startDate: '2024-05-01',
    appliedModality: 'PARTICULAR',
    originalListPrice: 400000,
    actorUserId,
  });

  const movementsBeforeHistorical = dbStore.getCashMovements(register.id).length;
  dbStore.recordTreatmentPayment(
    treatment.id,
    150000,
    'EFECTIVO',
    'REC-2024-001',
    actorUserId,
    '2024-05-10'
  );
  const histPayment = dbStore.getPayments().find((p) => p.receiptNumber === 'REC-2024-001');
  assert.ok(histPayment);
  assert.ok(new Date(histPayment.createdAt).toISOString().startsWith('2024-05-10'));
  assert.equal(histPayment.cashMovementId ?? null, null);
  assert.equal(
    dbStore.getCashMovements(register.id).length,
    movementsBeforeHistorical,
    'Un cobro con fecha pasada NO debe alterar la caja abierta de hoy'
  );

  const treatmentAfterHistPay = dbStore.getTreatments().find((t) => t.id === treatment.id)!;
  assert.equal(treatmentAfterHistPay.paidAmount, 150000);
  assert.equal(treatmentAfterHistPay.balanceDue, 250000);

  // 3) Anular el cobro histórico restaura saldo del tratamiento pero NO descuenta efectivo de la caja de hoy
  const annulHistRes = dbStore.annulPayment({
    paymentId: histPayment.id,
    reason: 'Corrección de carga histórica duplicada',
    actorUserId,
  });
  assert.equal(annulHistRes.payment.status, 'ANULADO');
  assert.equal(annulHistRes.counterMovement ?? null, null);
  assert.equal(
    dbStore.getCashMovements(register.id).length,
    movementsBeforeHistorical,
    'Anular un cobro histórico no debe crear un EGRESO falso en la caja de hoy'
  );
  const treatmentAfterAnnul = dbStore.getTreatments().find((t) => t.id === treatment.id)!;
  assert.equal(treatmentAfterAnnul.paidAmount, 0);
  assert.equal(treatmentAfterAnnul.balanceDue, 400000);

  // 4) Cobro de HOY sí ingresa a caja abierta y su anulación sí genera contra-asiento EGRESO en la caja abierta
  dbStore.recordTreatmentPayment(
    treatment.id,
    120000,
    'EFECTIVO',
    'REC-HOY-001',
    actorUserId,
    getTodayAsuncionISO()
  );
  const todayPayment = dbStore.getPayments().find((p) => p.receiptNumber === 'REC-HOY-001');
  assert.ok(todayPayment?.cashMovementId);
  assert.equal(dbStore.getCashMovements(register.id).length, movementsBeforeHistorical + 1);

  const annulTodayRes = dbStore.annulPayment({
    paymentId: todayPayment!.id,
    reason: 'Error de digitación en cobro del día',
    actorUserId,
  });
  assert.ok(annulTodayRes.counterMovement, 'Anular cobro del turno abierto sí debe generar contra-asiento');
  assert.equal(annulTodayRes.counterMovement.cashRegisterId, register.id);
  assert.equal(annulTodayRes.counterMovement.movementType, 'EGRESO');
  assert.equal(annulTodayRes.counterMovement.amount, 120000);
});

test('Etapa 2 E2E — API autoritativa de Presupuestos, Caja, Cobros Históricos y Anulaciones', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-stage2-qc-'));
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
    const hash = createPbkdf2Hash('Stage2Test#2026');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.username || superAdmin.email,
        password: 'Stage2Test#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.sidCookie;

    const branch = state.data.branches[0];
    const service = state.data.services[0];

    // Preparar plan y paciente asegurado en el estado del servidor
    const planId = 'plan-stage2-e2e';
    state.data.insurancePlans.push({
      id: planId,
      organizationId: state.data.organization.id,
      code: 'PLAN-S2',
      name: 'Plan Corporativo Stage2',
      type: 'SEGURO_PRIVADO',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    const insuredPatientId = 'pat-stage2-e2e';
    state.data.patients.push({
      id: insuredPatientId,
      organizationId: state.data.organization.id,
      primaryBranchId: branch.id,
      firstName: 'Lucía',
      lastName: 'Martínez',
      documentType: 'CI',
      documentNumber: '6234567',
      phone: '+595981555666',
      modality: 'PLAN_SEGURO',
      insurancePlanId: planId,
      insuranceMemberNumber: 'CARNET-2026',
      status: 'ACTIVO',
      createdAt: new Date().toISOString(),
    });

    // 1) Aprobar presupuesto PLAN_SEGURO calcula coveredAmount exacto desde originalListPrice
    const quoteInsuredId = 'quote-stage2-insured';
    state.data.quotes.push({
      id: quoteInsuredId,
      organizationId: state.data.organization.id,
      branchId: branch.id,
      patientId: insuredPatientId,
      odontologistId: superAdmin.id,
      planId,
      planName: 'Plan Corporativo Stage2',
      quoteNumber: 'PRES-S2-001',
      status: 'PENDIENTE',
      totalAmount: 300000,
      discountAmount: 0,
      finalAmount: 300000,
      createdAt: new Date().toISOString(),
    });
    state.data.quoteItems.push({
      id: 'qi-stage2-insured-1',
      quoteId: quoteInsuredId,
      serviceId: service.id,
      description: 'Endodoncia con Seguro',
      quantity: 1,
      unitPrice: 300000,
      subtotal: 300000,
      appliedModality: 'PLAN_SEGURO',
      appliedPlanId: planId,
      appliedPlanName: 'Plan Corporativo Stage2',
      originalListPrice: 500000,
    });

    const approveInsuredRes = await apiRequest(baseUrl, `/api/quotes/${quoteInsuredId}/approve`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ autoCreateTreatment: true }),
    });
    assert.equal(approveInsuredRes.status, 200);
    assert.equal(approveInsuredRes.json.treatment.appliedModality, 'PLAN_SEGURO');
    assert.equal(approveInsuredRes.json.treatment.originalListPrice, 500000);
    assert.equal(approveInsuredRes.json.treatment.totalAmount, 300000);
    assert.ok(approveInsuredRes.json.insuranceClaim);
    assert.equal(approveInsuredRes.json.insuranceClaim.coveredAmount, 200000);
    assert.equal(approveInsuredRes.json.insuranceClaim.copayAmount, 300000);

    // 2) Aprobar presupuesto PARTICULAR explícito (planId: null) para paciente asegurado NO crea seguro
    const quotePartId = 'quote-stage2-particular';
    state.data.quotes.push({
      id: quotePartId,
      organizationId: state.data.organization.id,
      branchId: branch.id,
      patientId: insuredPatientId,
      odontologistId: superAdmin.id,
      planId: null,
      quoteNumber: 'PRES-S2-002',
      status: 'PENDIENTE',
      totalAmount: 250000,
      discountAmount: 0,
      finalAmount: 250000,
      createdAt: new Date().toISOString(),
    });
    state.data.quoteItems.push({
      id: 'qi-stage2-part-1',
      quoteId: quotePartId,
      serviceId: service.id,
      description: 'Blanqueamiento Particular',
      quantity: 1,
      unitPrice: 250000,
      subtotal: 250000,
      appliedModality: 'PARTICULAR',
      originalListPrice: 250000,
    });

    const approvePartRes = await apiRequest(baseUrl, `/api/quotes/${quotePartId}/approve`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ autoCreateTreatment: true }),
    });
    assert.equal(approvePartRes.status, 200);
    assert.equal(approvePartRes.json.treatment.appliedModality, 'PARTICULAR');
    assert.equal(approvePartRes.json.treatment.appliedPlanId, null);
    assert.equal(approvePartRes.json.insuranceClaim, null);

    const treatmentId = approvePartRes.json.treatment.id;

    // 3) Apertura de caja: limpiar turnos abiertos del seed en esta sucursal aislada, rechazar decimales y aceptar entero PYG
    state.data.cashRegisters = state.data.cashRegisters.map((cr: any) =>
      cr.branchId === branch.id && cr.status === 'ABIERTA' ? { ...cr, status: 'CERRADA' } : cr
    );

    const badOpen = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ branchId: branch.id, openingAmount: 250000.5 }),
    });
    assert.equal(badOpen.status, 400);

    const openRes = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ branchId: branch.id, openingAmount: 500000 }),
    });
    assert.equal(openRes.status, 201);
    const registerId = openRes.json.cashRegister.id;

    // 4) Ingreso de caja SIN patientId no emite recibo a paciente fantasma
    const movNoPat = await apiRequest(baseUrl, `/api/cash-registers/${registerId}/movements`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        movementType: 'INGRESO',
        amount: 50000,
        paymentMethod: 'EFECTIVO',
        concept: 'Ingreso varios sin paciente',
      }),
    });
    assert.equal(movNoPat.status, 201);
    assert.equal(movNoPat.json.payment, null);

    // 5) Ingreso de caja CON patientId sí emite recibo al paciente indicado
    const movWithPat = await apiRequest(baseUrl, `/api/cash-registers/${registerId}/movements`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        movementType: 'INGRESO',
        amount: 80000,
        paymentMethod: 'TRANSFERENCIA_SIPAP',
        concept: 'Consulta rápida',
        patientId: insuredPatientId,
      }),
    });
    assert.equal(movWithPat.status, 201);
    assert.ok(movWithPat.json.payment);
    assert.equal(movWithPat.json.payment.patientId, insuredPatientId);

    // 6) Cobro HISTÓRICO de tratamiento (2024-05-10) actualiza saldo sin alterar caja abierta de hoy
    const histPayRes = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        amount: 100000,
        paymentMethod: 'EFECTIVO',
        receiptNumber: 'REC-E2E-HIST-01',
        paymentDate: '2024-05-10',
      }),
    });
    assert.equal(histPayRes.status, 201);
    assert.equal(histPayRes.json.cashMovement, null, 'Cobro histórico no debe entrar a la caja abierta de hoy');
    assert.ok(histPayRes.json.payment.createdAt.startsWith('2024-05-10'));
    assert.equal(histPayRes.json.treatment.paidAmount, 100000);
    assert.equal(histPayRes.json.treatment.balanceDue, 150000);

    // 7) Anular cobro histórico restaura saldo sin insertar EGRESO en la caja abierta de hoy
    const annulHist = await apiRequest(baseUrl, `/api/payments/${histPayRes.json.payment.id}/annul`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ reason: 'Error al transcribir recibo del 2024' }),
    });
    assert.equal(annulHist.status, 200);
    assert.equal(annulHist.json.counterMovement, null);
    assert.equal(annulHist.json.restoredTreatment.paidAmount, 0);
    assert.equal(annulHist.json.restoredTreatment.balanceDue, 250000);

    // 8) Cobro de HOY en efectivo sí suma a la caja abierta
    const todayPayRes = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        amount: 120000,
        paymentMethod: 'EFECTIVO',
        receiptNumber: 'REC-E2E-HOY-01',
        paymentDate: getTodayAsuncionISO(),
      }),
    });
    assert.equal(todayPayRes.status, 201);
    assert.ok(todayPayRes.json.cashMovement);
    assert.equal(todayPayRes.json.cashMovement.cashRegisterId, registerId);

    // 9) Cierre de caja: esperado = 500.000 (apertura) + 50.000 (ingreso varios) + 120.000 (cobro hoy) = 670.000
    const closeRes = await apiRequest(baseUrl, `/api/cash-registers/${registerId}/close`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ closingAmountReal: 670000, observations: 'Arqueo exacto Stage 2' }),
    });
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.json.cashRegister.closingAmountExpected, 670000);
    assert.equal(closeRes.json.cashRegister.differenceAmount, 0);

    // 10) Abrir un nuevo turno y anular el recibo del turno YA CERRADO -> no altera caja cerrada ni descuenta del turno nuevo
    const openNextRes = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ branchId: branch.id, openingAmount: 200000 }),
    });
    assert.equal(openNextRes.status, 201);

    const annulFromClosed = await apiRequest(baseUrl, `/api/payments/${todayPayRes.json.payment.id}/annul`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ reason: 'Devolución posterior al cierre de turno' }),
    });
    assert.equal(annulFromClosed.status, 200);
    assert.equal(
      annulFromClosed.json.counterMovement,
      null,
      'Anular un recibo de un turno cerrado no debe distorsionar el arqueo del turno nuevo ni alterar el turno cerrado'
    );
    assert.equal(annulFromClosed.json.restoredTreatment.balanceDue, 250000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
