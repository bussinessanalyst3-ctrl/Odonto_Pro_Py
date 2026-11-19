import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

async function rawRequest(
  baseUrl: string,
  endpoint: string,
  opts: { method?: string; body?: string; headers?: Record<string, string>; cookie?: string } = {}
) {
  const headers: Record<string, string> = { ...(opts.headers || {}) };
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
    headers: res.headers,
    json,
    text,
    sidCookie: sidMatch ? `odontopro_sid=${sidMatch[1]}` : '',
  };
}

test('Fase 8 (Producción): Headers de seguridad, CORS/CSRF, Lockout, JSON malformado y RBAC reset-seed', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odontopro-p8-'));
  const prevDataDir = process.env.DATA_DIR;
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const prevAllowIframe = process.env.ALLOW_IFRAME_PREVIEW;

  process.env.DATA_DIR = tmpDir;
  process.env.NODE_ENV = 'production';
  process.env.ALLOWED_ORIGINS = 'https://clinica.odontopro.com.py';
  process.env.ALLOW_IFRAME_PREVIEW = 'false';

  const { createConfiguredApp } = await import('../server.ts');
  const { getServerDbState } = await import('../server/stateStore.ts');
  const { createPbkdf2Hash } = await import('../server/crypto.ts');
  const { failedAttemptsMap } = await import('../server/security.ts');

  const app = await createConfiguredApp({ skipFrontend: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Health & Security Headers in production mode
    const healthRes = await rawRequest(baseUrl, '/api/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.json?.status, 'ok');
    assert.equal(healthRes.json?.environment, 'production');
    assert.ok(typeof healthRes.json?.uptimeSec === 'number');
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(healthRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(healthRes.headers.get('strict-transport-security')?.includes('max-age=31536000'));
    assert.equal(healthRes.headers.get('x-powered-by'), null);

    // 2. Unauthorized cross-origin blocked with 403
    const evilOriginRes = await rawRequest(baseUrl, '/api/health', {
      headers: { Origin: 'https://evil.attacker.example' },
    });
    assert.equal(evilOriginRes.status, 403);

    // 3. Authorized origin (ALLOWED_ORIGINS + .onrender.com) preflight 204
    const allowedPreflight = await rawRequest(baseUrl, '/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: 'https://clinica.odontopro.com.py' },
    });
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers.get('access-control-allow-origin'),
      'https://clinica.odontopro.com.py'
    );

    const renderPreflight = await rawRequest(baseUrl, '/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: 'https://odonto-pro-py.onrender.com' },
    });
    assert.equal(renderPreflight.status, 204);
    assert.equal(
      renderPreflight.headers.get('access-control-allow-origin'),
      'https://odonto-pro-py.onrender.com'
    );

    // 4. Malformed JSON returns 400 clean JSON error (no HTML stack trace)
    const badJsonRes = await rawRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"identifier": "admin", broken',
    });
    assert.equal(badJsonRes.status, 400);
    assert.ok(badJsonRes.json?.error);
    assert.ok(!badJsonRes.text.includes('SyntaxError:'));

    // 5. Brute-force lockout after 5 failed attempts
    const state = getServerDbState();
    const orgId = state.data.organization.id;
    const branchId = state.data.branches[0]?.id || 'branch-default';
    const targetEmail = 'lockout.p8@odontopro.com.py';
    const nonSuperEmail = 'admin.p8@odontopro.com.py';
    const pass = 'Phase8Strong#2026';
    const hash = createPbkdf2Hash(pass);

    state.data.users.push(
      {
        id: 'user-p8-lockout',
        organizationId: orgId,
        roleId: 'RECEPCION',
        username: 'lockout.p8',
        email: targetEmail,
        firstName: 'Test',
        lastName: 'Lockout',
        status: 'ACTIVE',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
      },
      {
        id: 'user-p8-admin',
        organizationId: orgId,
        roleId: 'ADMIN_ORGANIZACION',
        username: 'admin.p8',
        email: nonSuperEmail,
        firstName: 'Admin',
        lastName: 'Org',
        status: 'ACTIVE',
        passwordHash: hash.hash,
        passwordSalt: hash.salt,
        passwordIterations: hash.iterations,
      }
    );
    state.data.userBranches.push({ userId: 'user-p8-admin', branchId, isDefault: true });

    for (let i = 0; i < 5; i++) {
      const failAttempt = await rawRequest(baseUrl, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: targetEmail, password: 'WrongPassword!' }),
      });
      assert.equal(failAttempt.status, 401);
    }

    const lockedRes = await rawRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: targetEmail, password: pass }),
    });
    assert.equal(lockedRes.status, 429);
    assert.equal(lockedRes.json?.locked, true);

    failedAttemptsMap.delete(`user_${targetEmail}`);

    // 6. Non-SUPER_ADMIN cannot trigger /api/db/reset-seed and logs ACCESS_DENIED_SECURITY
    const adminLogin = await rawRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: nonSuperEmail, password: pass }),
    });
    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.sidCookie);

    const resetDenied = await rawRequest(baseUrl, '/api/db/reset-seed', {
      method: 'POST',
      cookie: adminLogin.sidCookie,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resetDenied.status, 403);
    assert.ok(
      state.data.auditLogs.some(
        (log: any) =>
          log.action === 'ACCESS_DENIED_SECURITY' &&
          log.entity === 'DATABASE' &&
          log.entityId === 'RESET_SEED' &&
          log.userId === 'user-p8-admin'
      )
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.DATA_DIR = prevDataDir;
    process.env.NODE_ENV = prevNodeEnv;
    process.env.ALLOWED_ORIGINS = prevAllowedOrigins;
    process.env.ALLOW_IFRAME_PREVIEW = prevAllowIframe;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Fase 8 (Configuración Release): .gitignore, render.yaml, ci.yml y ausencia de diálogos nativos', () => {
  const rootDir = process.cwd();

  const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
  for (const requiredPattern of ['.env', 'data/', 'dist/', 'node_modules/']) {
    assert.ok(gitignore.includes(requiredPattern), `.gitignore debe excluir ${requiredPattern}`);
  }

  const renderYaml = fs.readFileSync(path.join(rootDir, 'render.yaml'), 'utf-8');
  assert.ok(renderYaml.includes('preDeployCommand: npm run db:migrate -- --if-configured'));
  assert.ok(renderYaml.includes('healthCheckPath: /api/health'));
  assert.ok(renderYaml.includes('DIRECT_URL'));

  const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf-8');
  assert.ok(ciYml.includes('workflow_dispatch'));
  assert.ok(ciYml.includes('npm run lint'));
  assert.ok(ciYml.includes('npm test'));
  assert.ok(ciYml.includes('npm run db:migrate -- --status --if-configured'));
  assert.ok(ciYml.includes('npm run build'));
  assert.ok(ciYml.includes('npm audit --omit=dev'));

  // Verify no native window.alert/window.confirm/window.open remain in UI components
  const componentsDir = path.join(rootDir, 'src', 'components');
  const walkFiles = (dir: string): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
    });
  };
  for (const filePath of walkFiles(componentsDir)) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.equal(
      /\b(window\.)?(alert|confirm)\s*\(/.test(content),
      false,
      `No debe haber diálogos nativos alert()/confirm() en ${filePath}`
    );
    assert.equal(
      /\bwindow\.open\s*\(/.test(content),
      false,
      `No debe haber window.open() en ${filePath}`
    );
  }
});
