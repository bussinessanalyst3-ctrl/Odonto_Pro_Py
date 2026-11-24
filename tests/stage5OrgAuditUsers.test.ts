import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { dbStore } from '../src/db/inMemoryStore.ts';
import { DEFAULT_BRANDING } from '../src/branding/brandingTypes.ts';

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

function resetStoreAsSuperAdmin() {
  const snap = dbStore.getSnapshot();
  const sa = snap.users.find((u) => u.roleId === 'SUPER_ADMIN') || snap.users[0];
  dbStore.resetToSeed({
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
  });
  return {
    userId: sa.id,
    role: sa.roleId,
    organizationId: sa.organizationId,
    allowedBranchIds: dbStore.getSnapshot().branches.map((b: any) => b.id),
  };
}

test('Etapa 5 — Organización: valida nombre/RUC obligatorio, rechaza RUC duplicado, crea sillón inicial y protege última clínica activa', () => {
  const actor = resetStoreAsSuperAdmin();

  // 0) DEFAULT_BRANDING no debe traer timbrados ni teléfonos personales inventados
  assert.equal(DEFAULT_BRANDING.tradeName, 'ODONTOPRO');
  assert.equal(DEFAULT_BRANDING.timbradoNumber, '');
  assert.equal(DEFAULT_BRANDING.timbradoVencimiento, '');
  assert.equal(DEFAULT_BRANDING.whatsapp, '');
  assert.equal(DEFAULT_BRANDING.phone, '');

  // 1) Rechaza nombre vacío o RUC vacío (no fabrica 80000000-1)
  assert.throws(
    () => dbStore.addOrganization({ name: '   ', taxId: '80099111-2' }, actor),
    /nombre comercial.*obligatorio/i
  );
  assert.throws(
    () => dbStore.addOrganization({ name: 'Clínica Sin RUC', taxId: '   ' }, actor),
    /RUC.*obligatorio/i
  );

  // 2) Crear clínica válida inicializa sucursal Casa Central + 1 sillón activo
  const prevBranchesRef = dbStore.getSnapshot().branches;
  const created = dbStore.addOrganization(
    {
      name: 'Clínica Itapúa Dental',
      legalName: 'Itapúa Dental S.R.L.',
      taxId: '80077889-5',
      address: 'Av. Irrazábal 1200, Encarnación',
    },
    actor
  );

  assert.equal(created.name, 'Clínica Itapúa Dental');
  assert.equal(created.taxId, '80077889-5');
  assert.notEqual(dbStore.getSnapshot().branches, prevBranchesRef);

  // Conmutar al contexto de la nueva organización y verificar su sucursal + sillón inicial
  const switched = dbStore.switchOrganization(created.id, actor);
  assert.equal(switched, true);

  const createdBranches = dbStore.getBranches(actor);
  assert.equal(createdBranches.length, 1);

  const createdChairs = dbStore.getDentalChairs(createdBranches[0].id);
  assert.equal(createdChairs.length, 1, 'La nueva organización debe iniciar con un sillón operativo');
  assert.equal(createdChairs[0].status, 'ACTIVE');

  // 3) Rechazar RUC duplicado (incluso con espacios)
  assert.throws(
    () =>
      dbStore.addOrganization(
        {
          name: 'Clínica Duplicada',
          taxId: ' 80077889-5 ',
        },
        actor
      ),
    /Ya existe una organización activa registrada con el RUC/i
  );

  // 4) Rechazar actualización a RUC de otra organización activa
  const originalOrg = dbStore.getOrganizations().find((o) => o.id !== created.id)!;
  assert.throws(
    () => dbStore.updateOrganization({ taxId: originalOrg.taxId }, created.id, actor),
    /Ya existe otra organización activa con el RUC/i
  );

  // 5) Dar de baja la clínica creada deja solo 1 activa, y luego impide dar de baja la última activa
  const deleted = dbStore.deleteOrganization(created.id, actor);
  assert.equal(deleted, true);

  assert.throws(
    () => dbStore.deleteOrganization(originalOrg.id, actor),
    /única organización activa/i
  );
});

