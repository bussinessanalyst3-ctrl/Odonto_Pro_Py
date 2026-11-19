import type pg from 'pg';
import { generateInitialSeedData } from './seeds/initial-seed.ts';
import { ensurePayrollIntegrity } from './payrollEngine.ts';

export interface DbStateEnvelope {
  data: any;
  organizationsList: any[];
}

export interface DbDeltaPayload {
  baseVersion?: number;
  upserts?: Record<string, any[]>;
  deletes?: Record<string, string[]>;
  activeOrganizationId?: string;
  regulatoryRestrictions?: string[];
}

// ============================================================================
// METADATOS DE COLECCIONES Y CLAVES DETERMINÍSTICAS (32 TABLAS + ORGANIZATIONS)
// ============================================================================

export const COLLECTION_PARENT_TO_CHILD_ORDER = [
  'roles',
  'organizationsList',
  'branches',
  'branchSettings',
  'dentalChairs',
  'users',
  'userBranches',
  'services',
  'branchServices',
  'insurancePlans',
  'planServicePrices',
  'employees',
  'employeeSalaries',
  'commissionRules',
  'patients',
  'patientBranches',
  'appointments',
  'clinicalRecords',
  'odontograms',
  'odontogramItems',
  'quotes',
  'quoteItems',
  'treatments',
  'insuranceClaims',
  'cashRegisters',
  'cashMovements',
  'payments',
  'payrollSettlements',
  'generatedCommissions',
  'payrollSettlementItems',
  'staffPayments',
  'auditLogs',
] as const;

export const COLLECTION_CHILD_TO_PARENT_ORDER = [...COLLECTION_PARENT_TO_CHILD_ORDER].reverse();

