import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

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

test('E2E Fase 5: GET /api/audit-logs con paginación, filtros, RBAC por sucursal y aislamiento multiempresa', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-p5-audit-'));
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
    const branch1Id = state.data.branches[0].id;
    const branch2Id = state.data.branches[1]?.id || 'branch-e2e-2';
    if (!state.data.branches[1]) {
      state.data.branches.push({
        id: branch2Id,
        organizationId: orgAId,
        code: 'SUC-02',
        name: 'Sucursal 2 E2E',
        status: 'ACTIVE',
      });
    }

    const orgBId = '22222222-2222-4222-8222-222222222222';
    state.organizationsList.push({
      id: orgBId,
      code: 'ORG-B',
      name: 'Clínica B E2E',
      status: 'ACTIVE',
    });

    const pass = 'AuditPass#2026';
    const hash = createPbkdf2Hash(pass);

    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    const orgAdminId = 'user-p5-org-admin';
    const branchAdminId = 'user-p5-branch-admin';
    const recepId = 'user-p5-recep';

    state.data.users.push(
      {
        id: orgAdminId,
        organizationId: orgAId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'orgadmin.p5',
        firstName: 'Carlos',
        lastName: 'OrgAdmin',
        email: 'orgadmin.p5@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: branchAdminId,
        organizationId: orgAId,
        roleId: 'ADMIN_SUCURSAL',
        username: 'branchadmin.p5',
        firstName: 'Lucia',
        lastName: 'Sucursal',
        email: 'branchadmin.p5@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      },
      {
        id: recepId,
        organizationId: orgAId,
        roleId: 'RECEPCION',
        username: 'recep.p5',
        firstName: 'Sofia',
        lastName: 'Recep',
        email: 'recep.p5@odontosol.com.py',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
      }
    );

    state.data.userBranches.push(
      { userId: orgAdminId, branchId: branch1Id, isDefault: true },
      { userId: branchAdminId, branchId: branch1Id, isDefault: true },
      { userId: recepId, branchId: branch1Id, isDefault: true }
    );

    // Seed controlled audit logs across branches and organizations
    state.data.auditLogs = [
      {
        id: 'log-1',
        organizationId: orgAId,
        branchId: branch1Id,
        userId: orgAdminId,
        action: 'CASH_MOVEMENT',
        entity: 'PAYMENT',
        entityId: 'pay-1',
        ipAddress: '10.0.0.1',
        description: 'Cobro Fase5 sucursal principal',
        createdAt: '2026-11-18T10:05:00.000Z',
      },
      {
        id: 'log-2',
        organizationId: orgAId,
        branchId: branch2Id,
        userId: orgAdminId,
        action: 'READ_SENSITIVE',
        entity: 'CLINICAL_RECORD',
        entityId: 'cr-1',
        ipAddress: '10.0.0.2',
        description: 'Lectura ficha clínica sucursal dos',
        createdAt: '2026-11-18T10:04:00.000Z',
      },
      {
        id: 'log-3',
        organizationId: orgAId,
        branchId: null,
        userId: superAdmin.id,
        action: 'UPDATE',
        entity: 'ORGANIZATION',
        entityId: orgAId,
        ipAddress: '10.0.0.3',
        description: 'Actualización global organización A',
        createdAt: '2026-11-18T10:03:00.000Z',
      },
      {
        id: 'log-4',
        organizationId: orgAId,
        branchId: branch1Id,
        userId: branchAdminId,
        action: 'CREATE',
        entity: 'PATIENT',
        entityId: 'pat-1',
        ipAddress: '10.0.0.1',
        description: 'Alta paciente busquedaclave',
        createdAt: '2026-11-18T10:02:00.000Z',
      },
      {
        id: 'log-org-b',
        organizationId: orgBId,
        branchId: null,
        userId: null,
        action: 'CREATE',
        entity: 'PATIENT',
        entityId: 'pat-b',
        ipAddress: '10.0.9.9',
        description: 'Evento secreto clínica B',
        createdAt: '2026-11-18T10:01:00.000Z',
      },
    ];

    // 1. Unauthenticated -> 401
    const unauth = await apiRequest(baseUrl, '/api/audit-logs');
    assert.equal(unauth.status, 401);

    // 2. RECEPCION -> 403
    const recepLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.p5@odontosol.com.py', password: pass }),
    });
    assert.equal(recepLogin.status, 200);
    const recepLogs = await apiRequest(baseUrl, '/api/audit-logs', { cookie: recepLogin.sidCookie });
    assert.equal(recepLogs.status, 403);

    // 3. ADMIN_SUCURSAL -> branch scoped & denies unauthorized branchId
    const branchLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'branchadmin.p5@odontosol.com.py', password: pass }),
    });
    assert.equal(branchLogin.status, 200);

    const branchLogs = await apiRequest(baseUrl, '/api/audit-logs', { cookie: branchLogin.sidCookie });
    assert.equal(branchLogs.status, 200);
    const branchLogIds = branchLogs.json.logs.map((l: any) => l.id);
    assert.ok(branchLogIds.includes('log-1'));
    assert.ok(branchLogIds.includes('log-3')); // branchId null is org-wide visibility
    assert.ok(branchLogIds.includes('log-4'));
    assert.ok(!branchLogIds.includes('log-2')); // unassigned branch2 excluded
    assert.ok(!branchLogIds.includes('log-org-b')); // cross-tenant excluded

    const branchForbidden = await apiRequest(baseUrl, `/api/audit-logs?branchId=${branch2Id}`, {
      cookie: branchLogin.sidCookie,
    });
    assert.equal(branchForbidden.status, 403);

    // 4. ADMIN_ORGANIZACION -> pagination, filters & multi-tenant lock
    const orgLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'orgadmin.p5@odontosol.com.py', password: pass }),
    });
    assert.equal(orgLogin.status, 200);

    // Aislar la muestra controlada de 5 registros (excluyendo los eventos LOGIN_SUCCESS recién generados por los logins de prueba)
    state.data.auditLogs = state.data.auditLogs.filter((l: any) => l.action !== 'LOGIN_SUCCESS');

    const page1 = await apiRequest(baseUrl, `/api/audit-logs?limit=2&offset=0&organizationId=${orgBId}`, {
      cookie: orgLogin.sidCookie,
    });
    assert.equal(page1.status, 200);
    assert.equal(page1.json.total, 4); // ignores requested organizationId for non-super-admin
    assert.equal(page1.json.logs.length, 2);
    assert.equal(page1.json.hasMore, true);
    assert.equal(page1.json.stats.sensitiveAccessesCount, 1);
    assert.equal(page1.json.stats.financialOperationsCount, 1);
    assert.equal(page1.json.stats.uniqueIpsCount, 3);

    const page2 = await apiRequest(baseUrl, '/api/audit-logs?limit=2&offset=2', {
      cookie: orgLogin.sidCookie,
    });
    assert.equal(page2.status, 200);
    assert.equal(page2.json.logs.length, 2);
    assert.equal(page2.json.hasMore, false);

    const searchFiltered = await apiRequest(baseUrl, '/api/audit-logs?search=busquedaclave', {
      cookie: orgLogin.sidCookie,
    });
    assert.equal(searchFiltered.status, 200);
    assert.equal(searchFiltered.json.total, 1);
    assert.equal(searchFiltered.json.logs[0].id, 'log-4');

    const actionFiltered = await apiRequest(baseUrl, '/api/audit-logs?action=READ_SENSITIVE&entity=CLINICAL_RECORD', {
      cookie: orgLogin.sidCookie,
    });
    assert.equal(actionFiltered.status, 200);
    assert.equal(actionFiltered.json.total, 1);
    assert.equal(actionFiltered.json.logs[0].id, 'log-2');

    // 5. SUPER_ADMIN -> can inspect orgB specifically
    const superLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'bussinessanalyst3@gmail.com', password: pass }),
    });
    assert.equal(superLogin.status, 200);

    const superOrgB = await apiRequest(baseUrl, `/api/audit-logs?organizationId=${orgBId}`, {
      cookie: superLogin.sidCookie,
    });
    assert.equal(superOrgB.status, 200);
    assert.equal(superOrgB.json.total, 1);
    assert.equal(superOrgB.json.logs[0].id, 'log-org-b');
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Integridad fachada dbStore modular: Usuarios, Snapshot multiempresa y Ciclo Cobro/Anulación/Caja', async () => {
  const tmpStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-p5-store-'));
  const prevDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpStoreDir;
  const { dbStore } = await import('../src/db/inMemoryStore.ts');

  try {
    dbStore.setBackendActorContext(null);
    const baseSnapshot = dbStore.getSnapshot();
    const superAdmin = baseSnapshot.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin, 'Debe existir SUPER_ADMIN en la semilla inicial');
    const orgId = baseSnapshot.organization.id;
    const branchId = baseSnapshot.branches[0].id;

    // 1. Ciclo de usuario modular (addUser -> getUserPasswordRecord -> setUserPasswordHash -> deleteUser con preservación histórica)
    const superActor = {
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
      organizationId: orgId,
    };
    const uniqueSuffix = Date.now().toString();
    const createdDoc = dbStore.addUser(
      {
        firstName: 'Martín',
        lastName: 'Rojas',
        email: `martin.rojas.${uniqueSuffix}@odontosol.com.py`,
        username: `mrojas${uniqueSuffix}`,
        roleId: 'ODONTOLOGO',
        phone: '+595 981 123 456',
        branchIds: [branchId],
        passwordRecord: {
          hash: 'initialHashHex',
          salt: 'initialSaltHex',
          iterations: 100000,
        },
      },
      superActor
    );
    assert.ok(createdDoc.id);

    // 2. Aislamiento de getSnapshot para actor no-superadmin (excluye cuentas SUPER_ADMIN)
    const nonSuperSnapshot = dbStore.getSnapshot({
      userId: createdDoc.id,
      role: 'ODONTOLOGO',
      organizationId: orgId,
    });
    assert.equal(
      nonSuperSnapshot.users.some((u: any) => u.roleId === 'SUPER_ADMIN'),
      false
    );
    assert.equal(
      nonSuperSnapshot.users.some((u: any) => u.id === createdDoc.id),
      true
    );

    const pwdRec1 = dbStore.getUserPasswordRecord(createdDoc.email, superActor);
    assert.equal(pwdRec1?.hash, 'initialHashHex');

    const updatedHash = dbStore.setUserPasswordHash(
      createdDoc.id,
      { hash: 'rotatedHashHex', salt: 'rotatedSaltHex', iterations: 120000 },
      superActor
    );
    assert.equal(updatedHash, true);
    const pwdRec2 = dbStore.getUserPasswordRecord(createdDoc.email, superActor);
    assert.equal(pwdRec2?.hash, 'rotatedHashHex');
    assert.equal(pwdRec2?.iterations, 120000);

    // 3. Flujo clínico y financiero modular: Paciente -> Tratamiento -> Apertura Caja -> Cobro -> Anulación -> Cierre Caja
    const patient = dbStore.addPatient({
      documentNumber: `CI-${uniqueSuffix}`,
      documentType: 'CI',
      firstName: 'Valeria',
      lastName: 'Benítez',
      phone: '+595 971 555 000',
      primaryBranchId: branchId,
      actorUserId: superAdmin.id,
    });
    assert.ok(patient.id);

    const treatment = dbStore.addTreatment({
      patientId: patient.id,
      branchId,
      title: 'Endodoncia Molar Test',
      totalAmount: 500000,
      odontologistId: createdDoc.id,
      actorUserId: superAdmin.id,
    });
    assert.equal(treatment.balanceDue, 500000);

    // Abrir caja en sucursal (cerrar si hubiera una previa abierta en esta sucursal)
    const openExisting = dbStore.getCashRegisters(branchId).find((cr: any) => cr.status === 'ABIERTA');
    if (openExisting) {
      dbStore.closeCashRegister({
        cashRegisterId: openExisting.id,
        closingAmountReal: openExisting.openingAmount || 0,
        observations: 'Cierre previo en test',
        actorUserId: superAdmin.id,
      });
    }

    const cashReg = dbStore.openCashRegister({
      branchId,
      openingAmount: 100000,
      observations: 'Apertura test Fase 5',
      actorUserId: superAdmin.id,
    });
    assert.equal(cashReg.status, 'ABIERTA');

    const receipt = dbStore.getNextReceiptNumber();
    const afterPayTreat = dbStore.recordTreatmentPayment(
      treatment.id,
      200000,
      'EFECTIVO',
      receipt,
      createdDoc.id
    );
    assert.equal(afterPayTreat.paidAmount, 200000);
    assert.equal(afterPayTreat.balanceDue, 300000);

    const payment = dbStore.getPayments(branchId).find((p: any) => p.receiptNumber === receipt);
    assert.ok(payment, 'Debe existir el pago registrado');

    // Anular pago -> debe restaurar saldo y registrar EGRESO en caja
    const annulRes = dbStore.annulPayment({
      paymentId: payment!.id,
      reason: 'Anulación controlada prueba Fase 5',
      actorUserId: superAdmin.id,
    });
    assert.equal(annulRes.payment.status, 'ANULADO');
    assert.equal(annulRes.restoredTreatment?.paidAmount, 0);
    assert.equal(annulRes.restoredTreatment?.balanceDue, 500000);
    assert.equal(annulRes.counterMovement?.movementType, 'EGRESO');

    // Cerrar caja: apertura 100k + ingreso 200k - egreso 200k = 100k esperado
    const closedReg = dbStore.closeCashRegister({
      cashRegisterId: cashReg.id,
      closingAmountReal: 100000,
      actorUserId: superAdmin.id,
    });
    assert.equal(closedReg.status, 'CERRADA');
    assert.equal(closedReg.closingAmountExpected, 100000);
    assert.equal(closedReg.differenceAmount, 0);

    // Eliminar usuario -> debe preservar snapshot histórico en pago/turno
    const deleted = dbStore.deleteUser(createdDoc.id, superActor);
    assert.equal(deleted, true);
    const preservedPayment = dbStore.getPayments(branchId).find((p: any) => p.id === payment!.id);
    assert.ok((preservedPayment as any)?.historicalReceivedByName?.includes('Martín Rojas'));
  } finally {
    dbStore.setBackendActorContext(null);
    if (prevDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = prevDataDir;
    }
    fs.rmSync(tmpStoreDir, { recursive: true, force: true });
  }
});
