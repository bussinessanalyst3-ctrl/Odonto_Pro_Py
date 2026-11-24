import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import {
  getPgPool,
  getServerDbState,
  SESSIONS_FILE,
  TenantActorContext,
} from './stateStore.ts';
import { getUserEffectivePermissions, isSuperAdminRole } from '../src/security/rbacHierarchy.ts';
import {
  getModuleById,
  hasModuleAccess,
  SystemModuleId,
} from '../src/security/moduleCatalog.ts';

export const SESSION_COOKIE_NAME = 'odontopro_sid';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos
export const failedAttemptsMap = new Map<string, { count: number; lockedUntil: number | null }>();
export const apiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface ServerSessionRecord {
  userId: string;
  role: string;
  organizationId: string;
  branchId: string;
  issuedAt: string;
  expiresAt: string;
  permissionsVersion: number;
}

export const activeServerSessions = new Map<string, ServerSessionRecord>();

export const passwordRecoveryTokens = new Map<
  string,
  {
    userId: string;
    email: string;
    expiresAt: number;
    used: boolean;
  }
>();

export function parseCookies(req: express.Request): Record<string, string> {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  });
  return cookies;
}

export function extractSessionToken(req: express.Request): string | null {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME].trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (bearer && !bearer.startsWith('httpOnly_')) {
      return bearer;
    }
  }
  return null;
}

export function isSecureRequest(req: express.Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || proto === 'https' || process.env.NODE_ENV === 'production';
}

export function setSessionCookie(
  req: express.Request,
  res: express.Response,
  token: string,
  maxAgeSeconds: number
): void {
  const isHttps = isSecureRequest(req);
  const sameSite = isHttps ? 'None' : 'Lax';
  const secureFlag = isHttps ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAgeSeconds}${secureFlag}`
  );
}

export function clearSessionCookie(req: express.Request, res: express.Response): void {
  const isHttps = isSecureRequest(req);
  const sameSite = isHttps ? 'None' : 'Lax';
  const secureFlag = isHttps ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureFlag}`
  );
}

export function maskSessionToken(rawToken: string): string {
  const digest = crypto.createHash('sha256').update(rawToken).digest('hex').slice(0, 16);
  return `httpOnly_${digest}`;
}

export function persistSessionToDb(token: string, sess: ServerSessionRecord): void {
  const pgPool = getPgPool();
  if (!pgPool) return;
  pgPool
    .query(
      `INSERT INTO user_sessions (token, user_id, role, organization_id, branch_id, issued_at, expires_at, permissions_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (token) DO UPDATE
       SET role = EXCLUDED.role, organization_id = EXCLUDED.organization_id, branch_id = EXCLUDED.branch_id,
           expires_at = EXCLUDED.expires_at, permissions_version = EXCLUDED.permissions_version`,
      [
        token,
        sess.userId,
        sess.role,
        sess.organizationId,
        sess.branchId,
        sess.issuedAt,
        sess.expiresAt,
        sess.permissionsVersion,
      ]
    )
    .catch((err: any) => console.error('[PostgreSQL Sessions] Error saving session:', err.message));
}

export function deleteSessionFromDb(token: string): void {
  const pgPool = getPgPool();
  if (!pgPool) return;
  pgPool
    .query('DELETE FROM user_sessions WHERE token = $1', [token])
    .catch((err: any) => console.error('[PostgreSQL Sessions] Error deleting session:', err.message));
}

export function deleteUserSessionsFromDb(userId: string): void {
  const pgPool = getPgPool();
  if (!pgPool) return;
  pgPool
    .query('DELETE FROM user_sessions WHERE user_id = $1', [userId])
    .catch((err: any) => console.error('[PostgreSQL Sessions] Error deleting user sessions:', err.message));
}

