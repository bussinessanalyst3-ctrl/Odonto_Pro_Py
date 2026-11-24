import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { formatPYG, validatePygPrice } from '../src/db/seeds/paraguay-catalogs.ts';
import { dbStore } from '../src/db/inMemoryStore.ts';

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

test('Etapa 1 — Validación y formato estricto de precios en Guaraníes (PYG)', () => {
  assert.equal(validatePygPrice(127500), 127500);
  assert.equal(validatePygPrice(1), 1);
  assert.equal(validatePygPrice(325000), 325000);

  assert.throws(() => validatePygPrice(0), /mayor a ₲ 0/);
  assert.throws(() => validatePygPrice(-50000), /mayor a ₲ 0/);
  assert.throws(() => validatePygPrice(150000.5), /no admite decimales/);
  assert.throws(() => validatePygPrice(Number.NaN), /número válido/);

  assert.match(formatPYG(250000), /^₲\s?250[.,]000$/);
  assert.match(formatPYG(127500), /^₲\s?127[.,]500$/);
  assert.match(formatPYG(null), /^₲\s?0$/);
  assert.match(formatPYG(undefined), /^₲\s?0$/);
  assert.match(formatPYG(Number.NaN), /^₲\s?0$/);
});

function resetStoreAsSuperAdmin() {
  const snap = dbStore.getSnapshot();
  const sa = snap.users.find((u) => u.roleId === 'SUPER_ADMIN') || snap.users[0];
  dbStore.resetToSeed({
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
  });
}

