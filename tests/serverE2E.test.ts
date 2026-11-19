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

test('E2E Servidor modular: Auth, RBAC por colección, flujo completo de Nómina REST y reset de clave', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-e2e-'));
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
    const orgId = state.data.organization.id;
    const branchId = state.data.branches[0].id;

    const adminPass = 'SuperAdmin#2026';
    const adminHash = createPbkdf2Hash(adminPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    superAdmin.passwordHash = adminHash.hash;
    superAdmin.passwordSalt = adminHash.salt;
    superAdmin.passwordIterations = adminHash.iterations;

    const recepPass = 'RecepPass#2026';
    const recepHash = createPbkdf2Hash(recepPass);
    const recepUserId = 'user-e2e-recepcion-01';
    state.data.users.push({
      id: recepUserId,
      organizationId: orgId,
      roleId: 'RECEPCION',
      username: 'recep.e2e',
      firstName: 'Recepción',
      lastName: 'E2E',
      email: 'recep.e2e@odontosol.com.py',
      passwordHash: recepHash.hash,
      passwordSalt: recepHash.salt,
      passwordIterations: recepHash.iterations,
      status: 'ACTIVE',
      permissionsVersion: 1,
    });
    state.data.userBranches.push({ userId: recepUserId, branchId, isDefault: true });

    // 1. Health & JSON malformed error handler
    const health = await apiRequest(baseUrl, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.status, 'ok');

    const badJson = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: '{"identifier":',
    });
    assert.equal(badJson.status, 400);
    assert.equal(badJson.json.error, 'JSON inválido en el cuerpo de la solicitud.');

    // 2. RECEPCION RBAC & state redaction
    const recepLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.e2e@odontosol.com.py', password: recepPass }),
    });
    assert.equal(recepLogin.status, 200);
    assert.ok(recepLogin.sidCookie.startsWith('odontopro_sid='));

    const recepState = await apiRequest(baseUrl, '/api/db/state', { cookie: recepLogin.sidCookie });
    assert.equal(recepState.status, 200);
    assert.equal(recepState.json.data.auditLogs.length, 0);
    assert.equal(recepState.json.data.employeeSalaries.length, 0);
    assert.equal(recepState.json.data.clinicalRecords.length, 0);

    const forbidDelta = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: JSON.stringify({ upserts: { branches: [{ id: 'b-x', organizationId: orgId, name: 'X' }] } }),
    });
    assert.equal(forbidDelta.status, 403);

    const forbidPayroll = await apiRequest(baseUrl, '/api/payroll/employees', {
      method: 'POST',
      cookie: recepLogin.sidCookie,
      body: JSON.stringify({ firstName: 'X', lastName: 'Y', documentNumber: '123', area: 'OPERATIVA', position: 'Aux', remunerationModality: 'SALARIO_FIJO' }),
    });
    assert.equal(forbidPayroll.status, 403);

    // 3. SUPER_ADMIN ciclo completo de Personal, Salarios, Comisiones, Liquidación y Pago
    const adminLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'bussinessanalyst3@gmail.com', password: adminPass }),
    });
    assert.equal(adminLogin.status, 200);

    const empRes = await apiRequest(baseUrl, '/api/payroll/employees', {
      method: 'POST',
      cookie: adminLogin.sidCookie,
      body: JSON.stringify({
        branchId,
        firstName: 'Andrea',
        lastName: 'Salazar',
        documentNumber: '5.321.987',
        area: 'OPERATIVA',
        position: 'Coordinadora Operativa',
        remunerationModality: 'SALARIO_FIJO',
        initialSalary: 4000000,
        paymentFrequency: 'MENSUAL',
      }),
    });
    assert.equal(empRes.status, 201);
    const empId = empRes.json.employee.id;

    const settRes = await apiRequest(baseUrl, '/api/payroll/settlements', {
      method: 'POST',
      cookie: adminLogin.sidCookie,
      body: JSON.stringify({
        employeeId: empId,
        periodYear: 2026,
        periodMonth: 11,
        includeBaseSalary: true,
        bonuses: [{ concept: 'Meta operativa', amount: 300000 }],
      }),
    });
    assert.equal(settRes.status, 201);
    const settId = settRes.json.settlement.id;
    assert.equal(settRes.json.settlement.netPayable, 4300000);

    const approveRes = await apiRequest(baseUrl, `/api/payroll/settlements/${settId}/approve`, {
      method: 'POST',
      cookie: adminLogin.sidCookie,
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.settlement.status, 'APROBADA');

    const payRes = await apiRequest(baseUrl, '/api/payroll/payments', {
      method: 'POST',
      cookie: adminLogin.sidCookie,
      body: JSON.stringify({
        settlementId: settId,
        amount: 4300000,
        paymentMethod: 'TRANSFERENCIA_SIPAP',
      }),
    });
    assert.equal(payRes.status, 201);
    assert.equal(payRes.json.settlement.status, 'PAGADA');
    assert.equal(payRes.json.settlement.balanceDue, 0);

    // 4. Reset administrativo de contraseña + revocación de sesión previa
    const resetRes = await apiRequest(baseUrl, `/api/users/${recepUserId}/reset-password`, {
      method: 'POST',
      cookie: adminLogin.sidCookie,
      body: JSON.stringify({ newPassword: 'RecepNew#2026' }),
    });
    assert.equal(resetRes.status, 200);

    const oldSess = await apiRequest(baseUrl, '/api/auth/session', { cookie: recepLogin.sidCookie });
    assert.equal(oldSess.status, 401);

    const newLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.e2e@odontosol.com.py', password: 'RecepNew#2026' }),
    });
    assert.equal(newLogin.status, 200);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
