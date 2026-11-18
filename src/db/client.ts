// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN A BASE DE DATOS (Drizzle ORM + Connection Pooling)
// Compatible con Neon Serverless, Supabase (PgBouncer/Supavisor) y Cloud SQL
// ============================================================================

export interface DatabaseConfig {
  connectionString: string;
  isPooler: boolean;
  ssl: boolean;
  maxConnections: number;
}

export function getDatabaseConfig(): DatabaseConfig {
  // Las variables de entorno de producción pueden configurarse en .env
  const dbUrl = (typeof process !== 'undefined' && process.env?.DATABASE_URL) 
    ? process.env.DATABASE_URL 
    : 'postgresql://postgres:postgres@localhost:5432/odontopro_db';

  // Detección automática de Connection Pooler (Neon / Supabase Transaction Mode)
  const isPooler = dbUrl.includes('pooler.supabase.com') || 
                   dbUrl.includes('-pooler.') || 
                   dbUrl.includes('channel_binding=') || 
                   dbUrl.includes('pgbouncer=true');

  return {
    connectionString: dbUrl,
    isPooler,
    ssl: !dbUrl.includes('localhost'),
    maxConnections: isPooler ? 10 : 5,
  };
}

export const DB_MIGRATION_META = {
  version: '202611180001_staff_payroll_and_patient_traceability',
  appliedAt: '2026-11-18T00:00:00.000Z',
  tablesCount: 28,
  dialects: ['PostgreSQL 16+', 'Neon Serverless', 'Supabase'],
  tables: [
    'organizations',
    'branches',
    'branch_settings',
    'roles',
    'users',
    'user_branches',
    'patients',
    'patient_branches',
    'services',
    'branch_services',
    'appointments',
    'clinical_records',
    'odontograms',
    'odontogram_items',
    'quotes',
    'quote_items',
    'treatments',
    'cash_registers',
    'cash_movements',
    'payments',
    'audit_logs',
    'employees',
    'employee_salaries',
    'commission_rules',
    'generated_commissions',
    'payroll_settlements',
    'payroll_settlement_items',
    'staff_payments',
  ],
};
