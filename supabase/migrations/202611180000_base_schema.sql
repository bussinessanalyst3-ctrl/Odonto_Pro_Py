-- ============================================================================
-- MIGRACIÓN SQL VERSIONADA PARA SUPABASE / POSTGRESQL 16+
-- Versión: 202611180000_base_schema.sql
-- Descripción:
--   Esquema base relacional completo del sistema Odontológico (Multi-Tenant):
--   organizations, branches, branch_settings, roles, users, user_branches,
--   patients, patient_branches, services, branch_services, insurance_plans,
--   plan_service_prices, insurance_claims, dental_chairs, appointments,
--   clinical_records, odontograms, odontogram_items, quotes, quote_items,
--   treatments, cash_registers, cash_movements, payments, audit_logs,
--   system_state.
--   Completamente idempotente (IF NOT EXISTS).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ORGANIZACIONES Y SUCURSALES (Multi-Tenant Core)
-- ============================================================================
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
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100),
    address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    whatsapp VARCHAR(30),
    email VARCHAR(255),
    opening_time TIME NOT NULL DEFAULT '07:30:00',
    closing_time TIME NOT NULL DEFAULT '19:30:00',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id, status);

CREATE TABLE IF NOT EXISTS branch_settings (
    branch_id UUID PRIMARY KEY REFERENCES branches(id),
    appointment_duration_default INTEGER NOT NULL DEFAULT 30,
    slot_interval INTEGER NOT NULL DEFAULT 15,
    allow_double_booking BOOLEAN NOT NULL DEFAULT FALSE,
    require_document_on_booking BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ROLES Y USUARIOS (RBAC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, name, description) VALUES
    ('SUPER_ADMIN', 'Super Administrador', 'Acceso global multi-organización y administración del sistema'),
    ('ADMIN_ORG', 'Administrador de Organización', 'Administración completa de una organización y sus sucursales'),
    ('ADMIN_SUCURSAL', 'Administrador de Sucursal', 'Gestión operativa y financiera de sucursales asignadas'),
    ('SUPERVISOR', 'Supervisor', 'Supervisión clínica, operativa y financiera'),
    ('ODONTOLOGO', 'Odontólogo', 'Atención clínica, odontograma, evoluciones y presupuestos'),
    ('RECEPCION', 'Recepción', 'Agenda de citas, admisión de pacientes y cobros'),
    ('CAJA', 'Caja', 'Apertura/cierre de caja y gestión de pagos'),
    ('ASESOR_COMERCIAL', 'Asesor Comercial', 'Captación y seguimiento comercial de pacientes')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id),
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

