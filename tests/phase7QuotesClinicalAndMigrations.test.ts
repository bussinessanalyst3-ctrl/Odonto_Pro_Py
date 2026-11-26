import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  applyPendingMigrations,
  listMigrationFiles,
} from '../scripts/migrate.ts';

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

test('E2E Fase 7: Presupuestos, Tratamientos, Turnos, Historia Clínica autoritativos, RBAC y Multi-Tenant', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-p7-'));
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
    const orgBId = '33333333-3333-4333-8333-333333333333';
    const branchAId = 'branch-p7-a';
    const branchBId = 'branch-p7-b';

    state.organizationsList.push({
      id: orgBId,
      code: 'ORG-B-P7',
      name: 'Clínica Externa B P7',
      status: 'ACTIVE',
    });

    state.data.branches.push(
      { id: branchAId, organizationId: orgAId, code: 'SUC-P7-A', name: 'Sucursal P7 A', status: 'ACTIVE' },
      { id: branchBId, organizationId: orgBId, code: 'SUC-P7-B', name: 'Sucursal P7 B', status: 'ACTIVE' }
    );

    const pass = 'Phase7Pass#2026';
    const hash = createPbkdf2Hash(pass);

    const adminAId = 'user-p7-admin-a';
    const docAId = 'user-p7-doc-a';
    const recepAId = 'user-p7-recep-a';
    const cajaAId = 'user-p7-caja-a';
    const adminBId = 'user-p7-admin-b';

    state.data.users.push(
      {
        id: adminAId,
        organizationId: orgAId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.p7',
        firstName: 'Laura',
        lastName: 'AdminP7',
        email: 'admin.p7@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: docAId,
        organizationId: orgAId,
        roleId: 'ODONTOLOGO',
        username: 'doc.p7',
        firstName: 'Rafael',
        lastName: 'Gómez',
        email: 'doc.p7@odontosol.com.py',
        medicalLicenseNumber: 'MSPBS-7741',
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
        username: 'recep.p7',
        firstName: 'Nadia',
        lastName: 'RecepP7',
        email: 'recep.p7@odontosol.com.py',
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
        username: 'caja.p7',
        firstName: 'Oscar',
        lastName: 'CajaP7',
        email: 'caja.p7@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: adminBId,
        organizationId: orgBId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.orgb.p7',
        firstName: 'Hugo',
        lastName: 'OrgB',
        email: 'admin.orgb.p7@clinicab.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      }
    );

    state.data.userBranches.push(
      { userId: adminAId, branchId: branchAId, isDefault: true },
      { userId: docAId, branchId: branchAId, isDefault: true },
      { userId: recepAId, branchId: branchAId, isDefault: true },
      { userId: cajaAId, branchId: branchAId, isDefault: true },
      { userId: adminBId, branchId: branchBId, isDefault: true }
    );

    const planAId = 'plan-p7-a';
    state.data.insurancePlans.push({
      id: planAId,
      organizationId: orgAId,
      code: 'MEDP7',
      name: 'Seguro Dental P7',
      status: 'ACTIVO',
    });

    const patientP7Id = 'pat-p7-seguro';
    state.data.patients.push({
      id: patientP7Id,
      organizationId: orgAId,
      primaryBranchId: branchAId,
      documentType: 'CI',
      documentNumber: '7000001',
      firstName: 'Clara',
      lastName: 'Duarte',
      phone: '+595 981 700 001',
      modality: 'PLAN_SEGURO',
      insurancePlanId: planAId,
      insuranceMemberNumber: 'SEG-7001',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Regla de comisión al completar tratamiento para docA
    const empDocId = 'emp-p7-doc';
    state.data.employees.push({
      id: empDocId,
      organizationId: orgAId,
      branchId: branchAId,
      userId: docAId,
      firstName: 'Rafael',
      lastName: 'Gómez',
      documentType: 'CI',
      documentNumber: '7111111',
      area: 'CLINICA',
      position: 'Odontólogo',
      status: 'ACTIVE',
      isDentist: true,
      isAdvisor: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    state.data.commissionRules.push({
      id: 'rule-p7-treat-complete',
      organizationId: orgAId,
      area: 'CLINICA',
      name: 'Comisión clínica tratamiento finalizado P7',
      targetRole: 'ODONTOLOGO',
      targetEmployeeId: empDocId,
      triggerType: 'ON_TREATMENT_COMPLETED',
      calculationMode: 'PERCENTAGE',
      ratePercentage: 25,
      requiresCollectedPayment: false,
      requiresCompletedTreatment: true,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const quote1Id = 'quote-p7-1';
    const quote2Id = 'quote-p7-2';
    state.data.quotes.push(
      {
        id: quote1Id,
        organizationId: orgAId,
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        quoteNumber: 'PRES-2026-P701',
        totalAmount: 1000000,
        discountAmount: 200000,
        finalAmount: 800000,
        status: 'PENDIENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: quote2Id,
        organizationId: orgAId,
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        quoteNumber: 'PRES-2026-P702',
        totalAmount: 400000,
        discountAmount: 0,
        finalAmount: 400000,
        status: 'PENDIENTE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    state.data.quoteItems.push({
      id: 'qi-p7-1',
      quoteId: quote1Id,
      toothNumber: 16,
      description: 'Endodoncia Molar P7',
      quantity: 1,
      unitPrice: 800000,
      subtotal: 800000,
    });

    const apptId = 'appt-p7-1';
    state.data.appointments.push({
      id: apptId,
      organizationId: orgAId,
      branchId: branchAId,
      patientId: patientP7Id,
      odontologistId: docAId,
      appointmentDate: '2026-12-15',
      startTime: '10:00:00',
      endTime: '10:30:00',
      durationMin: 30,
      status: 'PENDIENTE',
      reason: 'Control endodóntico',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const [adminALogin, docALogin, recepALogin, cajaALogin, adminBLogin] = await Promise.all([
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'admin.p7@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'doc.p7@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'recep.p7@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'caja.p7@odontosol.com.py', password: pass },
      }),
      apiRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { identifier: 'admin.orgb.p7@clinicab.com.py', password: pass },
      }),
    ]);

    assert.equal(adminALogin.status, 200);
    assert.equal(docALogin.status, 200);
    assert.equal(recepALogin.status, 200);
    assert.equal(cajaALogin.status, 200);
    assert.equal(adminBLogin.status, 200);

    // 1. Concurrencia en aprobación de presupuesto -> 1x 200, 1x 409 + crea Treatment + InsuranceClaim
    const approveRace = await Promise.all([
      apiRequest(baseUrl, `/api/quotes/${quote1Id}/approve`, {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { autoCreateTreatment: true },
      }),
      apiRequest(baseUrl, `/api/quotes/${quote1Id}/approve`, {
        method: 'POST',
        cookie: adminALogin.sidCookie,
        body: { autoCreateTreatment: true },
      }),
    ]);
    assert.deepEqual(
      approveRace.map((r) => r.status).sort(),
      [200, 409]
    );
    const wonApprove = approveRace.find((r) => r.status === 200)!;
    const lostApprove = approveRace.find((r) => r.status === 409)!;
    assert.equal(lostApprove.json?.code, 'CONFLICT_QUOTE_ALREADY_FINALIZED');
    assert.equal(wonApprove.json?.quote?.status, 'APROBADO');
    assert.ok(wonApprove.json?.treatment?.id);
    assert.equal(wonApprove.json?.treatment?.appliedModality, 'PLAN_SEGURO');
    assert.ok(wonApprove.json?.insuranceClaim?.id);
    assert.equal(wonApprove.json?.insuranceClaim?.status, 'PENDIENTE_ENVIO');

    // Solo debe haberse creado 1 tratamiento vinculado a quote1Id
    assert.equal(
      state.data.treatments.filter((t: any) => t.quoteId === quote1Id).length,
      1
    );

    // Rechazar presupuesto 2 -> OK, luego aprobarlo -> 409
    const rejectQ2 = await apiRequest(baseUrl, `/api/quotes/${quote2Id}/reject`, {
      method: 'POST',
      cookie: adminALogin.sidCookie,
      body: { reason: 'Paciente postergó procedimiento' },
    });
    assert.equal(rejectQ2.status, 200);
    assert.equal(rejectQ2.json?.quote?.status, 'RECHAZADO');

    const approveRejected = await apiRequest(baseUrl, `/api/quotes/${quote2Id}/approve`, {
      method: 'POST',
      cookie: adminALogin.sidCookie,
      body: {},
    });
    assert.equal(approveRejected.status, 409);

    // 2. Transición concurrente de tratamiento a COMPLETADO -> genera comisión sin duplicar
    const createdTreatmentId = wonApprove.json.treatment.id;
    const completeRace = await Promise.all([
      apiRequest(baseUrl, `/api/treatments/${createdTreatmentId}/status`, {
        method: 'PATCH',
        cookie: docALogin.sidCookie,
        body: { status: 'COMPLETADO' },
      }),
      apiRequest(baseUrl, `/api/treatments/${createdTreatmentId}/status`, {
        method: 'PATCH',
        cookie: adminALogin.sidCookie,
        body: { status: 'COMPLETADO' },
      }),
    ]);
    assert.deepEqual(
      completeRace.map((r) => r.status),
      [200, 200]
    );
    const treatComms = state.data.generatedCommissions.filter(
      (c: any) => c.treatmentId === createdTreatmentId && c.ruleId === 'rule-p7-treat-complete'
    );
    assert.equal(treatComms.length, 1);
    assert.equal(treatComms[0].commissionAmount, 200000); // 25% de 800.000

    // 3. Transición de estado de cita con validación de motivo de cancelación
    const cancelNoReason = await apiRequest(baseUrl, `/api/appointments/${apptId}/status`, {
      method: 'PATCH',
      cookie: recepALogin.sidCookie,
      body: { status: 'CANCELADA', cancellationReason: '' },
    });
    assert.equal(cancelNoReason.status, 400);

    const confirmAppt = await apiRequest(baseUrl, `/api/appointments/${apptId}/status`, {
      method: 'PATCH',
      cookie: recepALogin.sidCookie,
      body: { status: 'CONFIRMADA' },
    });
    assert.equal(confirmAppt.status, 200);
    assert.equal(confirmAppt.json?.appointment?.status, 'CONFIRMADA');

    // 4. Historia clínica autoritativa: bloquea roles no clínicos (Ley 1682/01) y permite a odontólogo
    const recepClinical = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie: recepALogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        diagnosis: 'Intento no autorizado',
        treatmentPerformed: 'Ninguno',
      },
    });
    assert.equal(recepClinical.status, 403);

    const cajaClinical = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie: cajaALogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        diagnosis: 'Intento caja',
        treatmentPerformed: 'Ninguno',
      },
    });
    assert.equal(cajaClinical.status, 403);

    const docClinical = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie: docALogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        diagnosis: 'Pulpitis irreversible pieza 16',
        treatmentPerformed: 'Instrumentación rotatoria e irrigación NaOCl',
      },
    });
    assert.equal(docClinical.status, 201);
    assert.equal(docClinical.json?.clinicalRecord?.odontologistLicenseSnapshot, 'MSPBS-7741');
    assert.ok(docClinical.json?.clinicalRecord?.historicalDoctorName?.includes('Rafael Gómez'));

    // 5. RBAC adicional y aislamiento cross-tenant Org B -> Org A
    const recepApprove = await apiRequest(baseUrl, `/api/quotes/${quote1Id}/approve`, {
      method: 'POST',
      cookie: recepALogin.sidCookie,
      body: {},
    });
    assert.equal(recepApprove.status, 403);

    const recepTreatStatus = await apiRequest(baseUrl, `/api/treatments/${createdTreatmentId}/status`, {
      method: 'PATCH',
      cookie: recepALogin.sidCookie,
      body: { status: 'EN_PROGRESO' },
    });
    assert.equal(recepTreatStatus.status, 403);

    const crossQuote = await apiRequest(baseUrl, `/api/quotes/${quote1Id}/approve`, {
      method: 'POST',
      cookie: adminBLogin.sidCookie,
      body: {},
    });
    assert.equal(crossQuote.status, 403);

    const crossTreat = await apiRequest(baseUrl, `/api/treatments/${createdTreatmentId}/status`, {
      method: 'PATCH',
      cookie: adminBLogin.sidCookie,
      body: { status: 'SUSPENDIDO' },
    });
    assert.equal(crossTreat.status, 403);

    const crossAppt = await apiRequest(baseUrl, `/api/appointments/${apptId}/status`, {
      method: 'PATCH',
      cookie: adminBLogin.sidCookie,
      body: { status: 'FINALIZADA' },
    });
    assert.equal(crossAppt.status, 403);

    const crossClinical = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie: adminBLogin.sidCookie,
      body: {
        branchId: branchAId,
        patientId: patientP7Id,
        odontologistId: docAId,
        diagnosis: 'Cross tenant',
        treatmentPerformed: 'Cross tenant',
      },
    });
    assert.equal(crossClinical.status, 403);

    // 6. Health endpoint liviano sin secretos ni consulta a BD
    const healthRes = await apiRequest(baseUrl, '/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.json?.status, 'ok');
    assert.equal(typeof healthRes.json?.time, 'string');
    assert.equal(healthRes.json?.db, undefined);
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

test('Runner de migraciones SQL (scripts/migrate.ts): orden, advisory lock, idempotencia y validación de checksum', async () => {
  const migrationFiles = listMigrationFiles();
  assert.ok(migrationFiles.length >= 4, 'Deben existir al menos 4 migraciones SQL versionadas');
  assert.ok(
    migrationFiles.some((m) => m.filename === '202611190003_concurrency_and_financial_constraints.sql')
  );

  const appliedStore = new Map<string, string>();
  const executedSql: string[] = [];

  const mockPool = {
    async connect() {
      return {
        async query(sql: string, params?: any[]) {
          const normalized = sql.replace(/\s+/g, ' ').trim();
          executedSql.push(normalized);
          if (normalized.startsWith('SELECT filename, checksum FROM schema_migrations')) {
            return {
              rows: Array.from(appliedStore.entries()).map(([filename, checksum]) => ({
                filename,
                checksum,
              })),
            };
          }
          if (normalized.startsWith('INSERT INTO schema_migrations') && params) {
            appliedStore.set(String(params[0]), String(params[1]));
          }
          return { rows: [] };
        },
        release() {},
      };
    },
  } as any;

  // Primera ejecución: aplica todas las migraciones en orden dentro de transacciones con advisory lock
  const firstRun = await applyPendingMigrations(mockPool);
  assert.equal(firstRun.applied.length, migrationFiles.length);
  assert.equal(firstRun.alreadyApplied.length, 0);
  assert.ok(executedSql.some((s) => s.includes('pg_advisory_lock')));
  assert.ok(executedSql.some((s) => s.includes('pg_advisory_unlock')));

  // Segunda ejecución: idempotente (0 nuevas aplicadas)
  const secondRun = await applyPendingMigrations(mockPool);
  assert.equal(secondRun.applied.length, 0);
  assert.equal(secondRun.alreadyApplied.length, migrationFiles.length);

  // Checksum alterado en migración histórica -> rechaza ejecución
  appliedStore.set(migrationFiles[0].filename, 'tampered_checksum_sha256');
  await assert.rejects(
    () => applyPendingMigrations(mockPool),
    /Checksum mismatch/
  );
});
