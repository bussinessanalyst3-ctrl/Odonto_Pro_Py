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
  const setCookie = res.headers.get('set-cookie') || '';
  const sidMatch = setCookie.match(/odontopro_sid=([^;]+)/);
  return {
    status: res.status,
    headers: res.headers,
    setCookie,
    json,
    text,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

const TEST_TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-bloque3-auth-'));
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

test('Bloque 3 — Login auditado, cookies Partitioned, cambio de sucursal persistente, cambio/reset de contraseña, jerarquía RBAC, matriz de roles y privacidad clínica', async () => {
  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');
  const { MAX_FAILED_ATTEMPTS } = await import('../server/security.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const state = getServerDbState();
    const orgId = state.data.organization.id;
    const branch1 = state.data.branches[0];
    assert.ok(branch1, 'Debe existir al menos una sucursal principal');

    // Crear segunda sucursal de la misma clínica y una sucursal de otra organización
    const branch2Id = 'bbbb2222-3333-4444-8888-222222222222';
    const otherOrgId = 'oooo9999-3333-4444-8888-999999999999';
    const otherOrgBranchId = 'bbbb9999-3333-4444-8888-999999999999';

    state.data.branches.push(
      {
        ...branch1,
        id: branch2Id,
        code: 'SUC-02',
        name: 'Sucursal Villa Morra',
        isMain: false,
      },
      {
        ...branch1,
        id: otherOrgBranchId,
        organizationId: otherOrgId,
        code: 'EXT-01',
        name: 'Clínica Externa',
        isMain: true,
      }
    );

    // Preparar usuarios con contraseñas PBKDF2 conocidas
    const superPass = 'SuperPassB3#2026';
    const superHash = createPbkdf2Hash(superPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin, 'Debe existir SUPER_ADMIN');
    superAdmin.passwordHash = superHash.hash;
    superAdmin.passwordSalt = superHash.salt;
    superAdmin.passwordIterations = superHash.iterations;

    const userPass = 'ClinicUserB3#2026';
    const userHash = createPbkdf2Hash(userPass);

    const adminOrgId = '10000001-b3b3-4b3b-8b3b-111111111111';
    const adminSucId = '10000002-b3b3-4b3b-8b3b-222222222222';
    const supervisorId = '10000003-b3b3-4b3b-8b3b-333333333333';
    const recepBranch2Id = '10000004-b3b3-4b3b-8b3b-444444444444';
    const doctorRevokedId = '10000005-b3b3-4b3b-8b3b-555555555555';

    state.data.users.push(
      {
        id: adminOrgId,
        organizationId: orgId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.org.b3',
        firstName: 'Marta',
        lastName: 'Directora',
        email: 'admin.org.b3@odontopro.test',
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
        id: adminSucId,
        organizationId: orgId,
        roleId: 'ADMIN_SUCURSAL',
        username: 'admin.suc.b3',
        firstName: 'Carlos',
        lastName: 'JefeSucursal',
        email: 'admin.suc.b3@odontopro.test',
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
        id: supervisorId,
        organizationId: orgId,
        roleId: 'SUPERVISOR',
        username: 'supervisor.b3',
        firstName: 'Sofia',
        lastName: 'Supervisora',
        email: 'supervisor.b3@odontopro.test',
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
        id: recepBranch2Id,
        organizationId: orgId,
        roleId: 'RECEPCION',
        username: 'recep.suc2.b3',
        firstName: 'Ana',
        lastName: 'RecepSuc2',
        email: 'recep.suc2.b3@odontopro.test',
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
        id: doctorRevokedId,
        organizationId: orgId,
        roleId: 'ODONTOLOGO',
        username: 'doctor.revoked.b3',
        firstName: 'Diego',
        lastName: 'SinClinica',
        email: 'doctor.revoked.b3@odontopro.test',
        passwordHash: userHash.hash,
        passwordSalt: userHash.salt,
        passwordIterations: userHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: ['clinical.view'],
        assignedRestrictions: [],
        allowedNavTabs: [],
      }
    );

    // Asignaciones de sucursales:
    // - adminOrgId: branch1 y branch2
    // - adminSucId: solo branch1
    // - recepBranch2Id: solo branch2
    // - supervisorId y doctorRevokedId: branch1
    state.data.userBranches.push(
      { id: 'ub-b3-1', userId: adminOrgId, branchId: branch1.id, isDefault: true, createdAt: new Date().toISOString() },
      { id: 'ub-b3-2', userId: adminOrgId, branchId: branch2Id, isDefault: false, createdAt: new Date().toISOString() },
      { id: 'ub-b3-3', userId: adminSucId, branchId: branch1.id, isDefault: true, createdAt: new Date().toISOString() },
      { id: 'ub-b3-4', userId: recepBranch2Id, branchId: branch2Id, isDefault: true, createdAt: new Date().toISOString() },
      { id: 'ub-b3-5', userId: supervisorId, branchId: branch1.id, isDefault: true, createdAt: new Date().toISOString() },
      { id: 'ub-b3-6', userId: doctorRevokedId, branchId: branch1.id, isDefault: true, createdAt: new Date().toISOString() }
    );

    // Sembrar paciente, ficha clínica y odontograma para prueba de privacidad clínica
    const patId = 'pat-b3-0001-4444-8888-111111111111';
    state.data.patients.push({
      id: patId,
      organizationId: orgId,
      primaryBranchId: branch1.id,
      firstName: 'Elena',
      lastName: 'Confidencial',
      documentType: 'CI',
      documentNumber: '5123456',
      phone: '+595981999888',
      allergies: 'Penicilina severa',
      medicalConditions: 'Hipertensión arterial',
      currentMedications: 'Losartán 50mg',
      notes: 'Nota clínica privada',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.data.clinicalRecords.push({
      id: 'clin-b3-0001-4444-8888-111111111111',
      organizationId: orgId,
      branchId: branch1.id,
      patientId: patId,
      odontologistId: doctorRevokedId,
      date: '2026-01-15',
      chiefComplaint: 'Dolor molar 16',
      diagnosis: 'Pulpitis irreversible',
      createdAt: new Date().toISOString(),
    });
    state.data.odontograms.push({
      id: 'odon-b3-0001-4444-8888-111111111111',
      organizationId: orgId,
      branchId: branch1.id,
      patientId: patId,
      date: '2026-01-15',
      createdAt: new Date().toISOString(),
    });

    // =========================================================================
    // 1. Login con X-Forwarded-Proto: https -> cookie Partitioned + LOGIN_SUCCESS en auditoría
    // =========================================================================
    const loginSuper = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({ identifier: superAdmin.email, password: superPass }),
    });
    assert.equal(loginSuper.status, 200);
    assert.ok(loginSuper.sidCookie, 'Debe emitir cookie odontopro_sid');
    assert.match(loginSuper.setCookie, /HttpOnly/i);
    assert.match(loginSuper.setCookie, /SameSite=None/i);
    assert.match(loginSuper.setCookie, /Secure/i);
    assert.match(loginSuper.setCookie, /Partitioned/i);

    const loginSuccessAudit = state.data.auditLogs.find(
      (l: any) => l.action === 'LOGIN_SUCCESS' && l.userId === superAdmin.id
    );
    assert.ok(loginSuccessAudit, 'Login exitoso debe registrar evento LOGIN_SUCCESS en auditLogs');

    const loginAdminOrg = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.org.b3', password: userPass }),
    });
    assert.equal(loginAdminOrg.status, 200);

    const loginAdminSuc = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.suc.b3', password: userPass }),
    });
    assert.equal(loginAdminSuc.status, 200);

    const loginSupervisor = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'supervisor.b3', password: userPass }),
    });
    assert.equal(loginSupervisor.status, 200);

    const loginDoctorRevoked = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'doctor.revoked.b3', password: userPass }),
    });
    assert.equal(loginDoctorRevoked.status, 200);

    // =========================================================================
    // 2. Cambio de sucursal persistente + validación anti-IDOR
    // =========================================================================
    const switchOk = await apiRequest(baseUrl, '/api/auth/switch-branch', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ branchId: branch2Id }),
    });
    assert.equal(switchOk.status, 200);
    assert.equal(switchOk.json?.session?.currentBranchId, branch2Id);

    // Simular recarga F5: GET /api/auth/session debe conservar branch2Id
    const reloadedSession = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(reloadedSession.status, 200);
    assert.equal(reloadedSession.json?.session?.currentBranchId, branch2Id);

    const switchAudit = state.data.auditLogs.find(
      (l: any) => l.action === 'BRANCH_SWITCH' && l.userId === adminOrgId && l.branchId === branch2Id
    );
    assert.ok(switchAudit, 'Cambio de sucursal debe registrarse en auditLogs');

    // adminSucId NO tiene asignada branch2Id -> 403
    const switchUnassigned = await apiRequest(baseUrl, '/api/auth/switch-branch', {
      method: 'POST',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({ branchId: branch2Id }),
    });
    assert.equal(switchUnassigned.status, 403);

    // adminOrgId NO puede cambiar a una sucursal de otra clínica -> 403
    const switchOtherOrg = await apiRequest(baseUrl, '/api/auth/switch-branch', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ branchId: otherOrgBranchId }),
    });
    assert.equal(switchOtherOrg.status, 403);

    // =========================================================================
    // 3. Jerarquía RBAC y prevención de degradación de rol en /api/db/delta y adminRoutes
    // =========================================================================
    // adminSucId intenta degradar a adminOrgId (rango superior) enviando roleId: 'RECEPCION' -> 403
    const downgradeHigher = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              id: adminOrgId,
              organizationId: orgId,
              roleId: 'RECEPCION',
              firstName: 'Marta',
              lastName: 'Degradada',
            },
          ],
        },
      }),
    });
    assert.equal(downgradeHigher.status, 403);
    assert.equal(
      state.data.users.find((u: any) => u.id === adminOrgId)?.roleId,
      'ADMIN_ORGANIZACION',
      'El rol del ADMIN_ORGANIZACION no debe alterarse'
    );

    // adminOrgId intenta modificar a SUPER_ADMIN enviando roleId: 'RECEPCION' -> 403
    const touchSuperAdmin = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              id: superAdmin.id,
              organizationId: orgId,
              roleId: 'RECEPCION',
              status: 'SUSPENDED',
            },
          ],
        },
      }),
    });
    assert.equal(touchSuperAdmin.status, 403);
    assert.equal(superAdmin.roleId, 'SUPER_ADMIN');
    assert.equal(superAdmin.status, 'ACTIVE');

    // adminSucId (solo branch1) intenta editar o resetear contraseña o revocar sesiones de recepBranch2Id (solo branch2) -> 403
    const crossBranchDelta = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              id: recepBranch2Id,
              organizationId: orgId,
              roleId: 'RECEPCION',
              firstName: 'Modificada',
            },
          ],
        },
      }),
    });
    assert.equal(crossBranchDelta.status, 403);

    const crossBranchReset = await apiRequest(baseUrl, `/api/users/${recepBranch2Id}/reset-password`, {
      method: 'POST',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({ newPassword: 'TempReset#2026' }),
    });
    assert.equal(crossBranchReset.status, 403);

    const crossBranchRevoke = await apiRequest(baseUrl, `/api/users/${recepBranch2Id}/revoke-sessions`, {
      method: 'POST',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({}),
    });
    assert.equal(crossBranchRevoke.status, 403);

    // =========================================================================
    // 4. Matriz autoritativa de roles (PUT /api/roles/:roleId/permissions) y propagación en vivo
    // =========================================================================
    // ADMIN_ORGANIZACION no puede editar roles globales -> 403
    const roleEditDeniedOrg = await apiRequest(baseUrl, '/api/roles/SUPERVISOR/permissions', {
      method: 'PUT',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ permissions: ['dashboard.view'] }),
    });
    assert.equal(roleEditDeniedOrg.status, 403);

    // SUPER_ADMIN tampoco puede alterar el rol inmutable SUPER_ADMIN -> 403
    const roleEditDeniedSuper = await apiRequest(baseUrl, '/api/roles/SUPER_ADMIN/permissions', {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({ permissions: ['dashboard.view'] }),
    });
    assert.equal(roleEditDeniedSuper.status, 403);

    // Antes del cambio, SUPERVISOR tiene users.view -> GET /api/users devuelve 200
    const supUsersBefore = await apiRequest(baseUrl, '/api/users', {
      cookie: loginSupervisor.sidCookie,
    });
    assert.equal(supUsersBefore.status, 200);

    const supVersionBefore = state.data.users.find((u: any) => u.id === supervisorId)?.permissionsVersion || 1;
    const supRoleObj = state.data.roles.find((r: any) => r.id === 'SUPERVISOR');
    assert.ok(supRoleObj);
    const permsWithoutUsersView = (supRoleObj.permissions || []).filter((p: string) => p !== 'users.view');

    // SUPER_ADMIN quita users.view al rol SUPERVISOR
    const roleUpdateOk = await apiRequest(baseUrl, '/api/roles/SUPERVISOR/permissions', {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({ permissions: permsWithoutUsersView }),
    });
    assert.equal(roleUpdateOk.status, 200);
    assert.equal(roleUpdateOk.json?.success, true);
    assert.ok(roleUpdateOk.json?.affectedUsersCount >= 1);

    // Verificar incremento de permissionsVersion sin cerrar sesión
    const supPermVerRes = await apiRequest(baseUrl, '/api/auth/permissions-version', {
      cookie: loginSupervisor.sidCookie,
    });
    assert.equal(supPermVerRes.status, 200);
    assert.equal(supPermVerRes.json?.permissionsVersion, supVersionBefore + 1);

    // Ahora GET /api/users para SUPERVISOR debe fallar inmediatamente con 403 (RBAC dinámico)
    const supUsersAfterRevoke = await apiRequest(baseUrl, '/api/users', {
      cookie: loginSupervisor.sidCookie,
    });
    assert.equal(supUsersAfterRevoke.status, 403);

    // Restablecer defaults del rol SUPERVISOR
    const roleResetOk = await apiRequest(baseUrl, '/api/roles/SUPERVISOR/permissions', {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({ resetToDefaults: true }),
    });
    assert.equal(roleResetOk.status, 200);

    const roleResetAudit = state.data.auditLogs.find(
      (l: any) => l.action === 'ROLE_PERMISSIONS_RESET' && l.entityId === 'SUPERVISOR'
    );
    assert.ok(roleResetAudit, 'Restablecimiento de rol debe auditarse');

    // SUPERVISOR recupera acceso inmediato a GET /api/users -> 200
    const supUsersAfterReset = await apiRequest(baseUrl, '/api/users', {
      cookie: loginSupervisor.sidCookie,
    });
    assert.equal(supUsersAfterReset.status, 200);

    // =========================================================================
    // 5. Privacidad clínica: revocar clinical.view a un ODONTOLOGO oculta fichas/odontogramas/alergias
    // =========================================================================
    const docStateRes = await apiRequest(baseUrl, '/api/db/state', {
      cookie: loginDoctorRevoked.sidCookie,
    });
    assert.equal(docStateRes.status, 200);
    assert.equal((docStateRes.json?.data?.clinicalRecords || []).length, 0);
    assert.equal((docStateRes.json?.data?.odontograms || []).length, 0);
    const patForRevokedDoc = (docStateRes.json?.data?.patients || []).find((p: any) => p.id === patId);
    assert.ok(patForRevokedDoc, 'El paciente base sigue visible para gestión administrativa');
    assert.equal(patForRevokedDoc.allergies, 'Confidencial (Solo personal clínico)');
    assert.equal(patForRevokedDoc.medicalConditions, 'Confidencial');

    // =========================================================================
    // 6. Cambio de contraseña: misma contraseña rechazada + cierre de otras sesiones
    // =========================================================================
    // Abrir segunda sesión para adminOrgId antes de cambiar su contraseña
    const loginAdminOrgSecond = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.org.b3', password: userPass }),
    });
    assert.equal(loginAdminOrgSecond.status, 200);

    // Misma contraseña -> 400
    const samePassRes = await apiRequest(baseUrl, '/api/auth/change-password', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ currentPassword: userPass, newPassword: userPass }),
    });
    assert.equal(samePassRes.status, 400);

    // Nueva contraseña válida -> 200, cierra la segunda sesión, mantiene la actual activa
    const newOrgPass = 'NewAdminOrgB3#2026';
    const changePassOk = await apiRequest(baseUrl, '/api/auth/change-password', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ currentPassword: userPass, newPassword: newOrgPass }),
    });
    assert.equal(changePassOk.status, 200);

    const currentStillValid = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginAdminOrg.sidCookie,
    });
    assert.equal(currentStillValid.status, 200);

    const secondInvalidated = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginAdminOrgSecond.sidCookie,
    });
    assert.equal(secondInvalidated.status, 401);

    // =========================================================================
    // 7. Protección contra origen externo vía Referer cuando Origin no está presente
    // =========================================================================
    const badRefererRes = await apiRequest(baseUrl, '/api/auth/switch-branch', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      headers: { Referer: 'https://sitio-externo-no-autorizado.example/form' },
      body: JSON.stringify({ branchId: branch1.id }),
    });
    assert.equal(badRefererRes.status, 403);

    // =========================================================================
    // 8. Límite de intentos en /api/auth/reset-password contra fuerza bruta de tokens
    // =========================================================================
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      const badTokenRes = await apiRequest(baseUrl, '/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          resetToken: `rst_invalido_${i}`,
          newPassword: 'ResetAttempt#2026',
        }),
      });
      assert.equal(badTokenRes.status, 400);
    }
    const lockedResetRes = await apiRequest(baseUrl, '/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        resetToken: 'rst_invalido_bloqueado',
        newPassword: 'ResetAttempt#2026',
      }),
    });
    assert.equal(lockedResetRes.status, 429);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
