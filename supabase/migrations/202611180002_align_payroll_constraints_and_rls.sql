-- ============================================================================
-- MIGRACIÓN SQL VERSIONADA PARA SUPABASE / POSTGRESQL 16+
-- Versión: 202611180002_align_payroll_constraints_and_rls.sql
-- Descripción:
--   1. Alinea las restricciones CHECK y columnas entre 202611180001 y el motor
--      de dominio / repositorio relacional (payrollEngine.ts & pgRepository.ts).
--   2. Asegura tabla user_sessions con RLS habilitado (acceso exclusivo backend).
--   3. Habilita RLS multi-tenant en tablas operativas faltantes si aplica.
--   Completamente idempotente para entornos Supabase existentes o nuevos.
-- ============================================================================

-- 1. Columnas extendidas del motor de comisiones y liquidaciones
ALTER TABLE commission_rules
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS rate_percentage NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS min_threshold_amount BIGINT,
  ADD COLUMN IF NOT EXISTS target_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_collected_payment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_completed_treatment BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE generated_commissions
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL,
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

-- 2. Alineación de nulabilidad y CHECK constraints con el dominio real
ALTER TABLE employees ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE employees ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE commission_rules ALTER COLUMN concept DROP NOT NULL;
ALTER TABLE commission_rules ALTER COLUMN effective_from DROP NOT NULL;
ALTER TABLE commission_rules ALTER COLUMN target_type DROP NOT NULL;
ALTER TABLE commission_rules ALTER COLUMN calculation_base DROP NOT NULL;
ALTER TABLE commission_rules ALTER COLUMN trigger_condition DROP NOT NULL;
ALTER TABLE generated_commissions ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE generated_commissions ALTER COLUMN period DROP NOT NULL;
ALTER TABLE payroll_settlements ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE payroll_settlements ALTER COLUMN area DROP NOT NULL;
ALTER TABLE payroll_settlements ALTER COLUMN period DROP NOT NULL;
ALTER TABLE payroll_settlements ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE payroll_settlements ALTER COLUMN period_end DROP NOT NULL;
ALTER TABLE payroll_settlement_items ALTER COLUMN description DROP NOT NULL;
ALTER TABLE staff_payments ALTER COLUMN branch_id DROP NOT NULL;
ALTER TABLE staff_payments ALTER COLUMN responsible_user_name DROP NOT NULL;

ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_concept_check;
ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_calculation_mode_check;
ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rules_calculation_mode_check CHECK (
    calculation_mode IN (
      'PERCENTAGE',
      'FIXED_OPERATION',
      'FIXED_TREATMENT',
      'FIXED_PER_OPERATION',
      'FIXED_PER_TREATMENT',
      'GOAL_BONUS',
      'MANUAL_ADJUSTMENT'
    )
  );

ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_trigger_condition_check;
ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rules_trigger_condition_check CHECK (
    trigger_condition IS NULL OR trigger_condition IN (
      'ON_PAYMENT_COLLECTED',
      'ON_TREATMENT_COMPLETED',
      'ON_PATIENT_ACQUISITION',
      'ON_GOAL_ACHIEVED',
      'MANUAL',
      'MANUAL_OR_GOAL'
    )
  );

ALTER TABLE payroll_settlement_items DROP CONSTRAINT IF EXISTS payroll_settlement_items_item_type_check;
ALTER TABLE payroll_settlement_items
  ADD CONSTRAINT payroll_settlement_items_item_type_check CHECK (
    item_type IN (
      'SALARIO_BASE',
      'COMISION',
      'BONO',
      'ANTICIPO',
      'DESCUENTO',
      'AJUSTE',
      'BASE_SALARY',
      'COMMISSION',
      'BONUS',
      'ADVANCE',
      'DEDUCTION',
      'ADJUSTMENT'
    )
  );

ALTER TABLE staff_payments DROP CONSTRAINT IF EXISTS staff_payments_payment_method_check;

-- 3. Tabla persistente de sesiones de servidor (sin acceso anónimo PostgREST)
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

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_direct_user_sessions ON user_sessions;
CREATE POLICY deny_direct_user_sessions ON user_sessions USING (FALSE);
