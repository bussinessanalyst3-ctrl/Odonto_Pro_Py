import crypto from 'crypto';
import type pg from 'pg';
import { getPgPool } from './stateStore.ts';

export type HealthTrafficStatus = 'green' | 'yellow' | 'red';
export type PublicDbHealthStatus = 'ok' | 'degraded' | 'down';

export type HealthModuleId =
  | 'agenda'
  | 'patients'
  | 'odontogram'
  | 'treatments'
  | 'clinical'
  | 'quotes'
  | 'cash'
  | 'staff-payroll'
  | 'branches'
  | 'users'
  | 'organization'
  | 'audit'
  | 'dashboard'
  | 'other';

export interface HealthModuleDefinition {
  id: HealthModuleId;
  label: string;
}

export const HEALTH_MODULES: readonly HealthModuleDefinition[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'patients', label: 'Pacientes' },
  { id: 'odontogram', label: 'Odontograma' },
  { id: 'treatments', label: 'Tratamientos' },
  { id: 'clinical', label: 'Historia Clínica' },
  { id: 'quotes', label: 'Presupuestos' },
  { id: 'cash', label: 'Caja' },
  { id: 'staff-payroll', label: 'Gestión del Funcionario' },
  { id: 'branches', label: 'Sucursales' },
  { id: 'users', label: 'Usuarios y Accesos' },
  { id: 'organization', label: 'Empresa' },
  { id: 'audit', label: 'Auditoría' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'other', label: 'Otros' },
] as const;

const VALID_MODULE_IDS = new Set<string>(HEALTH_MODULES.map((m) => m.id));

export type HealthErrorSource = 'backend' | 'database' | 'frontend';

export interface SanitizedErrorEvent {
  id: string;
  timestamp: string;
  module: HealthModuleId;
  route: string;
  method: string;
  statusCode: number;
  source: HealthErrorSource;
  message: string;
  organizationId?: string;
  userId?: string;
}

export interface DbHealthProbeResult {
  status: HealthTrafficStatus;
  publicStatus: PublicDbHealthStatus;
  mode: 'postgres' | 'local-fallback';
  latencyMs: number | null;
  checkedAt: string;
  cached: boolean;
  errorMessage?: string;
}

export interface ModuleHealthSummary {
  id: HealthModuleId;
  label: string;
  errors24h: number;
  status: HealthTrafficStatus;
  lastError: {
    timestamp: string;
    route: string;
    method: string;
    statusCode: number;
    source: HealthErrorSource;
    message: string;
  } | null;
}

export interface SystemHealthAlert {
  level: 'red' | 'yellow';
  title: string;
  detail: string;
}

export interface OwnerSystemHealthPayload {
  checkedAt: string;
  server: {
    status: HealthTrafficStatus;
    uptimeSec: number;
    startedAt: string;
    version?: string;
    environment: string;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
    nodeVersion: string;
  };
  database: DbHealthProbeResult;
  modules: ModuleHealthSummary[];
  summary: {
    overallStatus: HealthTrafficStatus;
    totalErrors24h: number;
    affectedModulesCount: number;
    alerts: SystemHealthAlert[];
    recentErrors: SanitizedErrorEvent[];
    retentionNote: string;
  };
}

const MAX_STORED_ERRORS = 500;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_15M_MS = 15 * 60 * 1000;
const MAX_MESSAGE_LEN = 180;
const MAX_ROUTE_LEN = 120;

const DB_PROBE_TIMEOUT_MS = 3000;
const DB_SLOW_THRESHOLD_MS = 500;
const DB_CACHE_TTL_MS = 30_000;

const SERVER_STARTED_AT = new Date().toISOString();

const errorEventsBuffer: SanitizedErrorEvent[] = [];

// Caché y single-flight para evitar saturar el pool de conexiones en ráfagas
let cachedDbProbe: { result: DbHealthProbeResult; expiresAt: number } | null = null;
let inFlightDbProbe: Promise<DbHealthProbeResult> | null = null;

// Rate limit por usuario para POST /api/client-errors
const clientErrorUserBuckets = new Map<string, { count: number; resetAt: number }>();
const clientErrorModuleBuckets = new Map<string, { count: number; resetAt: number }>();

