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
    // respuesta no JSON
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

test('Consola del Propietario mínima + Fase 2 (Clientes): OWNER_EMAIL, 404 oculto, suspender/reactivar y flujo normal intacto', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-owner-min-'));
  const prevOwnerEmail = process.env.OWNER_EMAIL;
  process.env.DATA_DIR = tmpDir;
  process.env.NODE_ENV = 'production';
  delete process.env.OWNER_EMAIL;

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

    // Configurar contraseña para el usuario Super Admin existente (será el dueño por OWNER_EMAIL)
    const ownerPass = 'OwnerNormalPass#2026';
    const ownerHash = createPbkdf2Hash(ownerPass);
    const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
    assert.ok(superAdmin, 'Debe existir un usuario SUPER_ADMIN en el estado inicial');
    superAdmin.passwordHash = ownerHash.hash;
    superAdmin.passwordSalt = ownerHash.salt;
    superAdmin.passwordIterations = ownerHash.iterations;

    // Crear una segunda clínica cliente para probar suspensión/reactivación sin afectar la org del propietario
    const clientOrgId = '33333333-3333-4333-8333-333333333333';
    const clientBranchId = '44444444-4444-4444-8444-444444444444';
    state.organizationsList.push({
      id: clientOrgId,
      code: 'CLI-SONRISA-02',
      name: 'Clínica Sonrisa Sur',
      legalName: 'Clínica Odontológica Sonrisa Sur S.R.L.',
      taxId: '80055544-2',
      countryCode: 'PRY',
      defaultCurrency: 'PYG',
      timezone: 'America/Asuncion',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    state.data.branches.push({
      id: clientBranchId,
      organizationId: clientOrgId,
      code: 'SUC-01',
      name: 'Casa Central Sur',
      department: 'Central',
      city: 'Lambaré',
      address: 'Av. Cacique Lambaré 123',
      phone: '+595 21 555 000',
      status: 'ACTIVE',
    });

    const clinicPass = 'ClinicAdmin#2026';
    const clinicHash = createPbkdf2Hash(clinicPass);
    const clinicAdminId = '11111111-1111-4111-8111-111111111111';
    state.data.users.push({
      id: clinicAdminId,
      organizationId: clientOrgId,
      roleId: 'ADMIN_ORGANIZACION',
      username: 'admin.clinica',
      firstName: 'María',
      lastName: 'Clínica',
      email: 'admin.clinica@clinicatest.com.py',
      passwordHash: clinicHash.hash,
      passwordSalt: clinicHash.salt,
      passwordIterations: clinicHash.iterations,
      status: 'ACTIVE',
      permissionsVersion: 1,
    });
    state.data.userBranches.push({ userId: clinicAdminId, branchId: clientBranchId, isDefault: true });

    // 1. Sin sesión -> /api/owner/* responde 404
    const unauthMe = await apiRequest(baseUrl, '/api/owner/me');
    assert.equal(unauthMe.status, 404);
    const unauthOrgs = await apiRequest(baseUrl, '/api/owner/organizations');
    assert.equal(unauthOrgs.status, 404);
    const unauthAudit = await apiRequest(baseUrl, '/api/owner/audit', {
      method: 'POST',
      body: JSON.stringify({ module: 'roadmap' }),
    });
    assert.equal(unauthAudit.status, 404);

    // 2. Login normal del usuario existente sin OWNER_EMAIL definido -> /api/owner/me responde 404
    const ownerLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: superAdmin.email, password: ownerPass }),
    });
    assert.equal(ownerLogin.status, 200);
    assert.equal(ownerLogin.json?.success, true);
    assert.ok(ownerLogin.sidCookie);

    const meWithoutEnv = await apiRequest(baseUrl, '/api/owner/me', {
      cookie: ownerLogin.sidCookie,
    });
    assert.equal(meWithoutEnv.status, 404);

    // 3. Al configurar OWNER_EMAIL -> /api/owner/me responde 200
    process.env.OWNER_EMAIL = `  ${String(superAdmin.email).toUpperCase()}  `;
    const meAsOwner = await apiRequest(baseUrl, '/api/owner/me', {
      cookie: ownerLogin.sidCookie,
    });
    assert.equal(meAsOwner.status, 200);
    assert.equal(meAsOwner.json?.isOwner, true);
    assert.equal(meAsOwner.json?.user?.email, superAdmin.email);

    // 4. Auditoría de consola reutiliza auditLogs existente con organizationId válido (cero cambios en BD)
    const auditBefore = state.data.auditLogs.length;
    const ownerAuditRes = await apiRequest(baseUrl, '/api/owner/audit', {
      method: 'POST',
      cookie: ownerLogin.sidCookie,
      body: JSON.stringify({ action: 'OWNER_CONSOLE_VIEW', module: 'clients' }),
    });
    assert.equal(ownerAuditRes.status, 200);
    assert.equal(ownerAuditRes.json?.success, true);
    assert.equal(state.data.auditLogs.length, auditBefore + 1);
    assert.equal(state.data.auditLogs[0].entity, 'OWNER_CONSOLE');
    assert.equal(state.data.auditLogs[0].organizationId, superAdmin.organizationId);

    // 5. Usuario normal de clínica: login, carga de estado, creación de usuario y 404 en /api/owner/*
    const clinicLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.clinica@clinicatest.com.py', password: clinicPass }),
    });
    assert.equal(clinicLogin.status, 200);
    assert.equal(clinicLogin.json?.success, true);
    assert.ok(clinicLogin.sidCookie);

    const clinicOwnerMe = await apiRequest(baseUrl, '/api/owner/me', {
      cookie: clinicLogin.sidCookie,
    });
    assert.equal(clinicOwnerMe.status, 404);

    const clinicOwnerOrgs = await apiRequest(baseUrl, '/api/owner/organizations', {
      cookie: clinicLogin.sidCookie,
    });
    assert.equal(clinicOwnerOrgs.status, 404);

    const clinicPatchStatus = await apiRequest(baseUrl, `/api/owner/organizations/${clientOrgId}/status`, {
      method: 'PATCH',
      cookie: clinicLogin.sidCookie,
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    assert.equal(clinicPatchStatus.status, 404);

    const clinicState = await apiRequest(baseUrl, '/api/db/state', {
      cookie: clinicLogin.sidCookie,
    });
    assert.equal(clinicState.status, 200);
    assert.ok(Array.isArray(clinicState.json?.data?.users));

    // Crear un usuario nuevo de clínica mediante /api/db/delta como antes
    const newDoctorId = '22222222-2222-4222-8222-222222222222';
    const deltaRes = await apiRequest(baseUrl, '/api/db/delta', {
      method: 'POST',
      cookie: clinicLogin.sidCookie,
      body: JSON.stringify({
        upserts: {
          users: [
            {
              id: newDoctorId,
              organizationId: clientOrgId,
              roleId: 'ODONTOLOGO',
              username: 'dr.nuevo',
              firstName: 'Carlos',
              lastName: 'Nuevo',
              email: 'dr.nuevo@clinicatest.com.py',
              phone: '+595 981 111 222',
              status: 'ACTIVE',
            },
          ],
        },
        deletes: {},
      }),
    });
    assert.equal(deltaRes.status, 200);
    assert.equal(deltaRes.json?.success, true);
    assert.ok(state.data.users.some((u: any) => u.id === newDoctorId));

    // 6. Fase 2: Listar empresas desde /api/owner/organizations (solo metadatos, cero pacientes)
    const orgsRes = await apiRequest(baseUrl, '/api/owner/organizations', {
      cookie: ownerLogin.sidCookie,
    });
    assert.equal(orgsRes.status, 200);
    assert.ok(Array.isArray(orgsRes.json?.organizations));
    const clientSummary = orgsRes.json.organizations.find((o: any) => o.id === clientOrgId);
    assert.ok(clientSummary);
    assert.equal(clientSummary.name, 'Clínica Sonrisa Sur');
    assert.equal(clientSummary.legalName, 'Clínica Odontológica Sonrisa Sur S.R.L.');
    assert.equal(clientSummary.status, 'ACTIVE');
    assert.equal(clientSummary.branchesCount, 1);
    assert.equal(clientSummary.usersCount, 2); // admin.clinica + dr.nuevo
    assert.equal(clientSummary.isOwnerOrganization, false);
    assert.equal('patientsCount' in clientSummary, false, 'No debe exponer datos clínicos de pacientes');

    // 7. Protección: propietario no puede suspender su propia organización
    const selfSuspend = await apiRequest(baseUrl, `/api/owner/organizations/${orgId}/status`, {
      method: 'PATCH',
      cookie: ownerLogin.sidCookie,
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    assert.equal(selfSuspend.status, 400);

    // 8. Suspender clínica cliente -> solo impide NUEVO login con mensaje amable, sin romper sesión ya abierta
    const suspendRes = await apiRequest(baseUrl, `/api/owner/organizations/${clientOrgId}/status`, {
      method: 'PATCH',
      cookie: ownerLogin.sidCookie,
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    assert.equal(suspendRes.status, 200);
    assert.equal(suspendRes.json?.organization?.status, 'SUSPENDED');
    assert.equal(state.data.auditLogs[0].action, 'OWNER_ORG_SUSPEND');
    assert.equal(state.data.auditLogs[0].organizationId, clientOrgId);

    // Sesión ya abierta sigue funcionando sin interrupción abrupta
    const existingSessionCheck = await apiRequest(baseUrl, '/api/auth/session', {
      cookie: clinicLogin.sidCookie,
    });
    assert.equal(existingSessionCheck.status, 200);

    // Nuevo intento de inicio de sesión es bloqueado con mensaje claro y amable
    const blockedNewLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.clinica@clinicatest.com.py', password: clinicPass }),
    });
    assert.equal(blockedNewLogin.status, 403);
    assert.equal(blockedNewLogin.json?.success, false);
    assert.match(String(blockedNewLogin.json?.error || ''), /suspendido.*soporte/i);

    // 9. Reactivar clínica cliente -> permite iniciar sesión nuevamente y registra auditoría
    const reactivateRes = await apiRequest(baseUrl, `/api/owner/organizations/${clientOrgId}/status`, {
      method: 'PATCH',
      cookie: ownerLogin.sidCookie,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.json?.organization?.status, 'ACTIVE');
    assert.equal(state.data.auditLogs[0].action, 'OWNER_ORG_REACTIVATE');

    const restoredLogin = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'admin.clinica@clinicatest.com.py', password: clinicPass }),
    });
    assert.equal(restoredLogin.status, 200);
    assert.equal(restoredLogin.json?.success, true);

    // Referencia limpia para branchId original
    assert.ok(branchId);
  } finally {
    if (prevOwnerEmail === undefined) {
      delete process.env.OWNER_EMAIL;
    } else {
      process.env.OWNER_EMAIL = prevOwnerEmail;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Consola del Propietario mínima + Fase 2: integridad de vistas lazy, título y cero artefactos de BD', () => {
  const ownerConsoleSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/owner/OwnerConsole.tsx'),
    'utf-8'
  );
  assert.ok(ownerConsoleSrc.includes('ODONTOPRO · Consola del Propietario'));
  assert.ok(ownerConsoleSrc.includes('OwnerClientsPanel'));
  assert.ok(ownerConsoleSrc.includes('RoadmapViewer'));
  assert.ok(ownerConsoleSrc.includes('SchemaViewer'));
  assert.ok(ownerConsoleSrc.includes('AutomatedTestingView'));
  assert.ok(ownerConsoleSrc.includes('ProductionDeploymentView'));
  assert.ok(ownerConsoleSrc.includes('SecurityHardeningView'));
  assert.ok(ownerConsoleSrc.includes('lazy('));
  assert.equal(/\b(window\.)?(alert|confirm|open)\s*\(/.test(ownerConsoleSrc), false);

  const clientsPanelSrc = fs.readFileSync(
    path.join(process.cwd(), 'src/components/owner/OwnerClientsPanel.tsx'),
    'utf-8'
  );
  assert.ok(clientsPanelSrc.includes('/api/owner/organizations'));
  assert.equal(/\b(window\.)?(alert|confirm|open)\s*\(/.test(clientsPanelSrc), false);

  const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');
  assert.ok(appSrc.includes('/api/owner/me'));
  assert.ok(appSrc.includes("import('./components/owner/OwnerConsole.tsx')"));
  assert.equal(appSrc.includes('VITE_ENABLE_DEV_TOOLS'), false);

  const sidebarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/Sidebar.tsx'), 'utf-8');
  assert.ok(sidebarSrc.includes('canAccessOwnerConsole'));

  const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
  assert.equal(Boolean(pkgJson.dependencies?.otplib), false);
  assert.equal(Boolean(pkgJson.scripts?.['owner:create']), false);

  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'supabase/migrations/202611230004_platform_owner_support.sql')),
    false
  );
});