test('Etapa 5 — Auditoría UI: sin botón simulador MSPBS ni IPs/ISP/hash criptográfico falsos', () => {
  const root = process.cwd();
  const auditViewSrc = fs.readFileSync(path.join(root, 'src/components/audit/AuditLogsView.tsx'), 'utf8');
  const auditDetailSrc = fs.readFileSync(path.join(root, 'src/components/audit/AuditLogDetailModal.tsx'), 'utf8');
  const orgViewSrc = fs.readFileSync(path.join(root, 'src/components/organization/OrganizationManagementView.tsx'), 'utf8');

  // Auditoría no debe tener botón de simulación que ensucie la tabla inmutable audit_logs
  assert.equal(auditViewSrc.includes('Simular Acceso Sensible'), false);
  assert.equal(auditViewSrc.includes('handleSimulateSensitiveAccess'), false);

  // Sin IP falsa hardcodeada ni ISP inventado ni sello SHA256 simulado
  assert.equal(auditViewSrc.includes('190.52.144.12'), false);
  assert.equal(auditDetailSrc.includes('190.52.144.12'), false);
  assert.equal(auditDetailSrc.includes('ISP: Tigo / Personal Paraguay'), false);
  assert.equal(auditDetailSrc.includes('Sello Criptográfico de Integridad'), false);
  assert.equal(auditDetailSrc.includes('Chromium v128'), false);

  // Organización sin valores falsos de timbrado/WhatsApp ni guardado silencioso falso en catch
  assert.equal(orgViewSrc.includes("'15984260'"), false);
  assert.equal(orgViewSrc.includes("'+595 984 805 602'"), false);
  assert.equal(orgViewSrc.includes("'80000000-1'"), false);
  assert.equal(orgViewSrc.includes('Se guardaron los cambios localmente.'), false);
});

test('Etapa 5 — Usuarios (datos sin modificar auth/permisos): validación de correo/usuario único y actualización limpia', () => {
  const actor = resetStoreAsSuperAdmin();
  const snap = dbStore.getSnapshot();
  const firstBranch = snap.branches[0];

  const createdUser = dbStore.addUser(
    {
      firstName: 'Lucía',
      lastName: 'Benítez',
      email: 'lucia.benitez@clinica-test.py',
      username: 'lbenitez',
      roleId: 'RECEPCION',
      phone: '+595 981 445 566',
      specialty: 'Recepción y Agenda',
      branchIds: [firstBranch.id],
      defaultBranchId: firstBranch.id,
    },
    actor
  );

  assert.equal(createdUser.email, 'lucia.benitez@clinica-test.py');
  assert.equal(createdUser.username, 'lbenitez');

  // Rechaza correo duplicado y nombre de usuario duplicado
  assert.throws(
    () =>
      dbStore.addUser(
        {
          firstName: 'Otra',
          lastName: 'Persona',
          email: 'LUCIA.BENITEZ@clinica-test.py',
          username: 'otra.persona',
          roleId: 'RECEPCION',
          phone: '+595 981 111 222',
          branchIds: [firstBranch.id],
        },
        actor
      ),
    /Ya existe un usuario registrado con el correo/i
  );

  assert.throws(
    () =>
      dbStore.addUser(
        {
          firstName: 'Otra',
          lastName: 'Persona',
          email: 'otra@clinica-test.py',
          username: 'lbenitez',
          roleId: 'RECEPCION',
          phone: '+595 981 111 222',
          branchIds: [firstBranch.id],
        },
        actor
      ),
    /nombre de usuario.*en uso/i
  );

  // Actualizar datos básicos conserva rol/estado correctamente
  const updated = dbStore.updateUser(
    createdUser.id,
    {
      firstName: 'Lucía María',
      phone: '+595 982 778 899',
      branchIds: [firstBranch.id],
      defaultBranchId: firstBranch.id,
    },
    actor
  );
  assert.ok(updated);
  assert.equal(updated.firstName, 'Lucía María');
  assert.equal(updated.phone, '+595 982 778 899');
  assert.equal(updated.roleId, 'RECEPCION');
});

