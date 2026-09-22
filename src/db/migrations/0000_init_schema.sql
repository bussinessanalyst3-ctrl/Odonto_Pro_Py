-- ============================================================================
-- ODONTOPRO PARAGUAY - MIGRACIÓN INICIAL POSTGRESQL 16+
-- Archivo: 0000_init_schema.sql
-- Motor: PostgreSQL / Neon / Supabase / Cloud SQL
-- Convención: UUID v4, Multi-Tenant estricto (organization_id, branch_id)
-- Moneda base: Guaraníes (PYG) sin decimales en BIGINT
-- Zona Horaria: America/Asuncion
-- ============================================================================

-- Habilitar extensión para generación de UUIDs nativos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ESTRUCTURA ORGANIZACIONAL (Multi-Tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50), -- RUC Paraguay con dígito verificador
    country_code VARCHAR(3) NOT NULL DEFAULT 'PRY',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Asuncion',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL, -- Departamento de Paraguay
    city VARCHAR(100) NOT NULL,
    neighborhood VARCHAR(100),
    address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    whatsapp VARCHAR(30),
    email VARCHAR(255),
    opening_time TIME NOT NULL DEFAULT '07:30:00',
    closing_time TIME NOT NULL DEFAULT '19:30:00',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_branch_code_org UNIQUE (organization_id, code)
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

-- ============================================================================
-- 2. CONTROL DE ACCESOS Y USUARIOS (RBAC)
-- ============================================================================

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
    lastName VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    professional_license VARCHAR(50), -- Reg. Profesional MSPBS
    specialty VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_user_email_org UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS user_branches (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, branch_id)
);

-- ============================================================================
-- 3. PACIENTES Y FICHAS CLÍNICAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'CI' CHECK (document_type IN ('CI', 'RUC', 'PASAPORTE', 'OTRO')),
    document_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(20) CHECK (gender IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA')),
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
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_patient_doc_org UNIQUE (organization_id, document_type, document_number)
);

CREATE TABLE IF NOT EXISTS patient_branches (
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    first_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    last_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (patient_id, branch_id)
);

-- ============================================================================
-- 4. CATÁLOGO DE SERVICIOS ODONTOLÓGICOS Y ARANCELES
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    category VARCHAR(100) NOT NULL,
    code VARCHAR(30),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    default_duration_min INTEGER NOT NULL DEFAULT 30,
    base_price BIGINT NOT NULL, -- Guaraníes (PYG) sin centavos
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
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

-- ============================================================================
-- 5. AGENDAMIENTO Y TURNOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_min INTEGER NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (status IN ('PENDIENTE', 'CONFIRMADA', 'EN_SALA', 'EN_ATENCION', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO')),
    reason TEXT,
    cancellation_reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. FICHA CLÍNICA Y ODONTOGRAMA (FDI 2 Dígitos)
-- ============================================================================

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
    odontogram_type VARCHAR(20) NOT NULL DEFAULT 'ADULTO' CHECK (odontogram_type IN ('ADULTO', 'PEDIATRICO')),
    general_observations TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS odontogram_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odontogram_id UUID NOT NULL REFERENCES odontograms(id) ON DELETE CASCADE,
    tooth_number INTEGER NOT NULL, -- Código FDI
    surface VARCHAR(20) NOT NULL DEFAULT 'GENERAL' 
        CHECK (surface IN ('OCLUSAL', 'MESIAL', 'DISTAL', 'VESTIBULAR', 'LINGUAL', 'PALATINA', 'GENERAL')),
    condition VARCHAR(50) NOT NULL,
    material VARCHAR(50),
    notes TEXT,
    color_code VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. PRESUPUESTOS, TRATAMIENTOS Y FACTURACIÓN EN GUARANÍES
-- ============================================================================

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
    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'VENCIDO')),
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quote_number_org UNIQUE (organization_id, quote_number)
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
    status VARCHAR(25) NOT NULL DEFAULT 'EN_PROGRESO' 
        CHECK (status IN ('PLANIFICADO', 'EN_PROGRESO', 'COMPLETADO', 'SUSPENDIDO')),
    start_date DATE,
    completed_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    opening_amount BIGINT NOT NULL,
    closing_amount_expected BIGINT,
    closing_amount_real BIGINT,
    difference_amount BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA', 'ARQUEADA')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    observations TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('INGRESO', 'EGRESO', 'AJUSTE')),
    amount BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL 
        CHECK (payment_method IN ('EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA_SIPAP', 'QR', 'BILLETERA_DIGITAL')),
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
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETADO' CHECK (status IN ('COMPLETADO', 'ANULADO', 'PENDIENTE')),
    notes TEXT,
    received_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. AUDITORÍA GENERAL
-- ============================================================================

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

-- ============================================================================
-- ÍNDICES DE RENDIMIENTO (Claves para Multi-Tenant y Agendamiento)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_branches_org ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_doc ON patients(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_appointments_org_branch_date ON appointments(organization_id, branch_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_date ON appointments(odontologist_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_odontograms_patient ON odontograms(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_branch ON payments(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
