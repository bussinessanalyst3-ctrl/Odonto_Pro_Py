import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { generateInitialSeedData } from '../src/db/seeds/initial-seed.ts';
import { hasPermission, isSuperAdminRole } from '../src/security/rbacHierarchy.ts';
import { ensurePayrollIntegrity } from '../src/db/payrollEngine.ts';
import {
  applyDeltaToRelationalDb,
  DbDeltaPayload,
  loadStateFromRelationalDb,
  syncFullStateToRelationalDb,
} from '../src/db/pgRepository.ts';
import { sanitizeUsersForClient } from './crypto.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db_store.json');
export const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// PostgreSQL Connection Pool (Supabase, Neon, Cloud SQL)
let pgPool: pg.Pool | null = null;
if (process.env.DATABASE_URL) {
  try {
    let dbUrl = process.env.DATABASE_URL;
    try {
      const parsed = new URL(dbUrl);
      const sslMode = parsed.searchParams.get('sslmode');
      if (
        (sslMode === 'require' || sslMode === 'prefer') &&
        !parsed.searchParams.has('uselibpqcompat') &&
        !parsed.searchParams.has('sslrootcert')
      ) {
        parsed.searchParams.set('uselibpqcompat', 'true');
        dbUrl = parsed.toString();
      }
    } catch {
      // Keep original connection string if not standard URL
    }
    const isLocalhost =
      dbUrl.includes('localhost') ||
      dbUrl.includes('127.0.0.1');
    pgPool = new pg.Pool({
      connectionString: dbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
    });
    pgPool.on('error', (err: any) => {
      console.error('[PostgreSQL] Unexpected client error:', err.message);
    });
    console.log('[PostgreSQL] Initialized PostgreSQL connection pool from DATABASE_URL.');
  } catch (err) {
    console.error('[PostgreSQL] Failed to initialize pool:', err);
    pgPool = null;
  }
}

export interface ServerDbState {
  data: any;
  organizationsList: any[];
}

let serverDbState: ServerDbState = {
  data: {},
  organizationsList: [],
};
let serverStateVersion = 1;
let pgWriteQueue: Promise<void> = Promise.resolve();
const orgTransactionLocks = new Map<string, Promise<void>>();
const recordVersions = new Map<string, number>();

function recordVersionKey(collection: string, key: string): string {
  return `${collection}:${key}`;
}

function getDeltaRecordKey(collection: string, item: any): string {
  if (!item || typeof item !== 'object') return '';
  switch (collection) {
    case 'branchSettings':
      return String(item.branchId || item.id || '');
    case 'userBranches':
      return `${String(item.userId || '')}::${String(item.branchId || '')}`;
    case 'branchServices':
      return `${String(item.branchId || '')}::${String(item.serviceId || '')}`;
    case 'patientBranches':
      return `${String(item.patientId || '')}::${String(item.branchId || '')}`;
    default:
      return String(item.id || '');
  }
}

export function getRecordVersion(collection: string, key: string): number {
  return recordVersions.get(recordVersionKey(collection, key)) ?? 0;
}

export function stampRecordVersions(delta: DbDeltaPayload, version: number): void {
  if (delta.upserts) {
    for (const [col, items] of Object.entries(delta.upserts)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const key = getDeltaRecordKey(col, item);
        if (key) {
          recordVersions.set(recordVersionKey(col, key), version);
        }
      }
    }
  }
  if (delta.deletes) {
    for (const [col, keys] of Object.entries(delta.deletes)) {
      if (!Array.isArray(keys)) continue;
      for (const key of keys) {
        if (key) {
          recordVersions.set(recordVersionKey(col, String(key)), version);
        }
      }
    }
  }
}

/**
 * Serializa mutaciones críticas por organización (previene race conditions de
 * cobros concurrentes, doble apertura de caja y doble reserva en agenda).
 */
export async function withOrgTransactionLock<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  const lockKey = orgId || '__global__';
  const previous = orgTransactionLocks.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => gate, () => gate);
  orgTransactionLocks.set(lockKey, chained);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (orgTransactionLocks.get(lockKey) === chained) {
      orgTransactionLocks.delete(lockKey);
    }
  }
}

