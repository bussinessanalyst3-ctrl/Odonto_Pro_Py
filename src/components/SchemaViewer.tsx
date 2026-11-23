import React, { useState } from 'react';
import { Database, Table, Key, ShieldCheck, Code, Copy, Check, Info } from 'lucide-react';

interface TableDefinition {
  name: string;
  category: string;
  description: string;
  columns: {
    name: string;
    type: string;
    isPrimary?: boolean;
    isForeign?: boolean;
    nullable?: boolean;
    defaultVal?: string;
    note?: string;
  }[];
  indexes: string[];
}

const TABLES: TableDefinition[] = [
  {
    name: 'organizations',
    category: 'Multi-Tenant Core',
    description: 'Entidad raíz (Tenant). Cada clínica u organización opera con aislamiento estricto.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true, defaultVal: 'gen_random_uuid()' },
      { name: 'code', type: 'VARCHAR(50)', note: 'Código único ej. ODONTOPRO-PY' },
      { name: 'name', type: 'VARCHAR(255)', note: 'Nombre comercial' },
      { name: 'legal_name', type: 'VARCHAR(255)', nullable: true },
      { name: 'tax_id', type: 'VARCHAR(50)', note: 'RUC Paraguay con DV (ej. 7627641-4)' },
      { name: 'country_code', type: 'VARCHAR(3)', defaultVal: "'PRY'" },
      { name: 'default_currency', type: 'VARCHAR(3)', defaultVal: "'PYG'" },
      { name: 'timezone', type: 'VARCHAR(50)', defaultVal: "'America/Asuncion'" },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultVal: 'NOW()' },
      { name: 'updated_at', type: 'TIMESTAMPTZ', defaultVal: 'NOW()' },
      { name: 'deleted_at', type: 'TIMESTAMPTZ', nullable: true },
    ],
    indexes: ['uq_organizations_code', 'idx_organizations_status'],
  },
  {
    name: 'branches',
    category: 'Multi-Tenant Core',
    description: 'Sucursales físicas (Asunción, San Lorenzo, Luque, etc.).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true, defaultVal: 'gen_random_uuid()' },
      { name: 'organization_id', type: 'UUID', isForeign: true, note: 'FK -> organizations.id' },
      { name: 'code', type: 'VARCHAR(30)', note: 'Código ej. SUC-ASU-01' },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'department', type: 'VARCHAR(100)', note: 'Dpto. de Paraguay (ej. Central)' },
      { name: 'city', type: 'VARCHAR(100)', note: 'Ciudad (ej. San Lorenzo)' },
      { name: 'neighborhood', type: 'VARCHAR(100)', nullable: true },
      { name: 'address', type: 'TEXT' },
      { name: 'phone', type: 'VARCHAR(30)', note: '+595...' },
      { name: 'whatsapp', type: 'VARCHAR(30)', nullable: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: true },
      { name: 'opening_time', type: 'TIME', defaultVal: "'07:30:00'" },
      { name: 'closing_time', type: 'TIME', defaultVal: "'19:30:00'" },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultVal: 'NOW()' },
    ],
    indexes: ['idx_branches_org', 'uq_branch_code_org (organization_id, code)'],
  },
  {
    name: 'users',
    category: 'Autenticación & RBAC',
    description: 'Usuarios del sistema multi-tenant con roles y permisos RBAC.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true, defaultVal: 'gen_random_uuid()' },
      { name: 'organization_id', type: 'UUID', isForeign: true, note: 'FK -> organizations.id' },
      { name: 'role_id', type: 'VARCHAR(50)', isForeign: true, note: 'FK -> roles.id (SUPER_ADMIN, ...)' },
      { name: 'first_name', type: 'VARCHAR(100)' },
      { name: 'last_name', type: 'VARCHAR(100)' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'password_hash', type: 'VARCHAR(255)', note: 'PBKDF2-SHA256 (100k iteraciones)' },
      { name: 'phone', type: 'VARCHAR(30)', nullable: true },
      { name: 'professional_license', type: 'VARCHAR(50)', nullable: true, note: 'Registro Profesional MSPBS Paraguay' },
      { name: 'specialty', type: 'VARCHAR(100)', nullable: true, note: 'Ortodoncia, Endodoncia, etc.' },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
      { name: 'last_login_at', type: 'TIMESTAMPTZ', nullable: true },
    ],
    indexes: ['idx_users_org_role', 'idx_users_email'],
  },
  {
    name: 'patients',
    category: 'Módulo Clínico',
    description: 'Ficha única de paciente por organización con Cédula paraguaya (CI/RUC).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true, defaultVal: 'gen_random_uuid()' },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'primary_branch_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'document_type', type: 'VARCHAR(20)', defaultVal: "'CI'", note: 'CI, RUC, PASAPORTE, OTRO' },
      { name: 'document_number', type: 'VARCHAR(50)', note: 'Cédula o RUC con DV' },
      { name: 'first_name', type: 'VARCHAR(100)' },
      { name: 'last_name', type: 'VARCHAR(100)' },
      { name: 'birth_date', type: 'DATE', nullable: true },
      { name: 'gender', type: 'VARCHAR(20)', nullable: true },
      { name: 'phone', type: 'VARCHAR(30)', note: '+595...' },
      { name: 'whatsapp', type: 'VARCHAR(30)', nullable: true },
      { name: 'department', type: 'VARCHAR(100)', nullable: true },
      { name: 'city', type: 'VARCHAR(100)', nullable: true },
      { name: 'address', type: 'TEXT', nullable: true },
      { name: 'allergies', type: 'TEXT', nullable: true },
      { name: 'medical_conditions', type: 'TEXT', nullable: true },
      { name: 'assigned_advisor_id', type: 'UUID', isForeign: true, nullable: true, note: 'FK -> employees.id (Asesor comercial designado)' },
      { name: 'assigned_at', type: 'TIMESTAMPTZ', nullable: true },
      { name: 'assigned_by_user_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'created_by_user_id', type: 'UUID', isForeign: true, nullable: true, note: 'Inmutable por trigger SQL' },
      { name: 'created_by_name_snapshot', type: 'VARCHAR(200)', defaultVal: "'Origen histórico / Desconocido'", note: 'Inmutable por trigger SQL' },
    ],
    indexes: ['idx_patients_org', 'idx_patients_doc (document_type, document_number)', 'idx_patients_advisor (assigned_advisor_id)', 'idx_patients_creator (created_by_user_id)'],
  },
  {
    name: 'services',
    category: 'Catálogo & Precios',
    description: 'Aranceles y procedimientos odontológicos con precio base en Guaraníes (PYG).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'category', type: 'VARCHAR(100)' },
      { name: 'code', type: 'VARCHAR(30)', nullable: true },
      { name: 'name', type: 'VARCHAR(200)' },
      { name: 'default_duration_min', type: 'INTEGER', defaultVal: '30' },
      { name: 'base_price', type: 'BIGINT', note: 'Guaraníes (PYG) sin centavos' },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
    ],
    indexes: ['idx_services_org', 'idx_services_category'],
  },
  {
    name: 'appointments',
    category: 'Agenda & Turnos',
    description: 'Turnos con validación estricta de solapamiento en servidor.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'branch_id', type: 'UUID', isForeign: true },
      { name: 'patient_id', type: 'UUID', isForeign: true },
      { name: 'odontologist_id', type: 'UUID', isForeign: true },
      { name: 'service_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'appointment_date', type: 'DATE' },
      { name: 'start_time', type: 'TIME' },
      { name: 'end_time', type: 'TIME' },
      { name: 'duration_min', type: 'INTEGER' },
      { name: 'status', type: 'VARCHAR(25)', defaultVal: "'PENDIENTE'" },
      { name: 'reason', type: 'TEXT', nullable: true },
    ],
    indexes: ['idx_appointments_org_branch_date', 'idx_appointments_dentist_date'],
  },
  {
    name: 'odontograms',
    category: 'Módulo Clínico',
    description: 'Odontograma digital según notación FDI (11-48 adulto, 51-85 pediátrico).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'patient_id', type: 'UUID', isForeign: true },
      { name: 'odontologist_id', type: 'UUID', isForeign: true },
      { name: 'clinical_record_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'version', type: 'INTEGER', defaultVal: '1' },
      { name: 'odontogram_type', type: 'VARCHAR(20)', defaultVal: "'ADULTO'" },
      { name: 'general_observations', type: 'TEXT', nullable: true },
    ],
    indexes: ['idx_odontograms_patient'],
  },
  {
    name: 'cash_registers',
    category: 'Finanzas & Caja',
    description: 'Cajas diarias por sucursal para cobro de consultas y arqueo de turnos.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'branch_id', type: 'UUID', isForeign: true },
      { name: 'opened_by', type: 'UUID', isForeign: true },
      { name: 'closed_by', type: 'UUID', isForeign: true, nullable: true },
      { name: 'opening_amount', type: 'BIGINT', note: 'Fondo de cambio en PYG' },
      { name: 'closing_amount_real', type: 'BIGINT', nullable: true },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ABIERTA'" },
      { name: 'opened_at', type: 'TIMESTAMPTZ' },
      { name: 'closed_at', type: 'TIMESTAMPTZ', nullable: true },
    ],
    indexes: ['idx_cash_registers_branch_status'],
  },
  {
    name: 'cash_movements',
    category: 'Finanzas & Caja',
    description: 'Movimientos de caja (SIPAP, QR Bancard, Efectivo, Tarjeta).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'cash_register_id', type: 'UUID', isForeign: true },
      { name: 'movement_type', type: 'VARCHAR(20)', note: 'INGRESO, EGRESO, AJUSTE' },
      { name: 'amount', type: 'BIGINT', note: 'Monto en PYG' },
      { name: 'payment_method', type: 'VARCHAR(30)', note: 'EFECTIVO, SIPAP, QR, etc.' },
      { name: 'concept', type: 'VARCHAR(255)' },
      { name: 'reference_number', type: 'VARCHAR(100)', nullable: true },
      { name: 'performed_by', type: 'UUID', isForeign: true },
    ],
    indexes: ['idx_cash_movements_register'],
  },
  {
    name: 'audit_logs',
    category: 'Auditoría & Seguridad',
    description: 'Bitácora inmutable append-only de accesos y operaciones críticas.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'branch_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'user_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'action', type: 'VARCHAR(50)', note: 'CREATE, UPDATE, DELETE, LOGIN' },
      { name: 'entity', type: 'VARCHAR(50)', note: 'PATIENT, APPOINTMENT, etc.' },
      { name: 'ip_address', type: 'VARCHAR(45)', nullable: true },
      { name: 'description', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMPTZ', defaultVal: 'NOW()' },
    ],
    indexes: ['idx_audit_logs_org_created'],
  },
  {
    name: 'employees',
    category: 'Finanzas de Personal',
    description: 'Registro maestro de personal por área (Operativa, Clínica, Comercial) con vínculo opcional a usuarios.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true, defaultVal: 'gen_random_uuid()' },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'branch_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'user_id', type: 'UUID', isForeign: true, nullable: true, note: 'Opcional; sin duplicar users' },
      { name: 'employee_code', type: 'VARCHAR(40)', note: 'Código único por organización' },
      { name: 'first_name', type: 'VARCHAR(100)' },
      { name: 'last_name', type: 'VARCHAR(100)' },
      { name: 'document_number', type: 'VARCHAR(50)' },
      { name: 'area', type: 'VARCHAR(20)', note: 'OPERATIVA | CLINICA | COMERCIAL' },
      { name: 'position', type: 'VARCHAR(120)' },
      { name: 'remuneration_modality', type: 'VARCHAR(30)', note: 'SALARIO_FIJO | COMISION | MIXTO | HONORARIOS' },
      { name: 'is_advisor', type: 'BOOLEAN', defaultVal: 'false', note: 'Elegible como Asesor Designado de Pacientes' },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
    ],
    indexes: ['idx_employees_org_area', 'uq_employees_org_code', 'uq_employees_org_user'],
  },
  {
    name: 'employee_salaries',
    category: 'Finanzas de Personal',
    description: 'Historial inmutable de salarios por empleado en PYG (sin alterar períodos o pagos pasados).',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'employee_id', type: 'UUID', isForeign: true },
      { name: 'area', type: 'VARCHAR(20)' },
      { name: 'base_salary', type: 'BIGINT', note: 'Guaraníes (PYG)' },
      { name: 'payment_frequency', type: 'VARCHAR(20)', note: 'SEMANAL | QUINCENAL | MENSUAL' },
      { name: 'effective_date', type: 'DATE' },
      { name: 'end_date', type: 'DATE', nullable: true },
      { name: 'status', type: 'VARCHAR(20)', note: 'VIGENTE | HISTORICO | INACTIVO' },
    ],
    indexes: ['uq_employee_active_salary (employee_id WHERE status=VIGENTE)'],
  },
  {
    name: 'commission_rules',
    category: 'Finanzas de Personal',
    description: 'Reglas configurables de comisiones por área (Operativa, Clínica, Comercial) sin valores hardcoded.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'branch_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'area', type: 'VARCHAR(20)', note: 'OPERATIVA | CLINICA | COMERCIAL' },
      { name: 'trigger_type', type: 'VARCHAR(40)', note: 'ON_PAYMENT_COLLECTED | ON_TREATMENT_COMPLETED | ON_PATIENT_ACQUISITION | ON_GOAL_ACHIEVED | MANUAL' },
      { name: 'calculation_mode', type: 'VARCHAR(30)', note: 'PERCENTAGE | FIXED_OPERATION | FIXED_TREATMENT | GOAL_BONUS | MANUAL_ADJUSTMENT' },
      { name: 'rate_percentage', type: 'NUMERIC(6,2)', nullable: true },
      { name: 'fixed_amount', type: 'BIGINT', nullable: true },
      { name: 'service_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'ACTIVE'" },
    ],
    indexes: ['idx_commission_rules_org_area_status'],
  },
  {
    name: 'generated_commissions',
    category: 'Finanzas de Personal',
    description: 'Comisiones devengadas con trazabilidad a paciente, presupuesto, tratamiento y cobro, con deduplicación estricta.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'employee_id', type: 'UUID', isForeign: true },
      { name: 'rule_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'dedup_key', type: 'VARCHAR(255)', note: 'UNIQUE por organización (anti-doble comisión)' },
      { name: 'patient_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'quote_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'treatment_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'payment_id', type: 'UUID', isForeign: true, nullable: true },
      { name: 'advisor_snapshot_name', type: 'VARCHAR(200)', nullable: true },
      { name: 'commission_amount', type: 'BIGINT', note: 'PYG devengado' },
      { name: 'status', type: 'VARCHAR(25)', note: 'PENDIENTE | EN_LIQUIDACION | APROBADA | PAGADA | ANULADA' },
    ],
    indexes: ['uq_generated_commissions_dedup (organization_id, dedup_key)', 'idx_gen_comm_emp_period'],
  },
  {
    name: 'payroll_settlements',
    category: 'Finanzas de Personal',
    description: 'Liquidaciones de haberes por período con flujo BORRADOR -> PENDIENTE_APROBACION -> APROBADA -> PAGADA.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'employee_id', type: 'UUID', isForeign: true },
      { name: 'settlement_number', type: 'VARCHAR(50)' },
      { name: 'period_year', type: 'INTEGER' },
      { name: 'period_month', type: 'INTEGER' },
      { name: 'base_salary_snapshot', type: 'BIGINT' },
      { name: 'commissions_total', type: 'BIGINT' },
      { name: 'bonuses_total', type: 'BIGINT' },
      { name: 'advances_total', type: 'BIGINT' },
      { name: 'deductions_total', type: 'BIGINT' },
      { name: 'net_payable', type: 'BIGINT' },
      { name: 'paid_amount', type: 'BIGINT' },
      { name: 'balance_due', type: 'BIGINT' },
      { name: 'status', type: 'VARCHAR(25)', note: 'BORRADOR | PENDIENTE_APROBACION | APROBADA | PAGADA | ANULADA' },
    ],
    indexes: ['uq_payroll_settlement_number', 'idx_payroll_settlements_emp_period'],
  },
  {
    name: 'payroll_settlement_items',
    category: 'Finanzas de Personal',
    description: 'Detalle de conceptos consolidados dentro de cada liquidación de personal.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'settlement_id', type: 'UUID', isForeign: true },
      { name: 'item_type', type: 'VARCHAR(30)', note: 'SALARIO_BASE | COMISION | BONO | ANTICIPO | DESCUENTO | AJUSTE' },
      { name: 'concept', type: 'VARCHAR(255)' },
      { name: 'sign', type: 'VARCHAR(10)', note: 'CREDIT | DEBIT' },
      { name: 'amount', type: 'BIGINT' },
    ],
    indexes: ['idx_payroll_items_settlement'],
  },
  {
    name: 'staff_payments',
    category: 'Finanzas de Personal',
    description: 'Pagos parciales o totales efectuados sobre liquidaciones aprobadas con respaldo documental y anulación lógica.',
    columns: [
      { name: 'id', type: 'UUID', isPrimary: true },
      { name: 'organization_id', type: 'UUID', isForeign: true },
      { name: 'settlement_id', type: 'UUID', isForeign: true },
      { name: 'employee_id', type: 'UUID', isForeign: true },
      { name: 'operation_number', type: 'VARCHAR(60)' },
      { name: 'payment_date', type: 'DATE' },
      { name: 'amount', type: 'BIGINT' },
      { name: 'payment_method', type: 'VARCHAR(30)' },
      { name: 'overpayment_override', type: 'BOOLEAN', defaultVal: 'false' },
      { name: 'status', type: 'VARCHAR(20)', defaultVal: "'COMPLETADO'" },
    ],
    indexes: ['uq_staff_payments_op_num', 'idx_staff_payments_settlement'],
  }
];

