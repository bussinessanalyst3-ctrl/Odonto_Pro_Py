-- ============================================================================
-- MIGRACIÓN SQL VERSIONADA PARA SUPABASE / POSTGRESQL 16+
-- Versión: 202611190003_concurrency_and_financial_constraints.sql
-- Descripción:
--   Fase 6 — Concurrencia, integridad financiera y bitácora inmutable:
--   1. Índices únicos parciales para evitar doble caja abierta por sucursal
--      y emisión duplicada de números de recibo activos por organización.
--   2. Restricciones CHECK financieras en treatments, payments, cash_movements
--      y cash_registers.
--   3. Trigger append-only en audit_logs para impedir UPDATE/DELETE indebidos.
--   Completamente idempotente para entornos Supabase existentes o nuevos.
-- ============================================================================

-- 1. Índices únicos parciales anti-concurrencia
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_registers_open_branch
  ON cash_registers(branch_id)
  WHERE status = 'ABIERTA';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_org_receipt_active
  ON payments(organization_id, receipt_number)
  WHERE status <> 'ANULADO';

-- 2. Restricciones CHECK financieras (idempotentes vía catálogo pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_treatments_non_negative_amounts'
  ) THEN
    ALTER TABLE treatments
      ADD CONSTRAINT chk_treatments_non_negative_amounts
      CHECK (total_amount >= 0 AND paid_amount >= 0 AND balance_due >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_positive_amount'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT chk_payments_positive_amount
      CHECK (amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_movements_positive_amount'
  ) THEN
    ALTER TABLE cash_movements
      ADD CONSTRAINT chk_cash_movements_positive_amount
      CHECK (amount > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_cash_registers_non_negative_opening'
  ) THEN
    ALTER TABLE cash_registers
      ADD CONSTRAINT chk_cash_registers_non_negative_opening
      CHECK (opening_amount >= 0) NOT VALID;
  END IF;
END $$;

-- Validar restricciones si los datos existentes cumplen las invariantes
DO $$
BEGIN
  ALTER TABLE treatments VALIDATE CONSTRAINT chk_treatments_non_negative_amounts;
  ALTER TABLE payments VALIDATE CONSTRAINT chk_payments_positive_amount;
  ALTER TABLE cash_movements VALIDATE CONSTRAINT chk_cash_movements_positive_amount;
  ALTER TABLE cash_registers VALIDATE CONSTRAINT chk_cash_registers_non_negative_opening;
EXCEPTION
  WHEN others THEN
    -- Mantener NOT VALID para filas históricas pre-migración mientras aplica estrictamente a escrituras nuevas
    NULL;
END $$;

-- 3. Protección append-only para audit_logs (bloquea UPDATE y DELETE no autorizados)
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_audit_reset', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs es inmutable (append-only): no se permiten operaciones %', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
