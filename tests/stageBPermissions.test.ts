import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  ALL_SYSTEM_MODULE_IDS,
  MODULE_GROUPS,
  SYSTEM_MODULES,
  buildCopyPermissionsDraft,
  getFirstAllowedModule,
  getRoleDefaultModules,
  hasModuleAccess,
  moduleSetsEqual,
  normalizeModuleId,
  normalizeModuleList,
  resolveUserEffectiveModules,
} from '../src/security/moduleCatalog.ts';
import { BASE_ROLES } from '../src/db/seeds/paraguay-catalogs.ts';

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
    json,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

test('Etapa B — Catálogo único de módulos (moduleCatalog.ts): integridad, alias históricos y herencia de roles', () => {
  const groupIds = new Set(MODULE_GROUPS.map((g) => g.id));
  const seenIds = new Set<string>();

  assert.equal(SYSTEM_MODULES.length, 13, 'Debe registrar los 13 módulos canónicos de ODONTOPRO');
  for (const mod of SYSTEM_MODULES) {
    assert.ok(!seenIds.has(mod.id), `ID duplicado en SYSTEM_MODULES: ${mod.id}`);
    seenIds.add(mod.id);
    assert.ok(groupIds.has(mod.groupId), `Grupo inválido para ${mod.id}: ${mod.groupId}`);
    assert.ok(mod.label.trim().length > 0);
    assert.ok(mod.description.trim().length > 0);
  }

  // Alias histórico appointments -> agenda
  assert.equal(normalizeModuleId('appointments'), 'agenda');
  assert.equal(normalizeModuleId('agenda'), 'agenda');
  assert.equal(normalizeModuleId('modulo_desconocido'), null);
  assert.deepEqual(
    normalizeModuleList(['appointments', 'dashboard', 'agenda', 'roadmap', 'patients']),
    ['dashboard', 'agenda', 'patients']
  );

  // Compatibilidad con BASE_ROLES: RECEPCION con 'appointments' hereda 'agenda' sin perder acceso
  const recepRole = BASE_ROLES.find((r) => r.id === 'RECEPCION');
  const recepDefaults = getRoleDefaultModules(recepRole, 'RECEPCION');
  assert.ok(recepDefaults.includes('agenda'), 'RECEPCION debe resolver appointments como agenda');
  assert.ok(recepDefaults.includes('patients'));
  assert.ok(recepDefaults.includes('cash'));

  // Usuario sin overrides (allowedNavTabs: []) -> 0 ajustes individuales
  const recepUserBase = { id: 'u-recep', roleId: 'RECEPCION', allowedNavTabs: [] };
  const baseRes = resolveUserEffectiveModules(recepUserBase, BASE_ROLES);
  assert.equal(baseRes.hasIndividualOverride, false);
  assert.deepEqual(baseRes.addedModules, []);
  assert.deepEqual(baseRes.removedModules, []);
  assert.deepEqual(baseRes.effectiveModules, recepDefaults);

  // Usuario con ajuste individual (+audit, -cash) -> distingue claramente rol vs ajuste individual
  const recepUserCustom = {
    id: 'u-recep',
    roleId: 'RECEPCION',
    allowedNavTabs: ['dashboard', 'agenda', 'patients', 'quotes', 'audit'],
  };
  const customRes = resolveUserEffectiveModules(recepUserCustom, BASE_ROLES);
  assert.equal(customRes.hasIndividualOverride, true);
  assert.deepEqual(customRes.addedModules, ['audit']);
  assert.deepEqual(customRes.removedModules, ['cash']);

  // hasModuleAccess y getFirstAllowedModule soportan alias histórico 'appointments'
  assert.equal(
    hasModuleAccess({ role: 'RECEPCION', allowedNavTabs: ['appointments', 'patients'] }, 'agenda', recepRole),
    true
  );
  assert.equal(
    getFirstAllowedModule({ role: 'RECEPCION', allowedNavTabs: ['appointments'] }, recepRole),
    'agenda'
  );

  // Verificar que Sidebar, Header y UserPermissionsModal consumen moduleCatalog.ts (fuente única)
  const sidebarSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf-8');
  const headerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Header.tsx'), 'utf-8');
  const modalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/users/UserPermissionsModal.tsx'), 'utf-8');
  assert.match(sidebarSrc, /moduleCatalog\.ts/);
  assert.match(headerSrc, /moduleCatalog\.ts/);
  assert.match(modalSrc, /moduleCatalog\.ts/);
  assert.match(modalSrc, /Habilitar todos/);
  assert.match(modalSrc, /Restablecer al rol/);
  assert.match(modalSrc, /Copiar de otro usuario/);
});