test('Etapa 1 — Editar precio del catálogo NO altera tratamientos, presupuestos ni cobros históricos', () => {
  resetStoreAsSuperAdmin();
  const snapBefore = dbStore.getSnapshot();
  const branch = snapBefore.branches[0];
  const actorUserId = snapBefore.users[0]?.id;

  // Crear paciente particular para la prueba
  const patient = dbStore.addPatient({
    firstName: 'María',
    lastName: 'Histórica',
    documentType: 'CI',
    documentNumber: '4512987',
    phone: '+595981111222',
    primaryBranchId: branch.id,
    modality: 'PARTICULAR',
    actorUserId,
  });

  // Crear servicio específico con precio inicial ₲ 200.000
  const service = dbStore.addService({
    category: 'Operatoria Dental',
    code: 'TEST-HIST-01',
    name: 'Restauración Estética Test Histórico',
    description: 'Prueba de congelamiento de precios históricos',
    defaultDurationMin: 45,
    basePrice: 200000,
    actorUserId,
  });

  // Simular registro branchServices alineado con el precio base inicial (como ocurre en seed/BD)
  dbStore.setBranchServicePrice(branch.id, service.id, 200000, true, actorUserId);

  // 1) Registrar tratamiento histórico con fecha pasada (año anterior)
  const resolvedBefore = dbStore.resolveServicePrice({
    serviceId: service.id,
    patientId: patient.id,
    branchId: branch.id,
  });
  assert.equal(resolvedBefore.finalPrice, 200000);

  const historicalTreatment = dbStore.addTreatment({
    patientId: patient.id,
    branchId: branch.id,
    serviceId: service.id,
    title: service.name,
    totalAmount: resolvedBefore.finalPrice,
    paidAmount: 0,
    odontologistId: actorUserId,
    status: 'EN_PROGRESO',
    startDate: '2024-06-15',
    appliedModality: 'PARTICULAR',
    originalListPrice: resolvedBefore.listPrice,
    actorUserId,
  });

  // 2) Registrar cobro parcial sobre el tratamiento histórico
  const payment = dbStore.recordTreatmentPayment(
    historicalTreatment.id,
    80000,
    'EFECTIVO',
    'REC-HIST-001',
    actorUserId
  );
  assert.ok(payment);

  // 3) Registrar presupuesto histórico con ese servicio a ₲ 200.000
  const historicalQuote = dbStore.createQuote({
    branchId: branch.id,
    patientId: patient.id,
    odontologistId: actorUserId,
    validUntil: '2024-07-15',
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
  });

  const prevServicesRef = dbStore.getSnapshot().services;
  let notifiedCount = 0;
  const unsub = dbStore.subscribe(() => {
    notifiedCount += 1;
  });

  // 4) Actualizar precio en el Catálogo de Servicios a ₲ 312.500 (monto NO múltiplo de 5.000)
  const updated = dbStore.updateService(
    service.id,
    { basePrice: 312500 },
    actorUserId,
    { syncBranchPrices: 'matching_only' }
  );
  unsub();

  assert.ok(updated);
  assert.equal(updated.basePrice, 312500);
  assert.ok(notifiedCount >= 1, 'Debe notificar suscriptores para refrescar la UI de inmediato');
  assert.notEqual(
    dbStore.getSnapshot().services,
    prevServicesRef,
    'Debe reemplazar el arreglo services de forma inmutable para React/useMemo'
  );

  // 5) Verificar auditoría del cambio de precio
  const priceAudit = dbStore
    .getSnapshot()
    .auditLogs.find((a) => a.entity === 'SERVICE' && a.entityId === service.id && a.action === 'UPDATE_PRICE');
  assert.ok(priceAudit, 'Debe registrar auditoría UPDATE_PRICE');
  assert.equal(priceAudit.oldValues?.basePrice, 200000);
  assert.equal(priceAudit.newValues?.basePrice, 312500);
  assert.equal(priceAudit.userId, actorUserId);

  // 6) Verificar que los registros HISTÓRICOS permanecen 100% INTACTOS
  const snapAfter = dbStore.getSnapshot();
  const savedTreatment = snapAfter.treatments.find((t) => t.id === historicalTreatment.id);
  assert.ok(savedTreatment);
  assert.equal(savedTreatment.totalAmount, 200000);
  assert.equal(savedTreatment.originalListPrice, 200000);
  assert.equal(savedTreatment.finalAppliedPrice, 200000);
  assert.equal(savedTreatment.paidAmount, 80000);
  assert.equal(savedTreatment.balanceDue, 120000);
  assert.equal(savedTreatment.startDate, '2024-06-15');

  const savedPayment = snapAfter.payments.find(
    (p) => p.treatmentId === historicalTreatment.id && p.receiptNumber === 'REC-HIST-001'
  );
  assert.ok(savedPayment);
  assert.equal(savedPayment.amount, 80000);

  const savedQuote = snapAfter.quotes.find((q) => q.id === historicalQuote.id);
  assert.ok(savedQuote);
  assert.equal(savedQuote.totalAmount, 200000);
  assert.equal(savedQuote.finalAmount, 200000);

  const savedQuoteItems = snapAfter.quoteItems.filter((qi) => qi.quoteId === historicalQuote.id);
  assert.equal(savedQuoteItems.length, 1);
  assert.equal(savedQuoteItems[0].unitPrice, 200000);
  assert.equal(savedQuoteItems[0].subtotal, 200000);

  // 7) Verificar que los registros NUEVOS sí toman automáticamente ₲ 312.500
  const resolvedAfter = dbStore.resolveServicePrice({
    serviceId: service.id,
    patientId: patient.id,
    branchId: branch.id,
  });
  assert.equal(resolvedAfter.listPrice, 312500);
  assert.equal(resolvedAfter.finalPrice, 312500);

  const newTreatment = dbStore.addTreatment({
    patientId: patient.id,
    branchId: branch.id,
    serviceId: service.id,
    title: service.name,
    totalAmount: resolvedAfter.finalPrice,
    paidAmount: 0,
    odontologistId: actorUserId,
    status: 'PLANIFICADO',
    startDate: '2026-04-01',
    appliedModality: 'PARTICULAR',
    originalListPrice: resolvedAfter.listPrice,
    actorUserId,
  });
  assert.equal(newTreatment.totalAmount, 312500);

  // Confirmar nuevamente que el histórico no se alteró tras crear uno nuevo
  const recheckHistorical = dbStore.getSnapshot().treatments.find((t) => t.id === historicalTreatment.id);
  assert.equal(recheckHistorical?.totalAmount, 200000);
});

