# MODELO DE BASE DE DATOS (DATABASE.md)
## Sistema Web para Clínica Odontológica en Paraguay
### Modelo Relacional Multi-Tenant y Multi-Sucursal en PostgreSQL

---

## 1. PRINCIPIOS DE DISEÑO DE LA BASE DE DATOS

1. **Aislamiento Multi-Tenant**: Toda tabla operativa incluye la columna `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`.
2. **Contexto de Sucursal**: Las operaciones físicas (turnos, movimientos de dinero, catálogo de precios específico) incluyen `branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT`.
3. **Claves Primarias**: Identificadores universales únicos (`UUIDv4` o `gen_random_uuid()`) para evitar enumeración secuencial predecible (anti-scraping y seguridad contra ataques IDOR).
4. **Moneda en Guaraníes (PYG)**: Almacenamiento en columnas de tipo `BIGINT` (enteros sin decimales) para representar montos en Guaraníes sin pérdida por redondeo.
5. **Marcas Temporales con Zona Horaria**: Todo campo de auditoría utiliza `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` y se formatea para `America/Asuncion`.
6. **Borrado Lógico (Soft Delete)**: Columnas `deleted_at TIMESTAMP WITH TIME ZONE NULL` en entidades clave (pacientes, usuarios, sucursales) para conservar trazabilidad e integridad histórica.

---

## 2. DIAGRAMA ENTIDAD-RELACIÓN CONCEPTUAL

```text
 ┌────────────────┐       1:N       ┌────────────────┐
 │ organizations  ├────────────────►│    branches    │
 └───────┬────────┘                 └───────┬────────┘
         │ 1:N                              │ 1:N
         │                                  │
         ├──────────────────┐               │
         ▼                  ▼               ▼
 ┌────────────────┐   ┌───────────┐   ┌────────────────┐
 │     users      │   │ services  │   │ cash_registers │
 └───┬───────┬────┘   └─────┬─────┘   └───────┬────────┘
     │ 1:N   │ 1:N          │ 1:N             │ 1:N
     │       │              ▼                 ▼
     │       │        ┌───────────┐   ┌────────────────┐
     │       │        │ treatments│   │ cash_movements │
     │       │        └─────┬─────┘   └───────┬────────┘
     │       │              │ 1:N             │ 1:1
     │       │              ▼                 ▼
     │       │        ┌────────────────────────┐
     │       │        │        payments        │
     │       │        └────────────────────────┘
     │       │                      ▲
     │       ▼                      │ 1:N
     │   ┌────────────────┐         │
     │   │  appointments  ├─────────┤
     │   └───────┬────────┘         │
     │           │ N:1              │
     ▼           ▼                  │
 ┌───────────────────┐              │
 │     patients      ├──────────────┘
 └─────────┬─────────┘
           │ 1:N
           ├────────────────────────┐
           ▼                        ▼
 ┌───────────────────┐    ┌───────────────────┐
 │ clinical_records  │    │    odontograms    │
 └───────────────────┘    └─────────┬─────────┘
                                    │ 1:N
                                    ▼
                          ┌───────────────────┐
                          │ odontogram_items  │
                          └───────────────────┘
```

---

## 3. DEFINICIÓN DDL (SQL POSTGRESQL 16+)