// Rate limit dedicado para GET /api/health/db (complementa el global)
const publicDbHealthRateMap = new Map<string, { count: number; resetAt: number }>();

type DbProbeOverride = () => Promise<{
  ok: boolean;
  latencyMs?: number;
  errorMessage?: string;
  mode?: 'postgres' | 'local-fallback';
}>;
let dbProbeOverrideForTests: DbProbeOverride | null = null;

export function setDbHealthProbeOverrideForTests(override: DbProbeOverride | null): void {
  dbProbeOverrideForTests = override;
  cachedDbProbe = null;
  inFlightDbProbe = null;
}

export function clearHealthMonitorStateForTests(): void {
  errorEventsBuffer.length = 0;
  cachedDbProbe = null;
  inFlightDbProbe = null;
  clientErrorUserBuckets.clear();
  clientErrorModuleBuckets.clear();
  publicDbHealthRateMap.clear();
}

export function getDeployedVersion(): string | undefined {
  const raw = String(
    process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT ||
      process.env.SOURCE_VERSION ||
      ''
  ).trim();
  if (!raw) return undefined;
  if (/^[a-f0-9]{12,64}$/i.test(raw)) {
    return raw.slice(0, 12);
  }
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40);
  return safe || undefined;
}

export function sanitizeErrorMessage(raw: unknown): string {
  try {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (raw && typeof raw === 'object' && 'message' in (raw as any)) {
      text = String((raw as any).message ?? '');
    } else if (raw !== null && raw !== undefined) {
      text = String(raw);
    }

    text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (!text) return 'Error interno del sistema';

    // 1. Enmascarar URLs de conexión PostgreSQL con credenciales
    text = text.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[db-url]');

    // 2. Enmascarar tokens Bearer y JWT
    text = text.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{6,}\b/gi, 'Bearer [redacted]');
    text = text.replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g,
      '[jwt]'
    );

    // 3. Enmascarar pares clave=valor / JSON de secretos, contraseñas, cookies y tokens
    text = text.replace(
      /("?(?:password|passwd|pwd|secret|token|access_token|refresh_token|session_token|cookie|authorization|api[_-]?key|database_url|direct_url|auth_secret|odontopro_sid)"?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}{]+)/gi,
      '$1[redacted]'
    );

    // 4. Enmascarar correos electrónicos completos
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');

    // 5. Enmascarar tokens opacos largos (hex >= 24 o prefijo httpOnly_)
    text = text.replace(/\bhttpOnly_[A-Za-z0-9_-]{6,}\b/g, '[token]');
    text = text.replace(/\b[a-f0-9]{24,}\b/gi, '[token]');

    text = text.trim();
    if (text.length > MAX_MESSAGE_LEN) {
      return `${text.slice(0, MAX_MESSAGE_LEN - 3)}...`;
    }
    return text || 'Error interno del sistema';
  } catch {
    return 'Error interno del sistema';
  }
}

export function sanitizeRoutePath(rawRoute: unknown): string {
  try {
    let route = String(rawRoute || '/').trim();
    // Descartar query string para nunca registrar parámetros sensibles
    const qIdx = route.indexOf('?');
    if (qIdx >= 0) {
      route = route.slice(0, qIdx);
    }
    route = route.replace(/[\r\n\t]+/g, '');
    route = route.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
    // Normalizar UUIDs y tokens en segmentos de ruta
    route = route.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
      '/:id'
    );
    route = route.replace(/\/[a-f0-9]{24,}(?=\/|$)/gi, '/:id');
    route = route.replace(/\/\d{5,}(?=\/|$)/g, '/:id');
    if (!route.startsWith('/')) {
      route = `/${route}`;
    }
    if (route.length > MAX_ROUTE_LEN) {
      return route.slice(0, MAX_ROUTE_LEN);
    }
    return route || '/';
  } catch {
    return '/';
  }
}

export function normalizeModuleId(raw: unknown): HealthModuleId {
  const normalized = String(raw || '').trim().toLowerCase();
  if (VALID_MODULE_IDS.has(normalized)) {
    return normalized as HealthModuleId;
  }
  return 'other';
}

