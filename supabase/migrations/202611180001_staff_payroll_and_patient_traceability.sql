-- ============================================================================
-- MIGRACIÓN SQL VERSIONADA PARA SUPABASE / POSTGRESQL 16+
-- Versión: 202611180001_staff_payroll_and_patient_traceability.sql
-- Descripción:
--   1. Módulo Gestión Financiera del Personal (employees, employee_salaries,
--      commission_rules, generated_commissions, payroll_settlements,
--      payroll_settlement_items, staff_payments)
--   2. Trazabilidad comercial y auditoría en patients (assigned_advisor_id,
--      created_by_user_id inmutable, created_by_name_snapshot)
--   3. Índices de deduplicación, claves foráneas, triggers de inmutabilidad
--      y políticas Row Level Security (RLS) compatibles con Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PERSONAL / EMPLEADOS (Vinculación opcional a users sin duplicar cuentas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    employee_code VARCHAR(40) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'CI' CHECK (document_type IN ('CI', 'RUC', 'PASAPORTE', 'OTRO')),
    document_number VARCHAR(50) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    area VARCHAR(20) NOT NULL CHECK (area IN ('OPERATIVA', 'CLINICA', 'COMERCIAL')),
    position VARCHAR(120) NOT NULL,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    remuneration_modality VARCHAR(30) NOT NULL DEFAULT 'SALARIO_FIJO' CHECK (
        remuneration_modality IN ('SALARIO_FIJO', 'COMISION', 'MIXTO', 'HONORARIOS')
    ),
    is_advisor BOOLEAN NOT NULL DEFAULT FALSE,
    observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_employee_org_code UNIQUE (organization_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_employees_org_area_status ON employees(organization_id, area, status);
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_advisors ON employees(organization_id, is_advisor, status) WHERE is_advisor = TRUE;

-- ============================================================================
-- 2. SALARIOS E HISTORIAL SALARIAL INMUTABLE (PYG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    area VARCHAR(20) NOT NULL CHECK (area IN ('OPERATIVA', 'CLINICA', 'COMERCIAL')),
    base_salary BIGINT NOT NULL CHECK (base_salary >= 0),
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MENSUAL' CHECK (
        payment_frequency IN ('SEMANAL', 'QUINCENAL', 'MENSUAL')
    ),
    effective_date DATE NOT NULL,
    end_date DATE,
    currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
    status VARCHAR(20) NOT NULL DEFAULT 'VIGENTE' CHECK (status IN ('VIGENTE', 'HISTORICO', 'INACTIVO')),
    observations TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salaries_employee_status ON employee_salaries(employee_id, status, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_salaries_org ON employee_salaries(organization_id);

-- Solo un salario VIGENTE por empleado en paralelo
CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_active_salary
    ON employee_salaries(employee_id)
    WHERE status = 'VIGENTE';

-- ============================================================================
-- 3. REGLAS CONFIGURABLES DE COMISIONES (SIN VALORES FIJOS HARDCODEADOS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(180) NOT NULL,
    area VARCHAR(20) NOT NULL CHECK (area IN ('OPERATIVA', 'CLINICA', 'COMERCIAL')),
    target_type VARCHAR(20) NOT NULL DEFAULT 'AREA' CHECK (target_type IN ('EMPLOYEE', 'AREA', 'ROLE')),
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    target_role_id VARCHAR(50),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    concept VARCHAR(50) NOT NULL CHECK (
        concept IN (
            'CAPTACION_PACIENTE',
            'VENTA_TRATAMIENTO',
            'CUMPLIMIENTO_OBJETIVO',
            'OPERACION_COBRADA',
            'TRATAMIENTO_REALIZADO',
            'PROCEDIMIENTO_FINALIZADO',
            'SERVICIO_PRESTADO',
            'BONO_PRODUCTIVIDAD',
            'AJUSTE_MANUAL'
        )
    ),
    calculation_mode VARCHAR(30) NOT NULL CHECK (
        calculation_mode IN (
            'PERCENTAGE',
            'FIXED_PER_OPERATION',
            'FIXED_PER_TREATMENT',
            'GOAL_BONUS',
            'MANUAL_ADJUSTMENT'
        )
    ),
    percentage_rate NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (percentage_rate >= 0 AND percentage_rate <= 100),
    fixed_amount BIGINT NOT NULL DEFAULT 0 CHECK (fixed_amount >= 0),
    calculation_base VARCHAR(30) NOT NULL DEFAULT 'AMOUNT_COLLECTED' CHECK (
        calculation_base IN ('AMOUNT_COLLECTED', 'TREATMENT_TOTAL', 'QUOTE_TOTAL', 'PER_UNIT', 'GOAL_TARGET')
    ),
    trigger_condition VARCHAR(40) NOT NULL DEFAULT 'ON_PAYMENT_COLLECTED' CHECK (
        trigger_condition IN (
            'ON_PAYMENT_COLLECTED',
            'ON_TREATMENT_COMPLETED',
            'ON_PATIENT_ACQUISITION',
            'MANUAL_OR_GOAL'
        )
    ),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_org_area_status ON commission_rules(organization_id, area, status);

-- ============================================================================
-- 4. COMISIONES GENERADAS (TRAZABILIDAD Y DEDUPLICACIÓN ESTRICTA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    rule_id UUID REFERENCES commission_rules(id) ON DELETE SET NULL,
    area VARCHAR(20) NOT NULL CHECK (area IN ('OPERATIVA', 'CLINICA', 'COMERCIAL')),
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('PAYMENT', 'TREATMENT', 'QUOTE', 'PATIENT', 'MANUAL', 'GOAL')),
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
    period VARCHAR(10) NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE' CHECK (
        status IN ('PENDIENTE', 'EN_LIQUIDACION', 'APROBADA', 'PAGADA', 'ANULADA')
    ),
    settlement_id UUID,
    is_manual_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Previene duplicidad de comisiones automáticas sobre una misma operación de origen
CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_commissions_dedup
    ON generated_commissions(organization_id, dedup_key)
    WHERE status <> 'ANULADA' AND is_manual_adjustment = FALSE;

CREATE INDEX IF NOT EXISTS idx_gen_commissions_emp_period ON generated_commissions(employee_id, period, status);
CREATE INDEX IF NOT EXISTS idx_gen_commissions_settlement ON generated_commissions(settlement_id) WHERE settlement_id IS NOT NULL;

-- ============================================================================
-- 5. LIQUIDACIONES DE PERSONAL Y DETALLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    settlement_number VARCHAR(60) NOT NULL,
    area VARCHAR(20) NOT NULL CHECK (area IN ('OPERATIVA', 'CLINICA', 'COMERCIAL')),
    period VARCHAR(10) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    base_salary_amount BIGINT NOT NULL DEFAULT 0 CHECK (base_salary_amount >= 0),
    commissions_amount BIGINT NOT NULL DEFAULT 0,
    bonuses_amount BIGINT NOT NULL DEFAULT 0 CHECK (bonuses_amount >= 0),
    advances_amount BIGINT NOT NULL DEFAULT 0 CHECK (advances_amount >= 0),
    deductions_amount BIGINT NOT NULL DEFAULT 0 CHECK (deductions_amount >= 0),
    manual_adjustments_amount BIGINT NOT NULL DEFAULT 0,
    gross_total BIGINT NOT NULL DEFAULT 0,
    net_payable BIGINT NOT NULL DEFAULT 0 CHECK (net_payable >= 0),
    paid_amount BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    balance_due BIGINT NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'BORRADOR' CHECK (
        status IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'PAGADA', 'ANULADA')
    ),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    annulled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    annulled_at TIMESTAMPTZ,
    annulment_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payroll_settlement_org_num UNIQUE (organization_id, settlement_number)
);

CREATE INDEX IF NOT EXISTS idx_payroll_settlements_org_period ON payroll_settlements(organization_id, period, status);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_emp ON payroll_settlements(employee_id, period);

CREATE TABLE IF NOT EXISTS payroll_settlement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE CASCADE,
    item_type VARCHAR(25) NOT NULL CHECK (
        item_type IN ('BASE_SALARY', 'COMMISSION', 'BONUS', 'ADVANCE', 'DEDUCTION', 'ADJUSTMENT')
    ),
    description VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    generated_commission_id UUID REFERENCES generated_commissions(id) ON DELETE SET NULL,
    source_reference VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON payroll_settlement_items(settlement_id);

-- ============================================================================
-- 6. PAGOS AL PERSONAL (COMPLETOS, PARCIALES Y ANULACIONES AUDITADAS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    settlement_id UUID NOT NULL REFERENCES payroll_settlements(id) ON DELETE RESTRICT,
    operation_number VARCHAR(60) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL CHECK (
        payment_method IN (
            'EFECTIVO',
            'TRANSFERENCIA_SIPAP',
            'QR_BANCARIO',
            'TARJETA_DEBITO',
            'TARJETA_CREDITO',
            'BILLETERA_DIGITAL',
            'CHEQUE'
        )
    ),
    reference_number VARCHAR(120),
    responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    responsible_user_name VARCHAR(180) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO' CHECK (status IN ('COMPLETADO', 'ANULADO')),
    overpayment_override BOOLEAN NOT NULL DEFAULT FALSE,
    overpayment_override_reason TEXT,
    annulled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    annulled_at TIMESTAMPTZ,
    annulment_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_payment_org_op UNIQUE (organization_id, operation_number)
);

CREATE INDEX IF NOT EXISTS idx_staff_payments_settlement ON staff_payments(settlement_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_payments_employee ON staff_payments(employee_id, payment_date DESC);

-- ============================================================================
-- 7. ACTUALIZACIÓN DE PACIENTES: ASESOR DESIGNADO VS USUARIO DE CREACIÓN
-- ============================================================================
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS assigned_advisor_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS created_by_name_snapshot VARCHAR(180);

-- Migración limpia de registros históricos existentes sin inventar usuarios falsos
UPDATE patients
SET created_by_name_snapshot = 'Origen histórico / Desconocido'
WHERE created_by_user_id IS NULL
  AND (created_by_name_snapshot IS NULL OR created_by_name_snapshot = '');

CREATE INDEX IF NOT EXISTS idx_patients_assigned_advisor ON patients(organization_id, assigned_advisor_id);
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(organization_id, created_by_user_id);

-- ============================================================================
-- 8. TRIGGERS DE INMUTABILIDAD FINANCIERA Y AUDITORÍA DE PACIENTES
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_protect_patient_creator_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.created_by_user_id IS NOT NULL AND NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
        RAISE EXCEPTION 'created_by_user_id es inmutable tras la creación del paciente.';
    END IF;
    IF OLD.created_by_name_snapshot IS NOT NULL AND OLD.created_by_name_snapshot <> ''
       AND OLD.created_by_name_snapshot <> 'Origen histórico / Desconocido'
       AND NEW.created_by_name_snapshot IS DISTINCT FROM OLD.created_by_name_snapshot THEN
        RAISE EXCEPTION 'created_by_name_snapshot es inmutable tras la creación del paciente.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_patient_creator ON patients;
CREATE TRIGGER trg_protect_patient_creator
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_patient_creator_immutable();

CREATE OR REPLACE FUNCTION fn_protect_confirmed_payroll_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'payroll_settlements' AND OLD.status IN ('APROBADA', 'PAGADA') THEN
        RAISE EXCEPTION 'No se permite eliminar físicamente una liquidación confirmada. Utilice anulación auditada.';
    END IF;
    IF TG_TABLE_NAME = 'staff_payments' AND OLD.status = 'COMPLETADO' THEN
        RAISE EXCEPTION 'No se permite eliminar físicamente un pago confirmado al personal. Utilice anulación auditada.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_settlement_delete ON payroll_settlements;
CREATE TRIGGER trg_protect_settlement_delete
    BEFORE DELETE ON payroll_settlements
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_confirmed_payroll_delete();

DROP TRIGGER IF EXISTS trg_protect_staff_payment_delete ON staff_payments;
CREATE TRIGGER trg_protect_staff_payment_delete
    BEFORE DELETE ON staff_payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_protect_confirmed_payroll_delete();

-- ============================================================================
-- 9. POLÍTICAS ROW LEVEL SECURITY (RLS) COMPATIBLES CON SUPABASE
-- ============================================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payments ENABLE ROW LEVEL SECURITY;

-- Nota: El backend Express usa conexión privilegiada o service_role; estas políticas
-- protegen el acceso directo desde clientes Supabase Auth / PostgREST por tenant (organization_id).
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'employees',
        'employee_salaries',
        'commission_rules',
        'generated_commissions',
        'payroll_settlements',
        'staff_payments'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON %I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_%I ON %I
             USING (
                 EXISTS (
                     SELECT 1 FROM users u
                     WHERE u.id = auth.uid()
                       AND (u.role_id = ''SUPER_ADMIN'' OR u.organization_id = %I.organization_id)
                 )
             );',
            tbl, tbl, tbl
        );
    END LOOP;
END $$;

DROP POLICY IF EXISTS tenant_isolation_payroll_settlement_items ON payroll_settlement_items;
CREATE POLICY tenant_isolation_payroll_settlement_items ON payroll_settlement_items
    USING (
        EXISTS (
            SELECT 1
            FROM payroll_settlements ps
            JOIN users u ON u.id = auth.uid()
            WHERE ps.id = payroll_settlement_items.settlement_id
              AND (u.role_id = 'SUPER_ADMIN' OR u.organization_id = ps.organization_id)
        )
    );
