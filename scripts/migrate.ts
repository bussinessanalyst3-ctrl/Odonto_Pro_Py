import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
export const DEFAULT_MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');
const MIGRATION_ADVISORY_LOCK_ID = 88421001;

export interface MigrationFileEntry {
  filename: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export interface MigrationRunResult {
  applied: string[];
  alreadyApplied: string[];
  pending: string[];
}

export function computeMigrationChecksum(sql: string): string {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export function listMigrationFiles(migrationsDir: string = DEFAULT_MIGRATIONS_DIR): MigrationFileEntry[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((filename) => {
    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    return {
      filename,
      fullPath,
      sql,
      checksum: computeMigrationChecksum(sql),
    };
  });
}

export async function applyPendingMigrations(
  pool: pg.Pool,
  options: { migrationsDir?: string; dryRun?: boolean } = {}
): Promise<MigrationRunResult> {
  const entries = listMigrationFiles(options.migrationsDir || DEFAULT_MIGRATIONS_DIR);
  const client = await pool.connect();

  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [MIGRATION_ADVISORY_LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appliedRows = await client.query<{ filename: string; checksum: string }>(
      `SELECT filename, checksum FROM schema_migrations ORDER BY filename ASC`
    );
    const appliedMap = new Map<string, string>(
      (appliedRows.rows || []).map((r) => [r.filename, r.checksum])
    );

    const alreadyApplied: string[] = [];
    const pendingEntries: MigrationFileEntry[] = [];

    for (const entry of entries) {
      const existingChecksum = appliedMap.get(entry.filename);
      if (existingChecksum) {
        if (existingChecksum !== entry.checksum) {
          throw new Error(
            `Checksum mismatch en migración ya aplicada "${entry.filename}". No modifique migraciones históricas; cree una nueva migración incremental.`
          );
        }
        alreadyApplied.push(entry.filename);
      } else {
        pendingEntries.push(entry);
      }
    }

    if (options.dryRun) {
      return {
        applied: [],
        alreadyApplied,
        pending: pendingEntries.map((e) => e.filename),
      };
    }

    const applied: string[] = [];
    for (const entry of pendingEntries) {
      await client.query('BEGIN');
      try {
        await client.query(entry.sql);
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_at) VALUES ($1, $2, NOW())`,
          [entry.filename, entry.checksum]
        );
        await client.query('COMMIT');
        applied.push(entry.filename);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return {
      applied,
      alreadyApplied,
      pending: [],
    };
  } finally {
    try {
      await client.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_ADVISORY_LOCK_ID]);
    } catch {
      // Ignore unlock error if connection already closed
    }
    client.release();
  }
}

async function runCli() {
  const args = new Set(process.argv.slice(2));
  const allowMissingDb = args.has('--if-configured');
  const statusOnly = args.has('--status');

  const rawDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!rawDbUrl) {
    const entries = listMigrationFiles();
    if (allowMissingDb) {
      console.log(
        `[db:migrate] DATABASE_URL/DIRECT_URL no configurado (${entries.length} migración(es) locales verificadas). Saltando ejecución remota.`
      );
      return;
    }
    throw new Error('DIRECT_URL o DATABASE_URL no están configurados para ejecutar migraciones.');
  }

  let dbUrl = rawDbUrl;
  try {
    const parsed = new URL(rawDbUrl);
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

  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 15000,
  });

  try {
    const result = await applyPendingMigrations(pool, { dryRun: statusOnly });
    if (statusOnly) {
      console.log(
        `[db:migrate --status] Aplicadas: ${result.alreadyApplied.length} | Pendientes: ${result.pending.length}`
      );
    } else {
      console.log(
        `[db:migrate] Completado. Aplicadas ahora: ${result.applied.length} | Previas: ${result.alreadyApplied.length}`
      );
    }
  } finally {
    await pool.end();
  }
}

const isMainEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainEntry) {
  runCli().catch((err) => {
    console.error('[db:migrate] Error fatal:', err?.message || err);
    process.exit(1);
  });
}
