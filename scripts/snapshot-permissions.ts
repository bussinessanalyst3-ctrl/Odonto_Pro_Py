import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { generateInitialSeedData } from '../src/db/seeds/initial-seed.ts';
import { loadStateFromRelationalDb } from '../src/db/pgRepository.ts';
import { getUserEffectivePermissions } from '../src/security/rbacHierarchy.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_OUT_PATH = path.join(ROOT_DIR, 'data', 'permissions-snapshot-baseline.json');

export interface UserPermissionSnapshotEntry {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  organizationId: string;
  status: string;
  roleId: string;
  permissionsVersion: number;
  allowedNavTabsEffective: string[];
  effectivePermissions: string[];
  customPermissions: string[];
  revokedPermissions: string[];
  assignedRestrictions: string[];
  rawAllowedNavTabs: string[];
}

export interface PermissionsSnapshotDocument {
  generatedAt: string;
  source: 'postgresql' | 'local-db-store' | 'initial-seed';
  userCount: number;
  users: UserPermissionSnapshotEntry[];
}

export interface UserPermissionDiff {
  userId: string;
  email: string;
  roleIdBefore: string | null;
  roleIdAfter: string | null;
  addedModules: string[];
  lostModules: string[];
  addedPermissions: string[];
  lostPermissions: string[];
  statusChanged: boolean;
}

function uniqueSorted(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map((v) => String(v)))).sort((a, b) => a.localeCompare(b));
}

function buildPgConnectionString(rawDbUrl: string): string {
  try {
    const parsed = new URL(rawDbUrl);
    const sslMode = parsed.searchParams.get('sslmode');
    if (
      (sslMode === 'require' || sslMode === 'prefer') &&
      !parsed.searchParams.has('uselibpqcompat') &&
      !parsed.searchParams.has('sslrootcert')
    ) {
      parsed.searchParams.set('uselibpqcompat', 'true');
      return parsed.toString();
    }
  } catch {
    // Keep original connection string
  }
  return rawDbUrl;
}

async function loadUsersAndRoles(): Promise<{
  source: PermissionsSnapshotDocument['source'];
  users: any[];
  roles: any[];
}> {
  const rawDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (rawDbUrl) {
    const dbUrl = buildPgConnectionString(rawDbUrl);
    const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    const pool = new pg.Pool({
      connectionString: dbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 15000,
    });
    try {
      const loaded = await loadStateFromRelationalDb(pool);
      return {
        source: 'postgresql',
        users: loaded.state?.data?.users || [],
        roles: loaded.state?.data?.roles || [],
      };
    } finally {
      await pool.end();
    }
  }

  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');
  const dbStorePath = path.join(dataDir, 'db_store.json');
  if (fs.existsSync(dbStorePath)) {
    const raw = fs.readFileSync(dbStorePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      source: 'local-db-store',
      users: parsed?.data?.users || [],
      roles: parsed?.data?.roles || [],
    };
  }

  const seed = generateInitialSeedData();
  return {
    source: 'initial-seed',
    users: seed.users || [],
    roles: seed.roles || [],
  };
}

