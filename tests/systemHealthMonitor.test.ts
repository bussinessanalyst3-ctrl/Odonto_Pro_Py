import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function apiRequest(
  baseUrl: string,
  endpoint: string,
  options: { method?: string; cookie?: string; body?: any } = {}
): Promise<{ status: number; json: any; headers: Headers; text: string }> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body:
      options.body !== undefined
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers, text };
}

function extractSidCookie(headers: Headers): string {
  const raw = headers.get('set-cookie') || '';
  const match = raw.match(/odontopro_sid=[^;]+/);
  return match ? match[0] : '';
}

test('Sanitizador de monitoreo enmascara correos, tokens, contraseñas, JWT y URLs de BD', async () => {
  const { sanitizeErrorMessage, sanitizeRoutePath, inferModuleFromRoute } = await import(
    '../server/healthMonitor.ts'
  );

  const leaky =
    'Fallo para paciente juan.perez@clinica.com.py con Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123456 password=MiClave123! odontopro_sid=abcdef0123456789abcdef0123456789 postgres://user:pass@db.supabase.co:5432/postgres';
  const cleaned = sanitizeErrorMessage(leaky);

  assert.ok(!cleaned.includes('juan.perez@clinica.com.py'), 'No debe contener correos completos');
  assert.ok(!cleaned.includes('MiClave123'), 'No debe contener contraseñas');
  assert.ok(!cleaned.includes('eyJhbGciOiJIUzI1NiJ9'), 'No debe contener JWT');
  assert.ok(!cleaned.includes('db.supabase.co'), 'No debe contener URL de BD');
  assert.ok(!cleaned.includes('abcdef0123456789abcdef0123456789'), 'No debe contener tokens opacos');
  assert.ok(cleaned.includes('[email]'), 'Debe reemplazar el correo con [email]');
  assert.ok(cleaned.length <= 180, 'Debe truncar mensajes largos a <= 180 caracteres');

  const routeCleaned = sanitizeRoutePath(
    '/api/patients/550e8400-e29b-41d4-a716-446655440000?email=test@clinica.py&token=secret'
  );
  assert.equal(routeCleaned, '/api/patients/:id');

  assert.equal(inferModuleFromRoute('/api/appointments'), 'agenda');
  assert.equal(inferModuleFromRoute('/api/patients/123'), 'patients');
  assert.equal(inferModuleFromRoute('/api/payroll/settlements'), 'staff-payroll');
  assert.equal(inferModuleFromRoute('/api/ruta-desconocida/xyz'), 'other');
});

