import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  buildSnapshotFromData,
  compareSnapshots,
} from '../scripts/snapshot-permissions.ts';

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

test('Etapa A — Persistencia real de permisos, replicación rápida sin cerrar sesión y seguridad RBAC', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-etapa-a-'));
  process.env.DATA_DIR = tmpDir;
  process.env.NODE_ENV = 'production';

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState, DB_FILE } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');
  const { buildSafeSessionPayload, activeServerSessions } = await import('../server/security.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const state = getServerDbState();
    const orgId = state.data.organization.id;
    const branchId = state.data.branches[0].id;

    // 1. Preparar SUPER_ADMIN
    const superPass = 'SuperPass#2026';
    const superHash = createPbkdf2Hash(superPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin, 'Debe existir un usuario SUPER_ADMIN');
    superAdmin.passwordHash = superHash.hash;
    superAdmin.passwordSalt = superHash.salt;
    superAdmin.passwordIterations = superHash.iterations;

    // 2. Preparar ADMIN_ORGANIZACION, ADMIN_SUCURSAL y RECEPCION (con allowedNavTabs: [] para probar herencia)
    const commonPass = 'ClinicUser#2026';
    const commonHash = createPbkdf2Hash(commonPass);

    const adminOrgId = 'aaaaaaaa-1111-4111-8111-111111111111';
    const adminSucId = 'bbbbbbbb-2222-4222-8222-222222222222';
    const recepcionId = 'cccccccc-3333-4333-8333-333333333333';

    state.data.users.push(
      {
        id: adminOrgId,
        organizationId: orgId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.org.a',
        firstName: 'Ana',
        lastName: 'OrgAdmin',
        email: 'admin.org.a@odontopro.test',
        passwordHash: commonHash.hash,
        passwordSalt: commonHash.salt,
        passwordIterations: commonHash.iterations,
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
        username: 'admin.suc.a',
        firstName: 'Bruno',
        lastName: 'SucAdmin',
        email: 'admin.suc.a@odontopro.test',
        passwordHash: commonHash.hash,
        passwordSalt: commonHash.salt,
        passwordIterations: commonHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: [],
        assignedRestrictions: [],
        allowedNavTabs: [],
      },
      {
        id: recepcionId,
        organizationId: orgId,
        roleId: 'RECEPCION',
        username: 'recep.a',
        firstName: 'Carla',
        lastName: 'Recepcion',
        email: 'recep.a@odontopro.test',
        passwordHash: commonHash.hash,
        passwordSalt: commonHash.salt,
        passwordIterations: commonHash.iterations,
        status: 'ACTIVE',
        permissionsVersion: 1,
        customPermissions: [],
        revokedPermissions: [],
        assignedRestrictions: [],
        allowedNavTabs: [], // Bug anterior: [] devolvía vacío en vez de heredar del rol
      }
    );

    state.data.userBranches.push(
      { userId: adminOrgId, branchId, isDefault: true },
      { userId: adminSucId, branchId, isDefault: true },
      { userId: recepcionId, branchId, isDefault: true }
    );

    // 3. Crear otra empresa con un usuario para confirmar que SUPER_ADMIN puede gestionar usuarios multi-empresa
    const otherOrgId = 'dddddddd-4444-4444-8444-444444444444';
    const otherBranchId = 'eeeeeeee-5555-4555-8555-555555555555';
    const otherUserId = 'ffffffff-6666-4666-8666-666666666666';
    state.organizationsList.push({
      id: otherOrgId,
      code: 'CLI-OTRA-01',
      name: 'Clínica Remota',
      legalName: 'Clínica Remota S.A.',
      taxId: '80099988-1',
      countryCode: 'PRY',
      defaultCurrency: 'PYG',
      timezone: 'America/Asuncion',
      status: 'ACTIVE',
    });
    state.data.branches.push({
      id: otherBranchId,
      organizationId: otherOrgId,
      code: 'SUC-01',
      name: 'Central Remota',
      status: 'ACTIVE',
    });
    state.data.users.push({
      id: otherUserId,
      organizationId: otherOrgId,
      roleId: 'ODONTOLOGO',
      username: 'dr.remoto',
      firstName: 'Diego',
      lastName: 'Remoto',
      email: 'dr.remoto@clinicaremot.test',
      passwordHash: commonHash.hash,
      passwordSalt: commonHash.salt,
      passwordIterations: commonHash.iterations,
      status: 'ACTIVE',
      permissionsVersion: 1,
      allowedNavTabs: [],
    });
    state.data.userBranches.push({ userId: otherUserId, branchId: otherBranchId, isDefault: true });

    // 4. Probar fix en buildSafeSessionPayload: allowedNavTabs = [] hereda del rol y expone effectivePermissions
    const recepcionUser = state.data.users.find((u: any) => u.id === recepcionId);
    const recepRole = (state.data.roles || []).find((r: any) => r.id === 'RECEPCION');
    const nowIso = new Date().toISOString();
    const expIso = new Date(Date.now() + 3600 * 1000).toISOString();

    // 4a. Con el rol real RECEPCION (con allowedNavTabs definidos), user.allowedNavTabs = [] hereda los módulos del rol (no devuelve [])
    const payloadInheritedRole = buildSafeSessionPayload(recepcionUser, 'test-token', nowIso, expIso);
    assert.ok(
      Array.isArray(payloadInheritedRole.allowedNavTabs) && payloadInheritedRole.allowedNavTabs.length > 0,
      'allowedNavTabs [] en el usuario debe heredar los módulos del rol (no devolver arreglo vacío)'
    );
    assert.deepEqual(payloadInheritedRole.allowedNavTabs, recepRole?.allowedNavTabs);
    assert.ok(
      Array.isArray(payloadInheritedRole.effectivePermissions) && payloadInheritedRole.effectivePermissions.length > 0,
      'buildSafeSessionPayload debe incluir effectivePermissions'
    );

    // 4b. Si un rol en PostgreSQL aún tiene allowed_nav_tabs = [] (recién migrado con DEFAULT '[]'), devuelve undefined para caer al fallback por rol sin pérdida de acceso
    const prevRecepRoleTabs = recepRole?.allowedNavTabs;
    if (recepRole) {
      recepRole.allowedNavTabs = [];
    }
    const payloadEmptyRoleFallback = buildSafeSessionPayload(recepcionUser, 'test-token', nowIso, expIso);
    assert.equal(
      payloadEmptyRoleFallback.allowedNavTabs,
      undefined,
      'Con allowedNavTabs [] en usuario y rol recién migrado, debe devolver undefined para preservar acceso del rol'
    );
    if (recepRole) {
      recepRole.allowedNavTabs = prevRecepRoleTabs;
    }

    // 5. Iniciar sesiones (SUPER_ADMIN, ADMIN_ORGANIZACION, ADMIN_SUCURSAL, RECEPCION)
    const loginSuper = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: superAdmin.email, password: superPass }),
    });
    assert.equal(loginSuper.status, 200);
    assert.ok(loginSuper.sidCookie);

    const loginAdminOrg = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.org.a@odontopro.test', password: commonPass }),
    });
    assert.equal(loginAdminOrg.status, 200);

    const loginAdminSuc = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.suc.a@odontopro.test', password: commonPass }),
    });
    assert.equal(loginAdminSuc.status, 200);

    const loginRecep = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'recep.a@odontopro.test', password: commonPass }),
    });
    assert.equal(loginRecep.status, 200);
    assert.equal(loginRecep.json.session.permissionsVersion, 1);

    // 6. Reglas de seguridad: ADMIN_ORGANIZACION y ADMIN_SUCURSAL NO pueden editar permisos (403)
    const adminOrgAttempt = await apiRequest(baseUrl, `/api/users/${recepcionId}/permissions`, {
      method: 'PUT',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({ overrides: { allowedNavTabs: ['dashboard', 'agenda'] } }),
    });
    assert.equal(adminOrgAttempt.status, 403, 'ADMIN_ORGANIZACION debe recibir 403');

    const adminSucAttempt = await apiRequest(baseUrl, `/api/users/${recepcionId}/permissions`, {
      method: 'PUT',
      cookie: loginAdminSuc.sidCookie,
      body: JSON.stringify({ overrides: { allowedNavTabs: ['dashboard', 'agenda'] } }),
    });
    assert.equal(adminSucAttempt.status, 403, 'ADMIN_SUCURSAL debe recibir 403');

    // 7. Nadie puede editar sus propios permisos (403)
    const selfEditAttempt = await apiRequest(baseUrl, `/api/users/${superAdmin.id}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({ overrides: { allowedNavTabs: ['dashboard'] } }),
    });
    assert.equal(selfEditAttempt.status, 403, 'SUPER_ADMIN no puede editar sus propios permisos');

    // 8. No se pueden asignar módulos inexistentes / no poseídos (403)
    const invalidModuleAttempt = await apiRequest(baseUrl, `/api/users/${recepcionId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({ overrides: { allowedNavTabs: ['dashboard', 'modulo_inventado_xyz'] } }),
    });
    assert.equal(invalidModuleAttempt.status, 403, 'Módulo no poseído debe rechazarse con 403');

    // 9. Consulta inicial de versión de permisos para RECEPCION
    const versionBefore = await apiRequest(baseUrl, '/api/auth/permissions-version', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(versionBefore.status, 200);
    assert.equal(versionBefore.json.valid, true);
    assert.equal(versionBefore.json.permissionsVersion, 1);
    assert.match(String(versionBefore.headers.get('cache-control') || ''), /no-store/i);

    // 10. SUPER_ADMIN guarda cambios de permisos para RECEPCION (quita 'agenda', agrega 'cash')
    const newNavTabs = ['dashboard', 'patients', 'cash'];
    const updateRes = await apiRequest(baseUrl, `/api/users/${recepcionId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          customPermissions: ['cash.view'],
          revokedPermissions: ['appointments.view'],
          assignedRestrictions: [],
          allowedNavTabs: newNavTabs,
        },
      }),
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.json.success, true);
    assert.equal(updateRes.json.permissionsVersion, 2);
    assert.deepEqual(updateRes.json.user.allowedNavTabs, newNavTabs);
    assert.ok(updateRes.json.auditLog, 'Debe devolver registro de auditoría');
    assert.equal(updateRes.json.auditLog.action, 'USER_PERMISSIONS_OVERRIDE');
    assert.ok(updateRes.json.auditLog.oldValues && updateRes.json.auditLog.newValues, 'Auditoría debe incluir antes y después');

    // 11. Verificar que la sesión activa de RECEPCION NO se cerró y su permissionsVersion se actualizó en activeServerSessions
    const recepSessions = Array.from(activeServerSessions.values()).filter((s) => s.userId === recepcionId);
    assert.ok(recepSessions.length >= 1, 'La sesión activa del usuario no debe cerrarse');
    assert.equal(recepSessions[0].permissionsVersion, 2, 'activeServerSessions debe reflejar v2');

    // 12. RECEPCION consulta /api/auth/permissions-version y luego /api/auth/session SIN volver a loguearse
    const versionAfter = await apiRequest(baseUrl, '/api/auth/permissions-version', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(versionAfter.status, 200);
    assert.equal(versionAfter.json.permissionsVersion, 2);

    const sessionAfter = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: loginRecep.sidCookie,
    });
    assert.equal(sessionAfter.status, 200);
    assert.equal(sessionAfter.json.valid, true);
    assert.equal(sessionAfter.json.session.permissionsVersion, 2);
    assert.deepEqual(sessionAfter.json.session.allowedNavTabs, newNavTabs);
    assert.ok(sessionAfter.json.session.effectivePermissions.includes('cash.view'));
    assert.ok(!sessionAfter.json.session.effectivePermissions.includes('appointments.view'));

    // 13. Verificar persistencia real en archivo de respaldo (equivalente a sobrevivir reinicio)
    assert.ok(fs.existsSync(DB_FILE), 'Debe persistir el archivo db_store.json');
    const persistedRaw = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const persistedRecep = persistedRaw.data.users.find((u: any) => u.id === recepcionId);
    assert.ok(persistedRecep);
    assert.equal(persistedRecep.permissionsVersion, 2);
    assert.deepEqual(persistedRecep.allowedNavTabs, newNavTabs);
    assert.deepEqual(persistedRecep.customPermissions, ['cash.view']);
    assert.deepEqual(persistedRecep.revokedPermissions, ['appointments.view']);

    // 14. SUPER_ADMIN puede gestionar permisos de usuarios en otra organización
    const crossOrgRes = await apiRequest(baseUrl, `/api/users/${otherUserId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          customPermissions: [],
          revokedPermissions: [],
          assignedRestrictions: [],
          allowedNavTabs: ['dashboard', 'agenda', 'patients', 'quotes'],
        },
      }),
    });
    assert.equal(crossOrgRes.status, 200, 'SUPER_ADMIN debe poder gestionar usuarios de cualquier empresa');
    assert.equal(crossOrgRes.json.permissionsVersion, 2);

    // 15. Cierre del bypass en POST /api/db/delta
    const deltaBypassRecep = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginRecep.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              ...persistedRecep,
              allowedNavTabs: ['dashboard', 'users', 'audit', 'organization'],
              customPermissions: ['system.all'],
            },
          ],
        },
      }),
    });
    assert.equal(deltaBypassRecep.status, 403, 'RECEPCION sin permiso sobre users debe ser bloqueada con 403 en delta');
    const recepAfterSelfDelta = getServerDbState().data.users.find((u: any) => u.id === recepcionId);
    assert.deepEqual(recepAfterSelfDelta.allowedNavTabs, newNavTabs, 'allowedNavTabs de RECEPCION permanece intacto');
    assert.deepEqual(recepAfterSelfDelta.customPermissions, ['cash.view'], 'customPermissions de RECEPCION permanece intacto');

    // Incluso un ADMIN_ORGANIZACION con permiso sobre users no puede escalar sus propios permisos vía delta
    const adminOrgRecord = getServerDbState().data.users.find((u: any) => u.id === adminOrgId);
    const deltaBypassAdminSelf = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              ...adminOrgRecord,
              allowedNavTabs: ['dashboard', 'organization', 'audit'],
              customPermissions: ['system.all'],
            },
          ],
        },
      }),
    });
    assert.ok([200, 403].includes(deltaBypassAdminSelf.status));
    const adminOrgAfterDelta = getServerDbState().data.users.find((u: any) => u.id === adminOrgId);
    assert.deepEqual(adminOrgAfterDelta.allowedNavTabs, [], 'Auto-edición vía delta no puede alterar allowedNavTabs propios');
    assert.deepEqual(adminOrgAfterDelta.customPermissions, [], 'Auto-edición vía delta no puede escalar customPermissions propios');

    const deltaBypassOther = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: loginAdminOrg.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              ...persistedRecep,
              allowedNavTabs: ['dashboard', 'users'],
            },
          ],
        },
      }),
    });
    assert.equal(
      deltaBypassOther.status,
      403,
      'Modificar permisos de otro usuario vía POST /api/db/delta debe rechazarse con 403'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Etapa A — Snapshot de permisos detecta diferencias y migración 202611230005 es estrictamente aditiva', () => {
  const roles = [
    { id: 'RECEPCION', permissions: ['appointments.view', 'patients.view'], allowedNavTabs: ['dashboard', 'agenda', 'patients'] },
  ];
  const usersBefore = [
    { id: 'u-1', email: 'carla@clinica.test', roleId: 'RECEPCION', status: 'ACTIVE', allowedNavTabs: [] },
  ];
  const usersSame = [
    { id: 'u-1', email: 'carla@clinica.test', roleId: 'RECEPCION', status: 'ACTIVE', allowedNavTabs: [] },
  ];
  const usersChanged = [
    {
      id: 'u-1',
      email: 'carla@clinica.test',
      roleId: 'RECEPCION',
      status: 'ACTIVE',
      allowedNavTabs: ['dashboard', 'cash'],
      revokedPermissions: ['appointments.view'],
      customPermissions: ['cash.view'],
    },
  ];

  const baseSnap = buildSnapshotFromData('local-db-store', usersBefore, roles);
  const sameSnap = buildSnapshotFromData('local-db-store', usersSame, roles);
  const changedSnap = buildSnapshotFromData('local-db-store', usersChanged, roles);

  assert.equal(compareSnapshots(baseSnap, sameSnap).length, 0);

  const diffs = compareSnapshots(baseSnap, changedSnap);
  assert.equal(diffs.length, 1);
  assert.deepEqual(diffs[0].addedModules, ['cash']);
  assert.deepEqual(diffs[0].lostModules, ['agenda', 'patients']);
  assert.deepEqual(diffs[0].addedPermissions, ['cash.view']);
  assert.deepEqual(diffs[0].lostPermissions, ['appointments.view']);

  // Verificar que la migración SQL 202611230005 es estrictamente aditiva
  const migPath = path.resolve(process.cwd(), 'supabase/migrations/202611230005_user_permissions_columns.sql');
  assert.ok(fs.existsSync(migPath), 'Debe existir la migración 202611230005_user_permissions_columns.sql');
  const sql = fs.readFileSync(migPath, 'utf-8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS permissions_version/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS custom_permissions/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS revoked_permissions/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS assigned_restrictions/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS allowed_nav_tabs/i);
  assert.doesNotMatch(sql, /\bDROP\b|\bTRUNCATE\b|\bDELETE\b/i, 'La migración aditiva no debe contener DROP/TRUNCATE/DELETE');
});