test('Etapa B — Copiar permisos de otro usuario respeta estrictamente lo que posee el actor', () => {
  const sourceUser = {
    id: 'u-source',
    roleId: 'ODONTOLOGO',
    allowedNavTabs: ['dashboard', 'agenda', 'patients', 'odontogram', 'organization'],
    customPermissions: ['cash.view', 'organization.manage'],
    revokedPermissions: ['patients.delete'],
    assignedRestrictions: ['rest_block_financial_void'],
  };

  // Caso 1: SUPER_ADMIN posee todos los módulos y permisos
  const superDraft = buildCopyPermissionsDraft({
    sourceUser,
    roles: BASE_ROLES,
    actorAllowedModules: new Set(ALL_SYSTEM_MODULE_IDS),
    actorEffectivePermissions: new Set(['system.all']),
    actorHasAllPermissions: true,
  });
  assert.deepEqual(superDraft.allowedNavTabs, ['dashboard', 'agenda', 'patients', 'odontogram', 'organization']);
  assert.deepEqual(superDraft.customPermissions, ['cash.view', 'organization.manage']);
  assert.deepEqual(superDraft.revokedPermissions, ['patients.delete']);
  assert.deepEqual(superDraft.assignedRestrictions, ['rest_block_financial_void']);
  assert.deepEqual(superDraft.skippedModules, []);

  // Caso 2: Actor restringido no puede copiar módulos ni permisos que no posee
  const limitedDraft = buildCopyPermissionsDraft({
    sourceUser,
    roles: BASE_ROLES,
    actorAllowedModules: new Set(['dashboard', 'agenda', 'patients']),
    actorEffectivePermissions: new Set(['cash.view']),
    actorHasAllPermissions: false,
  });
  assert.deepEqual(limitedDraft.allowedNavTabs, ['dashboard', 'agenda', 'patients']);
  assert.deepEqual(limitedDraft.skippedModules, ['odontogram', 'organization']);
  assert.deepEqual(limitedDraft.customPermissions, ['cash.view']);
});

test('Etapa B — E2E: normalización de alias y restablecimiento limpio al rol (allowedNavTabs: []) vía PUT /api/users/:id/permissions', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-etapa-b-'));
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

    const superPass = 'SuperStageB#2026';
    const superHash = createPbkdf2Hash(superPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin);
    superAdmin.passwordHash = superHash.hash;
    superAdmin.passwordSalt = superHash.salt;
    superAdmin.passwordIterations = superHash.iterations;

    const targetId = '22222222-bbbb-4bbb-8bbb-222222222222';
    const targetHash = createPbkdf2Hash('TargetPass#2026');
    state.data.users.push({
      id: targetId,
      organizationId: orgId,
      roleId: 'RECEPCION',
      username: 'recep.b',
      firstName: 'Lucía',
      lastName: 'Recepción',
      email: 'recep.b@odontopro.test',
      passwordHash: targetHash.hash,
      passwordSalt: targetHash.salt,
      passwordIterations: targetHash.iterations,
      status: 'ACTIVE',
      permissionsVersion: 1,
      customPermissions: [],
      revokedPermissions: [],
      assignedRestrictions: [],
      allowedNavTabs: [],
    });
    state.data.userBranches.push({ userId: targetId, branchId, isDefault: true });

    const loginSuper = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: superAdmin.email, password: superPass }),
    });
    assert.equal(loginSuper.status, 200);

    // 1. Habilitar todos los módulos (incluyendo alias 'appointments' que se normaliza a 'agenda')
    const enableAllRes = await apiRequest(baseUrl, `/api/users/${targetId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: ['appointments', ...ALL_SYSTEM_MODULE_IDS],
          customPermissions: [],
          revokedPermissions: [],
          assignedRestrictions: [],
        },
      }),
    });
    assert.equal(enableAllRes.status, 200);
    assert.equal(enableAllRes.json.success, true);
    assert.ok(moduleSetsEqual(enableAllRes.json.user.allowedNavTabs, ALL_SYSTEM_MODULE_IDS));
    assert.ok(
      !enableAllRes.json.user.allowedNavTabs.includes('appointments'),
      'El backend debe normalizar el alias appointments al ID canónico agenda'
    );

    // 2. Restablecer al rol (envía allowedNavTabs: [] para volver a heredar del rol)
    const resetRes = await apiRequest(baseUrl, `/api/users/${targetId}/permissions`, {
      method: 'PUT',
      cookie: loginSuper.sidCookie,
      body: JSON.stringify({
        overrides: {
          allowedNavTabs: [],
          customPermissions: [],
          revokedPermissions: [],
          assignedRestrictions: [],
        },
      }),
    });
    assert.equal(resetRes.status, 200);
    assert.deepEqual(resetRes.json.user.allowedNavTabs, []);
    assert.equal(resetRes.json.permissionsVersion, 3);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