CREATE INDEX IF NOT EXISTS idx_users_org_role ON users(organization_id, role_id, status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS user_branches (
    user_id UUID NOT NULL REFERENCES users(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, branch_id)
);

-- ============================================================================
-- 3. PACIENTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    primary_branch_id UUID REFERENCES branches(id),
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
    modality VARCHAR(30) NOT NULL DEFAULT 'PARTICULAR',
    insurance_plan_id UUID,
    insurance_member_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patients_org_doc ON patients(organization_id, document_number);
CREATE INDEX IF NOT EXISTS idx_patients_branch ON patients(primary_branch_id);

CREATE TABLE IF NOT EXISTS patient_branches (
    patient_id UUID NOT NULL REFERENCES patients(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    first_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (patient_id, branch_id)
);

-- ============================================================================
-- 4. SERVICIOS, TARIFAS POR SUCURSAL Y PLANES / SEGUROS ODONTOLÓGICOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
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

CREATE INDEX IF NOT EXISTS idx_services_org ON services(organization_id, status);

CREATE TABLE IF NOT EXISTS branch_services (
    branch_id UUID NOT NULL REFERENCES branches(id),
    service_id UUID NOT NULL REFERENCES services(id),
    custom_price BIGINT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (branch_id, service_id)
);

CREATE TABLE IF NOT EXISTS insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    coverage_terms TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_plans_org ON insurance_plans(organization_id, status);

CREATE TABLE IF NOT EXISTS plan_service_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES insurance_plans(id),
    service_id UUID NOT NULL REFERENCES services(id),
    price BIGINT NOT NULL,
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_service_prices_plan ON plan_service_prices(plan_id, service_id);

CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    plan_id UUID NOT NULL REFERENCES insurance_plans(id),
    claim_number VARCHAR(50) NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id),
    treatment_id UUID,
    service_id UUID REFERENCES services(id),
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

CREATE INDEX IF NOT EXISTS idx_insurance_claims_org ON insurance_claims(organization_id, status);

-- ============================================================================
-- 5. SILLONES Y AGENDA DE CITAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS dental_chairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    room VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'OPERATIVE',
    color_tag VARCHAR(20) DEFAULT 'teal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dental_chairs_branch ON dental_chairs(branch_id, status);

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    dental_chair_id UUID REFERENCES dental_chairs(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    odontologist_id UUID NOT NULL REFERENCES users(id),
    service_id UUID REFERENCES services(id),
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_min INTEGER NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE',
    reason TEXT,
    cancellation_reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON appointments(branch_id, appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- ============================================================================
-- 6. HISTORIA CLÍNICA Y ODONTOGRAMAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    odontologist_id UUID NOT NULL REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    reason_for_consultation TEXT,
    diagnosis TEXT NOT NULL,
    treatment_performed TEXT NOT NULL,
    prescriptions TEXT,
    recommendations TEXT,
    internal_notes TEXT,
    attachments JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS odontograms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    odontologist_id UUID NOT NULL REFERENCES users(id),
    clinical_record_id UUID REFERENCES clinical_records(id),
    version INTEGER NOT NULL DEFAULT 1,
    odontogram_type VARCHAR(20) NOT NULL DEFAULT 'ADULTO',
    general_observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odontograms_patient ON odontograms(patient_id, version DESC);

CREATE TABLE IF NOT EXISTS odontogram_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odontogram_id UUID NOT NULL REFERENCES odontograms(id),
    tooth_number INTEGER NOT NULL,
    surface VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    condition VARCHAR(50) NOT NULL,
    material VARCHAR(50),
    notes TEXT,
    color_code VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odontogram_items_odontogram ON odontogram_items(odontogram_id);

-- ============================================================================
-- 7. PRESUPUESTOS, TRATAMIENTOS, CAJA Y PAGOS (GUARANÍES - PYG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    plan_id UUID,
    plan_name VARCHAR(200),
    odontologist_id UUID REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_quotes_org_branch ON quotes(organization_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_patient ON quotes(patient_id);

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id),
    service_id UUID REFERENCES services(id),
    tooth_number INTEGER,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price BIGINT NOT NULL,
    subtotal BIGINT NOT NULL,
    applied_modality VARCHAR(30),
    applied_plan_id UUID,
    applied_plan_name VARCHAR(200),
    original_list_price BIGINT
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);

CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    quote_id UUID REFERENCES quotes(id),
    service_id UUID REFERENCES services(id),
    title VARCHAR(200) NOT NULL,
    total_amount BIGINT NOT NULL,
    paid_amount BIGINT NOT NULL DEFAULT 0,
    balance_due BIGINT NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'EN_PROGRESO',
    applied_modality VARCHAR(30) DEFAULT 'PARTICULAR',
    applied_plan_id UUID,
    applied_plan_name VARCHAR(200),
    original_list_price BIGINT,
    start_date DATE,
    completed_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatments_org_patient ON treatments(organization_id, patient_id, status);

CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    opened_by UUID NOT NULL REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    opening_amount BIGINT NOT NULL,
    closing_amount_expected BIGINT,
    closing_amount_real BIGINT,
    difference_amount BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    observations TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_branch_status ON cash_registers(branch_id, status);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
    movement_type VARCHAR(20) NOT NULL,
    amount BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    concept VARCHAR(255) NOT NULL,
    reference_number VARCHAR(100),
    performed_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    treatment_id UUID REFERENCES treatments(id),
    appointment_id UUID REFERENCES appointments(id),
    cash_movement_id UUID REFERENCES cash_movements(id),
    receipt_number VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(50),
    amount BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO',
    notes TEXT,
    received_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_branch ON payments(organization_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);

-- ============================================================================
-- 8. AUDITORÍA Y ESTADO PERSISTENTE DEL SERVIDOR
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    branch_id UUID REFERENCES branches(id),
    user_id UUID REFERENCES users(id),
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_state (
    key VARCHAR(50) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