const DELTA_COLLECTION_TO_MODULE: Record<string, HealthModuleId> = {
  appointments: 'agenda',
  patients: 'patients',
  patientBranches: 'patients',
  odontograms: 'odontogram',
  odontogramItems: 'odontogram',
  treatments: 'treatments',
  services: 'treatments',
  branchServices: 'treatments',
  insurancePlans: 'treatments',
  planServicePrices: 'treatments',
  insuranceClaims: 'treatments',
  clinicalRecords: 'clinical',
  quotes: 'quotes',
  quoteItems: 'quotes',
  cashRegisters: 'cash',
  cashMovements: 'cash',
  payments: 'cash',
  employees: 'staff-payroll',
  employeeSalaries: 'staff-payroll',
  commissionRules: 'staff-payroll',
  generatedCommissions: 'staff-payroll',
  payrollSettlements: 'staff-payroll',
  payrollSettlementItems: 'staff-payroll',
  staffPayments: 'staff-payroll',
  branches: 'branches',
  dentalChairs: 'branches',
  branchSettings: 'branches',
  users: 'users',
  userBranches: 'users',
  roles: 'users',
  organizationsList: 'organization',
  auditLogs: 'audit',
};

export function inferModuleFromRoute(
  rawRoute: string,
  deltaCollections?: string[]
): HealthModuleId {
  const path = sanitizeRoutePath(rawRoute).toLowerCase();

  if (path.startsWith('/api/appointments')) return 'agenda';
  if (path.startsWith('/api/patients')) return 'patients';
  if (path.startsWith('/api/odontogram')) return 'odontogram';
  if (
    path.startsWith('/api/treatments') ||
    path.startsWith('/api/services') ||
    path.startsWith('/api/insurance')
  ) {
    return 'treatments';
  }
  if (path.startsWith('/api/clinical-records') || path.startsWith('/api/clinical')) {
    return 'clinical';
  }
  if (path.startsWith('/api/quotes')) return 'quotes';
  if (path.startsWith('/api/cash-registers') || path.startsWith('/api/payments')) return 'cash';
  if (path.startsWith('/api/payroll')) return 'staff-payroll';
  if (path.startsWith('/api/branches') || path.startsWith('/api/chairs')) return 'branches';
  if (
    path.startsWith('/api/users') ||
    path.startsWith('/api/roles') ||
    path.startsWith('/api/auth')
  ) {
    return 'users';
  }
  if (path.startsWith('/api/organizations')) return 'organization';
  if (path.startsWith('/api/audit-logs') || path.startsWith('/api/audit')) return 'audit';
  if (path.startsWith('/api/dashboard') || path.startsWith('/api/reports')) return 'dashboard';

  if (path.startsWith('/api/db/delta') && Array.isArray(deltaCollections)) {
    for (const col of deltaCollections) {
      const mapped = DELTA_COLLECTION_TO_MODULE[col];
      if (mapped) return mapped;
    }
  }

  return 'other';
}

function pruneOldEvents(nowMs: number): void {
  const cutoff = nowMs - RETENTION_MS;
  while (errorEventsBuffer.length > 0) {
    const oldestTs = new Date(errorEventsBuffer[0].timestamp).getTime();
    if (!Number.isFinite(oldestTs) || oldestTs < cutoff) {
      errorEventsBuffer.shift();
    } else {
      break;
    }
  }
  while (errorEventsBuffer.length > MAX_STORED_ERRORS) {
    errorEventsBuffer.shift();
  }
}