test('Monitoreo de salud: /api/health sin BD, /api/health/db 503 + caché 30s, /api/owner/health solo propietario y client-errors', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-health-'));
  const prevDataDir = process.env.DATA_DIR;
  const prevOwnerEmail = process.env.OWNER_EMAIL;
  const prevRenderCommit = process.env.RENDER_GIT_COMMIT;
  process.env.DATA_DIR = tmpDir;
  process.env.OWNER_EMAIL = 'admin@odontopro.com.py';
  delete process.env.RENDER_GIT_COMMIT;

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');
  const {
    clearHealthMonitorStateForTests,
    recordSystemError,
    setDbHealthProbeOverrideForTests,
  } = await import('../server/healthMonitor.ts');

  clearHealthMonitorStateForTests();

  const app = await createConfiguredApp({ skipFrontend: true });
  const state = getServerDbState();
  const orgId = state.data.organization.id;
  const branchId = state.data.branches[0].id;

  const ownerPassword = 'OwnerHealthPass#2026';
  const ownerHash = createPbkdf2Hash(ownerPassword);
  const superAdmin = state.data.users.find((u: any) => u.roleId === 'SUPER_ADMIN');
  assert.ok(superAdmin, 'Debe existir un SUPER_ADMIN inicial');
  superAdmin.passwordHash = ownerHash.hash;
  superAdmin.passwordSalt = ownerHash.salt;
  superAdmin.passwordIterations = ownerHash.iterations;
  process.env.OWNER_EMAIL = superAdmin.email;

  // Crear usuario de clínica no propietario (RECEPCION)
  const recepEmail = 'recepcion.health@clinicademo.py';
  const recepPassword = 'RecepHealth2026!';
  const recepHash = createPbkdf2Hash(recepPassword);
  state.data.users.push({
    id: 'user-recep-health',
    organizationId: orgId,
    roleId: 'RECEPCION',
    firstName: 'Lucia',
    lastName: 'Recepcion',
    email: recepEmail,
    username: 'recep.health',
    passwordHash: recepHash.hash,
    passwordSalt: recepHash.salt,
    passwordIterations: recepHash.iterations,
    status: 'ACTIVE',
    permissionsVersion: 1,
    createdAt: new Date().toISOString(),
  });
  state.data.userBranches.push({
    userId: 'user-recep-health',
    branchId,
    isDefault: true,
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. /api/health NO consulta la BD (incluso con BD simulada caída) y omite version si no existe env
    let dbProbeCalls = 0;
    setDbHealthProbeOverrideForTests(async () => {
      dbProbeCalls += 1;
      return { ok: false, errorMessage: 'FATAL: password authentication failed for user@secret.com' };
    });

    const healthNoVersion = await apiRequest(baseUrl, '/api/health');
    assert.equal(healthNoVersion.status, 200);
    assert.equal(healthNoVersion.json?.status, 'ok');
    assert.equal(typeof healthNoVersion.json?.time, 'string');
    assert.equal(Object.prototype.hasOwnProperty.call(healthNoVersion.json, 'version'), false);
    assert.equal(dbProbeCalls, 0, '/api/health jamás debe consultar la base de datos');

    // Con RENDER_GIT_COMMIT presente, expone version corta
    process.env.RENDER_GIT_COMMIT = 'a1b2c3d4e5f60123456789abcdef0123456789ab';
    const healthWithVersion = await apiRequest(baseUrl, '/api/health');
    assert.equal(healthWithVersion.status, 200);
    assert.equal(healthWithVersion.json?.version, 'a1b2c3d4e5f6');
    assert.equal(dbProbeCalls, 0);

    // 2. /api/health/db devuelve 503 y SOLO { status: "down" } sin detalles técnicos, y cachea 30 s
    const dbDown1 = await apiRequest(baseUrl, '/api/health/db');
    assert.equal(dbDown1.status, 503);
    assert.deepEqual(dbDown1.json, { status: 'down' });
    assert.equal(dbProbeCalls, 1);

    const dbDownCached = await apiRequest(baseUrl, '/api/health/db');
    assert.equal(dbDownCached.status, 503);
    assert.deepEqual(dbDownCached.json, { status: 'down' });
    assert.equal(dbProbeCalls, 1, 'Segunda llamada dentro de 30 s debe usar caché y no tocar el pool');

    // Simular BD recuperada -> 200 { status: "ok" }
    setDbHealthProbeOverrideForTests(async () => {
      dbProbeCalls += 1;
      return { ok: true, latencyMs: 18 };
    });
    const dbOk = await apiRequest(baseUrl, '/api/health/db');
    assert.equal(dbOk.status, 200);
    assert.deepEqual(dbOk.json, { status: 'ok' });

    // 3. /api/owner/health devuelve 404 sin sesión y 404 a un usuario de clínica
    const anonOwnerHealth = await apiRequest(baseUrl, '/api/owner/health');
    assert.equal(anonOwnerHealth.status, 404);

    const loginRecep = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: recepEmail, password: recepPassword },
    });
    assert.equal(loginRecep.status, 200);
    const recepCookie = extractSidCookie(loginRecep.headers);

    const recepOwnerHealth = await apiRequest(baseUrl, '/api/owner/health', {
      cookie: recepCookie,
    });
    assert.equal(recepOwnerHealth.status, 404, 'Usuario de clínica debe recibir 404 en /api/owner/health');

    // 4. Errores 4xx NO cuentan como fallas de módulo; errores 500 y client-errors autenticados SÍ
    const badReq = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'inexistente@test.py', password: 'wrong' },
    });
    assert.equal(badReq.status, 401);

    // POST /api/client-errors sin sesión -> descartado en silencio (204)
    const anonClientErr = await apiRequest(baseUrl, '/api/client-errors', {
      method: 'POST',
      body: { module: 'agenda', message: 'Error anonimo que no debe guardarse' },
    });
    assert.equal(anonClientErr.status, 204);

    // POST /api/client-errors con sesión válida y datos sensibles -> sanitizado y guardado en 'agenda'
    const authClientErr = await apiRequest(baseUrl, '/api/client-errors', {
      method: 'POST',
      cookie: recepCookie,
      body: {
        module: 'agenda',
        message: 'Crash al abrir cita de maria@paciente.py con Bearer secret_token_123456',
      },
    });
    assert.equal(authClientErr.status, 204);

    // POST /api/client-errors > 4 KB -> descartado sin error 500
    const hugeClientErr = await apiRequest(baseUrl, '/api/client-errors', {
      method: 'POST',
      cookie: recepCookie,
      body: { module: 'patients', message: 'A'.repeat(6000) },
    });
    assert.equal(hugeClientErr.status, 204);

    // Registrar un error backend 500 en ruta desconocida -> debe ir a "other"
    recordSystemError({
      source: 'backend',
      route: '/api/desconocida/accion',
      method: 'POST',
      statusCode: 500,
      message: 'Fallo inesperado en ruta sin módulo',
    });
    // Y verificar que un 404 backend no se registra
    recordSystemError({
      source: 'backend',
      route: '/api/patients/999',
      method: 'GET',
      statusCode: 404,
      message: 'No encontrado',
    });

    // 5. Login del propietario -> /api/owner/health devuelve 200 con servidor, BD y módulos
    const loginOwner = await apiRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: superAdmin.email, password: ownerPassword },
    });
    assert.equal(loginOwner.status, 200);
    const ownerCookie = extractSidCookie(loginOwner.headers);

    const ownerHealth = await apiRequest(baseUrl, '/api/owner/health?fresh=1', {
      cookie: ownerCookie,
    });
    assert.equal(ownerHealth.status, 200);
    assert.equal(ownerHealth.json?.server?.status, 'green');
    assert.equal(ownerHealth.json?.server?.version, 'a1b2c3d4e5f6');
    assert.equal(ownerHealth.json?.database?.status, 'green');
    assert.equal(ownerHealth.json?.database?.latencyMs, 18);

    const agendaMod = ownerHealth.json?.modules?.find((m: any) => m.id === 'agenda');
    const patientsMod = ownerHealth.json?.modules?.find((m: any) => m.id === 'patients');
    const otherMod = ownerHealth.json?.modules?.find((m: any) => m.id === 'other');
    const usersMod = ownerHealth.json?.modules?.find((m: any) => m.id === 'users');

    assert.equal(agendaMod?.errors24h, 1, 'Debe registrar exactamente 1 error autenticado en agenda');
    assert.ok(!agendaMod?.lastError?.message?.includes('maria@paciente.py'));
    assert.ok(!agendaMod?.lastError?.message?.includes('secret_token_123456'));
    assert.equal(patientsMod?.errors24h, 0, 'Payload > 4KB y 404 no deben contarse en patients');
    assert.equal(usersMod?.errors24h, 0, 'Error 401 de login no debe contarse en users');
    assert.equal(otherMod?.errors24h, 1, 'Ruta no asociada a módulo debe agruparse en Otros');
    assert.equal(
      ownerHealth.json?.summary?.retentionNote,
      'El historial se reinicia al reiniciar o redesplegar el servidor.'
    );

    // 6. Simular caída de BD y verificar semáforo rojo + alerta en /api/owner/health
    setDbHealthProbeOverrideForTests(async () => ({
      ok: false,
      errorMessage: 'connect ECONNREFUSED postgres://admin:secret@db.host:5432/app',
    }));
    const ownerHealthDbRed = await apiRequest(baseUrl, '/api/owner/health?fresh=1', {
      cookie: ownerCookie,
    });
    assert.equal(ownerHealthDbRed.status, 200);
    assert.equal(ownerHealthDbRed.json?.database?.status, 'red');
    assert.ok(!ownerHealthDbRed.json?.database?.errorMessage?.includes('admin:secret'));
    assert.ok(
      ownerHealthDbRed.json?.summary?.alerts?.some((a: any) => a.level === 'red'),
      'Debe mostrar alerta roja cuando la BD falla'
    );
  } finally {
    setDbHealthProbeOverrideForTests(null);
    clearHealthMonitorStateForTests();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prevDataDir;
    if (prevOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = prevOwnerEmail;
    if (prevRenderCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = prevRenderCommit;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