export function getPgPool(): pg.Pool | null {
  return pgPool;
}

export function getServerDbState(): ServerDbState {
  return serverDbState;
}

export function setServerDbState(nextState: ServerDbState): void {
  serverDbState = nextState;
  recordVersions.clear();
}

export function getServerStateVersion(): number {
  return serverStateVersion;
}

export function ensureInsuranceIntegrity(state: any): void {
  if (!state || !state.data) return;
  const initial = generateInitialSeedData();
  if (!state.data.insurancePlans || !Array.isArray(state.data.insurancePlans) || state.data.insurancePlans.length === 0) {
    state.data.insurancePlans = initial.insurancePlans || [];
  }
  if (!state.data.planServicePrices || !Array.isArray(state.data.planServicePrices) || state.data.planServicePrices.length === 0) {
    state.data.planServicePrices = initial.planServicePrices || [];
  }
  if (state.data.patients && Array.isArray(state.data.patients)) {
    state.data.patients.forEach((p: any) => {
      if (!p.modality) {
        p.modality = 'PARTICULAR';
        p.insurancePlanId = null;
        p.insuranceMemberNumber = null;
      }
    });
  }
  ensurePayrollIntegrity(state.data);
}

export function saveDatabaseStateToDisk(): void {
  try {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ ...serverDbState, stateVersion: serverStateVersion }, null, 2),
      'utf-8'
    );
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[Backend Database] Error persisting to db_store.json:', err);
  }
}

export async function loadDatabaseState(): Promise<void> {
  recordVersions.clear();
  if (pgPool) {
    try {
      console.log('[PostgreSQL] Initializing and hydrating 32 relational tables...');
      const loaded = await loadStateFromRelationalDb(pgPool);
      serverDbState = loaded.state;
      serverStateVersion = loaded.stateVersion || 1;
      ensureInsuranceIntegrity(serverDbState);
      saveDatabaseStateToDisk();
      console.log(
        `[PostgreSQL] Loaded relational state (${serverDbState.organizationsList?.length || 1} org(s), ${serverDbState.data?.patients?.length || 0} patient(s), v${serverStateVersion}${loaded.migratedFromLegacy ? ', migrated from legacy system_state' : ''}).`
      );
      return;
    } catch (err: any) {
      console.error('[PostgreSQL] Error connecting/hydrating relational DB, falling back to local disk:', err.message);
    }
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && parsed.organizationsList && Array.isArray(parsed.organizationsList)) {
        serverDbState = {
          data: parsed.data,
          organizationsList: parsed.organizationsList,
        };
        serverStateVersion = Number(parsed.stateVersion) || 1;
        ensureInsuranceIntegrity(serverDbState);
        console.log(
          `[Backend Database] Loaded persistent state with ${serverDbState.organizationsList.length} organization(s) (v${serverStateVersion}).`
        );
        return;
      }
    }
  } catch (err) {
    console.error('[Backend Database] Error reading persistent db_store.json:', err);
  }

  const initial = generateInitialSeedData();
  serverDbState = {
    data: initial,
    organizationsList: [initial.organization],
  };
  serverStateVersion = 1;
  saveDatabaseStateToDisk();
  console.log('[Backend Database] Initialized fresh database state from seed.');
}

function enqueuePgOperation(op: () => Promise<void>): Promise<void> {
  const next = pgWriteQueue.then(op, op);
  pgWriteQueue = next.catch(() => {});
  return next;
}