export function getRecordKey(collection: string, item: any): string {
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

function toNumber(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toNullableNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function toIsoString(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString();
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toISOString();
}

function toDateOnly(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? trimmed.slice(0, 10) : d.toISOString().slice(0, 10);
  }
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

function toTimeShort(val: any, fallback: string = '08:00:00'): string {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  return fallback;
}

function parseJsonArray(val: any, fallback: any[] = []): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseJsonValue(val: any, fallback: any = null): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeUuidOrNull(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null;
}

function normalizeJsonParam(val: any): string | null {
  if (val === null || val === undefined) return null;
  return JSON.stringify(val);
}

// ============================================================================
// 1. ESQUEMA RELACIONAL IDEMPOTENTE (SUPORTA TABLAS EXISTENTES EN SUPABASE)
// ============================================================================

let schemaReadyPromise: Promise<void> | null = null;

export async function ensureRelationalSchema(pool: pg.Pool): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

      // Tablas auxiliares de estado y sesión
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_state (
          key VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
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

      // Creación base de las 32 tablas relacionales (si la BD está vacía)
      await client.query(`
        CREATE TABLE IF NOT EXISTS organizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          legal_name VARCHAR(255),
          tax_id VARCHAR(50),
          country_code VARCHAR(3) NOT NULL DEFAULT 'PRY',
          default_currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
          timezone VARCHAR(50) NOT NULL DEFAULT 'America/Asuncion',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS branches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          code VARCHAR(30) NOT NULL,
          name VARCHAR(255) NOT NULL,
          department VARCHAR(100) NOT NULL DEFAULT 'Central',
          city VARCHAR(100) NOT NULL DEFAULT 'Asunción',
          neighborhood VARCHAR(100),
          address TEXT NOT NULL DEFAULT '',
          phone VARCHAR(30) NOT NULL DEFAULT '',
          whatsapp VARCHAR(30),
          email VARCHAR(255),
          opening_time TIME NOT NULL DEFAULT '07:30:00',
          closing_time TIME NOT NULL DEFAULT '19:30:00',
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS branch_settings (
          branch_id UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
          appointment_duration_default INTEGER NOT NULL DEFAULT 30,
          slot_interval INTEGER NOT NULL DEFAULT 15,
          allow_double_booking BOOLEAN NOT NULL DEFAULT FALSE,
          require_document_on_booking BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS dental_chairs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(20) NOT NULL,
          room VARCHAR(50),
          status VARCHAR(20) NOT NULL DEFAULT 'OPERATIVE',
          color_tag VARCHAR(20) DEFAULT 'teal',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          role_id VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          phone VARCHAR(30),
          professional_license VARCHAR(50),
          specialty VARCHAR(100),
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS user_branches (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, branch_id)
        );

        CREATE TABLE IF NOT EXISTS services (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          category VARCHAR(100) NOT NULL,
          code VARCHAR(30),
          name VARCHAR(200) NOT NULL,
          description TEXT,
          default_duration_min INTEGER NOT NULL DEFAULT 30,
          base_price BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS branch_services (
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          custom_price BIGINT NOT NULL,
          is_available BOOLEAN NOT NULL DEFAULT TRUE,
          PRIMARY KEY (branch_id, service_id)
        );

        CREATE TABLE IF NOT EXISTS insurance_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          code VARCHAR(50) NOT NULL,
          name VARCHAR(200) NOT NULL,
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
          coverage_terms TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS plan_service_prices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_id UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE CASCADE,
          service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          price BIGINT NOT NULL,
          notes VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS patients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          document_type VARCHAR(20) NOT NULL DEFAULT 'CI',
          document_number VARCHAR(50) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          birth_date DATE,
          gender VARCHAR(20),
          phone VARCHAR(30) NOT NULL,
          whatsapp VARCHAR(30),
          email VARCHAR(255),
          department VARCHAR(100),
          city VARCHAR(100),
          neighborhood VARCHAR(100),
          address TEXT,
          emergency_contact_name VARCHAR(150),
          emergency_contact_phone VARCHAR(30),
          blood_type VARCHAR(10),
          allergies TEXT,
          medical_conditions TEXT,
          medications TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS patient_branches (
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
          first_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
          last_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
          PRIMARY KEY (patient_id, branch_id)
        );

        CREATE TABLE IF NOT EXISTS appointments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          dental_chair_id UUID REFERENCES dental_chairs(id) ON DELETE SET NULL,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          appointment_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          duration_min INTEGER NOT NULL,
          status VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE',
          reason TEXT,
          cancellation_reason TEXT,
          notes TEXT,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinical_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
          reason_for_consultation TEXT,
          diagnosis TEXT NOT NULL,
          treatment_performed TEXT NOT NULL,
          prescriptions TEXT,
          recommendations TEXT,
          internal_notes TEXT,
          attachments JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS odontograms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE SET NULL,
          version INTEGER NOT NULL DEFAULT 1,
          odontogram_type VARCHAR(20) NOT NULL DEFAULT 'ADULTO',
          general_observations TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS odontogram_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          odontogram_id UUID NOT NULL REFERENCES odontograms(id) ON DELETE CASCADE,
          tooth_number INTEGER NOT NULL,
          surface VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
          condition VARCHAR(50) NOT NULL,
          material VARCHAR(50),
          notes TEXT,
          color_code VARCHAR(10),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS quotes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          odontologist_id UUID REFERENCES users(id) ON DELETE SET NULL,
          quote_number VARCHAR(50) NOT NULL,
          total_amount BIGINT NOT NULL,
          discount_amount BIGINT NOT NULL DEFAULT 0,
          final_amount BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
          valid_until DATE,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS quote_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          tooth_number INTEGER,
          description TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price BIGINT NOT NULL,
          subtotal BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS treatments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
          title VARCHAR(200) NOT NULL,
          total_amount BIGINT NOT NULL,
          paid_amount BIGINT NOT NULL DEFAULT 0,
          balance_due BIGINT NOT NULL,
          status VARCHAR(25) NOT NULL DEFAULT 'EN_PROGRESO',
          start_date DATE,
          completed_date DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS insurance_claims (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          plan_id UUID NOT NULL REFERENCES insurance_plans(id) ON DELETE RESTRICT,
          claim_number VARCHAR(50) NOT NULL,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          treatment_id UUID,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          patient_member_number VARCHAR(80),
          service_name VARCHAR(255) NOT NULL,
          tooth_number INTEGER,
          original_list_price BIGINT NOT NULL,
          copay_amount BIGINT NOT NULL,
          covered_amount BIGINT NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_ENVIO',
          submission_date TIMESTAMPTZ,
          settled_date TIMESTAMPTZ,
          settlement_reference VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cash_registers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
          opening_amount BIGINT NOT NULL,
          closing_amount_expected BIGINT,
          closing_amount_real BIGINT,
          difference_amount BIGINT,
          status VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
          opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          closed_at TIMESTAMPTZ,
          observations TEXT
        );

        CREATE TABLE IF NOT EXISTS cash_movements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
          movement_type VARCHAR(20) NOT NULL,
          amount BIGINT NOT NULL,
          payment_method VARCHAR(30) NOT NULL,
          concept VARCHAR(255) NOT NULL,
          reference_number VARCHAR(100),
          performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
          treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL,
          appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
          cash_movement_id UUID REFERENCES cash_movements(id) ON DELETE SET NULL,
          receipt_number VARCHAR(50) NOT NULL,
          invoice_number VARCHAR(50),
          amount BIGINT NOT NULL,
          payment_method VARCHAR(30) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO',
          notes TEXT,
          received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS employees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          employee_code VARCHAR(40) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          document_type VARCHAR(20) NOT NULL DEFAULT 'CI',
          document_number VARCHAR(50) NOT NULL,
          phone VARCHAR(30),
          email VARCHAR(255),
          area VARCHAR(20) NOT NULL,
          position VARCHAR(120) NOT NULL,
          hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          remuneration_modality VARCHAR(30) NOT NULL DEFAULT 'SALARIO_FIJO',
          is_advisor BOOLEAN NOT NULL DEFAULT FALSE,
          observations TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS employee_salaries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
          area VARCHAR(20) NOT NULL,
          base_salary BIGINT NOT NULL,
          payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MENSUAL',
          effective_date DATE NOT NULL,
          end_date DATE,
          currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
          status VARCHAR(20) NOT NULL DEFAULT 'VIGENTE',
          observations TEXT,
          created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS commission_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          name VARCHAR(180) NOT NULL,
          area VARCHAR(20) NOT NULL,
          target_type VARCHAR(20) NOT NULL DEFAULT 'AREA',
          employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
          target_role_id VARCHAR(50),
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          concept VARCHAR(50),
          calculation_mode VARCHAR(30) NOT NULL,
          percentage_rate NUMERIC(6, 2) NOT NULL DEFAULT 0,
          fixed_amount BIGINT NOT NULL DEFAULT 0,
          calculation_base VARCHAR(30) NOT NULL DEFAULT 'AMOUNT_COLLECTED',
          trigger_condition VARCHAR(40) NOT NULL DEFAULT 'ON_PAYMENT_COLLECTED',
          effective_from DATE,
          effective_to DATE,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          notes TEXT,
          created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payroll_settlements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
          settlement_number VARCHAR(60) NOT NULL,
          area VARCHAR(20),
          period VARCHAR(10),
          period_start DATE,
          period_end DATE,
          base_salary_amount BIGINT NOT NULL DEFAULT 0,
          commissions_amount BIGINT NOT NULL DEFAULT 0,
          bonuses_amount BIGINT NOT NULL DEFAULT 0,
          advances_amount BIGINT NOT NULL DEFAULT 0,
          deductions_amount BIGINT NOT NULL DEFAULT 0,
          manual_adjustments_amount BIGINT NOT NULL DEFAULT 0,
          gross_total BIGINT NOT NULL DEFAULT 0,
          net_payable BIGINT NOT NULL DEFAULT 0,
          paid_amount BIGINT NOT NULL DEFAULT 0,
          balance_due BIGINT NOT NULL DEFAULT 0,
          status VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
          created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMPTZ,
          annulled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          annulled_at TIMESTAMPTZ,
          annulment_reason TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS generated_commissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
          rule_id UUID REFERENCES commission_rules(id) ON DELETE SET NULL,
          area VARCHAR(20) NOT NULL,
          source_type VARCHAR(30) NOT NULL,
          source_id VARCHAR(80) NOT NULL,
          dedup_key VARCHAR(200) NOT NULL,
          patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
          quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
          treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL,
          payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
          advisor_snapshot_id UUID,
          advisor_snapshot_name VARCHAR(200),
          concept VARCHAR(255) NOT NULL,
          base_amount BIGINT NOT NULL DEFAULT 0,
          applied_rate VARCHAR(60),
          commission_amount BIGINT NOT NULL,
          period VARCHAR(10),
          status VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE',
          settlement_id UUID,
          is_manual_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payroll_settlement_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          settlement_id UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE CASCADE,
          item_type VARCHAR(25) NOT NULL,
          description VARCHAR(255),
          amount BIGINT NOT NULL,
          generated_commission_id UUID REFERENCES generated_commissions(id) ON DELETE SET NULL,
          source_reference VARCHAR(120),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS staff_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
          settlement_id UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE RESTRICT,
          operation_number VARCHAR(60) NOT NULL,
          payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          amount BIGINT NOT NULL,
          payment_method VARCHAR(30) NOT NULL,
          reference_number VARCHAR(120),
          responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          responsible_user_name VARCHAR(180),
          status VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO',
          overpayment_override BOOLEAN NOT NULL DEFAULT FALSE,
          overpayment_override_reason TEXT,
          annulled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          annulled_at TIMESTAMPTZ,
          annulment_reason TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(50) NOT NULL,
          entity VARCHAR(50) NOT NULL,
          entity_id VARCHAR(50),
          ip_address VARCHAR(45),
          user_agent TEXT,
          old_values JSONB,
          new_values JSONB,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // Normalizar columna lastName -> last_name en tabla users (bug histórico de 0000_init_schema.sql)
      const userColsRes = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
      `);
      const userCols = new Set(userColsRes.rows.map((r: any) => r.column_name));
      if (userCols.has('lastname') && !userCols.has('last_name')) {
        await client.query(`ALTER TABLE users RENAME COLUMN lastname TO last_name;`);
      }

      // Agregar columnas extendidas idempotentemente para tablas ya existentes en Supabase
      await client.query(`
        ALTER TABLE organizations
          ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
          ADD COLUMN IF NOT EXISTS email VARCHAR(255),
          ADD COLUMN IF NOT EXISTS address TEXT,
          ADD COLUMN IF NOT EXISTS website VARCHAR(255),
          ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
          ADD COLUMN IF NOT EXISTS primary_color VARCHAR(50),
          ADD COLUMN IF NOT EXISTS custom_hex_color VARCHAR(20),
          ADD COLUMN IF NOT EXISTS logo_url TEXT,
          ADD COLUMN IF NOT EXISTS logo_icon VARCHAR(60),
          ADD COLUMN IF NOT EXISTS company_type VARCHAR(80),
          ADD COLUMN IF NOT EXISTS timbrado_number VARCHAR(50),
          ADD COLUMN IF NOT EXISTS timbrado_vencimiento VARCHAR(30),
          ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
          ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10);

        ALTER TABLE branches
          ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS operating_hours TEXT;

        ALTER TABLE branch_settings
          ADD COLUMN IF NOT EXISTS id UUID,
          ADD COLUMN IF NOT EXISTS allow_online_booking BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS require_document_id BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_waitlist BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS max_overbooking_slots INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS reminder_channels JSONB DEFAULT '["WHATSAPP","EMAIL"]'::jsonb,
          ADD COLUMN IF NOT EXISTS default_appointment_duration_minutes INTEGER NOT NULL DEFAULT 30,
          ADD COLUMN IF NOT EXISTS cancellation_notice_hours INTEGER NOT NULL DEFAULT 24,
          ADD COLUMN IF NOT EXISTS require_deposit_for_specialties BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS deposit_amount_pyg BIGINT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER NOT NULL DEFAULT 15,
          ADD COLUMN IF NOT EXISTS max_advance_booking_days INTEGER NOT NULL DEFAULT 60,
          ADD COLUMN IF NOT EXISTS receipt_series VARCHAR(50);

        ALTER TABLE roles
          ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS allowed_nav_tabs JSONB DEFAULT '[]'::jsonb;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NOT NULL DEFAULT '',
          ADD COLUMN IF NOT EXISTS username VARCHAR(100),
          ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255),
          ADD COLUMN IF NOT EXISTS password_iterations INTEGER NOT NULL DEFAULT 100000,
          ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 1,
          ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS revoked_permissions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS assigned_restrictions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS allowed_nav_tabs JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ;

        ALTER TABLE patients
          ADD COLUMN IF NOT EXISTS modality VARCHAR(30) NOT NULL DEFAULT 'PARTICULAR',
          ADD COLUMN IF NOT EXISTS insurance_plan_id UUID,
          ADD COLUMN IF NOT EXISTS insurance_member_number VARCHAR(100),
          ADD COLUMN IF NOT EXISTS assigned_advisor_id UUID,
          ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID,
          ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
          ADD COLUMN IF NOT EXISTS created_by_name_snapshot VARCHAR(200) NOT NULL DEFAULT 'Origen histórico / Desconocido';

        ALTER TABLE appointments
          ADD COLUMN IF NOT EXISTS dental_chair_id UUID,
          ADD COLUMN IF NOT EXISTS historical_doctor_name VARCHAR(200),
          ADD COLUMN IF NOT EXISTS historical_created_by_name VARCHAR(200);

        ALTER TABLE clinical_records
          ADD COLUMN IF NOT EXISTS historical_doctor_name VARCHAR(200);

        ALTER TABLE odontograms
          ADD COLUMN IF NOT EXISTS historical_doctor_name VARCHAR(200);

        ALTER TABLE quotes
          ADD COLUMN IF NOT EXISTS plan_id UUID,
          ADD COLUMN IF NOT EXISTS plan_name VARCHAR(200),
          ADD COLUMN IF NOT EXISTS historical_doctor_name VARCHAR(200);

        ALTER TABLE quote_items
          ADD COLUMN IF NOT EXISTS applied_modality VARCHAR(30),
          ADD COLUMN IF NOT EXISTS applied_plan_id UUID,
          ADD COLUMN IF NOT EXISTS applied_plan_name VARCHAR(200),
          ADD COLUMN IF NOT EXISTS original_list_price BIGINT;

        ALTER TABLE treatments
          ADD COLUMN IF NOT EXISTS service_id UUID,
          ADD COLUMN IF NOT EXISTS applied_modality VARCHAR(30) DEFAULT 'PARTICULAR',
          ADD COLUMN IF NOT EXISTS applied_plan_id UUID,
          ADD COLUMN IF NOT EXISTS applied_plan_name VARCHAR(200),
          ADD COLUMN IF NOT EXISTS original_list_price BIGINT,
          ADD COLUMN IF NOT EXISTS final_applied_price BIGINT,
          ADD COLUMN IF NOT EXISTS tooth_numbers JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS odontologist_id UUID,
          ADD COLUMN IF NOT EXISTS notes TEXT;

        ALTER TABLE cash_registers
          ADD COLUMN IF NOT EXISTS historical_opened_by_name VARCHAR(200),
          ADD COLUMN IF NOT EXISTS historical_closed_by_name VARCHAR(200);

        ALTER TABLE cash_movements
          ADD COLUMN IF NOT EXISTS historical_performed_by_name VARCHAR(200);

        ALTER TABLE payments
          ADD COLUMN IF NOT EXISTS annulled_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS annulled_reason TEXT,
          ADD COLUMN IF NOT EXISTS annulled_by UUID,
          ADD COLUMN IF NOT EXISTS historical_received_by_name VARCHAR(200);

        ALTER TABLE commission_rules
          ADD COLUMN IF NOT EXISTS description TEXT,
          ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(40),
          ADD COLUMN IF NOT EXISTS rate_percentage NUMERIC(6, 2),
          ADD COLUMN IF NOT EXISTS min_threshold_amount BIGINT,
          ADD COLUMN IF NOT EXISTS target_employee_id UUID,
          ADD COLUMN IF NOT EXISTS requires_collected_payment BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS requires_completed_treatment BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE generated_commissions
          ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(40),
          ADD COLUMN IF NOT EXISTS service_id UUID,
          ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
          ADD COLUMN IF NOT EXISTS period_year INTEGER,
          ADD COLUMN IF NOT EXISTS period_month INTEGER,
          ADD COLUMN IF NOT EXISTS earned_at TIMESTAMPTZ;

        ALTER TABLE payroll_settlements
          ADD COLUMN IF NOT EXISTS period_year INTEGER,
          ADD COLUMN IF NOT EXISTS period_month INTEGER,
          ADD COLUMN IF NOT EXISTS period_label VARCHAR(80),
          ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
          ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

        ALTER TABLE payroll_settlement_items
          ADD COLUMN IF NOT EXISTS sign VARCHAR(10) NOT NULL DEFAULT 'CREDIT',
          ADD COLUMN IF NOT EXISTS notes TEXT;

        ALTER TABLE staff_payments
          ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PYG';
      `);

      // Flexibilizar restricciones legacy heredadas que bloqueaban campos válidos del dominio (ej. QR_BANCARIO, branch_id nulo en empleados)
      const relaxQueries = [
        `ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_payment_method_check`,
        `ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_document_type_check`,
        `ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_concept_check`,
        `ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_calculation_mode_check`,
        `ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_trigger_condition_check`,
        `ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_calculation_base_check`,
        `ALTER TABLE generated_commissions DROP CONSTRAINT IF EXISTS generated_commissions_source_type_check`,
        `ALTER TABLE payroll_settlement_items DROP CONSTRAINT IF EXISTS payroll_settlement_items_item_type_check`,
        `ALTER TABLE staff_payments DROP CONSTRAINT IF EXISTS staff_payments_payment_method_check`,
        `ALTER TABLE employees ALTER COLUMN branch_id DROP NOT NULL`,
        `ALTER TABLE employees ALTER COLUMN phone DROP NOT NULL`,
        `ALTER TABLE commission_rules ALTER COLUMN concept DROP NOT NULL`,
        `ALTER TABLE commission_rules ALTER COLUMN effective_from DROP NOT NULL`,
        `ALTER TABLE commission_rules ALTER COLUMN target_type DROP NOT NULL`,
        `ALTER TABLE commission_rules ALTER COLUMN calculation_base DROP NOT NULL`,
        `ALTER TABLE commission_rules ALTER COLUMN trigger_condition DROP NOT NULL`,
        `ALTER TABLE generated_commissions ALTER COLUMN branch_id DROP NOT NULL`,
        `ALTER TABLE generated_commissions ALTER COLUMN period DROP NOT NULL`,
        `ALTER TABLE payroll_settlements ALTER COLUMN branch_id DROP NOT NULL`,
        `ALTER TABLE payroll_settlements ALTER COLUMN area DROP NOT NULL`,
        `ALTER TABLE payroll_settlements ALTER COLUMN period DROP NOT NULL`,
        `ALTER TABLE payroll_settlements ALTER COLUMN period_start DROP NOT NULL`,
        `ALTER TABLE payroll_settlements ALTER COLUMN period_end DROP NOT NULL`,
        `ALTER TABLE payroll_settlement_items ALTER COLUMN description DROP NOT NULL`,
        `ALTER TABLE staff_payments ALTER COLUMN branch_id DROP NOT NULL`,
        `ALTER TABLE staff_payments ALTER COLUMN responsible_user_name DROP NOT NULL`,
        `ALTER TABLE cash_registers ALTER COLUMN opened_by DROP NOT NULL`,
        `ALTER TABLE cash_movements ALTER COLUMN performed_by DROP NOT NULL`,
        `ALTER TABLE payments ALTER COLUMN received_by DROP NOT NULL`,
        `ALTER TABLE appointments ALTER COLUMN odontologist_id DROP NOT NULL`,
        `ALTER TABLE clinical_records ALTER COLUMN odontologist_id DROP NOT NULL`,
        `ALTER TABLE odontograms ALTER COLUMN odontologist_id DROP NOT NULL`,
      ];
      for (const q of relaxQueries) {
        try {
          await client.query(q);
        } catch {
          // Ignorar si alguna tabla o constraint no aplica
        }
      }

      // Índices multi-tenant y de rendimiento
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
        CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
        CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(organization_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON appointments(organization_id, appointment_date);
        CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id);
        CREATE INDEX IF NOT EXISTS idx_odontograms_patient ON odontograms(patient_id);
        CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_payments_org_branch ON payments(organization_id, branch_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
        CREATE INDEX IF NOT EXISTS idx_generated_commissions_org ON generated_commissions(organization_id);
        CREATE INDEX IF NOT EXISTS idx_payroll_settlements_org ON payroll_settlements(organization_id);
      `);
    } catch (err) {
      schemaReadyPromise = null;
      throw err;
    } finally {
      client.release();
    }
  })();

  return schemaReadyPromise;
}

// ============================================================================
// 2. UPSERTS POR TABLA (PARAMETRIZADOS, CERO CONCATENACIÓN SQL)
// ============================================================================

async function upsertRow(client: pg.PoolClient, collection: string, item: any, contextState?: DbStateEnvelope): Promise<void> {
  if (!item || typeof item !== 'object') return;
  const nowIso = new Date().toISOString();

  switch (collection) {
    case 'roles': {
      await client.query(
        `INSERT INTO roles (id, name, description, is_system, permissions, allowed_nav_tabs, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, COALESCE($7::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system,
           permissions = EXCLUDED.permissions,
           allowed_nav_tabs = EXCLUDED.allowed_nav_tabs`,
        [
          String(item.id),
          String(item.name || item.id),
          item.description ?? null,
          Boolean(item.isSystem),
          normalizeJsonParam(Array.isArray(item.permissions) ? item.permissions : []),
          normalizeJsonParam(Array.isArray(item.allowedNavTabs) ? item.allowedNavTabs : []),
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'organizationsList': {
      await client.query(
        `INSERT INTO organizations (
           id, code, name, legal_name, tax_id, country_code, default_currency, timezone, status,
           phone, email, address, website, trade_name, primary_color, custom_hex_color, logo_url,
           logo_icon, company_type, timbrado_number, timbrado_vencimiento, whatsapp, currency_symbol,
           created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17,
           $18, $19, $20, $21, $22, $23,
           COALESCE($24::timestamptz, NOW()), COALESCE($25::timestamptz, NOW()), $26::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           legal_name = EXCLUDED.legal_name,
           tax_id = EXCLUDED.tax_id,
           country_code = EXCLUDED.country_code,
           default_currency = EXCLUDED.default_currency,
           timezone = EXCLUDED.timezone,
           status = EXCLUDED.status,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           address = EXCLUDED.address,
           website = EXCLUDED.website,
           trade_name = EXCLUDED.trade_name,
           primary_color = EXCLUDED.primary_color,
           custom_hex_color = EXCLUDED.custom_hex_color,
           logo_url = EXCLUDED.logo_url,
           logo_icon = EXCLUDED.logo_icon,
           company_type = EXCLUDED.company_type,
           timbrado_number = EXCLUDED.timbrado_number,
           timbrado_vencimiento = EXCLUDED.timbrado_vencimiento,
           whatsapp = EXCLUDED.whatsapp,
           currency_symbol = EXCLUDED.currency_symbol,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          item.id,
          String(item.code || `ORG-${String(item.id).slice(0, 8)}`),
          String(item.name || 'Organización'),
          item.legalName ?? null,
          item.taxId ?? null,
          item.countryCode || 'PRY',
          item.defaultCurrency || 'PYG',
          item.timezone || 'America/Asuncion',
          item.status || 'ACTIVE',
          item.phone ?? null,
          item.email ?? null,
          item.address ?? null,
          item.website ?? null,
          item.tradeName ?? null,
          item.primaryColor ?? null,
          item.customHexColor ?? null,
          item.logoUrl ?? null,
          item.logoIcon ?? null,
          item.companyType ?? null,
          item.timbradoNumber ?? null,
          item.timbradoVencimiento ?? null,
          item.whatsapp ?? null,
          item.currencySymbol ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'branches': {
      const id = normalizeUuidOrNull(item.id);
      if (!id) return;
      await client.query(
        `INSERT INTO branches (
           id, organization_id, code, name, department, city, neighborhood, address,
           phone, whatsapp, email, opening_time, closing_time, status, is_main, operating_hours,
           created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12::time, $13::time, $14, $15, $16,
           COALESCE($17::timestamptz, NOW()), COALESCE($18::timestamptz, NOW()), $19::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           department = EXCLUDED.department,
           city = EXCLUDED.city,
           neighborhood = EXCLUDED.neighborhood,
           address = EXCLUDED.address,
           phone = EXCLUDED.phone,
           whatsapp = EXCLUDED.whatsapp,
           email = EXCLUDED.email,
           opening_time = EXCLUDED.opening_time,
           closing_time = EXCLUDED.closing_time,
           status = EXCLUDED.status,
           is_main = EXCLUDED.is_main,
           operating_hours = EXCLUDED.operating_hours,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          id,
          item.organizationId,
          String(item.code || 'SUC-01'),
          String(item.name || 'Sucursal'),
          String(item.department || 'Central'),
          String(item.city || 'Asunción'),
          item.neighborhood ?? null,
          String(item.address || ''),
          String(item.phone || ''),
          item.whatsapp ?? null,
          item.email ?? null,
          toTimeShort(item.openingTime, '07:30:00'),
          toTimeShort(item.closingTime, '19:30:00'),
          item.status || 'ACTIVE',
          Boolean(item.isMain),
          item.operatingHours ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'branchSettings': {
      const branchId = normalizeUuidOrNull(item.branchId);
      if (!branchId) return;
      await client.query(
        `INSERT INTO branch_settings (
           branch_id, id, appointment_duration_default, slot_interval, allow_double_booking,
           require_document_on_booking, allow_online_booking, require_document_id, enable_waitlist,
           max_overbooking_slots, reminder_channels, default_appointment_duration_minutes,
           cancellation_notice_hours, require_deposit_for_specialties, deposit_amount_pyg,
           slot_interval_minutes, max_advance_booking_days, receipt_series, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11::jsonb, $12,
           $13, $14, $15,
           $16, $17, $18, COALESCE($19::timestamptz, NOW()), COALESCE($20::timestamptz, NOW())
         )
         ON CONFLICT (branch_id) DO UPDATE SET
           id = COALESCE(EXCLUDED.id, branch_settings.id),
           appointment_duration_default = EXCLUDED.appointment_duration_default,
           slot_interval = EXCLUDED.slot_interval,
           allow_double_booking = EXCLUDED.allow_double_booking,
           require_document_on_booking = EXCLUDED.require_document_on_booking,
           allow_online_booking = EXCLUDED.allow_online_booking,
           require_document_id = EXCLUDED.require_document_id,
           enable_waitlist = EXCLUDED.enable_waitlist,
           max_overbooking_slots = EXCLUDED.max_overbooking_slots,
           reminder_channels = EXCLUDED.reminder_channels,
           default_appointment_duration_minutes = EXCLUDED.default_appointment_duration_minutes,
           cancellation_notice_hours = EXCLUDED.cancellation_notice_hours,
           require_deposit_for_specialties = EXCLUDED.require_deposit_for_specialties,
           deposit_amount_pyg = EXCLUDED.deposit_amount_pyg,
           slot_interval_minutes = EXCLUDED.slot_interval_minutes,
           max_advance_booking_days = EXCLUDED.max_advance_booking_days,
           receipt_series = EXCLUDED.receipt_series,
           updated_at = EXCLUDED.updated_at`,
        [
          branchId,
          normalizeUuidOrNull(item.id),
          toNumber(item.appointmentDurationDefault ?? item.defaultAppointmentDurationMinutes, 30),
          toNumber(item.slotInterval ?? item.slotIntervalMinutes, 15),
          Boolean(item.allowDoubleBooking),
          item.requireDocumentOnBooking !== undefined ? Boolean(item.requireDocumentOnBooking) : true,
          item.allowOnlineBooking !== undefined ? Boolean(item.allowOnlineBooking) : true,
          item.requireDocumentId !== undefined ? Boolean(item.requireDocumentId) : true,
          item.enableWaitlist !== undefined ? Boolean(item.enableWaitlist) : true,
          toNumber(item.maxOverbookingSlots, 0),
          normalizeJsonParam(Array.isArray(item.reminderChannels) ? item.reminderChannels : ['WHATSAPP', 'EMAIL']),
          toNumber(item.defaultAppointmentDurationMinutes ?? item.appointmentDurationDefault, 30),
          toNumber(item.cancellationNoticeHours, 24),
          Boolean(item.requireDepositForSpecialties),
          toNumber(item.depositAmountPyg, 0),
          toNumber(item.slotIntervalMinutes ?? item.slotInterval, 15),
          toNumber(item.maxAdvanceBookingDays, 60),
          item.receiptSeries ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'dentalChairs': {
      await client.query(
        `INSERT INTO dental_chairs (
           id, organization_id, branch_id, name, code, room, status, color_tag, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()), COALESCE($10::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           name = EXCLUDED.name,
           code = EXCLUDED.code,
           room = EXCLUDED.room,
           status = EXCLUDED.status,
           color_tag = EXCLUDED.color_tag,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          String(item.name || 'Sillón'),
          String(item.code || 'S1'),
          item.room ?? null,
          item.status || 'OPERATIVE',
          item.colorTag || 'teal',
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'users': {
      await client.query(
        `INSERT INTO users (
           id, organization_id, role_id, username, first_name, last_name, email,
           password_hash, password_salt, password_iterations, phone, professional_license,
           specialty, status, permissions_version, custom_permissions, revoked_permissions,
           assigned_restrictions, allowed_nav_tabs, session_revoked_at, last_login_at,
           created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15, $16::jsonb, $17::jsonb,
           $18::jsonb, $19::jsonb, $20::timestamptz, $21::timestamptz,
           COALESCE($22::timestamptz, NOW()), COALESCE($23::timestamptz, NOW()), $24::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           role_id = EXCLUDED.role_id,
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           password_iterations = EXCLUDED.password_iterations,
           phone = EXCLUDED.phone,
           professional_license = EXCLUDED.professional_license,
           specialty = EXCLUDED.specialty,
           status = EXCLUDED.status,
           permissions_version = EXCLUDED.permissions_version,
           custom_permissions = EXCLUDED.custom_permissions,
           revoked_permissions = EXCLUDED.revoked_permissions,
           assigned_restrictions = EXCLUDED.assigned_restrictions,
           allowed_nav_tabs = EXCLUDED.allowed_nav_tabs,
           session_revoked_at = EXCLUDED.session_revoked_at,
           last_login_at = EXCLUDED.last_login_at,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          item.id,
          item.organizationId,
          item.roleId,
          item.username ?? null,
          String(item.firstName || ''),
          String(item.lastName || ''),
          String(item.email || ''),
          String(item.passwordHash || ''),
          item.passwordSalt ?? null,
          toNumber(item.passwordIterations, 100000),
          item.phone ?? null,
          item.professionalLicense ?? null,
          item.specialty ?? null,
          item.status || 'ACTIVE',
          toNumber(item.permissionsVersion, 1),
          normalizeJsonParam(Array.isArray(item.customPermissions) ? item.customPermissions : []),
          normalizeJsonParam(Array.isArray(item.revokedPermissions) ? item.revokedPermissions : []),
          normalizeJsonParam(Array.isArray(item.assignedRestrictions) ? item.assignedRestrictions : []),
          normalizeJsonParam(Array.isArray(item.allowedNavTabs) ? item.allowedNavTabs : []),
          toIsoString(item.sessionRevokedAt),
          toIsoString(item.lastLoginAt),
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'userBranches': {
      const userId = normalizeUuidOrNull(item.userId);
      const branchId = normalizeUuidOrNull(item.branchId);
      if (!userId || !branchId) return;
      await client.query(
        `INSERT INTO user_branches (user_id, branch_id, is_default, created_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
         ON CONFLICT (user_id, branch_id) DO UPDATE SET
           is_default = EXCLUDED.is_default`,
        [userId, branchId, Boolean(item.isDefault), toIsoString(item.createdAt)]
      );
      break;
    }

    case 'services': {
      await client.query(
        `INSERT INTO services (
           id, organization_id, category, code, name, description,
           default_duration_min, base_price, status, created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, COALESCE($10::timestamptz, NOW()), COALESCE($11::timestamptz, NOW()), $12::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           category = EXCLUDED.category,
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           default_duration_min = EXCLUDED.default_duration_min,
           base_price = EXCLUDED.base_price,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          item.id,
          item.organizationId,
          String(item.category || 'General'),
          item.code ?? null,
          String(item.name || 'Servicio'),
          item.description ?? null,
          toNumber(item.defaultDurationMin, 30),
          Math.round(toNumber(item.basePrice, 0)),
          item.status || 'ACTIVE',
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'branchServices': {
      const branchId = normalizeUuidOrNull(item.branchId);
      const serviceId = normalizeUuidOrNull(item.serviceId);
      if (!branchId || !serviceId) return;
      await client.query(
        `INSERT INTO branch_services (branch_id, service_id, custom_price, is_available)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (branch_id, service_id) DO UPDATE SET
           custom_price = EXCLUDED.custom_price,
           is_available = EXCLUDED.is_available`,
        [branchId, serviceId, Math.round(toNumber(item.customPrice, 0)), item.isAvailable !== false]
      );
      break;
    }

    case 'insurancePlans': {
      await client.query(
        `INSERT INTO insurance_plans (
           id, organization_id, code, name, description, status, coverage_terms, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()), COALESCE($9::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           coverage_terms = EXCLUDED.coverage_terms,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          String(item.code || 'PLAN'),
          String(item.name || 'Plan Odontológico'),
          item.description ?? null,
          item.status || 'ACTIVO',
          item.coverageTerms ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'planServicePrices': {
      await client.query(
        `INSERT INTO plan_service_prices (
           id, plan_id, service_id, price, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), COALESCE($7::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id,
           service_id = EXCLUDED.service_id,
           price = EXCLUDED.price,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.planId || item.insurancePlanId,
          item.serviceId,
          Math.round(toNumber(item.price, 0)),
          item.notes ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'employees': {
      await client.query(
        `INSERT INTO employees (
           id, organization_id, branch_id, user_id, employee_code, first_name, last_name,
           document_type, document_number, phone, email, area, position, hire_date,
           status, remuneration_modality, is_advisor, observations, created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13, COALESCE($14::date, CURRENT_DATE),
           $15, $16, $17, $18, COALESCE($19::timestamptz, NOW()), COALESCE($20::timestamptz, NOW()), $21::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           user_id = EXCLUDED.user_id,
           employee_code = EXCLUDED.employee_code,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           document_type = EXCLUDED.document_type,
           document_number = EXCLUDED.document_number,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           area = EXCLUDED.area,
           position = EXCLUDED.position,
           hire_date = EXCLUDED.hire_date,
           status = EXCLUDED.status,
           remuneration_modality = EXCLUDED.remuneration_modality,
           is_advisor = EXCLUDED.is_advisor,
           observations = EXCLUDED.observations,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.branchId),
          normalizeUuidOrNull(item.userId),
          String(item.employeeCode || 'EMP-0001'),
          String(item.firstName || ''),
          String(item.lastName || ''),
          item.documentType || 'CI',
          String(item.documentNumber || ''),
          item.phone ?? null,
          item.email ?? null,
          item.area || 'OPERATIVA',
          String(item.position || 'Colaborador'),
          toDateOnly(item.hireDate),
          item.status || 'ACTIVE',
          item.remunerationModality || 'SALARIO_FIJO',
          Boolean(item.isAdvisor),
          item.observations ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'employeeSalaries': {
      await client.query(
        `INSERT INTO employee_salaries (
           id, organization_id, employee_id, area, base_salary, payment_frequency,
           effective_date, end_date, currency, status, observations, created_by_user_id, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           COALESCE($7::date, CURRENT_DATE), $8::date, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()), NOW()
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           employee_id = EXCLUDED.employee_id,
           area = EXCLUDED.area,
           base_salary = EXCLUDED.base_salary,
           payment_frequency = EXCLUDED.payment_frequency,
           effective_date = EXCLUDED.effective_date,
           end_date = EXCLUDED.end_date,
           currency = EXCLUDED.currency,
           status = EXCLUDED.status,
           observations = EXCLUDED.observations,
           updated_at = NOW()`,
        [
          item.id,
          item.organizationId,
          item.employeeId,
          item.area || 'OPERATIVA',
          Math.round(toNumber(item.baseSalary, 0)),
          item.paymentFrequency || 'MENSUAL',
          toDateOnly(item.effectiveDate),
          toDateOnly(item.endDate),
          item.currency || 'PYG',
          item.status || 'VIGENTE',
          item.observations ?? null,
          normalizeUuidOrNull(item.createdBy ?? item.createdByUserId),
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'commissionRules': {
      const ratePct = toNullableNumber(item.ratePercentage ?? item.percentageRate);
      const fixedAmt = toNullableNumber(item.fixedAmount);
      await client.query(
        `INSERT INTO commission_rules (
           id, organization_id, branch_id, name, description, area,
           target_type, employee_id, target_role_id, service_id, concept,
           calculation_mode, percentage_rate, fixed_amount, calculation_base, trigger_condition,
           trigger_type, rate_percentage, min_threshold_amount, target_employee_id,
           requires_collected_payment, requires_completed_treatment,
           effective_from, effective_to, status, notes, created_by_user_id, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15, $16,
           $17, $18, $19, $20,
           $21, $22,
           $23::date, $24::date, $25, $26, $27, COALESCE($28::timestamptz, NOW()), COALESCE($29::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           area = EXCLUDED.area,
           service_id = EXCLUDED.service_id,
           calculation_mode = EXCLUDED.calculation_mode,
           percentage_rate = EXCLUDED.percentage_rate,
           fixed_amount = EXCLUDED.fixed_amount,
           trigger_type = EXCLUDED.trigger_type,
           trigger_condition = EXCLUDED.trigger_condition,
           rate_percentage = EXCLUDED.rate_percentage,
           min_threshold_amount = EXCLUDED.min_threshold_amount,
           target_employee_id = EXCLUDED.target_employee_id,
           employee_id = EXCLUDED.employee_id,
           requires_collected_payment = EXCLUDED.requires_collected_payment,
           requires_completed_treatment = EXCLUDED.requires_completed_treatment,
           effective_from = EXCLUDED.effective_from,
           effective_to = EXCLUDED.effective_to,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.branchId),
          String(item.name || 'Regla'),
          item.description ?? null,
          item.area || 'COMERCIAL',
          item.targetEmployeeId ? 'EMPLOYEE' : 'AREA',
          normalizeUuidOrNull(item.targetEmployeeId ?? item.employeeId),
          item.targetRoleId ?? null,
          normalizeUuidOrNull(item.serviceId),
          String(item.concept || item.triggerType || 'OPERACION_COBRADA').slice(0, 50),
          item.calculationMode || 'PERCENTAGE',
          ratePct ?? 0,
          Math.round(fixedAmt ?? 0),
          item.calculationBase || 'AMOUNT_COLLECTED',
          item.triggerType || item.triggerCondition || 'ON_PAYMENT_COLLECTED',
          item.triggerType || item.triggerCondition || 'ON_PAYMENT_COLLECTED',
          ratePct,
          toNullableNumber(item.minThresholdAmount),
          normalizeUuidOrNull(item.targetEmployeeId ?? item.employeeId),
          Boolean(item.requiresCollectedPayment),
          Boolean(item.requiresCompletedTreatment),
          toDateOnly(item.effectiveFrom),
          toDateOnly(item.effectiveTo),
          item.status || 'ACTIVE',
          item.description ?? item.notes ?? null,
          normalizeUuidOrNull(item.createdBy ?? item.createdByUserId),
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'patients': {
      await client.query(
        `INSERT INTO patients (
           id, organization_id, primary_branch_id, document_type, document_number,
           first_name, last_name, birth_date, gender, phone, whatsapp, email,
           department, city, neighborhood, address, emergency_contact_name, emergency_contact_phone,
           blood_type, allergies, medical_conditions, medications,
           modality, insurance_plan_id, insurance_member_number,
           assigned_advisor_id, assigned_at, assigned_by_user_id,
           created_by_user_id, created_by_name_snapshot,
           status, created_at, updated_at, deleted_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8::date, $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18,
           $19, $20, $21, $22,
           $23, $24, $25,
           $26, $27::timestamptz, $28,
           $29, $30,
           $31, COALESCE($32::timestamptz, NOW()), COALESCE($33::timestamptz, NOW()), $34::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           primary_branch_id = EXCLUDED.primary_branch_id,
           document_type = EXCLUDED.document_type,
           document_number = EXCLUDED.document_number,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           birth_date = EXCLUDED.birth_date,
           gender = EXCLUDED.gender,
           phone = EXCLUDED.phone,
           whatsapp = EXCLUDED.whatsapp,
           email = EXCLUDED.email,
           department = EXCLUDED.department,
           city = EXCLUDED.city,
           neighborhood = EXCLUDED.neighborhood,
           address = EXCLUDED.address,
           emergency_contact_name = EXCLUDED.emergency_contact_name,
           emergency_contact_phone = EXCLUDED.emergency_contact_phone,
           blood_type = EXCLUDED.blood_type,
           allergies = EXCLUDED.allergies,
           medical_conditions = EXCLUDED.medical_conditions,
           medications = EXCLUDED.medications,
           modality = EXCLUDED.modality,
           insurance_plan_id = EXCLUDED.insurance_plan_id,
           insurance_member_number = EXCLUDED.insurance_member_number,
           assigned_advisor_id = EXCLUDED.assigned_advisor_id,
           assigned_at = EXCLUDED.assigned_at,
           assigned_by_user_id = EXCLUDED.assigned_by_user_id,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.primaryBranchId),
          item.documentType || 'CI',
          String(item.documentNumber || ''),
          String(item.firstName || ''),
          String(item.lastName || ''),
          toDateOnly(item.birthDate),
          item.gender ?? null,
          String(item.phone || ''),
          item.whatsapp ?? null,
          item.email ?? null,
          item.department ?? null,
          item.city ?? null,
          item.neighborhood ?? null,
          item.address ?? null,
          item.emergencyContactName ?? null,
          item.emergencyContactPhone ?? null,
          item.bloodType ?? null,
          item.allergies ?? null,
          item.medicalConditions ?? null,
          item.medications ?? null,
          item.modality || 'PARTICULAR',
          normalizeUuidOrNull(item.insurancePlanId),
          item.insuranceMemberNumber ?? null,
          normalizeUuidOrNull(item.assignedAdvisorId),
          toIsoString(item.assignedAt),
          normalizeUuidOrNull(item.assignedByUserId),
          normalizeUuidOrNull(item.createdByUserId),
          item.createdByNameSnapshot || 'Origen histórico / Desconocido',
          item.status || 'ACTIVE',
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
          toIsoString(item.deletedAt),
        ]
      );
      break;
    }

    case 'patientBranches': {
      const patientId = normalizeUuidOrNull(item.patientId);
      const branchId = normalizeUuidOrNull(item.branchId);
      if (!patientId || !branchId) return;
      await client.query(
        `INSERT INTO patient_branches (patient_id, branch_id, first_visit_date, last_visit_date)
         VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), COALESCE($4::date, CURRENT_DATE))
         ON CONFLICT (patient_id, branch_id) DO UPDATE SET
           first_visit_date = EXCLUDED.first_visit_date,
           last_visit_date = EXCLUDED.last_visit_date`,
        [patientId, branchId, toDateOnly(item.firstVisitDate), toDateOnly(item.lastVisitDate)]
      );
      break;
    }

    case 'appointments': {
      await client.query(
        `INSERT INTO appointments (
           id, organization_id, branch_id, dental_chair_id, patient_id, odontologist_id,
           service_id, appointment_date, start_time, end_time, duration_min, status,
           reason, cancellation_reason, notes, created_by,
           historical_doctor_name, historical_created_by_name, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8::date, $9::time, $10::time, $11, $12,
           $13, $14, $15, $16,
           $17, $18, COALESCE($19::timestamptz, NOW()), COALESCE($20::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           dental_chair_id = EXCLUDED.dental_chair_id,
           patient_id = EXCLUDED.patient_id,
           odontologist_id = EXCLUDED.odontologist_id,
           service_id = EXCLUDED.service_id,
           appointment_date = EXCLUDED.appointment_date,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           duration_min = EXCLUDED.duration_min,
           status = EXCLUDED.status,
           reason = EXCLUDED.reason,
           cancellation_reason = EXCLUDED.cancellation_reason,
           notes = EXCLUDED.notes,
           historical_doctor_name = EXCLUDED.historical_doctor_name,
           historical_created_by_name = EXCLUDED.historical_created_by_name,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          normalizeUuidOrNull(item.dentalChairId),
          item.patientId,
          normalizeUuidOrNull(item.odontologistId),
          normalizeUuidOrNull(item.serviceId),
          toDateOnly(item.appointmentDate) || toDateOnly(new Date()),
          toTimeShort(item.startTime, '08:00:00'),
          toTimeShort(item.endTime, '08:30:00'),
          toNumber(item.durationMin, 30),
          item.status || 'PENDIENTE',
          item.reason ?? null,
          item.cancellationReason ?? null,
          item.notes ?? null,
          normalizeUuidOrNull(item.createdBy),
          item.historicalDoctorName ?? null,
          item.historicalCreatedByName ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'clinicalRecords': {
      await client.query(
        `INSERT INTO clinical_records (
           id, organization_id, branch_id, patient_id, odontologist_id, appointment_id,
           reason_for_consultation, diagnosis, treatment_performed, prescriptions,
           recommendations, internal_notes, attachments, historical_doctor_name, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, $13::jsonb, $14, COALESCE($15::timestamptz, NOW()), COALESCE($16::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           patient_id = EXCLUDED.patient_id,
           odontologist_id = EXCLUDED.odontologist_id,
           appointment_id = EXCLUDED.appointment_id,
           reason_for_consultation = EXCLUDED.reason_for_consultation,
           diagnosis = EXCLUDED.diagnosis,
           treatment_performed = EXCLUDED.treatment_performed,
           prescriptions = EXCLUDED.prescriptions,
           recommendations = EXCLUDED.recommendations,
           internal_notes = EXCLUDED.internal_notes,
           attachments = EXCLUDED.attachments,
           historical_doctor_name = EXCLUDED.historical_doctor_name,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          item.patientId,
          normalizeUuidOrNull(item.odontologistId),
          normalizeUuidOrNull(item.appointmentId),
          item.reasonForConsultation ?? null,
          String(item.diagnosis || ''),
          String(item.treatmentPerformed || ''),
          item.prescriptions ?? null,
          item.recommendations ?? null,
          item.internalNotes ?? null,
          normalizeJsonParam(Array.isArray(item.attachments) ? item.attachments : []),
          item.historicalDoctorName ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'odontograms': {
      await client.query(
        `INSERT INTO odontograms (
           id, organization_id, patient_id, odontologist_id, clinical_record_id,
           version, odontogram_type, general_observations, historical_doctor_name, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()), COALESCE($11::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           patient_id = EXCLUDED.patient_id,
           odontologist_id = EXCLUDED.odontologist_id,
           clinical_record_id = EXCLUDED.clinical_record_id,
           version = EXCLUDED.version,
           odontogram_type = EXCLUDED.odontogram_type,
           general_observations = EXCLUDED.general_observations,
           historical_doctor_name = EXCLUDED.historical_doctor_name,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.patientId,
          normalizeUuidOrNull(item.odontologistId),
          normalizeUuidOrNull(item.clinicalRecordId),
          toNumber(item.version, 1),
          item.odontogramType || 'ADULTO',
          item.generalObservations ?? null,
          item.historicalDoctorName ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'odontogramItems': {
      await client.query(
        `INSERT INTO odontogram_items (
           id, odontogram_id, tooth_number, surface, condition, material, notes, color_code, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           odontogram_id = EXCLUDED.odontogram_id,
           tooth_number = EXCLUDED.tooth_number,
           surface = EXCLUDED.surface,
           condition = EXCLUDED.condition,
           material = EXCLUDED.material,
           notes = EXCLUDED.notes,
           color_code = EXCLUDED.color_code`,
        [
          item.id,
          item.odontogramId,
          toNumber(item.toothNumber, 11),
          item.surface || 'GENERAL',
          String(item.condition || 'SANO'),
          item.material ?? null,
          item.notes ?? null,
          item.colorCode ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'quotes': {
      await client.query(
        `INSERT INTO quotes (
           id, organization_id, branch_id, patient_id, plan_id, plan_name, odontologist_id,
           quote_number, total_amount, discount_amount, final_amount, status, valid_until,
           notes, historical_doctor_name, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13::date,
           $14, $15, COALESCE($16::timestamptz, NOW()), COALESCE($17::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           patient_id = EXCLUDED.patient_id,
           plan_id = EXCLUDED.plan_id,
           plan_name = EXCLUDED.plan_name,
           odontologist_id = EXCLUDED.odontologist_id,
           quote_number = EXCLUDED.quote_number,
           total_amount = EXCLUDED.total_amount,
           discount_amount = EXCLUDED.discount_amount,
           final_amount = EXCLUDED.final_amount,
           status = EXCLUDED.status,
           valid_until = EXCLUDED.valid_until,
           notes = EXCLUDED.notes,
           historical_doctor_name = EXCLUDED.historical_doctor_name,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          item.patientId,
          normalizeUuidOrNull(item.planId),
          item.planName ?? null,
          normalizeUuidOrNull(item.odontologistId),
          String(item.quoteNumber || 'PRE-0001'),
          Math.round(toNumber(item.totalAmount, 0)),
          Math.round(toNumber(item.discountAmount, 0)),
          Math.round(toNumber(item.finalAmount, 0)),
          item.status || 'PENDIENTE',
          toDateOnly(item.validUntil),
          item.notes ?? null,
          item.historicalDoctorName ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'quoteItems': {
      await client.query(
        `INSERT INTO quote_items (
           id, quote_id, service_id, tooth_number, description, quantity, unit_price, subtotal,
           applied_modality, applied_plan_id, applied_plan_name, original_list_price
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11, $12
         )
         ON CONFLICT (id) DO UPDATE SET
           quote_id = EXCLUDED.quote_id,
           service_id = EXCLUDED.service_id,
           tooth_number = EXCLUDED.tooth_number,
           description = EXCLUDED.description,
           quantity = EXCLUDED.quantity,
           unit_price = EXCLUDED.unit_price,
           subtotal = EXCLUDED.subtotal,
           applied_modality = EXCLUDED.applied_modality,
           applied_plan_id = EXCLUDED.applied_plan_id,
           applied_plan_name = EXCLUDED.applied_plan_name,
           original_list_price = EXCLUDED.original_list_price`,
        [
          item.id,
          item.quoteId,
          normalizeUuidOrNull(item.serviceId),
          toNullableNumber(item.toothNumber),
          String(item.description || ''),
          toNumber(item.quantity, 1),
          Math.round(toNumber(item.unitPrice, 0)),
          Math.round(toNumber(item.subtotal, 0)),
          item.appliedModality ?? null,
          normalizeUuidOrNull(item.appliedPlanId),
          item.appliedPlanName ?? null,
          item.originalListPrice !== undefined && item.originalListPrice !== null
            ? Math.round(toNumber(item.originalListPrice, 0))
            : null,
        ]
      );
      break;
    }

    case 'treatments': {
      await client.query(
        `INSERT INTO treatments (
           id, organization_id, branch_id, patient_id, quote_id, service_id,
           title, total_amount, paid_amount, balance_due, status,
           applied_modality, applied_plan_id, applied_plan_name, original_list_price,
           final_applied_price, tooth_numbers, odontologist_id, notes,
           start_date, completed_date, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15,
           $16, $17::jsonb, $18, $19,
           $20::date, $21::date, COALESCE($22::timestamptz, NOW()), COALESCE($23::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           patient_id = EXCLUDED.patient_id,
           quote_id = EXCLUDED.quote_id,
           service_id = EXCLUDED.service_id,
           title = EXCLUDED.title,
           total_amount = EXCLUDED.total_amount,
           paid_amount = EXCLUDED.paid_amount,
           balance_due = EXCLUDED.balance_due,
           status = EXCLUDED.status,
           applied_modality = EXCLUDED.applied_modality,
           applied_plan_id = EXCLUDED.applied_plan_id,
           applied_plan_name = EXCLUDED.applied_plan_name,
           original_list_price = EXCLUDED.original_list_price,
           final_applied_price = EXCLUDED.final_applied_price,
           tooth_numbers = EXCLUDED.tooth_numbers,
           odontologist_id = EXCLUDED.odontologist_id,
           notes = EXCLUDED.notes,
           start_date = EXCLUDED.start_date,
           completed_date = EXCLUDED.completed_date,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          item.patientId,
          normalizeUuidOrNull(item.quoteId),
          normalizeUuidOrNull(item.serviceId),
          String(item.title || 'Tratamiento'),
          Math.round(toNumber(item.totalAmount, 0)),
          Math.round(toNumber(item.paidAmount, 0)),
          Math.round(toNumber(item.balanceDue, 0)),
          item.status || 'EN_PROGRESO',
          item.appliedModality || 'PARTICULAR',
          normalizeUuidOrNull(item.appliedPlanId),
          item.appliedPlanName ?? null,
          item.originalListPrice !== undefined && item.originalListPrice !== null
            ? Math.round(toNumber(item.originalListPrice, 0))
            : null,
          item.finalAppliedPrice !== undefined && item.finalAppliedPrice !== null
            ? Math.round(toNumber(item.finalAppliedPrice, 0))
            : null,
          normalizeJsonParam(Array.isArray(item.toothNumbers) ? item.toothNumbers : []),
          normalizeUuidOrNull(item.odontologistId),
          item.notes ?? null,
          toDateOnly(item.startDate),
          toDateOnly(item.completedDate),
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'insuranceClaims': {
      await client.query(
        `INSERT INTO insurance_claims (
           id, organization_id, branch_id, plan_id, claim_number, patient_id,
           treatment_id, service_id, patient_member_number, service_name, tooth_number,
           original_list_price, copay_amount, covered_amount, status,
           submission_date, settled_date, settlement_reference, notes, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15,
           $16::timestamptz, $17::timestamptz, $18, $19, COALESCE($20::timestamptz, NOW()), COALESCE($21::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           plan_id = EXCLUDED.plan_id,
           claim_number = EXCLUDED.claim_number,
           patient_id = EXCLUDED.patient_id,
           treatment_id = EXCLUDED.treatment_id,
           service_id = EXCLUDED.service_id,
           patient_member_number = EXCLUDED.patient_member_number,
           service_name = EXCLUDED.service_name,
           tooth_number = EXCLUDED.tooth_number,
           original_list_price = EXCLUDED.original_list_price,
           copay_amount = EXCLUDED.copay_amount,
           covered_amount = EXCLUDED.covered_amount,
           status = EXCLUDED.status,
           submission_date = EXCLUDED.submission_date,
           settled_date = EXCLUDED.settled_date,
           settlement_reference = EXCLUDED.settlement_reference,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          item.planId,
          String(item.claimNumber || 'CLM-0001'),
          item.patientId,
          normalizeUuidOrNull(item.treatmentId),
          normalizeUuidOrNull(item.serviceId),
          item.patientMemberNumber ?? null,
          String(item.serviceName || 'Servicio'),
          toNullableNumber(item.toothNumber),
          Math.round(toNumber(item.originalListPrice, 0)),
          Math.round(toNumber(item.copayAmount, 0)),
          Math.round(toNumber(item.coveredAmount, 0)),
          item.status || 'PENDIENTE_ENVIO',
          toIsoString(item.submissionDate),
          toIsoString(item.settledDate),
          item.settlementReference ?? null,
          item.notes ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'cashRegisters': {
      await client.query(
        `INSERT INTO cash_registers (
           id, organization_id, branch_id, opened_by, closed_by, opening_amount,
           closing_amount_expected, closing_amount_real, difference_amount, status,
           opened_at, closed_at, observations, historical_opened_by_name, historical_closed_by_name
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           COALESCE($11::timestamptz, NOW()), $12::timestamptz, $13, $14, $15
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           opened_by = EXCLUDED.opened_by,
           closed_by = EXCLUDED.closed_by,
           opening_amount = EXCLUDED.opening_amount,
           closing_amount_expected = EXCLUDED.closing_amount_expected,
           closing_amount_real = EXCLUDED.closing_amount_real,
           difference_amount = EXCLUDED.difference_amount,
           status = EXCLUDED.status,
           opened_at = EXCLUDED.opened_at,
           closed_at = EXCLUDED.closed_at,
           observations = EXCLUDED.observations,
           historical_opened_by_name = EXCLUDED.historical_opened_by_name,
           historical_closed_by_name = EXCLUDED.historical_closed_by_name`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          normalizeUuidOrNull(item.openedBy),
          normalizeUuidOrNull(item.closedBy),
          Math.round(toNumber(item.openingAmount, 0)),
          item.closingAmountExpected !== undefined && item.closingAmountExpected !== null
            ? Math.round(toNumber(item.closingAmountExpected, 0))
            : null,
          item.closingAmountReal !== undefined && item.closingAmountReal !== null
            ? Math.round(toNumber(item.closingAmountReal, 0))
            : null,
          item.differenceAmount !== undefined && item.differenceAmount !== null
            ? Math.round(toNumber(item.differenceAmount, 0))
            : null,
          item.status || 'ABIERTA',
          toIsoString(item.openedAt),
          toIsoString(item.closedAt),
          item.observations ?? null,
          item.historicalOpenedByName ?? null,
          item.historicalClosedByName ?? null,
        ]
      );
      break;
    }

    case 'cashMovements': {
      await client.query(
        `INSERT INTO cash_movements (
           id, cash_register_id, movement_type, amount, payment_method, concept,
           reference_number, performed_by, historical_performed_by_name, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, COALESCE($10::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           cash_register_id = EXCLUDED.cash_register_id,
           movement_type = EXCLUDED.movement_type,
           amount = EXCLUDED.amount,
           payment_method = EXCLUDED.payment_method,
           concept = EXCLUDED.concept,
           reference_number = EXCLUDED.reference_number,
           performed_by = EXCLUDED.performed_by,
           historical_performed_by_name = EXCLUDED.historical_performed_by_name`,
        [
          item.id,
          item.cashRegisterId,
          item.movementType || 'INGRESO',
          Math.round(toNumber(item.amount, 0)),
          String(item.paymentMethod || 'EFECTIVO'),
          String(item.concept || ''),
          item.referenceNumber ?? null,
          normalizeUuidOrNull(item.performedBy),
          item.historicalPerformedByName ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'payments': {
      await client.query(
        `INSERT INTO payments (
           id, organization_id, branch_id, patient_id, treatment_id, appointment_id,
           cash_movement_id, receipt_number, invoice_number, amount, payment_method,
           status, notes, received_by, annulled_at, annulled_reason, annulled_by,
           historical_received_by_name, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15::timestamptz, $16, $17,
           $18, COALESCE($19::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           patient_id = EXCLUDED.patient_id,
           treatment_id = EXCLUDED.treatment_id,
           appointment_id = EXCLUDED.appointment_id,
           cash_movement_id = EXCLUDED.cash_movement_id,
           receipt_number = EXCLUDED.receipt_number,
           invoice_number = EXCLUDED.invoice_number,
           amount = EXCLUDED.amount,
           payment_method = EXCLUDED.payment_method,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           received_by = EXCLUDED.received_by,
           annulled_at = EXCLUDED.annulled_at,
           annulled_reason = EXCLUDED.annulled_reason,
           annulled_by = EXCLUDED.annulled_by,
           historical_received_by_name = EXCLUDED.historical_received_by_name`,
        [
          item.id,
          item.organizationId,
          item.branchId,
          item.patientId,
          normalizeUuidOrNull(item.treatmentId),
          normalizeUuidOrNull(item.appointmentId),
          normalizeUuidOrNull(item.cashMovementId),
          String(item.receiptNumber || 'REC-0001'),
          item.invoiceNumber ?? null,
          Math.round(toNumber(item.amount, 0)),
          String(item.paymentMethod || 'EFECTIVO'),
          item.status || 'COMPLETADO',
          item.notes ?? null,
          normalizeUuidOrNull(item.receivedBy),
          toIsoString(item.annulledAt),
          item.annulledReason ?? null,
          normalizeUuidOrNull(item.annulledBy),
          item.historicalReceivedByName ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'payrollSettlements': {
      const yr = toNumber(item.periodYear, new Date().getUTCFullYear());
      const mo = toNumber(item.periodMonth, new Date().getUTCMonth() + 1);
      const periodStr = `${yr}-${String(mo).padStart(2, '0')}`;
      const periodStart = `${periodStr}-01`;
      const empArea =
        item.area ||
        (contextState?.data?.employees || []).find((e: any) => e.id === item.employeeId)?.area ||
        'OPERATIVA';

      await client.query(
        `INSERT INTO payroll_settlements (
           id, organization_id, branch_id, employee_id, settlement_number,
           area, period, period_start, period_end, period_year, period_month, period_label,
           base_salary_amount, commissions_amount, bonuses_amount, advances_amount,
           deductions_amount, manual_adjustments_amount, gross_total, net_payable,
           paid_amount, balance_due, currency, status, notes,
           created_by_user_id, submitted_at, approved_by_user_id, approved_at,
           annulled_by_user_id, annulled_at, annulment_reason, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8::date, $9::date, $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20,
           $21, $22, $23, $24, $25,
           $26, $27::timestamptz, $28, $29::timestamptz,
           $30, $31::timestamptz, $32, COALESCE($33::timestamptz, NOW()), COALESCE($34::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           employee_id = EXCLUDED.employee_id,
           settlement_number = EXCLUDED.settlement_number,
           area = EXCLUDED.area,
           period_year = EXCLUDED.period_year,
           period_month = EXCLUDED.period_month,
           period_label = EXCLUDED.period_label,
           base_salary_amount = EXCLUDED.base_salary_amount,
           commissions_amount = EXCLUDED.commissions_amount,
           bonuses_amount = EXCLUDED.bonuses_amount,
           advances_amount = EXCLUDED.advances_amount,
           deductions_amount = EXCLUDED.deductions_amount,
           manual_adjustments_amount = EXCLUDED.manual_adjustments_amount,
           gross_total = EXCLUDED.gross_total,
           net_payable = EXCLUDED.net_payable,
           paid_amount = EXCLUDED.paid_amount,
           balance_due = EXCLUDED.balance_due,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           submitted_at = EXCLUDED.submitted_at,
           approved_by_user_id = EXCLUDED.approved_by_user_id,
           approved_at = EXCLUDED.approved_at,
           annulled_by_user_id = EXCLUDED.annulled_by_user_id,
           annulled_at = EXCLUDED.annulled_at,
           annulment_reason = EXCLUDED.annulment_reason,
           updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.branchId),
          item.employeeId,
          String(item.settlementNumber || 'LIQ-PER-0001'),
          empArea,
          periodStr,
          periodStart,
          periodStart,
          yr,
          mo,
          item.periodLabel || periodStr,
          Math.round(toNumber(item.baseSalarySnapshot ?? item.baseSalaryAmount, 0)),
          Math.round(toNumber(item.commissionsTotal ?? item.commissionsAmount, 0)),
          Math.round(toNumber(item.bonusesTotal ?? item.bonusesAmount, 0)),
          Math.round(toNumber(item.advancesTotal ?? item.advancesAmount, 0)),
          Math.round(toNumber(item.deductionsTotal ?? item.deductionsAmount, 0)),
          Math.round(toNumber(item.adjustmentsTotal ?? item.manualAdjustmentsAmount, 0)),
          Math.round(toNumber(item.grossTotal, 0)),
          Math.round(toNumber(item.netPayable, 0)),
          Math.round(toNumber(item.paidAmount, 0)),
          Math.round(toNumber(item.balanceDue, 0)),
          item.currency || 'PYG',
          item.status || 'BORRADOR',
          item.notes ?? null,
          normalizeUuidOrNull(item.createdBy ?? item.createdByUserId),
          toIsoString(item.submittedAt),
          normalizeUuidOrNull(item.approvedBy ?? item.approvedByUserId),
          toIsoString(item.approvedAt),
          normalizeUuidOrNull(item.annulledBy ?? item.annulledByUserId),
          toIsoString(item.annulledAt),
          item.annulledReason ?? item.annulmentReason ?? null,
          toIsoString(item.createdAt),
          toIsoString(item.updatedAt) || nowIso,
        ]
      );
      break;
    }

    case 'generatedCommissions': {
      const yr = toNumber(item.periodYear, new Date().getUTCFullYear());
      const mo = toNumber(item.periodMonth, new Date().getUTCMonth() + 1);
      const periodStr = `${yr}-${String(mo).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO generated_commissions (
           id, organization_id, branch_id, employee_id, rule_id, settlement_id,
           area, trigger_type, source_type, source_id, dedup_key,
           patient_id, quote_id, treatment_id, payment_id, service_id,
           advisor_snapshot_id, advisor_snapshot_name, concept,
           base_amount, applied_rate, commission_amount, currency,
           period, period_year, period_month, status, is_manual_adjustment,
           notes, earned_at, created_by_user_id, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11,
           $12, $13, $14, $15, $16,
           $17, $18, $19,
           $20, $21, $22, $23,
           $24, $25, $26, $27, $28,
           $29, COALESCE($30::timestamptz, NOW()), $31, COALESCE($32::timestamptz, NOW()), NOW()
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           employee_id = EXCLUDED.employee_id,
           rule_id = EXCLUDED.rule_id,
           settlement_id = EXCLUDED.settlement_id,
           area = EXCLUDED.area,
           trigger_type = EXCLUDED.trigger_type,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           commission_amount = EXCLUDED.commission_amount,
           updated_at = NOW()`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.branchId),
          item.employeeId,
          normalizeUuidOrNull(item.ruleId),
          normalizeUuidOrNull(item.settlementId),
          item.area || 'COMERCIAL',
          item.triggerType || 'ON_PAYMENT_COLLECTED',
          item.sourceType || 'PAYMENT',
          String(item.sourceId || item.id),
          String(item.dedupKey || item.id),
          normalizeUuidOrNull(item.patientId),
          normalizeUuidOrNull(item.quoteId),
          normalizeUuidOrNull(item.treatmentId),
          normalizeUuidOrNull(item.paymentId),
          normalizeUuidOrNull(item.serviceId),
          normalizeUuidOrNull(item.advisorSnapshotId),
          item.advisorSnapshotName ?? null,
          String(item.concept || 'Comisión'),
          Math.round(toNumber(item.baseAmount, 0)),
          item.appliedRate !== null && item.appliedRate !== undefined ? String(item.appliedRate) : null,
          Math.round(toNumber(item.commissionAmount, 0)),
          item.currency || 'PYG',
          periodStr,
          yr,
          mo,
          item.status || 'PENDIENTE',
          item.sourceType === 'MANUAL',
          item.notes ?? null,
          toIsoString(item.earnedAt),
          normalizeUuidOrNull(item.createdBy ?? item.createdByUserId),
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'payrollSettlementItems': {
      await client.query(
        `INSERT INTO payroll_settlement_items (
           id, settlement_id, item_type, generated_commission_id, description,
           sign, amount, source_reference, created_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, COALESCE($9::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           settlement_id = EXCLUDED.settlement_id,
           item_type = EXCLUDED.item_type,
           generated_commission_id = EXCLUDED.generated_commission_id,
           description = EXCLUDED.description,
           sign = EXCLUDED.sign,
           amount = EXCLUDED.amount,
           source_reference = EXCLUDED.source_reference`,
        [
          item.id,
          item.settlementId,
          item.itemType || 'AJUSTE',
          normalizeUuidOrNull(item.commissionId ?? item.generatedCommissionId),
          String(item.concept ?? item.description ?? 'Concepto'),
          item.sign || 'CREDIT',
          Math.round(toNumber(item.amount, 0)),
          item.notes ?? item.sourceReference ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'staffPayments': {
      await client.query(
        `INSERT INTO staff_payments (
           id, organization_id, branch_id, settlement_id, employee_id,
           operation_number, payment_date, amount, currency, payment_method,
           reference_number, overpayment_override, overpayment_override_reason,
           status, notes, responsible_user_id, responsible_user_name,
           annulled_by_user_id, annulled_at, annulment_reason, created_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, COALESCE($7::timestamptz, NOW()), $8, $9, $10,
           $11, $12, $13,
           $14, $15, $16, $17,
           $18, $19::timestamptz, $20, COALESCE($21::timestamptz, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           branch_id = EXCLUDED.branch_id,
           settlement_id = EXCLUDED.settlement_id,
           employee_id = EXCLUDED.employee_id,
           operation_number = EXCLUDED.operation_number,
           payment_date = EXCLUDED.payment_date,
           amount = EXCLUDED.amount,
           payment_method = EXCLUDED.payment_method,
           reference_number = EXCLUDED.reference_number,
           overpayment_override = EXCLUDED.overpayment_override,
           overpayment_override_reason = EXCLUDED.overpayment_override_reason,
           status = EXCLUDED.status,
           notes = EXCLUDED.notes,
           annulled_by_user_id = EXCLUDED.annulled_by_user_id,
           annulled_at = EXCLUDED.annulled_at,
           annulment_reason = EXCLUDED.annulment_reason`,
        [
          item.id,
          item.organizationId,
          normalizeUuidOrNull(item.branchId),
          item.settlementId,
          item.employeeId,
          String(item.operationNumber || 'PAG-PER-0001'),
          toIsoString(item.paymentDate),
          Math.round(toNumber(item.amount, 0)),
          item.currency || 'PYG',
          String(item.paymentMethod || 'TRANSFERENCIA_SIPAP'),
          item.referenceNumber ?? null,
          Boolean(item.overpaymentOverride),
          item.overpaymentOverrideReason ?? null,
          item.status || 'COMPLETADO',
          item.notes ?? null,
          normalizeUuidOrNull(item.responsibleUserId),
          item.responsibleUserName ?? 'Usuario Responsable',
          normalizeUuidOrNull(item.annulledBy ?? item.annulledByUserId),
          toIsoString(item.annulledAt),
          item.annulledReason ?? item.annulmentReason ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    case 'auditLogs': {
      await client.query(
        `INSERT INTO audit_logs (
           id, organization_id, branch_id, user_id, action, entity, entity_id,
           ip_address, user_agent, old_values, new_values, description, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10::jsonb, $11::jsonb, $12, COALESCE($13::timestamptz, NOW())
         )
         ON CONFLICT (id) DO NOTHING`,
        [
          item.id,
          normalizeUuidOrNull(item.organizationId),
          normalizeUuidOrNull(item.branchId),
          normalizeUuidOrNull(item.userId),
          String(item.action || 'EVENT').slice(0, 50),
          String(item.entity || 'SYSTEM').slice(0, 50),
          item.entityId ? String(item.entityId).slice(0, 50) : null,
          item.ipAddress ? String(item.ipAddress).slice(0, 45) : null,
          item.userAgent ?? null,
          normalizeJsonParam(item.oldValues ?? null),
          normalizeJsonParam(item.newValues ?? null),
          item.description ?? null,
          toIsoString(item.createdAt),
        ]
      );
      break;
    }

    default:
      break;
  }
}

// ============================================================================
// 3. ELIMINACIÓN CON SAVEPOINT (SOFT-DELETE FALLBACK ANTE HISTORIAL CLÍNICO)
// ============================================================================

async function deleteRowWithFkFallback(client: pg.PoolClient, collection: string, key: string): Promise<void> {
  if (!key) return;
  const spName = `sp_del_${collection.toLowerCase()}`;

  switch (collection) {
    case 'userBranches': {
      const [userId, branchId] = key.split('::');
      if (userId && branchId) {
        await client.query('DELETE FROM user_branches WHERE user_id = $1 AND branch_id = $2', [userId, branchId]);
      }
      return;
    }
    case 'branchServices': {
      const [branchId, serviceId] = key.split('::');
      if (branchId && serviceId) {
        await client.query('DELETE FROM branch_services WHERE branch_id = $1 AND service_id = $2', [branchId, serviceId]);
      }
      return;
    }
    case 'patientBranches': {
      const [patientId, branchId] = key.split('::');
      if (patientId && branchId) {
        await client.query('DELETE FROM patient_branches WHERE patient_id = $1 AND branch_id = $2', [patientId, branchId]);
      }
      return;
    }
    case 'branchSettings': {
      await client.query('DELETE FROM branch_settings WHERE branch_id = $1', [key]);
      return;
    }
    default:
      break;
  }

  const tableMap: Record<string, { table: string; softDelete?: boolean }> = {
    organizationsList: { table: 'organizations', softDelete: true },
    branches: { table: 'branches', softDelete: true },
    dentalChairs: { table: 'dental_chairs', softDelete: false },
    roles: { table: 'roles', softDelete: false },
    users: { table: 'users', softDelete: true },
    services: { table: 'services', softDelete: true },
    insurancePlans: { table: 'insurance_plans', softDelete: false },
    planServicePrices: { table: 'plan_service_prices', softDelete: false },
    insuranceClaims: { table: 'insurance_claims', softDelete: false },
    patients: { table: 'patients', softDelete: true },
    appointments: { table: 'appointments', softDelete: false },
    clinicalRecords: { table: 'clinical_records', softDelete: false },
    odontograms: { table: 'odontograms', softDelete: false },
    odontogramItems: { table: 'odontogram_items', softDelete: false },
    quotes: { table: 'quotes', softDelete: false },
    quoteItems: { table: 'quote_items', softDelete: false },
    treatments: { table: 'treatments', softDelete: false },
    cashRegisters: { table: 'cash_registers', softDelete: false },
    cashMovements: { table: 'cash_movements', softDelete: false },
    payments: { table: 'payments', softDelete: false },
    employees: { table: 'employees', softDelete: true },
    employeeSalaries: { table: 'employee_salaries', softDelete: false },
    commissionRules: { table: 'commission_rules', softDelete: false },
    generatedCommissions: { table: 'generated_commissions', softDelete: false },
    payrollSettlements: { table: 'payroll_settlements', softDelete: false },
    payrollSettlementItems: { table: 'payroll_settlement_items', softDelete: false },
    staffPayments: { table: 'staff_payments', softDelete: false },
    auditLogs: { table: 'audit_logs', softDelete: false },
  };

  const meta = tableMap[collection];
  if (!meta) return;

  await client.query(`SAVEPOINT ${spName}`);
  try {
    await client.query(`DELETE FROM ${meta.table} WHERE id = $1`, [key]);
    await client.query(`RELEASE SAVEPOINT ${spName}`);
  } catch (err: any) {
    await client.query(`ROLLBACK TO SAVEPOINT ${spName}`);
    await client.query(`RELEASE SAVEPOINT ${spName}`);
    if (err?.code === '23503' && meta.softDelete) {
      await client.query(
        `UPDATE ${meta.table} SET deleted_at = NOW(), status = 'INACTIVE', updated_at = NOW() WHERE id = $1`,
        [key]
      );
    } else if (err?.code !== '23503') {
      throw err;
    }
  }
}

// ============================================================================
// 4. HIDRATACIÓN COMPLETA DESDE LAS 32 TABLAS RELACIONALES
// ============================================================================

export async function loadStateFromRelationalDb(pool: pg.Pool): Promise<{
  state: DbStateEnvelope;
  stateVersion: number;
  migratedFromLegacy: boolean;
}> {
  await ensureRelationalSchema(pool);

  const orgCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM organizations WHERE deleted_at IS NULL');
  const hasOrgs = Number(orgCountRes.rows[0]?.cnt || 0) > 0;

  let migratedFromLegacy = false;

  if (!hasOrgs) {
    // Verificar si existe app_state legacy en system_state para migrarlo automáticamente a las 32 tablas
    const legacyRes = await pool.query('SELECT data FROM system_state WHERE key = $1', ['app_state']);
    if (legacyRes.rows.length > 0 && legacyRes.rows[0]?.data?.data) {
      const legacyEnvelope: DbStateEnvelope = legacyRes.rows[0].data;
      ensurePayrollIntegrity(legacyEnvelope.data);
      await syncFullStateToRelationalDb(pool, legacyEnvelope, 1);
      migratedFromLegacy = true;
    } else {
      const initial = generateInitialSeedData();
      const initialEnvelope: DbStateEnvelope = {
        data: initial,
        organizationsList: [initial.organization],
      };
      await syncFullStateToRelationalDb(pool, initialEnvelope, 1);
    }
  }

  // Leer todas las 32 tablas + app_metadata en una lectura consistente
  const [
    orgsRes,
    branchesRes,
    branchSettingsRes,
    chairsRes,
    rolesRes,
    usersRes,
    userBranchesRes,
    servicesRes,
    branchServicesRes,
    plansRes,
    planPricesRes,
    claimsRes,
    patientsRes,
    patientBranchesRes,
    appointmentsRes,
    clinicalRes,
    odontogramsRes,
    odontogramItemsRes,
    quotesRes,
    quoteItemsRes,
    treatmentsRes,
    cashRegRes,
    cashMovRes,
    paymentsRes,
    auditRes,
    employeesRes,
    salariesRes,
    rulesRes,
    commissionsRes,
    settlementsRes,
    settlementItemsRes,
    staffPaymentsRes,
    metaRes,
  ] = await Promise.all([
    pool.query('SELECT * FROM organizations WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM branches WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM branch_settings ORDER BY created_at ASC'),
    pool.query('SELECT * FROM dental_chairs ORDER BY created_at ASC'),
    pool.query('SELECT * FROM roles ORDER BY created_at ASC'),
    pool.query('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM user_branches ORDER BY created_at ASC'),
    pool.query('SELECT * FROM services WHERE deleted_at IS NULL ORDER BY created_at ASC'),
    pool.query('SELECT * FROM branch_services'),
    pool.query('SELECT * FROM insurance_plans ORDER BY created_at ASC'),
    pool.query('SELECT * FROM plan_service_prices ORDER BY created_at ASC'),
    pool.query('SELECT * FROM insurance_claims ORDER BY created_at DESC'),
    pool.query('SELECT * FROM patients WHERE deleted_at IS NULL ORDER BY created_at DESC'),
    pool.query('SELECT * FROM patient_branches'),
    pool.query('SELECT * FROM appointments ORDER BY appointment_date DESC, start_time ASC'),
    pool.query('SELECT * FROM clinical_records ORDER BY created_at DESC'),
    pool.query('SELECT * FROM odontograms ORDER BY created_at DESC'),
    pool.query('SELECT * FROM odontogram_items ORDER BY created_at ASC'),
    pool.query('SELECT * FROM quotes ORDER BY created_at DESC'),
    pool.query('SELECT * FROM quote_items'),
    pool.query('SELECT * FROM treatments ORDER BY created_at DESC'),
    pool.query('SELECT * FROM cash_registers ORDER BY opened_at DESC'),
    pool.query('SELECT * FROM cash_movements ORDER BY created_at DESC'),
    pool.query('SELECT * FROM payments ORDER BY created_at DESC'),
    pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 2000'),
    pool.query('SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC'),
    pool.query('SELECT * FROM employee_salaries ORDER BY effective_date DESC, created_at DESC'),
    pool.query('SELECT * FROM commission_rules ORDER BY created_at DESC'),
    pool.query('SELECT * FROM generated_commissions ORDER BY created_at DESC'),
    pool.query('SELECT * FROM payroll_settlements ORDER BY created_at DESC'),
    pool.query('SELECT * FROM payroll_settlement_items ORDER BY created_at ASC'),
    pool.query('SELECT * FROM staff_payments ORDER BY created_at DESC'),
    pool.query('SELECT data FROM system_state WHERE key = $1', ['app_metadata']),
  ]);

  const organizationsList = orgsRes.rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    legalName: r.legal_name,
    taxId: r.tax_id,
    countryCode: r.country_code,
    defaultCurrency: r.default_currency,
    timezone: r.timezone,
    status: r.status,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    address: r.address ?? undefined,
    website: r.website ?? undefined,
    tradeName: r.trade_name ?? undefined,
    primaryColor: r.primary_color ?? undefined,
    customHexColor: r.custom_hex_color ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    logoIcon: r.logo_icon ?? undefined,
    companyType: r.company_type ?? undefined,
    timbradoNumber: r.timbrado_number ?? undefined,
    timbradoVencimiento: r.timbrado_vencimiento ?? undefined,
    whatsapp: r.whatsapp ?? undefined,
    currencySymbol: r.currency_symbol ?? undefined,
    createdAt: toIsoString(r.created_at),
    updatedAt: toIsoString(r.updated_at),
    deletedAt: toIsoString(r.deleted_at),
  }));

  const meta = metaRes.rows[0]?.data || {};
  const stateVersion = toNumber(meta.stateVersion, 1);
  const activeOrg =
    organizationsList.find((o: any) => o.id === meta.activeOrganizationId) ||
    organizationsList[0] ||
    generateInitialSeedData().organization;

  const data: any = {
    organization: activeOrg,
    regulatoryRestrictions: Array.isArray(meta.regulatoryRestrictions) ? meta.regulatoryRestrictions : undefined,
    branches: branchesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      code: r.code,
      name: r.name,
      department: r.department,
      city: r.city,
      neighborhood: r.neighborhood,
      address: r.address,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      openingTime: String(r.opening_time || '07:30:00').slice(0, 8),
      closingTime: String(r.closing_time || '19:30:00').slice(0, 8),
      status: r.status,
      isMain: Boolean(r.is_main),
      operatingHours: r.operating_hours ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    branchSettings: branchSettingsRes.rows.map((r: any) => ({
      id: r.id || r.branch_id,
      branchId: r.branch_id,
      appointmentDurationDefault: toNumber(r.appointment_duration_default, 30),
      slotInterval: toNumber(r.slot_interval, 15),
      allowDoubleBooking: Boolean(r.allow_double_booking),
      requireDocumentOnBooking: Boolean(r.require_document_on_booking),
      allowOnlineBooking: r.allow_online_booking !== false,
      requireDocumentId: r.require_document_id !== false,
      enableWaitlist: r.enable_waitlist !== false,
      maxOverbookingSlots: toNumber(r.max_overbooking_slots, 0),
      reminderChannels: parseJsonArray(r.reminder_channels, ['WHATSAPP', 'EMAIL']),
      defaultAppointmentDurationMinutes: toNumber(r.default_appointment_duration_minutes, 30),
      cancellationNoticeHours: toNumber(r.cancellation_notice_hours, 24),
      requireDepositForSpecialties: Boolean(r.require_deposit_for_specialties),
      depositAmountPyg: toNumber(r.deposit_amount_pyg, 0),
      slotIntervalMinutes: toNumber(r.slot_interval_minutes, 15),
      maxAdvanceBookingDays: toNumber(r.max_advance_booking_days, 60),
      receiptSeries: r.receipt_series ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    dentalChairs: chairsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      name: r.name,
      code: r.code,
      room: r.room,
      status: r.status,
      colorTag: r.color_tag || 'teal',
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    roles: rolesRes.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: Boolean(r.is_system),
      permissions: parseJsonArray(r.permissions, []),
      allowedNavTabs: parseJsonArray(r.allowed_nav_tabs, []),
      createdAt: toIsoString(r.created_at),
    })),
    users: usersRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      roleId: r.role_id,
      username: r.username || (r.email ? String(r.email).split('@')[0] : undefined),
      firstName: r.first_name,
      lastName: r.last_name ?? r.lastname,
      email: r.email,
      passwordHash: r.password_hash,
      passwordSalt: r.password_salt,
      passwordIterations: toNumber(r.password_iterations, 100000),
      phone: r.phone,
      professionalLicense: r.professional_license,
      specialty: r.specialty,
      status: r.status,
      permissionsVersion: toNumber(r.permissions_version, 1),
      customPermissions: parseJsonArray(r.custom_permissions, []),
      revokedPermissions: parseJsonArray(r.revoked_permissions, []),
      assignedRestrictions: parseJsonArray(r.assigned_restrictions, []),
      allowedNavTabs: parseJsonArray(r.allowed_nav_tabs, []),
      sessionRevokedAt: toIsoString(r.session_revoked_at),
      lastLoginAt: toIsoString(r.last_login_at),
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    userBranches: userBranchesRes.rows.map((r: any) => ({
      userId: r.user_id,
      branchId: r.branch_id,
      isDefault: Boolean(r.is_default),
      createdAt: toIsoString(r.created_at),
    })),
    services: servicesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      category: r.category,
      code: r.code,
      name: r.name,
      description: r.description,
      defaultDurationMin: toNumber(r.default_duration_min, 30),
      basePrice: toNumber(r.base_price, 0),
      status: r.status,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    branchServices: branchServicesRes.rows.map((r: any) => ({
      branchId: r.branch_id,
      serviceId: r.service_id,
      customPrice: toNumber(r.custom_price, 0),
      isAvailable: Boolean(r.is_available),
    })),
    insurancePlans: plansRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      code: r.code,
      name: r.name,
      description: r.description,
      status: r.status,
      coverageTerms: r.coverage_terms,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    planServicePrices: planPricesRes.rows.map((r: any) => ({
      id: r.id,
      planId: r.plan_id,
      serviceId: r.service_id,
      price: toNumber(r.price, 0),
      notes: r.notes,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    insuranceClaims: claimsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      planId: r.plan_id,
      claimNumber: r.claim_number,
      patientId: r.patient_id,
      treatmentId: r.treatment_id,
      serviceId: r.service_id,
      patientMemberNumber: r.patient_member_number,
      serviceName: r.service_name,
      toothNumber: toNullableNumber(r.tooth_number),
      originalListPrice: toNumber(r.original_list_price, 0),
      copayAmount: toNumber(r.copay_amount, 0),
      coveredAmount: toNumber(r.covered_amount, 0),
      status: r.status,
      submissionDate: toIsoString(r.submission_date),
      settledDate: toIsoString(r.settled_date),
      settlementReference: r.settlement_reference,
      notes: r.notes,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    patients: patientsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      primaryBranchId: r.primary_branch_id,
      documentType: r.document_type,
      documentNumber: r.document_number,
      firstName: r.first_name,
      lastName: r.last_name,
      birthDate: toDateOnly(r.birth_date),
      gender: r.gender,
      phone: r.phone,
      whatsapp: r.whatsapp,
      email: r.email,
      department: r.department,
      city: r.city,
      neighborhood: r.neighborhood,
      address: r.address,
      emergencyContactName: r.emergency_contact_name,
      emergencyContactPhone: r.emergency_contact_phone,
      bloodType: r.blood_type,
      allergies: r.allergies,
      medicalConditions: r.medical_conditions,
      medications: r.medications,
      modality: r.modality || 'PARTICULAR',
      insurancePlanId: r.insurance_plan_id ?? null,
      insuranceMemberNumber: r.insurance_member_number ?? null,
      assignedAdvisorId: r.assigned_advisor_id ?? null,
      assignedAt: toIsoString(r.assigned_at),
      assignedByUserId: r.assigned_by_user_id ?? null,
      createdByUserId: r.created_by_user_id ?? null,
      createdByNameSnapshot: r.created_by_name_snapshot || 'Origen histórico / Desconocido',
      status: r.status,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    patientBranches: patientBranchesRes.rows.map((r: any) => ({
      patientId: r.patient_id,
      branchId: r.branch_id,
      firstVisitDate: toDateOnly(r.first_visit_date),
      lastVisitDate: toDateOnly(r.last_visit_date),
    })),
    appointments: appointmentsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      dentalChairId: r.dental_chair_id,
      patientId: r.patient_id,
      odontologistId: r.odontologist_id,
      serviceId: r.service_id,
      appointmentDate: toDateOnly(r.appointment_date),
      startTime: String(r.start_time || '08:00:00').slice(0, 8),
      endTime: String(r.end_time || '08:30:00').slice(0, 8),
      durationMin: toNumber(r.duration_min, 30),
      status: r.status,
      reason: r.reason,
      cancellationReason: r.cancellation_reason,
      notes: r.notes,
      createdBy: r.created_by,
      historicalDoctorName: r.historical_doctor_name ?? undefined,
      historicalCreatedByName: r.historical_created_by_name ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    clinicalRecords: clinicalRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      patientId: r.patient_id,
      odontologistId: r.odontologist_id,
      appointmentId: r.appointment_id,
      reasonForConsultation: r.reason_for_consultation,
      diagnosis: r.diagnosis,
      treatmentPerformed: r.treatment_performed,
      prescriptions: r.prescriptions,
      recommendations: r.recommendations,
      internalNotes: r.internal_notes,
      attachments: parseJsonArray(r.attachments, []),
      historicalDoctorName: r.historical_doctor_name ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    odontograms: odontogramsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      patientId: r.patient_id,
      odontologistId: r.odontologist_id,
      clinicalRecordId: r.clinical_record_id,
      version: toNumber(r.version, 1),
      odontogramType: r.odontogram_type,
      generalObservations: r.general_observations,
      historicalDoctorName: r.historical_doctor_name ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    odontogramItems: odontogramItemsRes.rows.map((r: any) => ({
      id: r.id,
      odontogramId: r.odontogram_id,
      toothNumber: toNumber(r.tooth_number, 11),
      surface: r.surface,
      condition: r.condition,
      material: r.material,
      notes: r.notes,
      colorCode: r.color_code,
      createdAt: toIsoString(r.created_at),
    })),
    quotes: quotesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      patientId: r.patient_id,
      planId: r.plan_id ?? null,
      planName: r.plan_name ?? null,
      odontologistId: r.odontologist_id,
      quoteNumber: r.quote_number,
      totalAmount: toNumber(r.total_amount, 0),
      discountAmount: toNumber(r.discount_amount, 0),
      finalAmount: toNumber(r.final_amount, 0),
      status: r.status,
      validUntil: toDateOnly(r.valid_until),
      notes: r.notes,
      historicalDoctorName: r.historical_doctor_name ?? undefined,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    quoteItems: quoteItemsRes.rows.map((r: any) => ({
      id: r.id,
      quoteId: r.quote_id,
      serviceId: r.service_id,
      toothNumber: toNullableNumber(r.tooth_number),
      description: r.description,
      quantity: toNumber(r.quantity, 1),
      unitPrice: toNumber(r.unit_price, 0),
      subtotal: toNumber(r.subtotal, 0),
      appliedModality: r.applied_modality ?? undefined,
      appliedPlanId: r.applied_plan_id ?? null,
      appliedPlanName: r.applied_plan_name ?? null,
      originalListPrice: toNullableNumber(r.original_list_price) ?? undefined,
    })),
    treatments: treatmentsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      patientId: r.patient_id,
      quoteId: r.quote_id,
      serviceId: r.service_id ?? null,
      title: r.title,
      totalAmount: toNumber(r.total_amount, 0),
      paidAmount: toNumber(r.paid_amount, 0),
      balanceDue: toNumber(r.balance_due, 0),
      status: r.status,
      appliedModality: r.applied_modality || 'PARTICULAR',
      appliedPlanId: r.applied_plan_id ?? null,
      appliedPlanName: r.applied_plan_name ?? null,
      originalListPrice: toNullableNumber(r.original_list_price) ?? undefined,
      finalAppliedPrice: toNullableNumber(r.final_applied_price) ?? undefined,
      toothNumbers: parseJsonArray(r.tooth_numbers, []),
      odontologistId: r.odontologist_id ?? undefined,
      notes: r.notes ?? undefined,
      startDate: toDateOnly(r.start_date),
      completedDate: toDateOnly(r.completed_date),
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    cashRegisters: cashRegRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      openedBy: r.opened_by,
      closedBy: r.closed_by,
      openingAmount: toNumber(r.opening_amount, 0),
      closingAmountExpected: toNullableNumber(r.closing_amount_expected),
      closingAmountReal: toNullableNumber(r.closing_amount_real),
      differenceAmount: toNullableNumber(r.difference_amount),
      status: r.status,
      openedAt: toIsoString(r.opened_at),
      closedAt: toIsoString(r.closed_at),
      observations: r.observations,
      historicalOpenedByName: r.historical_opened_by_name ?? undefined,
      historicalClosedByName: r.historical_closed_by_name ?? undefined,
    })),
    cashMovements: cashMovRes.rows.map((r: any) => ({
      id: r.id,
      cashRegisterId: r.cash_register_id,
      movementType: r.movement_type,
      amount: toNumber(r.amount, 0),
      paymentMethod: r.payment_method,
      concept: r.concept,
      referenceNumber: r.reference_number,
      performedBy: r.performed_by,
      historicalPerformedByName: r.historical_performed_by_name ?? undefined,
      createdAt: toIsoString(r.created_at),
    })),
    payments: paymentsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      patientId: r.patient_id,
      treatmentId: r.treatment_id,
      appointmentId: r.appointment_id,
      cashMovementId: r.cash_movement_id,
      receiptNumber: r.receipt_number,
      invoiceNumber: r.invoice_number,
      amount: toNumber(r.amount, 0),
      paymentMethod: r.payment_method,
      status: r.status,
      notes: r.notes,
      receivedBy: r.received_by,
      annulledAt: toIsoString(r.annulled_at) ?? undefined,
      annulledReason: r.annulled_reason ?? undefined,
      annulledBy: r.annulled_by ?? undefined,
      historicalReceivedByName: r.historical_received_by_name ?? undefined,
      createdAt: toIsoString(r.created_at),
    })),
    auditLogs: auditRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id,
      userId: r.user_id,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      oldValues: parseJsonValue(r.old_values, null),
      newValues: parseJsonValue(r.new_values, null),
      description: r.description,
      createdAt: toIsoString(r.created_at),
    })),
    employees: employeesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id ?? null,
      userId: r.user_id ?? null,
      employeeCode: r.employee_code,
      firstName: r.first_name,
      lastName: r.last_name,
      documentType: r.document_type,
      documentNumber: r.document_number,
      phone: r.phone ?? null,
      email: r.email ?? null,
      area: r.area,
      position: r.position,
      hireDate: toDateOnly(r.hire_date),
      status: r.status,
      remunerationModality: r.remuneration_modality,
      isAdvisor: Boolean(r.is_advisor),
      observations: r.observations ?? null,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    employeeSalaries: salariesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      employeeId: r.employee_id,
      area: r.area,
      baseSalary: toNumber(r.base_salary, 0),
      paymentFrequency: r.payment_frequency,
      effectiveDate: toDateOnly(r.effective_date),
      endDate: toDateOnly(r.end_date),
      currency: r.currency || 'PYG',
      status: r.status,
      observations: r.observations ?? null,
      createdBy: r.created_by_user_id ?? null,
      createdAt: toIsoString(r.created_at),
    })),
    commissionRules: rulesRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id ?? null,
      name: r.name,
      description: r.description ?? r.notes ?? null,
      area: r.area,
      triggerType: r.trigger_type || r.trigger_condition || 'ON_PAYMENT_COLLECTED',
      calculationMode: r.calculation_mode,
      ratePercentage: toNullableNumber(r.rate_percentage ?? r.percentage_rate),
      fixedAmount: toNullableNumber(r.fixed_amount),
      minThresholdAmount: toNullableNumber(r.min_threshold_amount),
      serviceId: r.service_id ?? null,
      targetEmployeeId: r.target_employee_id ?? r.employee_id ?? null,
      requiresCollectedPayment: Boolean(r.requires_collected_payment),
      requiresCompletedTreatment: Boolean(r.requires_completed_treatment),
      effectiveFrom: toDateOnly(r.effective_from),
      effectiveTo: toDateOnly(r.effective_to),
      status: r.status,
      createdBy: r.created_by_user_id ?? null,
      createdAt: toIsoString(r.created_at),
      updatedAt: toIsoString(r.updated_at),
    })),
    generatedCommissions: commissionsRes.rows.map((r: any) => {
      const [pYearStr, pMonthStr] = String(r.period || '').split('-');
      return {
        id: r.id,
        organizationId: r.organization_id,
        branchId: r.branch_id ?? null,
        employeeId: r.employee_id,
        ruleId: r.rule_id ?? null,
        settlementId: r.settlement_id ?? null,
        area: r.area,
        triggerType: r.trigger_type || (r.is_manual_adjustment ? 'MANUAL' : 'ON_PAYMENT_COLLECTED'),
        sourceType: r.source_type,
        sourceId: r.source_id,
        dedupKey: r.dedup_key,
        patientId: r.patient_id ?? null,
        quoteId: r.quote_id ?? null,
        treatmentId: r.treatment_id ?? null,
        paymentId: r.payment_id ?? null,
        serviceId: r.service_id ?? null,
        advisorSnapshotId: r.advisor_snapshot_id ?? null,
        advisorSnapshotName: r.advisor_snapshot_name ?? null,
        baseAmount: toNumber(r.base_amount, 0),
        appliedRate: toNullableNumber(r.applied_rate),
        commissionAmount: toNumber(r.commission_amount, 0),
        currency: r.currency || 'PYG',
        periodYear: toNumber(r.period_year ?? pYearStr, new Date().getUTCFullYear()),
        periodMonth: toNumber(r.period_month ?? pMonthStr, 1),
        status: r.status,
        concept: r.concept,
        notes: r.notes ?? null,
        earnedAt: toIsoString(r.earned_at || r.created_at),
        createdBy: r.created_by_user_id ?? null,
        createdAt: toIsoString(r.created_at),
      };
    }),
    payrollSettlements: settlementsRes.rows.map((r: any) => {
      const [pYearStr, pMonthStr] = String(r.period || '').split('-');
      return {
        id: r.id,
        organizationId: r.organization_id,
        branchId: r.branch_id ?? null,
        employeeId: r.employee_id,
        settlementNumber: r.settlement_number,
        periodYear: toNumber(r.period_year ?? pYearStr, new Date().getUTCFullYear()),
        periodMonth: toNumber(r.period_month ?? pMonthStr, 1),
        periodLabel: r.period_label || r.period || '',
        baseSalarySnapshot: toNumber(r.base_salary_amount, 0),
        commissionsTotal: toNumber(r.commissions_amount, 0),
        bonusesTotal: toNumber(r.bonuses_amount, 0),
        advancesTotal: toNumber(r.advances_amount, 0),
        deductionsTotal: toNumber(r.deductions_amount, 0),
        adjustmentsTotal: toNumber(r.manual_adjustments_amount, 0),
        grossTotal: toNumber(r.gross_total, 0),
        netPayable: toNumber(r.net_payable, 0),
        paidAmount: toNumber(r.paid_amount, 0),
        balanceDue: toNumber(r.balance_due, 0),
        currency: r.currency || 'PYG',
        status: r.status,
        notes: r.notes ?? null,
        createdBy: r.created_by_user_id ?? null,
        submittedAt: toIsoString(r.submitted_at),
        approvedBy: r.approved_by_user_id ?? null,
        approvedAt: toIsoString(r.approved_at),
        annulledBy: r.annulled_by_user_id ?? null,
        annulledAt: toIsoString(r.annulled_at),
        annulledReason: r.annulment_reason ?? null,
        createdAt: toIsoString(r.created_at),
        updatedAt: toIsoString(r.updated_at),
      };
    }),
    payrollSettlementItems: settlementItemsRes.rows.map((r: any) => ({
      id: r.id,
      settlementId: r.settlement_id,
      itemType: r.item_type,
      commissionId: r.generated_commission_id ?? null,
      concept: r.description || '',
      sign: r.sign || 'CREDIT',
      amount: toNumber(r.amount, 0),
      notes: r.source_reference ?? r.notes ?? null,
      createdAt: toIsoString(r.created_at),
    })),
    staffPayments: staffPaymentsRes.rows.map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      branchId: r.branch_id ?? null,
      settlementId: r.settlement_id,
      employeeId: r.employee_id,
      operationNumber: r.operation_number,
      paymentDate: toDateOnly(r.payment_date),
      amount: toNumber(r.amount, 0),
      currency: r.currency || 'PYG',
      paymentMethod: r.payment_method,
      referenceNumber: r.reference_number ?? null,
      overpaymentOverride: Boolean(r.overpayment_override),
      overpaymentOverrideReason: r.overpayment_override_reason ?? null,
      status: r.status,
      notes: r.notes ?? null,
      responsibleUserId: r.responsible_user_id ?? null,
      responsibleUserName: r.responsible_user_name ?? null,
      annulledBy: r.annulled_by_user_id ?? null,
      annulledAt: toIsoString(r.annulled_at),
      annulledReason: r.annulment_reason ?? null,
      createdAt: toIsoString(r.created_at),
    })),
  };

  ensurePayrollIntegrity(data);

  return {
    state: {
      data,
      organizationsList,
    },
    stateVersion,
    migratedFromLegacy,
  };
}

// ============================================================================
// 5. ESCRITURA RELACIONAL COMPLETA (SOLO EN SEED INICIAL / RESET-SEED)
// ============================================================================

async function upsertMetadata(client: pg.PoolClient, state: DbStateEnvelope, stateVersion: number): Promise<void> {
  const metadata = {
    stateVersion,
    activeOrganizationId: state.data?.organization?.id || state.organizationsList?.[0]?.id || null,
    regulatoryRestrictions: Array.isArray(state.data?.regulatoryRestrictions) ? state.data.regulatoryRestrictions : null,
    updatedAt: new Date().toISOString(),
  };
  await client.query(
    `INSERT INTO system_state (key, data, updated_at)
     VALUES ('app_metadata', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(metadata)]
  );
}

export async function syncFullStateToRelationalDb(
  pool: pg.Pool,
  state: DbStateEnvelope,
  stateVersion: number = 1
): Promise<void> {
  await ensureRelationalSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.allow_audit_reset = 'on'`);

    // Vaciar en orden hijo -> padre para reseteo limpio de semilla o migración inicial
    const tablesToClear = [
      'audit_logs',
      'staff_payments',
      'payroll_settlement_items',
      'generated_commissions',
      'payroll_settlements',
      'payments',
      'cash_movements',
      'cash_registers',
      'insurance_claims',
      'treatments',
      'quote_items',
      'quotes',
      'odontogram_items',
      'odontograms',
      'clinical_records',
      'appointments',
      'patient_branches',
      'patients',
      'commission_rules',
      'employee_salaries',
      'employees',
      'plan_service_prices',
      'insurance_plans',
      'branch_services',
      'services',
      'user_branches',
      'users',
      'dental_chairs',
      'branch_settings',
      'branches',
      'organizations',
      'roles',
    ];

    for (const tbl of tablesToClear) {
      await client.query(`DELETE FROM ${tbl}`);
    }

    const getCollectionRows = (col: string): any[] => {
      if (col === 'organizationsList') {
        const list = Array.isArray(state.organizationsList) ? state.organizationsList : [];
        if (list.length > 0) return list;
        return state.data?.organization ? [state.data.organization] : [];
      }
      return Array.isArray(state.data?.[col]) ? state.data[col] : [];
    };

    for (const col of COLLECTION_PARENT_TO_CHILD_ORDER) {
      const rows = getCollectionRows(col);
      for (const item of rows) {
        await upsertRow(client, col, item, state);
      }
    }

    await upsertMetadata(client, state, stateVersion);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================================
// 6. PERSISTENCIA TRANSACCIONAL POR DELTA (CERO SOBRESCRITURA MONOLÍTICA)
// ============================================================================

export async function applyDeltaToRelationalDb(
  pool: pg.Pool,
  delta: DbDeltaPayload,
  currentState: DbStateEnvelope,
  stateVersion: number
): Promise<void> {
  await ensureRelationalSchema(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upserts en orden padre -> hijo
    const upserts = delta.upserts || {};
    for (const col of COLLECTION_PARENT_TO_CHILD_ORDER) {
      const items = upserts[col];
      if (!Array.isArray(items) || items.length === 0) continue;
      for (const item of items) {
        await upsertRow(client, col, item, currentState);
      }
    }

    // 2. Deletes en orden hijo -> padre (con SAVEPOINT + soft-delete fallback)
    const deletes = delta.deletes || {};
    for (const col of COLLECTION_CHILD_TO_PARENT_ORDER) {
      const keys = deletes[col];
      if (!Array.isArray(keys) || keys.length === 0) continue;
      for (const key of keys) {
        await deleteRowWithFkFallback(client, col, key);
      }
    }

    await upsertMetadata(client, currentState, stateVersion);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
