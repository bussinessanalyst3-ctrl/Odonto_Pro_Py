import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  buildTemplateCsv,
  normalizePaymentMethod,
  normalizeTreatmentStatus,
  parseCsvText,
  parseFlexibleDateISO,
  parseHistoricalPygAmount,
  sanitizeCsvCell,
} from '../src/utils/historicalCsv.ts';

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

test('Bloque 2 — Utilidad CSV histórica: delimitadores, fechas Paraguay, Guaraníes y protección de fórmulas', () => {
  // 1) Delimitador ';' (Excel Paraguay) con UTF-8 BOM y comillas
  const semiCsv = '\uFEFFnombres;apellidos;documento;notas\n"María; José";González;4521890;"Control ""anual"" 2024"';
  const parsedSemi = parseCsvText(semiCsv);
  assert.equal(parsedSemi.delimiter, ';');
  assert.equal(parsedSemi.rows.length, 1);
  assert.equal(parsedSemi.rows[0].nombres, 'María; José');
  assert.equal(parsedSemi.rows[0].notas, 'Control "anual" 2024');

  // 2) Delimitador ',' y '\t' (pegado directo desde Excel)
  const commaCsv = 'nombres,apellidos,documento\nCarlos,Benítez,3890123';
  assert.equal(parseCsvText(commaCsv).delimiter, ',');
  assert.equal(parseCsvText(commaCsv).rows[0].documento, '3890123');

  const tabCsv = 'nombres\tapellidos\tdocumento\nAna\tSilva\t5123456';
  assert.equal(parseCsvText(tabCsv).delimiter, '\t');
  assert.equal(parseCsvText(tabCsv).rows[0].apellidos, 'Silva');

  // 3) Fechas flexibles con validación de calendario real
  assert.equal(parseFlexibleDateISO('18/05/2024'), '2024-05-18');
  assert.equal(parseFlexibleDateISO('04-06-2024'), '2024-06-04');
  assert.equal(parseFlexibleDateISO('2024-02-29'), '2024-02-29'); // año bisiesto válido
  assert.equal(parseFlexibleDateISO('2023-02-29'), null); // no bisiesto inválido
  assert.equal(parseFlexibleDateISO('31/04/2024'), null); // abril tiene 30 días
  assert.equal(parseFlexibleDateISO('fecha-mala'), null);

  // 4) Montos estrictos en Guaraníes (enteros positivos, sin centavos)
  assert.deepEqual(parseHistoricalPygAmount('650000'), { ok: true, value: 650000 });
  assert.deepEqual(parseHistoricalPygAmount('350.000'), { ok: true, value: 350000 });
  assert.deepEqual(parseHistoricalPygAmount('Gs. 1.250.000'), { ok: true, value: 1250000 });
  assert.deepEqual(parseHistoricalPygAmount('₲ 80.000'), { ok: true, value: 80000 });

  assert.equal(parseHistoricalPygAmount('-50000').ok, false);
  assert.equal(parseHistoricalPygAmount('150000.50').ok, false);
  assert.equal(parseHistoricalPygAmount('150000,50').ok, false);
  assert.equal(parseHistoricalPygAmount('abc').ok, false);

  // 5) Neutralización de fórmulas peligrosas en celdas CSV
  assert.equal(sanitizeCsvCell('=CMD|"/C calc"!A0'), '"\'=CMD|""/C calc""!A0"');
  assert.equal(sanitizeCsvCell('+1+2'), '"\'+1+2"');
  assert.equal(sanitizeCsvCell('-500'), '"\'-500"');
  assert.equal(sanitizeCsvCell('@SUM(A1:A5)'), '"\'@SUM(A1:A5)"');
  assert.equal(sanitizeCsvCell('Texto normal'), '"Texto normal"');

  // 6) Normalización de estados y métodos de pago
  assert.equal(normalizePaymentMethod('Transferencia SIPAP'), 'TRANSFERENCIA');
  assert.equal(normalizePaymentMethod('QR Bancard'), 'QR_BANCARD');
  assert.equal(normalizePaymentMethod(''), 'EFECTIVO');
  assert.equal(normalizeTreatmentStatus('Finalizado'), 'COMPLETADO');
  assert.equal(normalizeTreatmentStatus('en curso'), 'EN_PROGRESO');

  // 7) Plantillas descargables son válidas y parseables
  for (const entity of ['patients', 'treatments', 'payments'] as const) {
    const csv = buildTemplateCsv(entity);
    const parsed = parseCsvText(csv);
    assert.ok(parsed.rows.length >= 2, `Plantilla ${entity} debe incluir filas de ejemplo`);
  }
});