export async function saveDatabaseStateStrict(delta?: DbDeltaPayload): Promise<number> {
  const previousVersion = serverStateVersion;
  const previousRecordSnapshots = new Map<string, number | undefined>();
  if (delta) {
    for (const [col, items] of Object.entries(delta.upserts || {})) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const key = getDeltaRecordKey(col, item);
        if (key) {
          const rk = recordVersionKey(col, key);
          previousRecordSnapshots.set(rk, recordVersions.get(rk));
        }
      }
    }
    for (const [col, keys] of Object.entries(delta.deletes || {})) {
      if (!Array.isArray(keys)) continue;
      for (const key of keys) {
        if (key) {
          const rk = recordVersionKey(col, String(key));
          previousRecordSnapshots.set(rk, recordVersions.get(rk));
        }
      }
    }
  }

  serverStateVersion += 1;
  const versionSnapshot = serverStateVersion;
  if (delta) {
    stampRecordVersions(delta, versionSnapshot);
  }

  if (pgPool) {
    try {
      if (delta) {
        await enqueuePgOperation(() =>
          applyDeltaToRelationalDb(pgPool!, delta, serverDbState, versionSnapshot)
        );
      } else {
        await enqueuePgOperation(() =>
          syncFullStateToRelationalDb(pgPool!, serverDbState, versionSnapshot)
        );
      }
    } catch (err) {
      serverStateVersion = previousVersion;
      for (const [rk, oldVer] of previousRecordSnapshots.entries()) {
        if (oldVer === undefined) recordVersions.delete(rk);
        else recordVersions.set(rk, oldVer);
      }
      throw err;
    }
  }

  saveDatabaseStateToDisk();
  return versionSnapshot;
}

export function saveDatabaseState(delta?: DbDeltaPayload): Promise<void> {
  serverStateVersion += 1;
  const versionSnapshot = serverStateVersion;
  if (delta) {
    stampRecordVersions(delta, versionSnapshot);
  }
  saveDatabaseStateToDisk();

  if (!pgPool) {
    return Promise.resolve();
  }

  if (delta) {
    return enqueuePgOperation(() => applyDeltaToRelationalDb(pgPool!, delta, serverDbState, versionSnapshot)).catch(
      (err: any) => {
        console.error('[PostgreSQL] Error applying relational delta:', err.message);
      }
    );
  }

  return enqueuePgOperation(() => syncFullStateToRelationalDb(pgPool!, serverDbState, versionSnapshot)).catch(
    (err: any) => {
      console.error('[PostgreSQL] Error syncing full relational state:', err.message);
    }
  );
}

export const CLINICAL_ACCESS_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN_ORGANIZACION',
  'ADMIN_SUCURSAL',
  'SUPERVISOR',
  'ODONTOLOGO',
  'ASISTENTE',
]);

export interface TenantActorContext {
  userId: string;
  role: string;
  organizationId: string;
  allowedBranchIds: string[];
  customPermissions?: string[];
  revokedPermissions?: string[];
  assignedRestrictions?: string[];
  allowedNavTabs?: string[];
  professionalLicense?: string | null;
}

export function actorHasDynamicPermission(
  actor: TenantActorContext,
  permission: string,
  roles: any[]
): boolean {
  const roleObj = (roles || []).find((r: any) => r.id === actor.role);
  const dynamicPerms = Array.isArray(roleObj?.permissions) ? roleObj.permissions : undefined;
  return hasPermission(actor, permission, dynamicPerms);
}

/**
 * Filtra y redacta estrictamente el estado del servidor según aislamiento multiempresa,
 * privacidad clínica y permisos efectivos RBAC del actor autenticado.
 */
