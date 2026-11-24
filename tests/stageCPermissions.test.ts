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
    // Respuesta no JSON
  }
  const setCookie = res.headers.get('set-cookie');
  const sidMatch = setCookie?.match(/odontopro_sid=([^;]+)/);
  return {
    status: res.status,
    headers: res.headers,
    json,
    text,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

const TEST_TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-etapa-c-'));
const PREV_DATA_DIR = process.env.DATA_DIR;
const PREV_NODE_ENV = process.env.NODE_ENV;
process.env.DATA_DIR = TEST_TMP_DIR;
process.env.NODE_ENV = 'production';

test.after(() => {
  if (PREV_DATA_DIR === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = PREV_DATA_DIR;
  }
  if (PREV_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = PREV_NODE_ENV;
  }
  fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
});

test('Etapa C — Bandera PERMISSIONS_ENFORCE_MODULES (off / log / enforce) y mapeo de colecciones', async () => {
  const {
    getModuleEnforcementMode,
    getRequiredModulesForDeltaCollection,
  } = await import('../server/security.ts');

  const prevFlag = process.env.PERMISSIONS_ENFORCE_MODULES;
  try {
    delete process.env.PERMISSIONS_ENFORCE_MODULES;
    assert.equal(getModuleEnforcementMode(), 'off');

    process.env.PERMISSIONS_ENFORCE_MODULES = 'false';
    assert.equal(getModuleEnforcementMode(), 'off');

    process.env.PERMISSIONS_ENFORCE_MODULES = 'log';
    assert.equal(getModuleEnforcementMode(), 'log');

    process.env.PERMISSIONS_ENFORCE_MODULES = 'audit';
    assert.equal(getModuleEnforcementMode(), 'log');

    process.env.PERMISSIONS_ENFORCE_MODULES = 'true';
    assert.equal(getModuleEnforcementMode(), 'enforce');

    process.env.PERMISSIONS_ENFORCE_MODULES = '1';
    assert.equal(getModuleEnforcementMode(), 'enforce');

    // auditLogs nunca debe bloquearse al escribir (cualquier módulo registra auditoría)
    assert.equal(getRequiredModulesForDeltaCollection('auditLogs'), null);
    assert.deepEqual(getRequiredModulesForDeltaCollection('appointments'), ['agenda']);
    assert.deepEqual(getRequiredModulesForDeltaCollection('clinicalRecords'), ['clinical']);
    assert.deepEqual(getRequiredModulesForDeltaCollection('odontograms'), ['odontogram']);
    assert.deepEqual(getRequiredModulesForDeltaCollection('cashRegisters'), ['cash']);
    assert.deepEqual(getRequiredModulesForDeltaCollection('employees'), ['staff-payroll']);
    assert.deepEqual(getRequiredModulesForDeltaCollection('users'), ['users']);
  } finally {
    if (prevFlag === undefined) {
      delete process.env.PERMISSIONS_ENFORCE_MODULES;
    } else {
      process.env.PERMISSIONS_ENFORCE_MODULES = prevFlag;
    }
  }
});

test('Etapa C — Validación de módulos en rutas del backend con bandera controlada PERMISSIONS_ENFORCE_MODULES', async () => {
  const prevFlag = process.env.PERMISSIONS_ENFORCE_MODULES;
  delete process.env.PERMISSIONS_ENFORCE_MODULES;

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

    // 1. Preparar usuarios de prueba
    const superPass = 'SuperPassC#2026';
    const superHash = createPbkdf2Hash(superPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin, 'Debe existir SUPER_ADMIN');
    superAdmin.passwordHash = superHash.hash;
    superAdmin.passwordSalt = superHash.salt;
    superAdmin.passwordIterations = superHash.iterations;

    const userPass = 'ClinicUserC#2026';
    const userHash = createPbkdf2Hash(userPass);

    const recepId = '11111111-cccc-4ccc-8ccc-111111111111';
    const doctorId = '22222222-cccc-4ccc-8ccc-222222222222';
    const adminOrgId = '33333333-cccc-4ccc-8ccc-333333333333';

    state.data.users.push(
      {
        id: recepId,
        organizationId: orgId,
        roleId: 'RECEPCION',
        username: 'recep.c',
        firstName: 'Lucia',
        lastName: 'RecepcionC',
        email: 'recep.c@odontopro.test',
        passwordHash: userHash.hash,
        passwordSalt: userHash.salt,
        passwordIterations: userHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: [],
        assignedRestrictions: [],
        allowedNavTabs: [],
      },
      {
        id: doctorId,
        organizationId: orgId,
        roleId: 'ODONTOLOGO',
        username: 'doctor.c',
        firstName: 'Marcos',
        lastName: 'OdontologoC',
        email: 'doctor.c@odontopro.test',
        passwordHash: userHash.hash,
        passwordSalt: userHash.salt,
        passwordIterations: userHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: [],
        assignedRestrictions: [],
        allowedNavTabs: [],
      },
      {
        id: adminOrgId,
        organizationId: orgId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.org.c',
        firstName: 'Sofia',
        lastName: 'AdminOrgC',
        email: 'admin.org.c@odontopro.test',
        passwordHash: userHash.hash,
        passwordSalt: userHash.salt,
        passwordIterations: userHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: [],
        assignedRestrictions: [],
        allowedNavTabs: [],
      }
    );

    state.data.userBranches.push(
      { userId: recepId, branchId, isDefault: true },
      { userId: doctorId, branchId, isDefault: true },
      { userId: adminOrgId, branchId, isDefault: true }
    );

    // Asegurar un paciente base para probar rutas
    const patientId = '44444444-cccc-4ccc-8ccc-444444444444';
    state.data.patients.push({
      id: patientId,
      organizationId: orgId,
      primaryBranchId: branchId,
      documentType: 'CI',
      documentNumber: '5555123',
      firstName: 'Paciente',
      lastName: 'PruebaC',
      phone: '+595981000111',
      status: 'ACTIVE',
    });

    // 2. Iniciar sesión con todos los usuarios
    const loginSuper = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: superAdmin.email, password: superPass }),
    });
    assert.equal(loginSuper.status, 200);

    const loginRecep = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.c@odontopro.test', password: userPass }),
    });
    assert.equal(loginRecep.status, 200);

    const loginDoctor = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'doctor.c@odontopro.test', password: userPass }),
    });
    assert.equal(loginDoctor.status, 200);

    const loginAdminOrg = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.org.c@odontopro.test', password: userPass }),
    });
    assert.equal(loginAdminOrg.status, 200);

    // 3. Quitarle el módulo "agenda" a RECEPCION vía PUT /api/users/:id/permissions (sin cerrar su sesión)
    const disableAgenda = await apiRequest(baseUrl, `/api/users/${recepId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['dashboard', 'patients', 'quotes', 'cash'],
        },
      }),
    });
    assert.equal(disableAgenda.status, 200);

    // 4. Con bandera OFF (por defecto): NO bloquea con MODULE_ACCESS_DENIED (compatibilidad total)
    process.env.PERMISSIONS_ENFORCE_MODULES = 'false';
    const apptOff = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({
        branchId,
        patientId,
        odontologistId: doctorId,
        appointmentDate: '2026-12-10',
        startTime: '09:00',
        durationMin: 30,
      }),
    });
    assert.equal(apptOff.status, 201, 'Con PERMISSIONS_ENFORCE_MODULES=false no debe bloquear');
    const createdAppointmentId = apptOff.json.appointment.id;

    // 5. Con bandera LOG (modo observación): registra aviso pero NO bloquea
    process.env.PERMISSIONS_ENFORCE_MODULES = 'log';
    const apptLog = await apiRequest(baseUrl, `/api/appointments/${createdAppointmentId}/status`, {
      method: 'PATCH',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({ status: 'CONFIRMADA' }),
    });
    assert.equal(apptLog.status, 200, 'Con PERMISSIONS_ENFORCE_MODULES=log no debe bloquear');

    // 6. Activar bandera STRICT (PERMISSIONS_ENFORCE_MODULES=true)
    process.env.PERMISSIONS_ENFORCE_MODULES = 'true';

    // 6a. RECEPCION sin módulo "agenda" es bloqueada de inmediato SIN reiniciar sesión
    const apptDenied = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({
        branchId,
        patientId,
        odontologistId: doctorId,
        appointmentDate: '2026-12-11',
        startTime: '10:00',
        durationMin: 30,
      }),
    });
    assert.equal(apptDenied.status, 403);
    assert.equal(apptDenied.json.code, 'MODULE_ACCESS_DENIED');
    assert.deepEqual(apptDenied.json.requiredModules, ['agenda']);
    assert.match(apptDenied.json.error, /Agenda y Citas/i);

    const apptStatusDenied = await apiRequest(baseUrl, `/api/appointments/${createdAppointmentId}/status`, {
      method: 'PATCH',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({ status: 'EN_SALA' }),
    });
    assert.equal(apptStatusDenied.status, 403);
    assert.equal(apptStatusDenied.json.code, 'MODULE_ACCESS_DENIED');

    // 6b. Bloqueo también en POST /api/db/delta para colección "appointments"
    const deltaApptDenied = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({
        upserts: {
          appointments: [
            {
              id: '55555555-cccc-4ccc-8ccc-555555555555',
              organizationId: orgId,
              branchId,
              patientId,
              odontologistId: doctorId,
              appointmentDate: '2026-12-12',
              startTime: '11:00:00',
              endTime: '11:30:00',
              status: 'PENDIENTE',
            },
          ],
        },
      }),
    });
    assert.equal(deltaApptDenied.status, 403);
    assert.equal(deltaApptDenied.json.code, 'MODULE_ACCESS_DENIED');

    // 6c. Mientras tanto, RECEPCION sigue teniendo acceso normal a "patients" y a rutas base de sesión
    const patAllowed = await apiRequest(baseUrl, '/api/patients', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(patAllowed.status, 200);

    const sessionStillAlive = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(sessionStillAlive.status, 200);
    assert.equal(sessionStillAlive.json.valid, true);

    const dbStateStillAlive = await apiRequest(baseUrl, '/api/db/state', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(dbStateStillAlive.status, 200);

    // 6d. Volver a habilitar "agenda" en RECEPCION restaura el acceso de inmediato sin re-login
    const reEnableAgenda = await apiRequest(baseUrl, `/api/users/${recepId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['dashboard', 'agenda', 'patients', 'quotes', 'cash'],
        },
      }),
    });
    assert.equal(reEnableAgenda.status, 200);

    const apptRestored = await apiRequest(baseUrl, '/api/appointments', {
      method: 'POST',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({
        branchId,
        patientId,
        odontologistId: doctorId,
        appointmentDate: '2026-12-11',
        startTime: '10:00',
        durationMin: 30,
      }),
    });
    assert.equal(apptRestored.status, 201, 'Al rehabilitar el módulo agenda, el acceso vuelve de inmediato');

    // 7. Probar bloqueo en clinical, treatments y odontogram sobre ODONTOLOGO
    const restrictDoctor = await apiRequest(baseUrl, `/api/users/${doctorId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['dashboard', 'agenda', 'patients'],
        },
      }),
    });
    assert.equal(restrictDoctor.status, 200);

    const clinicalDenied = await apiRequest(baseUrl, '/api/clinical-records', {
      method: 'POST',
      cookie: loginDoctor.sidCookie,
      body: JSON.stringify({
        branchId,
        patientId,
        diagnosis: 'Caries simple',
        treatmentPerformed: 'Evaluación',
      }),
    });
    assert.equal(clinicalDenied.status, 403);
    assert.equal(clinicalDenied.json.code, 'MODULE_ACCESS_DENIED');

    const treatStatusDenied = await apiRequest(baseUrl, '/api/treatments/fake-treat-id/status', {
      method: 'PATCH',
      cookie: loginDoctor.sidCookie,
      body: JSON.stringify({ status: 'COMPLETADO' }),
    });
    assert.equal(treatStatusDenied.status, 403);
    assert.equal(treatStatusDenied.json.code, 'MODULE_ACCESS_DENIED');

    const deltaOdontogramDenied = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginDoctor.sidCookie,
      body: JSON.stringify({
        upserts: {
          odontograms: [
            {
              id: '66666666-cccc-4ccc-8ccc-666666666666',
              organizationId: orgId,
              branchId,
              patientId,
            },
          ],
        },
      }),
    });
    assert.equal(deltaOdontogramDenied.status, 403);
    assert.equal(deltaOdontogramDenied.json.code, 'MODULE_ACCESS_DENIED');

    // 8. Probar bloqueo en cash, quotes, staff-payroll, users y audit sobre ADMIN_ORGANIZACION
    const restrictAdminOrg = await apiRequest(baseUrl, `/api/users/${adminOrgId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['dashboard', 'patients'],
        },
      }),
    });
    assert.equal(restrictAdminOrg.status, 200);

    const cashOpenDenied = await apiRequest(baseUrl, '/api/cash-registers/open', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ branchId, openingAmount: 100000 }),
    });
    assert.equal(cashOpenDenied.status, 403);
    assert.equal(cashOpenDenied.json.code, 'MODULE_ACCESS_DENIED');

    const quoteApproveDenied = await apiRequest(baseUrl, '/api/quotes/fake-quote-id/approve', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ autoCreateTreatment: true }),
    });
    assert.equal(quoteApproveDenied.status, 403);
    assert.equal(quoteApproveDenied.json.code, 'MODULE_ACCESS_DENIED');

    const payrollDenied = await apiRequest(baseUrl, '/api/payroll/overview', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(payrollDenied.status, 403);
    assert.equal(payrollDenied.json.code, 'MODULE_ACCESS_DENIED');

    // /api/payroll/advisors sigue funcionando si tiene "patients" habilitado (para seleccionar asesor comercial en ficha de paciente)
    const advisorsAllowed = await apiRequest(baseUrl, '/api/payroll/advisors', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(advisorsAllowed.status, 200);

    const usersDenied = await apiRequest(baseUrl, '/api/users', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(usersDenied.status, 403);
    assert.equal(usersDenied.json.code, 'MODULE_ACCESS_DENIED');

    const auditDenied = await apiRequest(baseUrl, '/api/audit-logs', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(auditDenied.status, 403);
    assert.equal(auditDenied.json.code, 'MODULE_ACCESS_DENIED');

    // Registrar auditoría vía delta NO se bloquea aunque "audit" esté oculto
    const auditWriteAllowed = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({
        upserts: {
          auditLogs: [
            {
              id: '77777777-cccc-4ccc-8ccc-777777777777',
              organizationId: orgId,
              branchId,
              userId: adminOrgId,
              action: 'VIEW',
              entity: 'PATIENT',
              entityId: patientId,
              description: 'Consulta desde módulo pacientes habilitado',
              createdAt: new Date().toISOString(),
            },
          ],
        },
      }),
    });
    assert.equal(auditWriteAllowed.status, 200, 'Escritura en auditLogs nunca debe bloquearse por ocultar el visor audit');

    // 9. SUPER_ADMIN siempre pasa todas las rutas incluso con PERMISSIONS_ENFORCE_MODULES=true
    const superUsersOk = await apiRequest(baseUrl, '/api/users', {
      cookie: loginSuper.sidCookie,
    });
    assert.equal(superUsersOk.status, 200);

    const superAuditOk = await apiRequest(baseUrl, '/api/audit-logs', {
      cookie: loginSuper.sidCookie,
    });
    assert.equal(superAuditOk.status, 200);

    const superPayrollOk = await apiRequest(baseUrl, '/api/payroll/overview', {
      cookie: loginSuper.sidCookie,
    });
    assert.equal(superPayrollOk.status, 200);

    const healthOk = await apiRequest(baseUrl, '/api/health');
    assert.equal(healthOk.status, 200);
  } finally {
    if (prevFlag === undefined) {
      delete process.env.PERMISSIONS_ENFORCE_MODULES;
    } else {
      process.env.PERMISSIONS_ENFORCE_MODULES = prevFlag;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Regresión — RECEPCION con módulos quitados: /api/db/state, sesión, re-login, rol vacío [] y delta de roles', async () => {
  const prevFlag = process.env.PERMISSIONS_ENFORCE_MODULES;
  process.env.PERMISSIONS_ENFORCE_MODULES = 'true';

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');
  const { getUserEffectivePermissions } = await import('../src/security/rbacHierarchy.ts');
  const { hasModuleAccess } = await import('../src/security/moduleCatalog.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const state = getServerDbState();
    const orgId = state.data.organization.id;
    const branchId = state.data.branches[0].id;

    // 1. Verificar que roleObj.allowedNavTabs = [] (default PostgreSQL) NO pisa los defaults del rol
    const emptyRolePerms = getUserEffectivePermissions(
      { id: 'u-empty', roleId: 'RECEPCION', allowedNavTabs: [] },
      [{ id: 'RECEPCION', allowedNavTabs: [] }]
    );
    assert.ok(emptyRolePerms.allowedNavTabs.includes('dashboard'));
    assert.ok(emptyRolePerms.allowedNavTabs.includes('patients'));

    // 2. Verificar que hasModuleAccess respeta los módulos reducidos del usuario RECEPCION
    const restrictedSession = {
      role: 'RECEPCION',
      allowedNavTabs: ['dashboard', 'patients'],
    };
    const recepRoleObj = {
      id: 'RECEPCION',
      allowedNavTabs: ['dashboard', 'agenda', 'patients', 'quotes', 'cash'],
    };
    assert.equal(hasModuleAccess(restrictedSession, 'dashboard', recepRoleObj), true);
    assert.equal(hasModuleAccess(restrictedSession, 'patients', recepRoleObj), true);
    assert.equal(hasModuleAccess(restrictedSession, 'agenda', recepRoleObj), false);
    assert.equal(hasModuleAccess(restrictedSession, 'quotes', recepRoleObj), false);
    assert.equal(hasModuleAccess(restrictedSession, 'cash', recepRoleObj), false);
    assert.equal(hasModuleAccess(restrictedSession, 'treatments', recepRoleObj), false);

    // 3. Preparar usuarios y datos reales de agenda, presupuestos, caja y pacientes en el tenant
    const superPass = 'SuperPassReg#2026';
    const superHash = createPbkdf2Hash(superPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin);
    superAdmin.passwordHash = superHash.hash;
    superAdmin.passwordSalt = superHash.salt;
    superAdmin.passwordIterations = superHash.iterations;

    const recepPass = 'RecepPassReg#2026';
    const recepHash = createPbkdf2Hash(recepPass);
    const recepId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const doctorId = state.data.users.find((u: any) => u.roleId === 'ODONTOLOGO')?.id || superAdmin.id;
    const patientId = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';

    state.data.users.push({
      id: recepId,
      organizationId: orgId,
      roleId: 'RECEPCION',
      username: 'recep.regresion',
      firstName: 'Ana',
      lastName: 'Recepcionista',
      email: 'recep.regresion@odontopro.test',
      passwordHash: recepHash.hash,
      passwordSalt: recepHash.salt,
      passwordIterations: recepHash.iterations,
      status: 'ACTIVE',
      permissionsVersion: 1,
      customPermissions: [],
      revokedPermissions: [],
      assignedRestrictions: [],
      allowedNavTabs: [],
    });
    state.data.userBranches.push({ userId: recepId, branchId, isDefault: true });
    state.data.patients.push({
      id: patientId,
      organizationId: orgId,
      primaryBranchId: branchId,
      documentType: 'CI',
      documentNumber: '9988776',
      firstName: 'Carlos',
      lastName: 'Regresion',
      phone: '+595981999888',
      status: 'ACTIVE',
    });
    state.data.appointments.push({
      id: 'cccccccc-1111-4111-8111-cccccccccccc',
      organizationId: orgId,
      branchId,
      patientId,
      odontologistId: doctorId,
      appointmentDate: '2026-12-15',
      startTime: '09:00:00',
      endTime: '09:30:00',
      status: 'CONFIRMADA',
    });
    state.data.quotes.push({
      id: 'dddddddd-1111-4111-8111-dddddddddddd',
      organizationId: orgId,
      branchId,
      patientId,
      quoteNumber: 'P-REG-001',
      status: 'PENDIENTE',
      finalAmount: 250000,
    });
    state.data.cashRegisters.push({
      id: 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee',
      organizationId: orgId,
      branchId,
      status: 'OPEN',
      openingAmount: 100000,
    });
    state.data.payments.push({
      id: 'ffffffff-1111-4111-8111-ffffffffffff',
      organizationId: orgId,
      branchId,
      patientId,
      amount: 250000,
      status: 'COMPLETADO',
      paymentMethod: 'EFECTIVO',
    });

    // 4. Iniciar sesión como SUPER_ADMIN y como RECEPCION
    const loginSuper = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: superAdmin.email, password: superPass }),
    });
    assert.equal(loginSuper.status, 200);

    const loginRecepInitial = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.regresion@odontopro.test', password: recepPass }),
    });
    assert.equal(loginRecepInitial.status, 200);

    // 5. Quitar agenda, quotes y cash a la usuaria RECEPCION (dejar solo dashboard y patients)
    const updatePerms = await apiRequest(baseUrl, `/api/users/${recepId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['dashboard', 'patients'],
        },
      }),
    });
    assert.equal(updatePerms.status, 200);
    assert.deepEqual(updatePerms.json.user.allowedNavTabs, ['dashboard', 'patients']);

    // 6. Sesión ya abierta recibe allowedNavTabs actualizados inmediatamente
    const liveSession = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginRecepInitial.sidCookie,
    });
    assert.equal(liveSession.status, 200);
    assert.deepEqual(liveSession.json.session.allowedNavTabs, ['dashboard', 'patients']);

    // 7. Nuevo login con su usuario también recibe exactamente ['dashboard', 'patients']
    const freshLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.regresion@odontopro.test', password: recepPass }),
    });
    assert.equal(freshLogin.status, 200);
    assert.deepEqual(freshLogin.json.session.allowedNavTabs, ['dashboard', 'patients']);

    // 8. GET /api/db/state con PERMISSIONS_ENFORCE_MODULES=true oculta colecciones de módulos quitados
    const filteredStateRes = await apiRequest(baseUrl, '/api/db/state', {
      cookie: freshLogin.sidCookie,
    });
    assert.equal(filteredStateRes.status, 200);
    const filteredData = filteredStateRes.json.data;
    assert.equal(filteredData.appointments.length, 0, 'appointments debe venir vacío si se quitó agenda');
    assert.equal(filteredData.quotes.length, 0, 'quotes debe venir vacío si se quitó quotes');
    assert.equal(filteredData.quoteItems.length, 0, 'quoteItems debe venir vacío si se quitó quotes');
    assert.equal(filteredData.cashRegisters.length, 0, 'cashRegisters debe venir vacío si se quitó cash');
    assert.equal(filteredData.cashMovements.length, 0, 'cashMovements debe venir vacío si se quitó cash');
    assert.equal(filteredData.payments.length, 0, 'payments debe venir vacío si se quitó cash');
    assert.ok(
      filteredData.patients.some((p: any) => p.id === patientId),
      'patients debe permanecer visible porque el módulo patients sigue habilitado'
    );

    // 9. Con PERMISSIONS_ENFORCE_MODULES=false se mantiene compatibilidad retroactiva
    process.env.PERMISSIONS_ENFORCE_MODULES = 'false';
    const legacyStateRes = await apiRequest(baseUrl, '/api/db/state', {
      cookie: freshLogin.sidCookie,
    });
    assert.equal(legacyStateRes.status, 200);
    assert.ok(legacyStateRes.json.data.appointments.length >= 1, 'Con bandera apagada mantiene compatibilidad');
    assert.ok(legacyStateRes.json.data.quotes.length >= 1, 'Con bandera apagada mantiene compatibilidad');
    assert.ok(legacyStateRes.json.data.payments.length >= 1, 'Con bandera apagada mantiene compatibilidad');

    // 10. Actualizar el rol RECEPCION vía POST /api/db/delta normaliza aliases ('appointments' -> 'agenda')
    //     y sube permissionsVersion en usuarias del rol
    process.env.PERMISSIONS_ENFORCE_MODULES = 'true';
    const recepBefore = state.data.users.find((u: any) => u.id === recepId);
    const prevVersion = Number(recepBefore?.permissionsVersion || 1);
    const recepRole = state.data.roles.find((r: any) => r.id === 'RECEPCION');
    assert.ok(recepRole, 'Debe existir el rol RECEPCION');

    const roleDeltaRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        upserts: {
          roles: [
            {
              ...recepRole,
              allowedNavTabs: ['dashboard', 'appointments', 'patients'],
            },
          ],
        },
      }),
    });
    assert.equal(roleDeltaRes.status, 200);

    const updatedRole = getServerDbState().data.roles.find((r: any) => r.id === 'RECEPCION');
    assert.deepEqual(
      updatedRole.allowedNavTabs,
      ['dashboard', 'agenda', 'patients'],
      'Alias legacy appointments debe normalizarse a agenda al guardar el rol'
    );

    const recepAfter = getServerDbState().data.users.find((u: any) => u.id === recepId);
    assert.ok(
      Number(recepAfter.permissionsVersion) > prevVersion,
      'Actualizar un rol debe incrementar permissionsVersion de las usuarias de ese rol'
    );
  } finally {
    if (prevFlag === undefined) {
      delete process.env.PERMISSIONS_ENFORCE_MODULES;
    } else {
      process.env.PERMISSIONS_ENFORCE_MODULES = prevFlag;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