export async function updateUserSessionsPermissionsVersion(
  userId: string,
  permissionsVersion: number,
  role?: string
): Promise<void> {
  let updatedMemory = false;
  for (const sess of activeServerSessions.values()) {
    if (sess.userId === userId) {
      sess.permissionsVersion = permissionsVersion;
      if (role) {
        sess.role = role;
      }
      updatedMemory = true;
    }
  }
  if (updatedMemory) {
    saveServerSessions();
  }

  const pgPool = getPgPool();
  if (!pgPool) return;
  try {
    if (role) {
      await pgPool.query(
        'UPDATE user_sessions SET permissions_version = $1, role = $2 WHERE user_id = $3',
        [permissionsVersion, role, userId]
      );
    } else {
      await pgPool.query(
        'UPDATE user_sessions SET permissions_version = $1 WHERE user_id = $2',
        [permissionsVersion, userId]
      );
    }
  } catch (err: any) {
    console.error('[PostgreSQL Sessions] Error updating permissions_version:', err.message);
  }
}

export async function loadServerSessions(): Promise<void> {
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          token VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          role VARCHAR(64) NOT NULL,
          organization_id VARCHAR(64) NOT NULL,
          branch_id VARCHAR(64),
          issued_at TIMESTAMPTZ NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          permissions_version INTEGER DEFAULT 1
        );
      `);
      await pgPool.query('DELETE FROM user_sessions WHERE expires_at <= NOW()');
      const res = await pgPool.query('SELECT * FROM user_sessions WHERE expires_at > NOW()');
      for (const row of res.rows) {
        activeServerSessions.set(row.token, {
          userId: row.user_id,
          role: row.role,
          organizationId: row.organization_id,
          branchId: row.branch_id || '',
          issuedAt: new Date(row.issued_at).toISOString(),
          expiresAt: new Date(row.expires_at).toISOString(),
          permissionsVersion: Number(row.permissions_version) || 1,
        });
      }
      console.log(`[PostgreSQL Sessions] Loaded ${activeServerSessions.size} active session(s).`);
      return;
    } catch (err: any) {
      console.error('[PostgreSQL Sessions] Falling back to sessions.json:', err.message);
    }
  }

  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const now = Date.now();
        for (const [token, sess] of Object.entries<any>(parsed)) {
          if (sess && sess.userId && sess.expiresAt && new Date(sess.expiresAt).getTime() > now) {
            activeServerSessions.set(token, sess);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Auth Sessions] Error loading sessions.json:', err);
  }
}

export function saveServerSessions(): void {
  try {
    const obj: Record<string, any> = {};
    const now = Date.now();
    for (const [token, sess] of activeServerSessions.entries()) {
      if (new Date(sess.expiresAt).getTime() > now) {
        obj[token] = sess;
      } else {
        activeServerSessions.delete(token);
        deleteSessionFromDb(token);
      }
    }
    const tmpFile = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), 'utf-8');
    fs.renameSync(tmpFile, SESSIONS_FILE);
  } catch (err) {
    console.error('[Auth Sessions] Error saving sessions.json:', err);
  }
}

export function buildSafeSessionPayload(
  user: any,
  rawToken: string,
  issuedAt: string,
  expiresAt: string,
  currentBranchId?: string
) {
  const serverDbState = getServerDbState();
  const ttlSeconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - new Date(issuedAt).getTime()) / 1000));

  const userBranches = (serverDbState.data.userBranches || []).filter((ub: any) => ub.userId === user.id);
  const defaultBranch =
    currentBranchId ||
    userBranches.find((ub: any) => ub.isDefault)?.branchId ||
    userBranches[0]?.branchId ||
    (serverDbState.data.branches || []).find((b: any) => b.organizationId === user.organizationId)?.id ||
    serverDbState.data.branches?.[0]?.id ||
    'branch-default';

  const roles = serverDbState.data.roles || [];
  const roleObj = roles.find((r: any) => r.id === user.roleId);
  const effective = getUserEffectivePermissions(user, roles);
  const org =
    (serverDbState.organizationsList || []).find((o: any) => o.id === user.organizationId) ||
    serverDbState.data.organization;

  const allowedBranchIds =
    user.roleId === 'SUPER_ADMIN'
      ? (serverDbState.data.branches || []).map((b: any) => b.id)
      : userBranches.map((ub: any) => ub.branchId);

  const userHasCustomTabs = Array.isArray(user.allowedNavTabs) && user.allowedNavTabs.length > 0;
  const roleHasCustomTabs = Array.isArray(roleObj?.allowedNavTabs) && roleObj.allowedNavTabs.length > 0;
  const resolvedAllowedNavTabs =
    user.roleId === 'SUPER_ADMIN'
      ? effective.allowedNavTabs
      : userHasCustomTabs
      ? user.allowedNavTabs
      : roleHasCustomTabs
      ? roleObj.allowedNavTabs
      : undefined;

  return {
    userId: user.id,
    organizationId: org?.id || user.organizationId || 'org-default',
    organizationName: org?.name || '',
    organizationLegalName: org?.legalName || org?.name || '',
    organizationTaxId: org?.taxId || '',
    role: user.roleId,
    roleName: roleObj?.name || user.roleId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    specialty: user.specialty,
    professionalLicense: user.professionalLicense,
    currentBranchId: defaultBranch,
    allowedBranchIds,
    permissionsVersion: user.permissionsVersion || 1,
    effectivePermissions: effective.effectivePermissions,
    customPermissions: Array.isArray(user.customPermissions) ? user.customPermissions : [],
    revokedPermissions: Array.isArray(user.revokedPermissions) ? user.revokedPermissions : [],
    assignedRestrictions: Array.isArray(user.assignedRestrictions) ? user.assignedRestrictions : [],
    allowedNavTabs: resolvedAllowedNavTabs,
    sessionToken: maskSessionToken(rawToken),
    issuedAt,
    expiresAt,
    cookieConfig: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: true,
      maxAgeSeconds: ttlSeconds,
    },
  };
}

export function authenticateServerRequest(req: express.Request): {
  authenticated: boolean;
  statusCode: number;
  error?: string;
  token?: string;
  sessionData?: ServerSessionRecord;
  user?: any;
  actor?: TenantActorContext;
} {
  const token = extractSessionToken(req);
  if (!token) {
    return {
      authenticated: false,
      statusCode: 401,
      error: '401 No autorizado: Sesión requerida.',
    };
  }

  const sessionData = activeServerSessions.get(token);
  if (!sessionData) {
    return {
      authenticated: false,
      statusCode: 401,
      error: '401 No autorizado: Sesión inválida o inexistente.',
    };
  }

  if (new Date(sessionData.expiresAt).getTime() <= Date.now()) {
    activeServerSessions.delete(token);
    deleteSessionFromDb(token);
    saveServerSessions();
    return {
      authenticated: false,
      statusCode: 401,
      error: '401 No autorizado: Sesión expirada.',
    };
  }

  const serverDbState = getServerDbState();
  const user = (serverDbState.data.users || []).find((u: any) => u.id === sessionData.userId);
  if (!user || user.status === 'INACTIVE') {
    activeServerSessions.delete(token);
    deleteSessionFromDb(token);
    saveServerSessions();
    return {
      authenticated: false,
      statusCode: 401,
      error: '401 No autorizado: Cuenta de usuario inexistente o inactiva.',
    };
  }

  if (user.sessionRevokedAt && new Date(user.sessionRevokedAt).getTime() >= new Date(sessionData.issuedAt).getTime()) {
    activeServerSessions.delete(token);
    deleteSessionFromDb(token);
    saveServerSessions();
    return {
      authenticated: false,
      statusCode: 401,
      error: '401 No autorizado: La sesión ha sido revocada por el administrador.',
    };
  }

  const userBranches = (serverDbState.data.userBranches || [])
    .filter((ub: any) => ub.userId === user.id)
    .map((ub: any) => ub.branchId);

  const allowedBranchIds =
    user.roleId === 'SUPER_ADMIN'
      ? (serverDbState.data.branches || []).map((b: any) => b.id)
      : userBranches;

  const effective = getUserEffectivePermissions(user, serverDbState.data.roles || []);

  return {
    authenticated: true,
    statusCode: 200,
    token,
    sessionData,
    user,
    actor: {
      userId: user.id,
      role: user.roleId,
      organizationId: user.organizationId,
      allowedBranchIds,
      customPermissions: Array.isArray(user.customPermissions) ? user.customPermissions : [],
      revokedPermissions: Array.isArray(user.revokedPermissions) ? user.revokedPermissions : [],
      assignedRestrictions: Array.isArray(user.assignedRestrictions) ? user.assignedRestrictions : [],
      allowedNavTabs: effective.allowedNavTabs,
      professionalLicense: user.professionalLicense || null,
    },
  };
}

export type ModuleEnforcementMode = 'off' | 'log' | 'enforce';

export function getModuleEnforcementMode(): ModuleEnforcementMode {
  const raw = String(process.env.PERMISSIONS_ENFORCE_MODULES || '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'enforce' || raw === 'strict') {
    return 'enforce';
  }
  if (raw === 'log' || raw === 'audit' || raw === 'shadow' || raw === 'warn') {
    return 'log';
  }
  return 'off';
}

export interface ModuleAccessCheckResult {
  allowed: boolean;
  mode: ModuleEnforcementMode;
  wouldDeny: boolean;
  requiredModules: SystemModuleId[];
  statusCode?: number;
  code?: 'MODULE_ACCESS_DENIED';
  error?: string;
}

export function evaluateModuleAccess(
  auth: { user?: any; actor?: TenantActorContext },
  requiredModules: SystemModuleId | SystemModuleId[],
  contextLabel?: string
): ModuleAccessCheckResult {
  const modulesList: SystemModuleId[] = Array.isArray(requiredModules)
    ? requiredModules
    : [requiredModules];
  const mode = getModuleEnforcementMode();

  if (modulesList.length === 0) {
    return { allowed: true, mode, wouldDeny: false, requiredModules: [] };
  }

  const roleId = String(auth.user?.roleId || auth.actor?.role || '');
  if (isSuperAdminRole(roleId)) {
    return { allowed: true, mode, wouldDeny: false, requiredModules: modulesList };
  }

  const serverDbState = getServerDbState();
  const roles = serverDbState.data?.roles || [];
  const roleObj = roles.find((r: any) => r.id === roleId);
  const sessionLike = {
    role: roleId,
    allowedNavTabs: Array.isArray(auth.user?.allowedNavTabs)
      ? auth.user.allowedNavTabs
      : undefined,
  };

  const hasAnyRequiredModule = modulesList.some((modId) =>
    hasModuleAccess(sessionLike, modId, roleObj)
  );

  if (hasAnyRequiredModule) {
    return { allowed: true, mode, wouldDeny: false, requiredModules: modulesList };
  }

  const moduleLabels = modulesList
    .map((id) => getModuleById(id)?.label || id)
    .join(' o ');

  if (mode === 'off') {
    return { allowed: true, mode, wouldDeny: true, requiredModules: modulesList };
  }

  if (mode === 'log') {
    console.warn(
      `[ModuleGuard][OBSERVACION] Acceso fuera de módulo detectado en ${contextLabel || 'API'} (rol=${roleId}, requiere=${modulesList.join('|')}). No bloqueado porque PERMISSIONS_ENFORCE_MODULES=log.`
    );
    return { allowed: true, mode, wouldDeny: true, requiredModules: modulesList };
  }

  console.warn(
    `[ModuleGuard][BLOQUEADO] Acceso denegado en ${contextLabel || 'API'} (rol=${roleId}, requiere=${modulesList.join('|')}).`
  );

  return {
    allowed: false,
    mode,
    wouldDeny: true,
    requiredModules: modulesList,
    statusCode: 403,
    code: 'MODULE_ACCESS_DENIED',
    error: `403 Prohibido: No tenés acceso habilitado al módulo "${moduleLabels}" para realizar esta operación.`,
  };
}

export function denyIfModuleNotAllowed(
  auth: { user?: any; actor?: TenantActorContext },
  res: express.Response,
  requiredModules: SystemModuleId | SystemModuleId[],
  contextLabel?: string
): boolean {
  const result = evaluateModuleAccess(auth, requiredModules, contextLabel);
  if (!result.allowed) {
    res.status(result.statusCode || 403).json({
      error: result.error,
      code: result.code || 'MODULE_ACCESS_DENIED',
      requiredModules: result.requiredModules,
    });
    return true;
  }
  return false;
}

const DELTA_COLLECTION_MODULES: Record<string, SystemModuleId[] | null> = {
  auditLogs: null,
  organizationsList: ['organization'],
  roles: ['users'],
  branches: ['branches'],
  dentalChairs: ['branches'],
  branchSettings: ['branches'],
  users: ['users'],
  userBranches: ['users'],
  services: ['treatments', 'branches', 'quotes'],
  branchServices: ['treatments', 'branches', 'quotes'],
  insurancePlans: ['quotes', 'treatments', 'patients'],
  planServicePrices: ['quotes', 'treatments', 'patients'],
  patients: ['patients'],
  patientBranches: ['patients', 'agenda', 'clinical', 'odontogram'],
  appointments: ['agenda'],
  clinicalRecords: ['clinical'],
  odontograms: ['odontogram'],
  odontogramItems: ['odontogram'],
  quotes: ['quotes'],
  quoteItems: ['quotes'],
  treatments: ['treatments', 'quotes', 'cash'],
  insuranceClaims: ['treatments', 'quotes', 'cash'],
  cashRegisters: ['cash'],
  cashMovements: ['cash'],
  payments: ['cash', 'treatments'],
  employees: ['staff-payroll'],
  employeeSalaries: ['staff-payroll'],
  commissionRules: ['staff-payroll'],
  generatedCommissions: ['staff-payroll', 'cash', 'treatments', 'patients'],
  payrollSettlements: ['staff-payroll'],
  payrollSettlementItems: ['staff-payroll'],
  staffPayments: ['staff-payroll'],
};

export function getRequiredModulesForDeltaCollection(col: string): SystemModuleId[] | null {
  if (Object.prototype.hasOwnProperty.call(DELTA_COLLECTION_MODULES, col)) {
    return DELTA_COLLECTION_MODULES[col];
  }
  return null;
}

export function isOriginAllowed(origin: string, req: express.Request): boolean {
  if (!origin) return true;
  const host = req.headers.host;
  if (host && (origin === `https://${host}` || origin === `http://${host}`)) {
    return true;
  }
  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (extraOrigins.includes(origin)) return true;
  if (process.env.VITE_APP_URL && origin === process.env.VITE_APP_URL.trim().replace(/\/$/, '')) {
    return true;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.run.app')) return true;
    if (parsed.protocol === 'https:' && parsed.hostname.endsWith('.onrender.com')) return true;
  } catch {
    return false;
  }
  return false;
}

export function securityHeadersMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IFRAME_PREVIEW !== 'true') {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
}

export function corsAndCsrfMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin, req)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  } else if (origin && req.path.startsWith('/api/')) {
    return res.status(403).json({ error: '403 Prohibido: Origen no autorizado.' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (
    req.path.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    origin &&
    !isOriginAllowed(origin, req)
  ) {
    return res.status(403).json({ error: '403 Prohibido: Validación anti-CSRF fallida.' });
  }
  next();
}

export function apiRateLimitMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = apiRateLimitMap.get(clientIp);
  if (!bucket || bucket.resetAt <= now) {
    apiRateLimitMap.set(clientIp, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 300) {
    return res.status(429).json({ error: '429 Demasiadas solicitudes. Intente en unos segundos.' });
  }
  next();
}