test('Etapa 5 E2E — GET /api/audit-logs filtra por rango de fechas en hora Paraguay, ordena descendente y cuenta anulaciones financieras', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-stage5-e2e-'));
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
    const hash = createPbkdf2Hash('Stage5Test#2026');
    superAdmin.passwordHash = hash.hash;
    superAdmin.passwordSalt = hash.salt;
    superAdmin.passwordIterations = hash.iterations;

    const loginRes = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: superAdmin.email,
        password: 'Stage5Test#2026',
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.sidCookie;
    assert.ok(cookie, 'Debe devolver cookie de sesión');

    const orgId = state.data.organization.id;
    const branchId = state.data.branches[0].id;

    // Insertar eventos con fechas de distintos días (incluyendo borde UTC -> Paraguay)
    // 2025-06-16T01:30:00Z = 2025-06-15 21:30 en America/Asuncion (UTC-4 en junio)
    state.data.auditLogs.push(
      {
        id: 'audit-stage5-old',
        organizationId: orgId,
        branchId,
        userId: superAdmin.id,
        action: 'CREATE',
        entity: 'SERVICE',
        entityId: 'srv-1',
        ipAddress: '181.40.10.5',
        userAgent: 'ODONTOPRO Test',
        oldValues: null,
        newValues: { basePrice: 250000 },
        description: 'Evento histórico marzo 2025',
        createdAt: '2025-03-10T14:00:00.000Z',
      },
      {
        id: 'audit-stage5-midnight-py',
        organizationId: orgId,
        branchId,
        userId: superAdmin.id,
        action: 'PAYMENT_ANNUL',
        entity: 'PAYMENT',
        entityId: 'pay-99',
        ipAddress: '181.40.10.6',
        userAgent: 'ODONTOPRO Test',
        oldValues: { status: 'COMPLETADO' },
        newValues: { status: 'ANULADO' },
        description: 'Anulación nocturna del 15 de junio (hora Paraguay)',
        createdAt: '2025-06-16T01:30:00.000Z',
      },
      {
        id: 'audit-stage5-june16',
        organizationId: orgId,
        branchId,
        userId: superAdmin.id,
        action: 'UPDATE',
        entity: 'ORGANIZATION',
        entityId: orgId,
        ipAddress: null,
        userAgent: 'ODONTOPRO Test',
        oldValues: null,
        newValues: { name: 'Clínica Actualizada' },
        description: 'Cambio de datos institucionales 16 de junio',
        createdAt: '2025-06-16T15:00:00.000Z',
      }
    );

    // 1) Filtrar exactamente por 2025-06-15 en hora Paraguay: debe traer audit-stage5-midnight-py (NO june16 ni marzo)
    const june15Res = await apiRequest(
      baseUrl,
      '/api/audit-logs?dateFrom=2025-06-15&dateTo=2025-06-15&limit=500',
      { cookie }
    );
    assert.equal(june15Res.status, 200);
    assert.equal(june15Res.json.limit, 500, 'Debe aceptar limit hasta 500 para exportación CSV');
    assert.equal(june15Res.json.total, 1);
    assert.equal(june15Res.json.logs[0].id, 'audit-stage5-midnight-py');
    assert.equal(
      june15Res.json.stats.financialOperationsCount,
      1,
      'PAYMENT_ANNUL debe contabilizarse en operaciones financieras'
    );

    // 2) Rango 2025-03-01 a 2025-06-30 debe devolver los 3 eventos ordenados del más reciente al más antiguo
    const rangeRes = await apiRequest(
      baseUrl,
      '/api/audit-logs?dateFrom=2025-03-01&dateTo=2025-06-30&limit=10&offset=0',
      { cookie }
    );
    assert.equal(rangeRes.status, 200);
    assert.equal(rangeRes.json.total, 3);
    assert.deepEqual(
      rangeRes.json.logs.map((l: any) => l.id),
      ['audit-stage5-june16', 'audit-stage5-midnight-py', 'audit-stage5-old']
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