export const SchemaViewer: React.FC = () => {
  const [selectedTableName, setSelectedTableName] = useState<string>('patients');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'sql'>('visual');

  const selectedTable = TABLES.find((t) => t.name === selectedTableName) || TABLES[0];

  const handleCopySql = () => {
    navigator.clipboard.writeText(`-- Migración PostgreSQL OdontoPro Paraguay\n-- Ver archivo /src/db/migrations/0000_init_schema.sql`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Overview banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-teal-100 text-teal-800 rounded-lg">
                <Database className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Esquemas Drizzle ORM & PostgreSQL 16+
              </h2>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Definición formal de tablas, tipos de datos, claves foráneas, índices de alta concurrencia
              y compatibilidad nativa con Connection Pooling (Neon / Supabase).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === 'visual'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Explorador Visual
            </button>
            <button
              onClick={() => setViewMode('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'sql'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>DDL SQL (0000_init_schema.sql)</span>
            </button>
          </div>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500"></span>
            <span className="text-slate-600 font-medium">28 Tablas Normalizadas</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Guaraníes en BIGINT (PYG)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            <span className="text-slate-600 font-medium">Multi-Tenant (org_id, branch_id)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span className="text-slate-600 font-medium">Connection Pooling Ready</span>
          </div>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Table list selector */}
          <div className="lg:col-span-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
              Tablas del Sistema ({TABLES.length})
            </h3>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs max-h-[580px] overflow-y-auto">
              {TABLES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTableName(t.name)}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${
                    selectedTableName === t.name
                      ? 'bg-teal-50 border-l-4 border-teal-600 text-teal-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-sm font-mono flex items-center gap-2">
                      <Table className="h-3.5 w-3.5 text-slate-400" />
                      {t.name}
                    </div>
                    <div className="text-xs text-slate-400 font-sans mt-0.5">{t.category}</div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {t.columns.length} cols
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Table details */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold font-mono text-slate-900">
                      {selectedTable.name}
                    </h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">
                      {selectedTable.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{selectedTable.description}</p>
                </div>
              </div>

              {/* Columns Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Columna</th>
                      <th className="py-2.5 px-3">Tipo de Dato</th>
                      <th className="py-2.5 px-3">Atributos</th>
                      <th className="py-2.5 px-3">Descripción / Nota Paraguay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedTable.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800 flex items-center gap-1.5">
                          {col.isPrimary && (
                            <span title="Primary Key" className="text-amber-500">
                              <Key className="h-3 w-3" />
                            </span>
                          )}
                          {col.isForeign && (
                            <span title="Foreign Key" className="text-teal-500">
                              <ShieldCheck className="h-3 w-3" />
                            </span>
                          )}
                          {col.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-700 font-medium">
                          {col.type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {col.isPrimary && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold mr-1">
                              PK
                            </span>
                          )}
                          {col.isForeign && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold mr-1">
                              FK
                            </span>
                          )}
                          {col.nullable ? (
                            <span className="text-slate-400">NULL</span>
                          ) : (
                            <span className="text-slate-700 font-medium">NOT NULL</span>
                          )}
                          {col.defaultVal && (
                            <span className="ml-1 text-[11px] text-slate-500 font-mono">
                              def: {col.defaultVal}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {col.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Indexes */}
              {selectedTable.indexes.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Índices & Restricciones:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTable.indexes.map((idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono"
                      >
                        {idx}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SQL DDL View */
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-slate-200 font-mono text-xs shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500"></span>
              <span className="h-3 w-3 rounded-full bg-amber-500"></span>
              <span className="h-3 w-3 rounded-full bg-green-500"></span>
              <span className="text-slate-400 text-xs ml-2">
                /src/db/migrations/0000_init_schema.sql (PostgreSQL 16+)
              </span>
            </div>
            <button
              onClick={handleCopySql}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar Ruta'}</span>
            </button>
          </div>

          <pre className="mt-4 overflow-x-auto max-h-[500px] text-slate-300 leading-relaxed">
{`-- ============================================================================
-- ODONTOPRO PARAGUAY - MIGRACIÓN INICIAL POSTGRESQL 16+
-- Archivo: 0000_init_schema.sql
-- Motor: PostgreSQL / Neon Serverless / Supabase
-- Convención: UUID v4, Multi-Tenant estricto (organization_id, branch_id)
-- Moneda: Guaraníes (PYG) sin centavos en BIGINT
-- Zona Horaria: America/Asuncion
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ORGANIZACIONES Y SUCURSALES
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(50), -- RUC Paraguay con dígito verificador
    country_code VARCHAR(3) NOT NULL DEFAULT 'PRY',
    default_currency VARCHAR(3) NOT NULL DEFAULT 'PYG',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Asuncion',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL, -- Departamento de Paraguay
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    opening_time TIME NOT NULL DEFAULT '07:30:00',
    closing_time TIME NOT NULL DEFAULT '19:30:00',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT uq_branch_code_org UNIQUE (organization_id, code)
);

-- 2. PACIENTES CON CAMPOS PARAGUAY
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'CI',
    document_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE,
    phone VARCHAR(30) NOT NULL,
    department VARCHAR(100),
    city VARCHAR(100),
    allergies TEXT,
    CONSTRAINT uq_patient_doc_org UNIQUE (organization_id, document_type, document_number)
);

-- 3. ARANCELES Y SERVICIOS EN GUARANÍES (PYG)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    category VARCHAR(100) NOT NULL,
    code VARCHAR(30),
    name VARCHAR(200) NOT NULL,
    default_duration_min INTEGER NOT NULL DEFAULT 30,
    base_price BIGINT NOT NULL, -- ₲ sin centavos
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

-- Ver archivo completo en: /src/db/migrations/0000_init_schema.sql`}
          </pre>
        </div>
      )}
    </div>
  );
};