export function recordSystemError(params: {
  module?: HealthModuleId | string;
  route?: string;
  method?: string;
  statusCode?: number;
  source: HealthErrorSource;
  message?: unknown;
  organizationId?: string;
  userId?: string;
}): void {
  try {
    const statusCode = Number(params.statusCode ?? 500);
    // Solo registrar errores de servidor (>= 500), fallos de BD o errores de render de módulo
    if (params.source === 'backend' && statusCode < 500) {
      return;
    }

    const nowMs = Date.now();
    const safeRoute = sanitizeRoutePath(params.route || '/');
    const safeMethod = String(params.method || 'GET')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10) || 'GET';
    const moduleId = params.module
      ? normalizeModuleId(params.module)
      : inferModuleFromRoute(safeRoute);

    const safeOrgId = params.organizationId
      ? String(params.organizationId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : undefined;
    const safeUserId = params.userId
      ? String(params.userId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : undefined;

    const event: SanitizedErrorEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(nowMs).toISOString(),
      module: moduleId,
      route: safeRoute,
      method: safeMethod,
      statusCode: Number.isFinite(statusCode) ? statusCode : 500,
      source: params.source,
      message: sanitizeErrorMessage(params.message),
      ...(safeOrgId ? { organizationId: safeOrgId } : {}),
      ...(safeUserId ? { userId: safeUserId } : {}),
    };

    errorEventsBuffer.push(event);
    pruneOldEvents(nowMs);

    // Log estructurado sanitizado para persistencia externa en logs de Render
    console.error(
      '[ODONTOPRO:HEALTH]',
      JSON.stringify({
        ts: event.timestamp,
        source: event.source,
        module: event.module,
        method: event.method,
        route: event.route,
        statusCode: event.statusCode,
        message: event.message,
        ...(safeOrgId ? { orgId: safeOrgId } : {}),
        ...(safeUserId ? { userId: safeUserId } : {}),
      })
    );
  } catch {
    // El monitoreo jamás puede hacer fallar la petición original
  }
}