export function filterStateForTenant(
  state: ServerDbState,
  actorOrOrgId: TenantActorContext | string,
  legacyRoleId?: string
): ServerDbState {
  const d = state.data || {};

  const actor: TenantActorContext =
    typeof actorOrOrgId === 'string'
      ? {
          userId: '',
          role: legacyRoleId || '',
          organizationId: actorOrOrgId,
          allowedBranchIds: [],
          customPermissions: [],
          revokedPermissions: [],
          assignedRestrictions: [],
        }
      : actorOrOrgId;

  const orgId = actor.organizationId;
  const roleId = actor.role;

  const roles = d.roles || [];

  const org =
    (state.organizationsList || []).find((o: any) => o.id === orgId) ||
    (d.organization?.id === orgId ? d.organization : null);

  const branches = (d.branches || []).filter((b: any) => b.organizationId === orgId);
  const branchIds = new Set(branches.map((b: any) => b.id));
  const allowedBranchSet = new Set(actor.allowedBranchIds || []);

  const users = sanitizeUsersForClient(
    (d.users || []).filter(
      (u: any) => u.organizationId === orgId && !isSuperAdminRole(u.roleId)
    )
  );
  const userIds = new Set(users.map((u: any) => u.id));

  const canSeeClinical =
    CLINICAL_ACCESS_ROLES.has(roleId) ||
    actorHasDynamicPermission(actor, 'clinical.view', roles) ||
    actorHasDynamicPermission(actor, 'odontogram.manage', roles);

  const patients = (d.patients || [])
    .filter((p: any) => p.organizationId === orgId)
    .map((p: any) => {
      if (canSeeClinical) return p;
      return {
        ...p,
        bloodType: null,
        allergies: 'Confidencial (Solo personal clínico)',
        medicalConditions: 'Confidencial',
        medications: 'Confidencial',
      };
    });
  const patientIds = new Set(patients.map((p: any) => p.id));

  const insurancePlans = (d.insurancePlans || []).filter((p: any) => p.organizationId === orgId);
  const planIds = new Set(insurancePlans.map((p: any) => p.id));

  const quotes = (d.quotes || []).filter((q: any) => q.organizationId === orgId);
  const quoteIds = new Set(quotes.map((q: any) => q.id));

  const odontograms = canSeeClinical
    ? (d.odontograms || []).filter((o: any) => o.organizationId === orgId)
    : [];
  const odontogramIds = new Set(odontograms.map((o: any) => o.id));

  const cashRegisters = (d.cashRegisters || []).filter((c: any) => c.organizationId === orgId);
  const cashRegisterIds = new Set(cashRegisters.map((c: any) => c.id));

  // Auditoría: restringida estrictamente por permiso audit.view / audit.view_own_branch
  const canViewAllAudit = actorHasDynamicPermission(actor, 'audit.view', roles);
  const canViewBranchAudit = actorHasDynamicPermission(actor, 'audit.view_own_branch', roles);
  const auditLogs = (d.auditLogs || []).filter((al: any) => {
    if (al.organizationId !== orgId) return false;
    if (canViewAllAudit) return true;
    if (canViewBranchAudit) {
      return !al.branchId || allowedBranchSet.has(al.branchId);
    }
    return false;
  });

  // Personal, Salarios, Comisiones y Liquidaciones: aislamiento por permiso RBAC
  const orgEmployees = (d.employees || []).filter((e: any) => e.organizationId === orgId);
  const ownEmp = actor.userId ? orgEmployees.find((e: any) => e.userId === actor.userId) : undefined;

  const canViewAllStaff =
    actorHasDynamicPermission(actor, 'staff.view', roles) ||
    actorHasDynamicPermission(actor, 'commissions.view_all', roles) ||
    actorHasDynamicPermission(actor, 'payroll.create', roles) ||
    actorHasDynamicPermission(actor, 'payroll.approve', roles) ||
    actorHasDynamicPermission(actor, 'payroll.pay', roles);

  const canViewOwnPayroll = actorHasDynamicPermission(actor, 'commissions.view_own', roles);
  const canViewAllSalaries = actorHasDynamicPermission(actor, 'salaries.view', roles);
  const canManageCommRules = actorHasDynamicPermission(actor, 'commissions.rules_manage', roles);

  const employees = canViewAllStaff
    ? orgEmployees
    : orgEmployees
        .filter((e: any) => (ownEmp && e.id === ownEmp.id) || (e.status === 'ACTIVE' && (e.isAdvisor || e.area === 'CLINICA')))
        .map((e: any) => {
          if (ownEmp && e.id === ownEmp.id) return e;
          // Proyección mínima segura (sin C.I., correo, teléfono ni observaciones privadas) para selectores operativos
          return {
            id: e.id,
            organizationId: e.organizationId,
            branchId: e.branchId,
            userId: e.userId,
            employeeCode: e.employeeCode,
            firstName: e.firstName,
            lastName: e.lastName,
            area: e.area,
            position: e.position,
            status: e.status,
            isAdvisor: e.isAdvisor,
          };
        });

  const employeeIds = new Set(orgEmployees.map((e: any) => e.id));

  const employeeSalaries = canViewAllSalaries
    ? (d.employeeSalaries || []).filter((es: any) => employeeIds.has(es.employeeId))
    : canViewOwnPayroll && ownEmp
      ? (d.employeeSalaries || []).filter((es: any) => es.employeeId === ownEmp.id)
      : [];

  const commissionRules =
    canViewAllStaff || canManageCommRules
      ? (d.commissionRules || []).filter((cr: any) => cr.organizationId === orgId)
      : [];

  const generatedCommissions = canViewAllStaff
    ? (d.generatedCommissions || []).filter(
        (gc: any) => gc.organizationId === orgId || employeeIds.has(gc.employeeId)
      )
    : canViewOwnPayroll && ownEmp
      ? (d.generatedCommissions || []).filter((gc: any) => gc.employeeId === ownEmp.id)
      : [];

  const payrollSettlements = canViewAllStaff
    ? (d.payrollSettlements || []).filter((s: any) => s.organizationId === orgId)
    : canViewOwnPayroll && ownEmp
      ? (d.payrollSettlements || []).filter((s: any) => s.organizationId === orgId && s.employeeId === ownEmp.id)
      : [];

  const settlementIds = new Set(payrollSettlements.map((s: any) => s.id));

  const payrollSettlementItems =
    canViewAllStaff || (canViewOwnPayroll && ownEmp)
      ? (d.payrollSettlementItems || []).filter((psi: any) => settlementIds.has(psi.settlementId))
      : [];

  const staffPayments = canViewAllStaff
    ? (d.staffPayments || []).filter(
        (sp: any) => sp.organizationId === orgId || employeeIds.has(sp.employeeId)
      )
    : canViewOwnPayroll && ownEmp
      ? (d.staffPayments || []).filter((sp: any) => sp.employeeId === ownEmp.id)
      : [];

  return {
    organizationsList: org ? [org] : [],
    data: {
      ...d,
      roles,
      organization: org || d.organization,
      branches,
      branchSettings: (d.branchSettings || []).filter((bs: any) => branchIds.has(bs.branchId)),
      dentalChairs: (d.dentalChairs || []).filter((dc: any) => dc.organizationId === orgId),
      users,
      userBranches: (d.userBranches || []).filter((ub: any) => userIds.has(ub.userId) && branchIds.has(ub.branchId)),
      services: (d.services || []).filter((s: any) => s.organizationId === orgId),
      branchServices: (d.branchServices || []).filter((bs: any) => branchIds.has(bs.branchId)),
      insurancePlans,
      planServicePrices: (d.planServicePrices || []).filter((psp: any) =>
        planIds.has(psp.planId || psp.insurancePlanId)
      ),
      insuranceClaims: (d.insuranceClaims || []).filter((ic: any) => ic.organizationId === orgId),
      patients,
      patientBranches: (d.patientBranches || []).filter((pb: any) => patientIds.has(pb.patientId)),
      appointments: (d.appointments || []).filter((a: any) => a.organizationId === orgId),
      clinicalRecords: canSeeClinical
        ? (d.clinicalRecords || []).filter((cr: any) => cr.organizationId === orgId)
        : [],
      odontograms,
      odontogramItems: canSeeClinical
        ? (d.odontogramItems || []).filter((oi: any) => odontogramIds.has(oi.odontogramId))
        : [],
      quotes,
      quoteItems: (d.quoteItems || []).filter((qi: any) => quoteIds.has(qi.quoteId)),
      treatments: (d.treatments || []).filter((t: any) => t.organizationId === orgId),
      cashRegisters,
      cashMovements: (d.cashMovements || []).filter((cm: any) => cashRegisterIds.has(cm.cashRegisterId)),
      payments: (d.payments || []).filter((p: any) => p.organizationId === orgId),
      auditLogs,
      employees,
      employeeSalaries,
      commissionRules,
      generatedCommissions,
      payrollSettlements,
      payrollSettlementItems,
      staffPayments,
    },
  };
}