test('Bloque 2 E2E — Polling liviano (sinceVersion), auditLimit y Carga Masiva Histórica con dry-run', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-bloque2-'));
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
    const adminHash = createPbkdf2Hash('Bloque2Admin#2026');
    superAdmin.passwordHash = adminHash.hash;
    superAdmin.passwordSalt = adminHash.salt;
    superAdmin.passwordIterations = adminHash.iterations;

    const branch = state.data.branches[0];
    const orgId = state.data.organization.id;

    // Agregar un usuario RECEPCION (sin permiso treatments.manage) para probar RBAC
    const recepHash = createPbkdf2Hash('RecepTest#2026');
    const recepUser = {
      id: 'usr-recep-bloque2',
      organizationId: orgId,
      roleId: 'RECEPCION',
      firstName: 'Lucía',
      lastName: 'Recepción',
      username: 'recep.bloque2',
      email: 'recep.bloque2@odontopro.test',
      passwordHash: recepHash.hash,
      passwordSalt: recepHash.salt,
      passwordIterations: recepHash.iterations,
      phone: '+595981000000',
      status: 'ACTIVE',
      permissionsVersion: 1,
      createdAt: new Date().toISOString(),
    };
    state.data.users.push(recepUser);
    state.data.userBranches.push({ userId: recepUser.id, branchId: branch.id, isPrimary: true });

    // ------------------------------------------------------------------
    // A) Seguridad: sin sesión -> 401; rol sin permiso -> 403
    // ------------------------------------------------------------------
    const unauthRes = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      body: JSON.stringify({ entityType: 'patients', mode: 'dry_run', rows: [{ nombres: 'A' }] }),
    });
    assert.equal(unauthRes.status, 401);

    const recepLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.bloque2', password: 'RecepTest#2026' }),
    });
    assert.equal(recepLogin.status, 200);

    const recepForbidden = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: JSON.stringify({
        entityType: 'treatments',
        mode: 'dry_run',
        branchId: branch.id,
        rows: [{ documento_paciente: '4521890', titulo_tratamiento: 'Test', monto_total_gs: '100000', fecha_tratamiento: '10/05/2024' }],
      }),
    });
    assert.equal(recepForbidden.status, 403);

    // Login como Super Admin
    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.username || superAdmin.email,
        password: 'Bloque2Admin#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.sidCookie;

    // ------------------------------------------------------------------
    // B) Rendimiento: GET /api/db/state con sinceVersion y auditLimit
    // ------------------------------------------------------------------
    // Sembrar 5 logs de auditoría adicionales para probar auditLimit
    for (let i = 0; i < 5; i++) {
      state.data.auditLogs.unshift({
        id: `audit-perf-${i}`,
        organizationId: orgId,
        branchId: branch.id,
        userId: superAdmin.id,
        action: 'TEST_AUDIT',
        entity: 'SYSTEM',
        entityId: `sys-${i}`,
        description: `Evento ${i}`,
        createdAt: new Date().toISOString(),
      });
    }

    const initialStateRes = await apiRequest(baseUrl, '/api/db/state?auditLimit=2', { cookie });
    assert.equal(initialStateRes.status, 200);
    assert.equal(initialStateRes.json.unchanged, undefined);
    assert.equal(initialStateRes.json.data.auditLogs.length, 2, 'auditLimit=2 debe limitar los auditLogs en el payload inicial');
    assert.ok(initialStateRes.json.auditLogsTotal >= 5, 'auditLogsTotal debe informar el conteo real');

    const v1 = initialStateRes.json.stateVersion;
    const pv1 = initialStateRes.json.permissionsVersion;

    // Polling liviano con misma versión -> unchanged: true sin payload pesado
    const unchangedRes = await apiRequest(
      baseUrl,
      `/api/db/state?auditLimit=2&sinceVersion=${v1}&sincePermVersion=${pv1}`,
      { cookie }
    );
    assert.equal(unchangedRes.status, 200);
    assert.equal(unchangedRes.json.unchanged, true);
    assert.equal(unchangedRes.json.data, undefined);
    assert.equal(unchangedRes.json.stateVersion, v1);

    // ------------------------------------------------------------------
    // C) Carga Masiva Histórica: 1) PACIENTES (dry_run -> commit -> reintento)
    // ------------------------------------------------------------------
    const patientsCountBefore = getServerDbState().data.patients.length;
    const patientRows = [
      {
        nombres: 'María José',
        apellidos: 'González López',
        documento: '4521890',
        telefono: '+595981456789',
        fecha_nacimiento: '15/08/1990',
        ciudad: 'Asunción',
        fecha_alta: '12/03/2024',
      },
      {
        nombres: 'Duplicado En Lote',
        apellidos: 'Misma CI',
        documento: '4521890',
        fecha_alta: '14/03/2024',
      },
      {
        nombres: '',
        apellidos: 'Incompleto',
        documento: '',
      },
    ];

    const patDry = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ entityType: 'patients', mode: 'dry_run', branchId: branch.id, rows: patientRows }),
    });
    assert.equal(patDry.status, 200);
    assert.equal(patDry.json.validCount, 1);
    assert.equal(patDry.json.skippedCount, 1);
    assert.equal(patDry.json.errorCount, 1);
    assert.equal(getServerDbState().data.patients.length, patientsCountBefore, 'dry_run NO debe escribir en la BD');

    const patCommit = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ entityType: 'patients', mode: 'commit', branchId: branch.id, rows: patientRows }),
    });
    assert.equal(patCommit.status, 201);
    assert.equal(patCommit.json.committed, true);
    assert.equal(patCommit.json.willCreatePatients, 1);

    const importedPatient = getServerDbState().data.patients.find((p: any) => p.documentNumber === '4521890');
    assert.ok(importedPatient);
    assert.equal(importedPatient.firstName, 'María José');
    assert.ok(String(importedPatient.createdAt).startsWith('2024-03-12'), 'Debe conservar fecha de alta histórica');

    // Al haber habido una mutación, GET /api/db/state con v1 anterior debe devolver datos frescos (NO unchanged)
    const afterCommitState = await apiRequest(
      baseUrl,
      `/api/db/state?auditLimit=5&sinceVersion=${v1}&sincePermVersion=${pv1}`,
      { cookie }
    );
    assert.equal(afterCommitState.status, 200);
    assert.equal(afterCommitState.json.unchanged, undefined);
    assert.ok(afterCommitState.json.stateVersion > v1);

    // Re-importar el mismo paciente con otro nombre NO debe sobrescribirlo (SKIPPED)
    const patRetryDry = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        entityType: 'patients',
        mode: 'dry_run',
        branchId: branch.id,
        rows: [{ nombres: 'OTRO NOMBRE', apellidos: 'SOBRESCRITO', documento: '4521890' }],
      }),
    });
    assert.equal(patRetryDry.status, 200);
    assert.equal(patRetryDry.json.validCount, 0);
    assert.equal(patRetryDry.json.skippedCount, 1);
    assert.equal(
      getServerDbState().data.patients.find((p: any) => p.documentNumber === '4521890')?.firstName,
      'María José'
    );

    // ------------------------------------------------------------------
    // D) Abrir una caja HOY para verificar que la carga histórica NO la altera
    // ------------------------------------------------------------------
    const todayCashRegisterId = 'cr-today-bloque2';
    getServerDbState().data.cashRegisters.push({
      id: todayCashRegisterId,
      organizationId: orgId,
      branchId: branch.id,
      openedBy: superAdmin.id,
      openedAt: new Date().toISOString(),
      openingAmount: 500000,
      expectedClosingAmount: 500000,
      status: 'ABIERTA',
    });
    const movementsBefore = getServerDbState().data.cashMovements.filter(
      (m: any) => m.cashRegisterId === todayCashRegisterId
    ).length;

    // ------------------------------------------------------------------
    // E) Carga Masiva Histórica: 2) TRATAMIENTOS (precio congelado + pago parcial sin tocar caja)
    // ------------------------------------------------------------------
    const catalogService = getServerDbState().data.services[0];
    const treatRows = [
      {
        documento_paciente: '4521890',
        titulo_tratamiento: 'Endodoncia Molar Histórica 2024',
        codigo_servicio: catalogService.code,
        monto_total_gs: '650.000',
        monto_pagado_gs: '250.000',
        estado: 'EN_PROGRESO',
        fecha_tratamiento: '18/05/2024',
        piezas_fdi: '36',
      },
      {
        documento_paciente: '4521890',
        titulo_tratamiento: 'Tratamiento con decimal inválido',
        monto_total_gs: '150000.50',
        fecha_tratamiento: '19/05/2024',
      },
    ];

    const treatCommit = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ entityType: 'treatments', mode: 'commit', branchId: branch.id, rows: treatRows }),
    });
    assert.equal(treatCommit.status, 201);
    assert.equal(treatCommit.json.validCount, 1);
    assert.equal(treatCommit.json.errorCount, 1);
    assert.equal(treatCommit.json.willCreateTreatments, 1);
    assert.equal(treatCommit.json.willCreatePayments, 1);

    const importedTreatment = getServerDbState().data.treatments.find(
      (t: any) => t.title === 'Endodoncia Molar Histórica 2024'
    );
    assert.ok(importedTreatment);
    assert.equal(importedTreatment.totalAmount, 650000);
    assert.equal(importedTreatment.originalListPrice, 650000);
    assert.equal(importedTreatment.paidAmount, 250000);
    assert.equal(importedTreatment.balanceDue, 400000);
    assert.equal(importedTreatment.startDate, '2024-05-18');

    // Cambiar precio del servicio del catálogo ahora NO debe alterar el tratamiento histórico importado
    const priceChangeRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        upserts: {
          services: [{ ...catalogService, basePrice: 995000, updatedAt: new Date().toISOString() }],
        },
        deletes: {},
      }),
    });
    assert.equal(priceChangeRes.status, 200);
    const recheckTreat = getServerDbState().data.treatments.find((t: any) => t.id === importedTreatment.id);
    assert.equal(recheckTreat.totalAmount, 650000, 'El precio histórico congelado NO puede cambiar al editar el catálogo');

    // ------------------------------------------------------------------
    // F) Carga Masiva Histórica: 3) COBROS HISTÓRICOS (saldos, duplicados, sobrepago y caja intacta)
    // ------------------------------------------------------------------
    const payCommit = await apiRequest(baseUrl, '/api/historical-import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        entityType: 'payments',
        mode: 'commit',
        branchId: branch.id,
        rows: [
          {
            documento_paciente: '4521890',
            titulo_tratamiento: 'Endodoncia Molar Histórica 2024',
            monto_gs: '400.000',
            metodo_pago: 'TRANSFERENCIA',
            fecha_cobro: '15/06/2024',
            nro_recibo: 'HIST-2024-9001',
          },
          {
            // Mismo recibo -> SKIPPED
            documento_paciente: '4521890',
            titulo_tratamiento: 'Endodoncia Molar Histórica 2024',
            monto_gs: '100.000',
            fecha_cobro: '16/06/2024',
            nro_recibo: 'HIST-2024-9001',
          },
          {
            // Sobrepago contra tratamiento ya saldado -> ERROR
            documento_paciente: '4521890',
            titulo_tratamiento: 'Endodoncia Molar Histórica 2024',
            monto_gs: '50.000',
            fecha_cobro: '17/06/2024',
            nro_recibo: 'HIST-2024-9002',
          },
        ],
      }),
    });
    assert.equal(payCommit.status, 201);
    assert.equal(payCommit.json.validCount, 1);
    assert.equal(payCommit.json.skippedCount, 1);
    assert.equal(payCommit.json.errorCount, 1);

    const settledTreatment = getServerDbState().data.treatments.find((t: any) => t.id === importedTreatment.id);
    assert.equal(settledTreatment.paidAmount, 650000);
    assert.equal(settledTreatment.balanceDue, 0);

    const histPay = getServerDbState().data.payments.find((p: any) => p.receiptNumber === 'HIST-2024-9001');
    assert.ok(histPay);
    assert.equal(histPay.cashMovementId, null, 'Los cobros históricos NO deben vincularse a la caja de hoy');
    assert.ok(String(histPay.createdAt).startsWith('2024-06-15'));

    // Verificar que la caja abierta de HOY tiene exactamente 0 movimientos agregados
    const movementsAfter = getServerDbState().data.cashMovements.filter(
      (m: any) => m.cashRegisterId === todayCashRegisterId
    ).length;
    assert.equal(movementsAfter, movementsBefore, 'La caja abierta de hoy debe permanecer 100% intacta');

    // Verificar auditoría de importación histórica
    const importAudits = getServerDbState().data.auditLogs.filter((a: any) => a.action === 'HISTORICAL_IMPORT');
    assert.equal(importAudits.length, 3, 'Deben quedar 3 eventos inmutables HISTORICAL_IMPORT (patients, treatments, payments)');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