export function buildSnapshotFromData(
  source: PermissionsSnapshotDocument['source'],
  users: any[],
  roles: any[]
): PermissionsSnapshotDocument {
  const entries: UserPermissionSnapshotEntry[] = [...users]
    .sort((a, b) => String(a.email || a.id).localeCompare(String(b.email || b.id)))
    .map((user) => {
      const eff = getUserEffectivePermissions(user, roles);
      return {
        userId: String(user.id),
        email: String(user.email || ''),
        username: String(user.username || ''),
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        organizationId: String(user.organizationId || ''),
        status: String(user.status || 'ACTIVE'),
        roleId: String(user.roleId || ''),
        permissionsVersion: Number(user.permissionsVersion || 1),
        allowedNavTabsEffective: uniqueSorted(eff.allowedNavTabs),
        effectivePermissions: uniqueSorted(eff.effectivePermissions),
        customPermissions: uniqueSorted(user.customPermissions),
        revokedPermissions: uniqueSorted(user.revokedPermissions),
        assignedRestrictions: uniqueSorted(user.assignedRestrictions),
        rawAllowedNavTabs: uniqueSorted(user.allowedNavTabs),
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    source,
    userCount: entries.length,
    users: entries,
  };
}

export function compareSnapshots(
  baseline: PermissionsSnapshotDocument,
  current: PermissionsSnapshotDocument
): UserPermissionDiff[] {
  const baseById = new Map(baseline.users.map((u) => [u.userId, u]));
  const currById = new Map(current.users.map((u) => [u.userId, u]));
  const allIds = Array.from(new Set([...baseById.keys(), ...currById.keys()])).sort();
  const diffs: UserPermissionDiff[] = [];

  for (const id of allIds) {
    const before = baseById.get(id);
    const after = currById.get(id);

    const beforeMods = new Set(before?.allowedNavTabsEffective || []);
    const afterMods = new Set(after?.allowedNavTabsEffective || []);
    const beforePerms = new Set(before?.effectivePermissions || []);
    const afterPerms = new Set(after?.effectivePermissions || []);

    const addedModules = Array.from(afterMods).filter((m) => !beforeMods.has(m)).sort();
    const lostModules = Array.from(beforeMods).filter((m) => !afterMods.has(m)).sort();
    const addedPermissions = Array.from(afterPerms).filter((p) => !beforePerms.has(p)).sort();
    const lostPermissions = Array.from(beforePerms).filter((p) => !afterPerms.has(p)).sort();
    const roleChanged = (before?.roleId || null) !== (after?.roleId || null);
    const statusChanged = (before?.status || null) !== (after?.status || null);

    if (
      addedModules.length > 0 ||
      lostModules.length > 0 ||
      addedPermissions.length > 0 ||
      lostPermissions.length > 0 ||
      roleChanged ||
      statusChanged
    ) {
      diffs.push({
        userId: id,
        email: after?.email || before?.email || id,
        roleIdBefore: before?.roleId || null,
        roleIdAfter: after?.roleId || null,
        addedModules,
        lostModules,
        addedPermissions,
        lostPermissions,
        statusChanged,
      });
    }
  }

  return diffs;
}

function getArgValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

async function runCli() {
  const args = process.argv.slice(2);
  const outArg = getArgValue(args, '--out');
  const compareArg = getArgValue(args, '--compare');
  const failOnLoss = args.includes('--fail-on-loss');

  const { source, users, roles } = await loadUsersAndRoles();
  const snapshot = buildSnapshotFromData(source, users, roles);

  const outPath = outArg ? path.resolve(ROOT_DIR, outArg) : DEFAULT_OUT_PATH;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  console.log(
    `[snapshot-permissions] Snapshot generado (${snapshot.userCount} usuario(s), fuente: ${snapshot.source}) -> ${path.relative(ROOT_DIR, outPath)}`
  );

  if (compareArg) {
    const comparePath = path.resolve(ROOT_DIR, compareArg);
    if (!fs.existsSync(comparePath)) {
      throw new Error(`No existe archivo de línea base para comparar: ${comparePath}`);
    }
    const baseline = JSON.parse(fs.readFileSync(comparePath, 'utf-8')) as PermissionsSnapshotDocument;
    const diffs = compareSnapshots(baseline, snapshot);

    if (diffs.length === 0) {
      console.log('[snapshot-permissions] COMPARACIÓN: 0 diferencias respecto a la línea base.');
      return;
    }

    console.log(`[snapshot-permissions] COMPARACIÓN: ${diffs.length} usuario(s) con diferencias:`);
    let hasLoss = false;
    for (const d of diffs) {
      if (d.lostModules.length > 0 || d.lostPermissions.length > 0) {
        hasLoss = true;
      }
      console.log(
        `  - ${d.email} (${d.userId}) | rol: ${d.roleIdBefore} -> ${d.roleIdAfter}` +
          (d.addedModules.length ? ` | +módulos: [${d.addedModules.join(', ')}]` : '') +
          (d.lostModules.length ? ` | -módulos PERDIDOS: [${d.lostModules.join(', ')}]` : '') +
          (d.addedPermissions.length ? ` | +permisos: ${d.addedPermissions.length}` : '') +
          (d.lostPermissions.length ? ` | -permisos PERDIDOS: [${d.lostPermissions.join(', ')}]` : '')
      );
    }

    if (failOnLoss && hasLoss) {
      console.error('[snapshot-permissions] ERROR: Se detectó pérdida de accesos respecto a la línea base.');
      process.exit(1);
    }
  }
}

const isMainEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainEntry) {
  runCli().catch((err) => {
    console.error('[snapshot-permissions] Error fatal:', err?.message || err);
    process.exit(1);
  });
}
