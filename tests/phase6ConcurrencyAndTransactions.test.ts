import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

async function apiRequest(
  baseUrl: string,
  endpoint: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string>; cookie?: string } = {}
) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
  let serializedBody: string | undefined;
  if (opts.body !== undefined) {
    serializedBody = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: opts.method || 'GET',
    headers,
    body: serializedBody,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json response
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

test('E2E Fase 6: Concurrencia, transacciones atómicas de cobro/caja/agenda, bloqueo optimista, RBAC y multi-tenant', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-p6-'));
  const prevDataDir = process.env.DATA_DIR;
  const prevNodeEnv = process.env.NODE_ENV;
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
    const orgAId = state.data.organization.id;
    const orgBId = '22222222-2222-4222-8222-222222222222';
    const branchAId = 'branch-p6-a2';
    const branchBId = 'branch-p6-b1';
    const chairAId = 'chair-p6-a2';

    state.organizationsList.push({
      id: orgBId,
      code: 'ORG-B-P6',
      name: 'Clínica Competidora B',
      status: 'ACTIVE',
    });

    state.data.branches.push(
      {
        id: branchAId,
        organizationId: orgAId,
        code: 'SUC-P6-A',
        name: 'Sucursal Fase 6 A',
        status: 'ACTIVE',
      },
      {
        id: branchBId,
        organizationId: orgBId,
        code: 'SUC-P6-B',
        name: 'Sucursal Fase 6 B',
        status: 'ACTIVE',
      }
    );

    state.data.branchSettings.push({
      branchId: branchAId,
      appointmentDurationDefault: 30,
      slotInterval: 15,
      allowDoubleBooking: false,
      requireDocumentOnBooking: true,
    });

    state.data.dentalChairs.push({
      id: chairAId,
      organizationId: orgAId,
      branchId: branchAId,
      name: 'Sillón Quirúrgico P6',
      code: 'SQ-P6',
      status: 'OPERATIVE',
    });

    const pass = 'Phase6Pass#2026';
    const hash = createPbkdf2Hash(pass);

    const orgAdminAId = 'user-p6-admin-a';
    const cajaAId = 'user-p6-caja-a';
    const recepAId = 'user-p6-recep-a';
    const doc1AId = 'user-p6-doc1-a';
    const doc2AId = 'user-p6-doc2-a';
    const orgAdminBId = 'user-p6-admin-b';

    state.data.users.push(
      {
        id: orgAdminAId,
        organizationId: orgAId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.p6',
        firstName: 'Andrea',
        lastName: 'AdminA',
        email: 'admin.p6@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: cajaAId,
        organizationId: orgAId,
        roleId: 'CAJA',
        username: 'caja.p6',
        firstName: 'Marcos',
        lastName: 'Cajero',
        email: 'caja.p6@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: recepAId,
        organizationId: orgAId,
        roleId: 'RECEPCION',
        username: 'recep.p6',
        firstName: 'Elena',
        lastName: 'Recep',
        email: 'recep.p6@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: doc1AId,
        organizationId: orgAId,
        roleId: 'ODONTOLOGO',
        username: 'doc1.p6',
        firstName: 'Diego',
        lastName: 'Medina',
        email: 'doc1.p6@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: doc2AId,
        organizationId: orgAId,
        roleId: 'ODONTOLOGO',
        username: 'doc2.p6',
        firstName: 'Camila',
        lastName: 'Sosa',
        email: 'doc2.p6@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: orgAdminBId,
        organizationId: orgBId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.orgb.p6',
        firstName: 'Bruno',
        lastName: 'OrgB',
        email: 'admin.orgb.p6@clinicab.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      }
    );

    state.data.userBranches.push(
      { userId: orgAdminAId, branchId: branchAId, isDefault: true },
      { userId: cajaAId, branchId: branchAId, isDefault: true },
      { userId: recepAId, branchId: branchAId, isDefault: true },
      { userId: doc1AId, branchId: branchAId, isDefault: true },
      { userId: doc2AId, branchId: branchAId, isDefault: true },
      { userId: orgAdminBId, branchId: branchBId, isDefault: true }
    );

    const patient1Id = 'pat-p6-1';
    const patient2Id = 'pat-p6-2';
    state.data.patients.push(
      {
        id: patient1Id,
        organizationId: orgAId,
        primaryBranchId: branchAId,
        documentType: 'CI',
        documentNumber: '6000001',
        firstName: 'Mateo',
        lastName: 'Paredes',
        phone: '+595 981 000 001',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: patient2Id,
        organizationId: orgAId,
        primaryBranchId: branchAId,
        documentType: 'CI',
        documentNumber: '6000002',
        firstName: 'Luciana',
        lastName: 'Vera',
        phone: '+595 981 000 002',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    const treatmentId = 'treat-p6-1';
    state.data.treatments.push({
      id: treatmentId,
      organizationId: orgAId,
      branchId: branchAId,
      patientId: patient1Id,
      odontologistId: doc1AId,
      title: 'Corona Cerámica Pieza 11',
      totalAmount: 900000,
      paidAmount: 0,
      balanceDue: 900000,
      status: 'PLANIFICADO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Autenticar actores de prueba
    const [cajaLogin, recepLogin, doc1Login, adminALogin, adminBLogin] = await Promise.all([
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'caja.p6@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'recep.p6@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'doc1.p6@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'admin.p6@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'admin.orgb.p6@clinicab.com.py', password: pass },
      }),
    ]);

    assert.equal(cajaLogin.status, 200);
    assert.equal(recepLogin.status, 200);
    assert.equal(doc1Login.status, 200);
    assert.equal(adminALogin.status, 200);
    assert.equal(adminBLogin.status, 200);

    // -----------------------------------------------------------------------
    // 1. Concurrencia en apertura de caja: 2 aperturas simultáneas en sucursal
    // -----------------------------------------------------------------------
    const openResults = await Promise.all([
      apiRequest(baseUrl, '/api/cash-registers/open', {
        method: 'POST',
        cookie: cajaLogin.sidCookie,
        body: { branchId: branchAId, openingAmount: 250000, observations: 'Turno 1' },
      }),
      apiRequest(baseUrl, '/api/cash-registers/open', {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { branchId: branchAId, openingAmount: 300000, observations: 'Turno duplicado' },
      }),
    ]);

    const openStatuses = openResults.map((r) => r.status).sort();
    assert.deepEqual(openStatuses, [201, 409]);
    const failedOpen = openResults.find((r) => r.status === 409);
    assert.equal(failedOpen?.json?.code, 'CONFLICT_OPEN_CASH_REGISTER');
    const createdRegister = openResults.find((r) => r.status === 201)?.json?.cashRegister;
    assert.ok(createdRegister?.id);

    // -----------------------------------------------------------------------
    // 2. Concurrencia de doble cobro sobre el mismo tratamiento (saldo total)
    // -----------------------------------------------------------------------
    const payResults = await Promise.all([
      apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
        method: 'POST',
        cookie: cajaLogin.sidCookie,
        body: { amount: 900000, paymentMethod: 'EFECTIVO', autoProgressIfPaid: true },
      }),
      apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { amount: 900000, paymentMethod: 'TRANSFERENCIA', autoProgressIfPaid: true },
      }),
    ]);

    const payStatuses = payResults.map((r) => r.status).sort();
    assert.deepEqual(payStatuses, [201, 409]);
    const wonPay = payResults.find((r) => r.status === 201)!;
    const lostPay = payResults.find((r) => r.status === 409)!;
    assert.equal(lostPay.json?.code, 'CONFLICT_TREATMENT_ALREADY_PAID');
    assert.equal(wonPay.json?.treatment?.balanceDue, 0);
    assert.equal(wonPay.json?.treatment?.paidAmount, 900000);
    assert.equal(wonPay.json?.cashMovement?.movementType, 'INGRESO');

    const orgAPaymentsAfterCharge = state.data.payments.filter(
      (p: any) => p.treatmentId === treatmentId && p.status !== 'ANULADO'
    );
    assert.equal(orgAPaymentsAfterCharge.length, 1);

    const paymentId = wonPay.json.payment.id;

    // -----------------------------------------------------------------------
    // 3. Concurrencia de doble anulación del mismo recibo
    // -----------------------------------------------------------------------
    const annulResults = await Promise.all([
      apiRequest(baseUrl, `/api/payments/${paymentId}/annul`, {
        method: 'POST',
        cookie: cajaLogin.sidCookie,
        body: { reason: 'Error de digitación de medio de pago' },
      }),
      apiRequest(baseUrl, `/api/payments/${paymentId}/annul`, {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { reason: 'Anulación simultánea repetida' },
      }),
    ]);

    const annulStatuses = annulResults.map((r) => r.status).sort();
    assert.deepEqual(annulStatuses, [200, 409]);
    const wonAnnul = annulResults.find((r) => r.status === 200)!;
    const lostAnnul = annulResults.find((r) => r.status === 409)!;
    assert.equal(lostAnnul.json?.code, 'CONFLICT_PAYMENT_ALREADY_ANNULLED');
    assert.equal(wonAnnul.json?.restoredTreatment?.paidAmount, 0);
    assert.equal(wonAnnul.json?.restoredTreatment?.balanceDue, 900000);
    assert.equal(wonAnnul.json?.counterMovement?.movementType, 'EGRESO');

    const registerEgresos = state.data.cashMovements.filter(
      (m: any) => m.cashRegisterId === createdRegister.id && m.movementType === 'EGRESO'
    );
    assert.equal(registerEgresos.length, 1);

    // -----------------------------------------------------------------------
    // 4. Doble cierre simultáneo de caja y bloqueo de movimientos tras cierre
    // -----------------------------------------------------------------------
    const expectedCashAtClose =
      createdRegister.openingAmount +
      (wonPay.json.payment.paymentMethod === 'EFECTIVO' ? 900000 : 0) -
      (wonPay.json.payment.paymentMethod === 'EFECTIVO' ? 900000 : 0);

    const closeResults = await Promise.all([
      apiRequest(baseUrl, `/api/cash-registers/${createdRegister.id}/close`, {
        method: 'POST',
        cookie: cajaLogin.sidCookie,
        body: { closingAmountReal: expectedCashAtClose, observations: 'Arqueo final' },
      }),
      apiRequest(baseUrl, `/api/cash-registers/${createdRegister.id}/close`, {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { closingAmountReal: expectedCashAtClose, observations: 'Segundo cierre simultáneo' },
      }),
    ]);

    assert.deepEqual(
      closeResults.map((r) => r.status).sort(),
      [200, 409]
    );
    assert.equal(
      closeResults.find((r) => r.status === 409)?.json?.code,
      'CONFLICT_CASH_REGISTER_ALREADY_CLOSED'
    );
    const closedRegister = closeResults.find((r) => r.status === 200)?.json?.cashRegister;
    assert.equal(closedRegister?.closingAmountExpected, expectedCashAtClose);
    assert.equal(closedRegister?.differenceAmount, 0);

    const postCloseMove = await apiRequest(baseUrl, `/api/cash-registers/${createdRegister.id}/movements`, {
      method: 'POST',
      cookie: cajaLogin.sidCookie,
      body: {
        movementType: 'INGRESO',
        amount: 50000,
        paymentMethod: 'EFECTIVO',
        concept: 'Movimiento tardío con caja cerrada',
      },
    });
    assert.equal(postCloseMove.status, 409);
    assert.equal(postCloseMove.json?.code, 'CONFLICT_CASH_REGISTER_CLOSED');

    // -----------------------------------------------------------------------
    // 5. Concurrencia anti-double-booking en agenda (mismo profesional y mismo sillón)
    // -----------------------------------------------------------------------
    const apptDate = '2026-12-10';
    const doctorRace = await Promise.all([
      apiRequest(baseUrl, '/api/appointments', {
        method: 'POST',
        cookie: recepLogin.sidCookie,
        body: {
          branchId: branchAId,
          patientId: patient1Id,
          odontologistId: doc1AId,
          dentalChairId: chairAId,
          appointmentDate: apptDate,
          startTime: '09:00',
          durationMin: 45,
          reason: 'Consulta 1',
        },
      }),
      apiRequest(baseUrl, '/api/appointments', {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: {
          branchId: branchAId,
          patientId: patient2Id,
          odontologistId: doc1AId,
          appointmentDate: apptDate,
          startTime: '09:15',
          durationMin: 30,
          reason: 'Consulta superpuesta mismo doctor',
        },
      }),
    ]);

    assert.deepEqual(
      doctorRace.map((r) => r.status).sort(),
      [201, 409]
    );
    assert.equal(
      doctorRace.find((r) => r.status === 409)?.json?.code,
      'CONFLICT_DOUBLE_BOOKING_DOCTOR'
    );

    // Distinto odontólogo pero MISMO sillón en horario superpuesto -> 409 CONFLICT_DOUBLE_BOOKING_CHAIR
    const chairConflict = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patient2Id,
        odontologistId: doc2AId,
        dentalChairId: chairAId,
        appointmentDate: apptDate,
        startTime: '09:30',
        durationMin: 30,
        reason: 'Intento de uso simultáneo del sillón',
      },
    });
    assert.equal(chairConflict.status, 409);
    assert.equal(chairConflict.json?.code, 'CONFLICT_DOUBLE_BOOKING_CHAIR');

    // -----------------------------------------------------------------------
    // 6. Bloqueo optimista por clave en POST /api/db/delta
    // -----------------------------------------------------------------------
    const stateRes = await apiRequest(baseUrl, '/api/db/state', { cookie: adminALogin.sidCookie });
    assert.equal(stateRes.status, 200);
    const baseVersion = stateRes.json.stateVersion;
    assert.equal(typeof baseVersion, 'number');

    const p1 = stateRes.json.data.patients.find((p: any) => p.id === patient1Id);
    const p2 = stateRes.json.data.patients.find((p: any) => p.id === patient2Id);
    assert.ok(p1 && p2);

    // Usuario A actualiza Paciente 1 -> 200 OK
    const updateP1ByA = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: adminALogin.sidCookie,
      body: {
        baseVersion,
        upserts: {
          patients: [{ ...p1, phone: '+595 981 111 111' }],
        },
      },
    });
    assert.equal(updateP1ByA.status, 200);
    assert.ok(updateP1ByA.json.stateVersion > baseVersion);

    // Usuario B intenta actualizar el MISMO Paciente 1 con baseVersion atrasada -> 409 CONFLICT_OPTIMISTIC_LOCK
    const staleUpdateP1ByB = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: {
        baseVersion,
        upserts: {
          patients: [{ ...p1, phone: '+595 981 999 999' }],
        },
      },
    });
    assert.equal(staleUpdateP1ByB.status, 409);
    assert.equal(staleUpdateP1ByB.json?.code, 'CONFLICT_OPTIMISTIC_LOCK');
    assert.equal(staleUpdateP1ByB.json?.conflicts?.[0]?.key, patient1Id);

    // Usuario C actualiza un registro DISTINTO (Paciente 2) con baseVersion atrasada -> 200 merge limpio
    const staleUpdateP2ByC = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: {
        baseVersion,
        upserts: {
          patients: [{ ...p2, phone: '+595 981 222 222' }],
        },
      },
    });
    assert.equal(staleUpdateP2ByC.status, 200);

    // -----------------------------------------------------------------------
    // 7. RBAC estricto y aislamiento multi-tenant en endpoints autoritativos
    // -----------------------------------------------------------------------
    const recepOpenCash = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: { branchId: branchAId, openingAmount: 100000 },
    });
    assert.equal(recepOpenCash.status, 403);

    const recepPay = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: { amount: 100000, paymentMethod: 'EFECTIVO' },
    });
    assert.equal(recepPay.status, 403);

    const recepAnnul = await apiRequest(baseUrl, `/api/payments/${paymentId}/annul`, {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: { reason: 'Intento sin permisos' },
    });
    assert.equal(recepAnnul.status, 403);

    const docPay = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie: doc1Login.sidCookie,
      body: { amount: 100000, paymentMethod: 'EFECTIVO' },
    });
    assert.equal(docPay.status, 403);

    const docOpenCash = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie: doc1Login.sidCookie,
      body: { branchId: branchAId, openingAmount: 100000 },
    });
    assert.equal(docOpenCash.status, 403);

    const docValidAppt = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: doc1Login.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patient1Id,
        odontologistId: doc1AId,
        dentalChairId: chairAId,
        appointmentDate: apptDate,
        startTime: '11:00',
        durationMin: 30,
        reason: 'Control sin superposición',
      },
    });
    assert.equal(docValidAppt.status, 201);

    // Cross-tenant Org B intentando operar sobre recursos de Org A -> 403
    const crossTenantPay = await apiRequest(baseUrl, `/api/treatments/${treatmentId}/payments`, {
      method: 'POST',
      cookie: adminBLogin.sidCookie,
      body: { amount: 100000, paymentMethod: 'EFECTIVO' },
    });
    assert.equal(crossTenantPay.status, 403);

    const crossTenantOpenCash = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie: adminBLogin.sidCookie,
      body: { branchId: branchAId, openingAmount: 50000 },
    });
    assert.equal(crossTenantOpenCash.status, 403);

    const crossTenantAppt = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: adminBLogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patient1Id,
        odontologistId: doc1AId,
        appointmentDate: apptDate,
        startTime: '15:00',
        durationMin: 30,
      },
    });
    assert.equal(crossTenantAppt.status, 403);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = prevDataDir;
    }
    if (prevNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = prevNodeEnv;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