```sql
-- Extensión para generación de UUID v4
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ORGANIZACIONES Y SUCURSALES (Multi-Tenant Core)
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- ej. "ODONTOSOL_PY"
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50), -- RUC Paraguay
    country_code VARCHAR(3) DEFAULT 'PRY' NOT NULL,
    default_currency VARCHAR(3) DEFAULT 'PYG' NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/Asuncion' NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    code VARCHAR(30) NOT NULL, -- ej. "SUC-ASU-01"
    name VARCHAR(255) NOT NULL, -- ej. "Sucursal Centro Asunción"
    department VARCHAR(100) NOT NULL, -- ej. "Asunción" o "Central"
    city VARCHAR(100) NOT NULL, -- ej. "San Lorenzo"
    neighborhood VARCHAR(100), -- ej. "Barrio San Miguel"
    address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL, -- ej. "+59521445566"
    whatsapp VARCHAR(30), -- ej. "+595981123456"
    email VARCHAR(255),
    opening_time TIME NOT NULL DEFAULT '07:30:00',
    closing_time TIME NOT NULL DEFAULT '19:30:00',
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_branch_org_code UNIQUE (organization_id, code)
);

CREATE TABLE branch_settings (
    branch_id UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
    appointment_duration_default INT DEFAULT 30 NOT NULL, -- minutos
    slot_interval INT DEFAULT 15 NOT NULL, -- minutos para visualización de agenda
    allow_double_booking BOOLEAN DEFAULT FALSE NOT NULL,
    require_document_on_booking BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 2. USUARIOS, ROLES Y ASIGNACIÓN MULTI-SUCURSAL
-- ============================================================================

CREATE TABLE roles (
    id VARCHAR(50) PRIMARY KEY, -- 'SUPER_ADMIN', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    role_id VARCHAR(50) NOT NULL REFERENCES roles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    professional_license VARCHAR(50), -- Registro profesional de odontólogo en Paraguay (MSPBS)
    specialty VARCHAR(100), -- ej. "Ortodoncia", "Endodoncia", "Implantología"
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_user_org_email UNIQUE (organization_id, email)
);

-- Asignación de usuarios a una o múltiples sucursales
CREATE TABLE user_branches (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, branch_id)
);

-- ============================================================================
-- 3. PACIENTES Y RELACIÓN CON SUCURSALES
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    document_type VARCHAR(20) DEFAULT 'CI' NOT NULL CHECK (document_type IN ('CI', 'RUC', 'PASAPORTE', 'OTRO')),
    document_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    gender VARCHAR(20) CHECK (gender IN ('MASCULINO', 'FEMENINO', 'OTRO', 'NO_ESPECIFICA')),
    phone VARCHAR(30) NOT NULL,
    whatsapp VARCHAR(30),
    email VARCHAR(255),
    department VARCHAR(100), -- Catálogo Paraguay
    city VARCHAR(100),
    neighborhood VARCHAR(100),
    address TEXT,
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(30),
    blood_type VARCHAR(10),
    allergies TEXT,
    medical_conditions TEXT,
    medications TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_patient_org_document UNIQUE (organization_id, document_type, document_number)
);

CREATE TABLE patient_branches (
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    first_visit_date DATE DEFAULT CURRENT_DATE NOT NULL,
    last_visit_date DATE DEFAULT CURRENT_DATE NOT NULL,
    PRIMARY KEY (patient_id, branch_id)
);

-- ============================================================================
-- 4. SERVICIOS Y CATÁLOGOS DE PRECIOS
-- ============================================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    category VARCHAR(100) NOT NULL, -- ej. "Prevención", "Rehabilitación", "Cirugía"
    code VARCHAR(30),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    default_duration_min INT DEFAULT 30 NOT NULL,
    base_price BIGINT NOT NULL CHECK (base_price >= 0), -- Guaraníes (PYG)
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Precios diferenciados por sucursal (opcional por clínica)
CREATE TABLE branch_services (
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    custom_price BIGINT NOT NULL CHECK (custom_price >= 0),
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    PRIMARY KEY (branch_id, service_id)
);

-- ============================================================================
-- 5. AGENDA DE CITAS (APPOINTMENTS)
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_min INT NOT NULL,
    status VARCHAR(25) DEFAULT 'PENDIENTE' NOT NULL CHECK (
        status IN ('PENDIENTE', 'CONFIRMADA', 'EN_SALA', 'EN_ATENCION', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO')
    ),
    reason TEXT,
    cancellation_reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_appointment_times CHECK (end_time > start_time)
);

-- ============================================================================
-- 6. HISTORIA CLÍNICA Y ODONTOGRAMA
-- ============================================================================

CREATE TABLE clinical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    record_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    chief_complaint TEXT NOT NULL, -- Motivo de consulta
    anamnesis TEXT,
    clinical_examination TEXT,
    diagnosis TEXT NOT NULL,
    treatment_plan TEXT,
    prescriptions TEXT,
    recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE odontograms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    record_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    is_initial BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE odontogram_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    odontogram_id UUID NOT NULL REFERENCES odontograms(id) ON DELETE CASCADE,
    tooth_number INT NOT NULL CHECK ((tooth_number BETWEEN 11 AND 48) OR (tooth_number BETWEEN 51 AND 85)), -- Notación FDI
    surface VARCHAR(20) CHECK (surface IN ('O', 'M', 'D', 'V', 'L', 'P', 'TOTAL', 'ROOT')), -- Oclusal, Mesial, etc.
    condition VARCHAR(50) NOT NULL, -- 'SANO', 'CARIES', 'OBTURADO', 'CORONA', 'ENDODONCIA', 'AUSENTE', 'IMPLANTE'
    notes TEXT,
    treatment_id UUID, -- Vinculación con tratamiento si aplica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 7. TRATAMIENTOS Y PRESUPUESTOS
-- ============================================================================

CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    odontologist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    tooth_number INT,
    surface VARCHAR(20),
    diagnosis TEXT,
    price BIGINT NOT NULL CHECK (price >= 0), -- PYG
    status VARCHAR(20) DEFAULT 'PLANIFICADO' NOT NULL CHECK (status IN ('PLANIFICADO', 'EN_CURSO', 'FINALIZADO', 'CANCELADO')),
    planned_date DATE,
    completed_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL, -- ej. "PRE-2026-0001"
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    discount BIGINT DEFAULT 0 NOT NULL CHECK (discount >= 0),
    total BIGINT NOT NULL CHECK (total >= 0),
    status VARCHAR(20) DEFAULT 'EMITIDO' NOT NULL CHECK (status IN ('BORRADOR', 'EMITIDO', 'APROBADO', 'RECHAZADO', 'VENCIDO')),
    expiration_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_quote_org_code UNIQUE (organization_id, code)
);

CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    tooth_number INT,
    quantity INT DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    total_price BIGINT NOT NULL CHECK (total_price >= 0)
);

-- ============================================================================
-- 8. CAJA, MOVIMIENTOS Y PAGOS
-- ============================================================================

CREATE TABLE cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL, -- ej. "Caja Recepción Principal"
    opened_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    initial_amount BIGINT NOT NULL DEFAULT 0 CHECK (initial_amount >= 0), -- PYG
    final_amount_expected BIGINT,
    final_amount_real BIGINT,
    difference BIGINT,
    status VARCHAR(20) DEFAULT 'OPEN' NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    notes TEXT
);

CREATE TABLE cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('INGRESO', 'EGRESO', 'AJUSTE')),
    amount BIGINT NOT NULL CHECK (amount > 0), -- PYG
    concept VARCHAR(255) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_POS', 'QR', 'CHEQUE', 'OTRO')),
    reference_number VARCHAR(100), -- Comprobante Bancario / Nro Boleta POS
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL,
    cash_movement_id UUID REFERENCES cash_movements(id) ON DELETE SET NULL,
    receipt_number VARCHAR(50), -- Factura o Recibo Legal Paraguay
    amount BIGINT NOT NULL CHECK (amount > 0), -- Monto en PYG
    currency VARCHAR(3) DEFAULT 'PYG' NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA_POS', 'QR', 'OTRO')),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    reference VARCHAR(100),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 9. AUDITORÍA INMUTABLE (COMPLIANCE Y SEGURIDAD)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL, -- ej. "PATIENT_CREATED", "RECORD_ACCESSED", "PAYMENT_PROCESSED"
    resource VARCHAR(80) NOT NULL, -- ej. "patients", "clinical_records", "payments"
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB, -- Payload sanitizado previo y posterior (sin datos sensibles)
    result VARCHAR(20) DEFAULT 'SUCCESS' NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE', 'DENIED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- 10. ÍNDICES ESTRATÉGICOS PARA MÁXIMO RENDIMIENTO
-- ============================================================================

-- Índices de aislamiento de inquilino (Multi-Tenant Performance)
CREATE INDEX idx_branches_org ON branches(organization_id);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_patients_org ON patients(organization_id);
CREATE INDEX idx_appointments_org ON appointments(organization_id);
CREATE INDEX idx_clinical_records_org ON clinical_records(organization_id);
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_audit_logs_org_date ON audit_logs(organization_id, created_at DESC);

-- Índices operativos por sucursal y fecha (Agenda y Caja)
CREATE INDEX idx_appointments_branch_date ON appointments(branch_id, appointment_date, start_time);
CREATE INDEX idx_appointments_doctor_date ON appointments(odontologist_id, appointment_date, start_time);
CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX idx_patients_doc ON patients(organization_id, document_type, document_number);
CREATE INDEX idx_patients_phone ON patients(organization_id, phone);
```