export function allowClientErrorReport(userId: string, moduleId: HealthModuleId): boolean {
  try {
    const now = Date.now();
    if (clientErrorUserBuckets.size > 500) {
      for (const [k, v] of clientErrorUserBuckets.entries()) {
        if (v.resetAt <= now) clientErrorUserBuckets.delete(k);
      }
    }
    if (clientErrorModuleBuckets.size > 500) {
      for (const [k, v] of clientErrorModuleBuckets.entries()) {
        if (v.resetAt <= now) clientErrorModuleBuckets.delete(k);
      }
    }

    // Límite por usuario: máx. 10 reportes cada 5 minutos
    const userKey = userId || 'anon';
    const userBucket = clientErrorUserBuckets.get(userKey);
    if (!userBucket || userBucket.resetAt <= now) {
      clientErrorUserBuckets.set(userKey, { count: 1, resetAt: now + 5 * 60_000 });
    } else {
      userBucket.count += 1;
      if (userBucket.count > 10) return false;
    }

    // Límite por usuario + módulo: máx. 3 reportes por minuto
    const modKey = `${userKey}:${moduleId}`;
    const modBucket = clientErrorModuleBuckets.get(modKey);
    if (!modBucket || modBucket.resetAt <= now) {
      clientErrorModuleBuckets.set(modKey, { count: 1, resetAt: now + 60_000 });
    } else {
      modBucket.count += 1;
      if (modBucket.count > 3) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function allowPublicDbHealthRequest(clientIp: string): boolean {
  try {
    const now = Date.now();
    if (publicDbHealthRateMap.size > 500) {
      for (const [k, v] of publicDbHealthRateMap.entries()) {
        if (v.resetAt <= now) publicDbHealthRateMap.delete(k);
      }
    }
    const key = clientIp || 'unknown';
    const bucket = publicDbHealthRateMap.get(key);
    if (!bucket || bucket.resetAt <= now) {
      publicDbHealthRateMap.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    bucket.count += 1;
    // Máx. 30 consultas/minuto por IP (además de la caché de 30 s)
    return bucket.count <= 30;
  } catch {
    return true;
  }
}

/**
 * Ejecuta SELECT 1 con timeout propio (3 s) destruyendo inmediatamente la conexión
 * en caso de timeout para no dejar slots retenidos en el pool de 10 conexiones.
 */
async function runTimedSelectOne(pool: pg.Pool, timeoutMs: number): Promise<number> {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  let timedOut = false;
  let client: pg.PoolClient | null = null;
  let released = false;

  const releaseOnce = (destroy: boolean) => {
    if (!released && client) {
      released = true;
      try {
        client.release(destroy);
      } catch {
        // Ignorar errores al liberar conexión ya cerrada
      }
    }
  };

  const probePromise = (async () => {
    const acquired = await pool.connect();
    if (timedOut) {
      try {
        acquired.release(true);
      } catch {
        // Ignorar
      }
      throw new Error('Tiempo de espera agotado al conectar con la base de datos.');
    }
    client = acquired;
    await client.query('SELECT 1');
    const latencyMs = Date.now() - started;
    releaseOnce(false);
    return latencyMs;
  })();

  // Evita UnhandledPromiseRejection si timeoutPromise gana la carrera
  probePromise.catch(() => {});

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      // Destruye el cliente inmediatamente para liberar el slot del pool
      releaseOnce(true);
      reject(new Error(`Timeout al verificar base de datos (>${timeoutMs} ms).`));
    }, timeoutMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([probePromise, timeoutPromise]);
  } catch (err) {
    releaseOnce(true);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeDatabaseProbe(): Promise<DbHealthProbeResult> {
  const checkedAt = new Date().toISOString();

  if (dbProbeOverrideForTests) {
    try {
      const custom = await dbProbeOverrideForTests();
      const latencyMs = typeof custom.latencyMs === 'number' ? Math.max(0, Math.round(custom.latencyMs)) : 0;
      const mode = custom.mode || 'postgres';
      if (!custom.ok) {
        return {
          status: 'red',
          publicStatus: 'down',
          mode,
          latencyMs: null,
          checkedAt,
          cached: false,
          errorMessage: sanitizeErrorMessage(custom.errorMessage || 'Error de conexión con la base de datos.'),
        };
      }
      const isSlow = latencyMs > DB_SLOW_THRESHOLD_MS;
      return {
        status: isSlow ? 'yellow' : 'green',
        publicStatus: isSlow ? 'degraded' : 'ok',
        mode,
        latencyMs,
        checkedAt,
        cached: false,
      };
    } catch (err: any) {
      return {
        status: 'red',
        publicStatus: 'down',
        mode: 'postgres',
        latencyMs: null,
        checkedAt,
        cached: false,
        errorMessage: sanitizeErrorMessage(err?.message || err),
      };
    }
  }

  const pgPool = getPgPool();
  if (!pgPool) {
    const hasDatabaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());
    if (hasDatabaseUrlConfigured) {
      return {
        status: 'red',
        publicStatus: 'down',
        mode: 'postgres',
        latencyMs: null,
        checkedAt,
        cached: false,
        errorMessage: 'No se pudo inicializar el pool de conexión PostgreSQL.',
      };
    }
    return {
      status: 'yellow',
      publicStatus: 'ok',
      mode: 'local-fallback',
      latencyMs: 0,
      checkedAt,
      cached: false,
      errorMessage: 'Operando en almacenamiento local (DATABASE_URL no configurado).',
    };
  }

  try {
    const latencyMs = await runTimedSelectOne(pgPool, DB_PROBE_TIMEOUT_MS);
    const isSlow = latencyMs > DB_SLOW_THRESHOLD_MS;
    return {
      status: isSlow ? 'yellow' : 'green',
      publicStatus: isSlow ? 'degraded' : 'ok',
      mode: 'postgres',
      latencyMs,
      checkedAt,
      cached: false,
    };
  } catch (err: any) {
    return {
      status: 'red',
      publicStatus: 'down',
      mode: 'postgres',
      latencyMs: null,
      checkedAt,
      cached: false,
      errorMessage: sanitizeErrorMessage(err?.message || err),
    };
  }
}

export async function checkDatabaseHealth(options?: {
  bypassCache?: boolean;
}): Promise<DbHealthProbeResult> {
  const now = Date.now();
  if (!options?.bypassCache && cachedDbProbe && cachedDbProbe.expiresAt > now) {
    return { ...cachedDbProbe.result, cached: true };
  }

  if (inFlightDbProbe) {
    return inFlightDbProbe;
  }

  inFlightDbProbe = executeDatabaseProbe()
    .then((result) => {
      cachedDbProbe = {
        result,
        expiresAt: Date.now() + DB_CACHE_TTL_MS,
      };
      return result;
    })
    .finally(() => {
      inFlightDbProbe = null;
    });

  return inFlightDbProbe;
}

export async function getPublicDbHealthResponse(): Promise<{
  httpStatus: 200 | 503;
  body: { status: PublicDbHealthStatus };
}> {
  const probe = await checkDatabaseHealth({ bypassCache: false });
  return {
    httpStatus: probe.publicStatus === 'down' ? 503 : 200,
    body: { status: probe.publicStatus },
  };
}

export async function getOwnerSystemHealth(options?: {
  fresh?: boolean;
}): Promise<OwnerSystemHealthPayload> {
  const nowMs = Date.now();
  pruneOldEvents(nowMs);

  const database = await checkDatabaseHealth({ bypassCache: Boolean(options?.fresh) });
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

  const cutoff24h = nowMs - WINDOW_24H_MS;
  const cutoff15m = nowMs - WINDOW_15M_MS;

  const events24h = errorEventsBuffer.filter(
    (e) => new Date(e.timestamp).getTime() >= cutoff24h
  );

  const modules: ModuleHealthSummary[] = HEALTH_MODULES.map((mod) => {
    const modEvents24h = events24h.filter((e) => e.module === mod.id);
    const modEvents15m = modEvents24h.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff15m
    );
    const last = modEvents24h.length > 0 ? modEvents24h[modEvents24h.length - 1] : null;

    let status: HealthTrafficStatus = 'green';
    if (modEvents24h.length >= 5 || modEvents15m.length >= 3) {
      status = 'red';
    } else if (modEvents24h.length >= 1) {
      status = 'yellow';
    }

    return {
      id: mod.id,
      label: mod.label,
      errors24h: modEvents24h.length,
      status,
      lastError: last
        ? {
            timestamp: last.timestamp,
            route: last.route,
            method: last.method,
            statusCode: last.statusCode,
            source: last.source,
            message: last.message,
          }
        : null,
    };
  });

  const redModules = modules.filter((m) => m.status === 'red');
  const affectedModules = modules.filter((m) => m.errors24h > 0);
  const alerts: SystemHealthAlert[] = [];

  if (database.status === 'red') {
    alerts.push({
      level: 'red',
      title: 'Base de datos sin respuesta',
      detail: database.errorMessage || 'No se pudo completar SELECT 1 en PostgreSQL.',
    });
  } else if (database.status === 'yellow' && database.mode === 'postgres') {
    alerts.push({
      level: 'yellow',
      title: 'Latencia elevada en base de datos',
      detail: `Respuesta actual de ${database.latencyMs ?? 0} ms (umbral recomendado: <= ${DB_SLOW_THRESHOLD_MS} ms).`,
    });
  }

  for (const mod of redModules) {
    alerts.push({
      level: 'red',
      title: `Fallas repetidas en ${mod.label}`,
      detail: `Se registraron ${mod.errors24h} error(es) en las últimas 24 horas.`,
    });
  }

  let overallStatus: HealthTrafficStatus = 'green';
  if (database.status === 'red' || redModules.length > 0) {
    overallStatus = 'red';
  } else if (database.status === 'yellow' || affectedModules.length > 0) {
    overallStatus = 'yellow';
  }

  const version = getDeployedVersion();
  const recentErrors = [...errorEventsBuffer].reverse().slice(0, 100);

  return {
    checkedAt: new Date(nowMs).toISOString(),
    server: {
      status: 'green',
      uptimeSec: Math.round(process.uptime()),
      startedAt: SERVER_STARTED_AT,
      ...(version ? { version } : {}),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rssMb: toMb(mem.rss),
        heapUsedMb: toMb(mem.heapUsed),
        heapTotalMb: toMb(mem.heapTotal),
      },
      nodeVersion: process.version,
    },
    database,
    modules,
    summary: {
      overallStatus,
      totalErrors24h: events24h.length,
      affectedModulesCount: affectedModules.length,
      alerts,
      recentErrors,
      retentionNote: 'El historial se reinicia al reiniciar o redesplegar el servidor.',
    },
  };
}