test('Etapa 1 — Precios diferenciados por sucursal: matching_only respeta tarifa diferenciada y all la actualiza', () => {
  resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const actorUserId = snap.users[0]?.id;
  const branchA = snap.branches[0];
  const branchB = snap.branches[1] || snap.branches[0];

  const service = dbStore.addService({
    category: 'Endodoncia',
    code: 'TEST-BR-01',
    name: 'Endodoncia Test Multi-Sucursal',
    defaultDurationMin: 60,
    basePrice: 500000,
    actorUserId,
  });

  dbStore.setBranchServicePrice(branchA.id, service.id, 500000, true, actorUserId);
  if (branchB.id !== branchA.id) {
    dbStore.setBranchServicePrice(branchB.id, service.id, 620000, true, actorUserId);
  }

  // Con matching_only: sucursal A (que tenía 500.000) sube a 550.000; sucursal B (tarifa diferenciada 620.000) se conserva
  dbStore.updateService(service.id, { basePrice: 550000 }, actorUserId, {
    syncBranchPrices: 'matching_only',
  });

  const bsA = dbStore
    .getSnapshot()
    .branchServices.find((bs) => bs.branchId === branchA.id && bs.serviceId === service.id);
  assert.equal(bsA?.customPrice, 550000);

  if (branchB.id !== branchA.id) {
    const bsB = dbStore
      .getSnapshot()
      .branchServices.find((bs) => bs.branchId === branchB.id && bs.serviceId === service.id);
    assert.equal(bsB?.customPrice, 620000);

    // Con syncBranchPrices: 'all': ambas sucursales pasan a 575.000
    dbStore.updateService(service.id, { basePrice: 575000 }, actorUserId, {
      syncBranchPrices: 'all',
    });
    const bsBAfterAll = dbStore
      .getSnapshot()
      .branchServices.find((bs) => bs.branchId === branchB.id && bs.serviceId === service.id);
    assert.equal(bsBAfterAll?.customPrice, 575000);
  }

  // setBranchServicePrice rechaza montos inválidos
  assert.throws(
    () => dbStore.setBranchServicePrice(branchA.id, service.id, 0, true, actorUserId),
    /mayor a ₲ 0/
  );
  assert.throws(
    () => dbStore.setBranchServicePrice(branchA.id, service.id, 12345.5, true, actorUserId),
    /no admite decimales/
  );
});

test('Etapa 1 E2E — Persistencia y validación de precios de servicios en POST /api/db/delta', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-stage1-cat-'));
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
    const hash = createPbkdf2Hash('Stage1Test#2026');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.username || superAdmin.email,
        password: 'Stage1Test#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.sidCookie);

    const targetService = state.data.services[0];
    const targetBranch = state.data.branches[0];

    // 1) Actualización válida con monto entero no múltiplo de 5.000
    const validDelta = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginRes.sidCookie,
      body: JSON.stringify({
        upserts: {
          services: [
            {
              ...targetService,
              basePrice: 287500,
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        deletes: {},
      }),
    });
    assert.equal(validDelta.status, 200);

    // Verificar persistencia al consultar GET /api/db/state
    const stateRes = await apiRequest(baseUrl, '/api/db/state', {
      method: 'GET',
      cookie: loginRes.sidCookie,
    });
    assert.equal(stateRes.status, 200);
    const persistedService = stateRes.json.data.services.find((s: any) => s.id === targetService.id);
    assert.equal(persistedService.basePrice, 287500);

    // 2) Rechazar precio 0, negativo y decimal en services
    for (const badPrice of [0, -10000, 150000.75]) {
      const badRes = await apiRequest(baseUrl, '/api/db/delta', {
        method: 'POST',
        cookie: loginRes.sidCookie,
        body: JSON.stringify({
          upserts: {
            services: [
              {
                ...targetService,
                basePrice: badPrice,
              },
            ],
          },
          deletes: {},
        }),
      });
      assert.equal(badRes.status, 400, `Debe rechazar basePrice=${badPrice}`);
    }

    // 3) Rechazar precio inválido en branchServices
    const badBranchPriceRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginRes.sidCookie,
      body: JSON.stringify({
        upserts: {
          branchServices: [
            {
              branchId: targetBranch.id,
              serviceId: targetService.id,
              customPrice: 99999.5,
              isAvailable: true,
            },
          ],
        },
        deletes: {},
      }),
    });
    assert.equal(badBranchPriceRes.status, 400);

    // Verificar que el precio válido previo (287500) no fue corrompido
    const stateAfterBad = await apiRequest(baseUrl, '/api/db/state', {
      method: 'GET',
      cookie: loginRes.sidCookie,
    });
    const stillValid = stateAfterBad.json.data.services.find((s: any) => s.id === targetService.id);
    assert.equal(stillValid.basePrice, 287500);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
