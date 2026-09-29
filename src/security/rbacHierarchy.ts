// ============================================================================
// SISTEMA DE CONTROL DE ACCESO BASADO EN ROLES (RBAC) & JERARQUÍA DE AUTORIDAD
// Arquitectura de Seguridad y Mínimo Privilegio para OdontoPro Multiempresa
// ============================================================================

export type SystemRoleType =
  | 'SUPER_ADMIN'
  | 'ADMIN_ORGANIZACION'
  | 'ADMIN_SUCURSAL'
  | 'SUPERVISOR'
  | 'ODONTOLOGO'
  | 'RECEPCION'
  | 'CAJA'
  | 'ASISTENTE'
  | 'VENDEDOR';

export interface RoleHierarchyDefinition {
  level: number;
  displayName: string;
  category: 'GLOBAL' | 'ORGANIZATION' | 'BRANCH' | 'OPERATIONAL';
  permissions: string[];
}

/**
 * Tabla de jerarquía estricta:
 * Nivel 100: SUPER_ADMIN (Administra todo el sistema y organizaciones)
 * Nivel 80:  ADMIN_ORGANIZACION (Administra su organización y sus sucursales)
 * Nivel 50:  ADMIN_SUCURSAL (Administra EXCLUSIVAMENTE su/s sucursal/es asignadas)
 * Nivel 40:  SUPERVISOR (Auditoría y control de calidad médica)
 * Nivel 30:  ODONTOLOGO (Atención clínica y diagnósticos médicos)
 * Nivel 25:  CAJA (Operaciones de caja chica y cobros en sucursal)
 * Nivel 20:  RECEPCION (Agendas, recepción y citas)
 * Nivel 15:  VENDEDOR (Cotizaciones comerciales)
 * Nivel 10:  ASISTENTE (Apoyo odontológico)
 */
export const ROLE_HIERARCHY: Record<string, RoleHierarchyDefinition> = {
  SUPER_ADMIN: {
    level: 100,
    displayName: 'Super Administrador del Sistema',
    category: 'GLOBAL',
    permissions: [
      'system.all',
      'organization.create',
      'organization.manage',
      'organization.branding',
      'branches.view',
      'branches.create',
      'branches.update',
      'branches.delete',
      'users.view',
      'users.create',
      'users.update',
      'users.deactivate',
      'users.reset_password',
      'super_admin.manage',
      'roles.manage',
      'settings.view',
      'settings.update',
      'audit.view',
      'security.manage',
      'database.seed',
      'data.export_sensitive',
    ],
  },
  ADMIN_ORGANIZACION: {
    level: 80,
    displayName: 'Administrador de Organización',
    category: 'ORGANIZATION',
    permissions: [
      'dashboard.view',
      'reports.financial',
      'reports.commissions',
      'reports.reception',
      'branches.view',
      'branches.create',
      'branches.update',
      'branches.delete',
      'users.view',
      'users.create',
      'users.update',
      'users.deactivate',
      'users.reset_password',
      'users.revoke_sessions',
      'roles.manage',
      'settings.view',
      'settings.update',
      'audit.view',
      'quotes.view',
      'quotes.create',
      'quotes.approve',
      'quotes.manage',
      'cash.view',
      'cash.reports',
      'cash.open_close',
      'cash.movement',
      'payments.create',
      'payments.annul',
      'invoices.issue',
      'appointments.view',
      'appointments.view_own',
      'appointments.manage',
      'appointments.checkin',
      'appointments.block',
      'patients.view',
      'patients.view_basic',
      'patients.manage',
      'patients.export',
      'treatments.view',
      'treatments.manage',
      'treatments.discounts',
      'clinical.view',
      'clinical.manage',
      'odontogram.manage',
      'prescriptions.create',
      'anamnesis.view',
      'anamnesis.manage',
    ],
  },
  ADMIN_SUCURSAL: {
    level: 50,
    displayName: 'Administrador de Sucursal',
    category: 'BRANCH',
    permissions: [
      'branches.view',
      'branches.update_own', // Solo actualizar parámetros de su propia sucursal, NUNCA crear ni eliminar
      'users.view',
      'users.create_operational',
      'users.update_operational',
      'users.deactivate_operational',
      'settings.view',
      'settings.update_own_branch',
      'quotes.manage',
      'cash.manage_own_branch',
      'appointments.manage_own_branch',
      'patients.manage',
      'audit.view_own_branch',
    ],
  },
  SUPERVISOR: {
    level: 40,
    displayName: 'Supervisor Clínico / Auditor',
    category: 'BRANCH',
    permissions: [
      'branches.view',
      'users.view',
      'clinical.view',
      'quotes.view',
      'cash.view',
      'appointments.view',
      'patients.view',
      'audit.view',
    ],
  },
  ODONTOLOGO: {
    level: 30,
    displayName: 'Odontólogo / Especialista',
    category: 'OPERATIONAL',
    permissions: [
      'clinical.view',
      'clinical.manage',
      'odontogram.manage',
      'treatments.manage',
      'prescriptions.create',
      'appointments.view_own',
      'patients.view',
      'quotes.create',
    ],
  },
  CAJA: {
    level: 25,
    displayName: 'Cajero / Facturación',
    category: 'OPERATIONAL',
    permissions: [
      'cash.open_close',
      'cash.movement',
      'payments.create',
      'payments.annul',
      'quotes.view',
      'patients.view_basic',
    ],
  },
  RECEPCION: {
    level: 20,
    displayName: 'Recepcionista',
    category: 'OPERATIONAL',
    permissions: [
      'appointments.manage_own_branch',
      'patients.manage',
      'quotes.view',
      'cash.view_basic',
    ],
  },
  VENDEDOR: {
    level: 15,
    displayName: 'Asesor Comercial',
    category: 'OPERATIONAL',
    permissions: [
      'quotes.create',
      'quotes.view',
      'patients.view_basic',
    ],
  },
  ASISTENTE: {
    level: 10,
    displayName: 'Asistente Odontológico',
    category: 'OPERATIONAL',
    permissions: [
      'appointments.view_own_branch',
      'patients.view_basic',
      'treatments.view',
    ],
  },
};

export interface SystemPermissionItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  defaultRoles: string[];
}

export interface PermissionModuleGroup {
  id: string;
  name: string;
  category: string;
  description: string;
  permissions: SystemPermissionItem[];
}

export const SYSTEM_PERMISSION_MODULES: PermissionModuleGroup[] = [
  {
    id: 'clinical',
    name: 'Historia Clínica & Odontograma (FDI / MSPBS)',
    category: 'Clínica',
    description: 'Diagnósticos, piezas dentales, evoluciones y normativas de confidencialidad médica.',
    permissions: [
      {
        id: 'clinical.view',
        code: 'clinical.view',
        name: 'Ver historial clínico y evolución',
        description: 'Consulta de fichas clínicas, evoluciones anteriores y planes médicos.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'SUPERVISOR', 'ODONTOLOGO'],
      },
      {
        id: 'clinical.manage',
        code: 'clinical.manage',
        name: 'Registrar diagnósticos y evoluciones',
        description: 'Cargar notas clínicas, procedimientos realizados y diagnósticos CIE-10.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ODONTOLOGO'],
      },
      {
        id: 'odontogram.manage',
        code: 'odontogram.manage',
        name: 'Editar odontograma FDI digital',
        description: 'Marcar caras dentales, caries, prótesis, extracciones y endodoncias.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ODONTOLOGO'],
      },
      {
        id: 'prescriptions.create',
        code: 'prescriptions.create',
        name: 'Emitir recetas con registro MSPBS',
        description: 'Prescripción de medicamentos con firma y registro profesional habilitado.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ODONTOLOGO'],
      },
      {
        id: 'anamnesis.view',
        code: 'anamnesis.view',
        name: 'Ver alertas médicas de anamnesis',
        description: 'Visualizar alergias, patologías cardíacas, diabetes y precauciones.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
      },
      {
        id: 'anamnesis.manage',
        code: 'anamnesis.manage',
        name: 'Actualizar anamnesis y antecedentes',
        description: 'Editar historial de salud, alergias declaradas y consentimiento firmado.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
      },
    ],
  },
  {
    id: 'appointments',
    name: 'Agenda de Turnos & Citas Médicas',
    category: 'Operación',
    description: 'Control de agenda de sillones, confirmaciones y gestión de sala de espera.',
    permissions: [
      {
        id: 'appointments.view',
        code: 'appointments.view',
        name: 'Ver calendario y agenda general',
        description: 'Visualizar citas por profesional, sillón dental y horarios de atención.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'ODONTOLOGO', 'RECEPCION', 'VENDEDOR'],
      },
      {
        id: 'appointments.view_own',
        code: 'appointments.view_own',
        name: 'Ver únicamente turnos propios asignados',
        description: 'Visualización restringida solo a los pacientes citados con el profesional en sesión.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ODONTOLOGO', 'ASISTENTE'],
      },
      {
        id: 'appointments.manage',
        code: 'appointments.manage',
        name: 'Crear, reprogramar o cancelar turnos',
        description: 'Agendamiento de nuevas consultas, cambios de fecha y cancelaciones.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'RECEPCION', 'VENDEDOR'],
      },
      {
        id: 'appointments.checkin',
        code: 'appointments.checkin',
        name: 'Confirmar llegada y sala de espera',
        description: 'Registrar la presencia física del paciente en recepción y derivación a box.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION'],
      },
      {
        id: 'appointments.block',
        code: 'appointments.block',
        name: 'Bloquear horarios de profesionales',
        description: 'Bloqueo de agenda por permisos, capacitaciones o descansos médicos.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
      },
    ],
  },
  {
    id: 'patients',
    name: 'Fichas de Pacientes & Filiación',
    category: 'Operación',
    description: 'Gestión de expedientes personales, documentos C.I./RUC y contactos.',
    permissions: [
      {
        id: 'patients.view',
        code: 'patients.view',
        name: 'Consultar datos de pacientes',
        description: 'Acceso a datos personales, número de cédula, celular y ciudad.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'ODONTOLOGO', 'RECEPCION', 'CAJA', 'VENDEDOR'],
      },
      {
        id: 'patients.view_basic',
        code: 'patients.view_basic',
        name: 'Ver solo filiación básica (Recepción/Caja)',
        description: 'Consulta acotada a nombre, teléfono y cédula sin acceso a expedientes clínicos.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'CAJA', 'VENDEDOR', 'ASISTENTE'],
      },
      {
        id: 'patients.manage',
        code: 'patients.manage',
        name: 'Alta y edición de pacientes',
        description: 'Creación de nuevas fichas y actualización de datos de contacto.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION', 'ODONTOLOGO'],
      },
      {
        id: 'patients.export',
        code: 'patients.export',
        name: 'Exportar nómina de pacientes',
        description: 'Descarga de listados de pacientes para reportes estadísticos o clínicos.',
        category: 'Operación',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
    ],
  },
  {
    id: 'treatments',
    name: 'Catálogo de Tratamientos & Aranceles',
    category: 'Clínica',
    description: 'Tarifario de procedimientos odontológicos y precios base en Guaraníes (PYG).',
    permissions: [
      {
        id: 'treatments.view',
        code: 'treatments.view',
        name: 'Ver catálogo de aranceles',
        description: 'Consultar precios oficiales y códigos de prestaciones odontológicas.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'ODONTOLOGO', 'VENDEDOR', 'RECEPCION', 'CAJA'],
      },
      {
        id: 'treatments.manage',
        code: 'treatments.manage',
        name: 'Crear y actualizar aranceles dentales',
        description: 'Modificar tarifas, crear nuevas prestaciones y ajustar costos.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
      {
        id: 'treatments.discounts',
        code: 'treatments.discounts',
        name: 'Autorizar descuentos especiales',
        description: 'Aplicación de bonificaciones o tarifas diferenciadas a pacientes.',
        category: 'Clínica',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
    ],
  },
  {
    id: 'quotes',
    name: 'Presupuestos & Planes de Tratamiento',
    category: 'Administración',
    description: 'Cotizaciones, formas de pago, planes de cuotas y autorizaciones.',
    permissions: [
      {
        id: 'quotes.view',
        code: 'quotes.view',
        name: 'Visualizar presupuestos y planes',
        description: 'Consulta de cotizaciones emitidas, estado de aprobación y totales.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'ODONTOLOGO', 'VENDEDOR', 'RECEPCION', 'CAJA'],
      },
      {
        id: 'quotes.create',
        code: 'quotes.create',
        name: 'Cotizar y emitir presupuestos',
        description: 'Generación de presupuestos formales para entrega impresa o digital.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'VENDEDOR', 'RECEPCION'],
      },
      {
        id: 'quotes.approve',
        code: 'quotes.approve',
        name: 'Aprobar presupuestos y planes de cuotas',
        description: 'Aprobación definitiva de inicio de tratamiento y financiamiento.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
      {
        id: 'quotes.manage',
        code: 'quotes.manage',
        name: 'Modificar o anular presupuestos emitidos',
        description: 'Corrección de items presupuestados o anulación de propuestas vencidas.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
    ],
  },
  {
    id: 'cash',
    name: 'Caja, Cobros & Facturación (PYG)',
    category: 'Administración',
    description: 'Control de flujo de caja chica, cobros multicanal y emisión fiscal.',
    permissions: [
      {
        id: 'cash.view',
        code: 'cash.view',
        name: 'Visualizar movimientos de caja y cobros',
        description: 'Consulta de ingresos, cobros del día y estado de cajas activas.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'CAJA', 'RECEPCION'],
      },
      {
        id: 'cash.open_close',
        code: 'cash.open_close',
        name: 'Apertura y cierre de caja chica',
        description: 'Inicio de turno con saldo inicial y arqueo de caja con diferencias.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'CAJA'],
      },
      {
        id: 'cash.movement',
        code: 'cash.movement',
        name: 'Registrar movimientos de caja chica',
        description: 'Ingresos y egresos operativos con comprobante de respaldo.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'CAJA'],
      },
      {
        id: 'payments.create',
        code: 'payments.create',
        name: 'Registrar cobros (Efectivo, SIPAP, QR, Tarjetas)',
        description: 'Recepción de pagos y generación de comprobantes de ingreso.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'CAJA'],
      },
      {
        id: 'payments.annul',
        code: 'payments.annul',
        name: 'Anulación de recibos y devoluciones',
        description: 'Reversión autorizada de cobros erróneos con registro de motivo.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
      {
        id: 'invoices.issue',
        code: 'invoices.issue',
        name: 'Emisión de facturas legales y recibos oficiales',
        description: 'Generación de facturas con timbrado legal de la SET / DNIT.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'CAJA'],
      },
      {
        id: 'cash.reports',
        code: 'cash.reports',
        name: 'Ver balances y arqueos consolidados',
        description: 'Informes financieros diarios, semanales y mensuales de recaudación.',
        category: 'Administración',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
    ],
  },
  {
    id: 'reports',
    name: 'Dashboard, Métricas & Reportes Gerenciales',
    category: 'Gerencia',
    description: 'Métricas de productividad, ingresos consolidados y liquidación a odontólogos.',
    permissions: [
      {
        id: 'dashboard.view',
        code: 'dashboard.view',
        name: 'Acceso a Dashboard de Métricas y KPIs',
        description: 'Visualizar resumen general, pacientes atendidos, ingresos y turnos.',
        category: 'Gerencia',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
      },
      {
        id: 'reports.financial',
        code: 'reports.financial',
        name: 'Reportes Financieros y Rentabilidad',
        description: 'Flujo de caja consolidado, cobranzas, tickets promedio y comparativas.',
        category: 'Gerencia',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
      {
        id: 'reports.commissions',
        code: 'reports.commissions',
        name: 'Liquidación de Comisiones Médicas',
        description: 'Cálculo de honorarios y porcentajes por odontólogo y procedimiento realizado.',
        category: 'Gerencia',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
      {
        id: 'reports.reception',
        code: 'reports.reception',
        name: 'Métricas de Ocupación de Sillones & Espera',
        description: 'Tiempos de espera en recepción, puntualidad y ocupación por box.',
        category: 'Gerencia',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'RECEPCION'],
      },
    ],
  },
  {
    id: 'branches',
    name: 'Sucursales & Sillones Dentales',
    category: 'Sistema',
    description: 'Infraestructura física, habilitación de sedes y consultorios.',
    permissions: [
      {
        id: 'branches.view',
        code: 'branches.view',
        name: 'Visualizar sucursales y sillones',
        description: 'Consulta de sedes físicas, sillones disponibles y horarios.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
      {
        id: 'branches.create',
        code: 'branches.create',
        name: 'Crear nuevas sucursales',
        description: 'Apertura de nuevas sedes clínicas (Super Admin u Organización).',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
      {
        id: 'branches.update',
        code: 'branches.update',
        name: 'Modificar parámetros de sucursal',
        description: 'Ajuste de horarios, teléfono, dirección y políticas de atención.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
      {
        id: 'branches.delete',
        code: 'branches.delete',
        name: 'Eliminar o dar de baja sucursales',
        description: 'Cierre definitivo de una sede física.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
    ],
  },
  {
    id: 'users',
    name: 'Equipo Médico, Roles & Accesos',
    category: 'Sistema',
    description: 'Directorio de funcionarios, credenciales y jerarquía de seguridad.',
    permissions: [
      {
        id: 'users.view',
        code: 'users.view',
        name: 'Ver directorio de colaboradores',
        description: 'Visualizar lista de personal, odontólogos y estado de acceso.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
      {
        id: 'users.create',
        code: 'users.create',
        name: 'Dar de alta nuevos colaboradores',
        description: 'Creación de cuentas institucionales con contraseñas criptográficas.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
      {
        id: 'users.update',
        code: 'users.update',
        name: 'Modificar datos y asignación de sedes',
        description: 'Cambio de teléfono, especialidad y sucursales autorizadas.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
      },
      {
        id: 'users.deactivate',
        code: 'users.deactivate',
        name: 'Activar o inactivar colaboradores',
        description: 'Bloqueo temporal o reactivación de acceso al sistema clínico.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
      {
        id: 'users.reset_password',
        code: 'users.reset_password',
        name: 'Restablecer contraseñas de personal',
        description: 'Regeneración segura de clave PBKDF2 para colaboradores.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
      {
        id: 'users.revoke_sessions',
        code: 'users.revoke_sessions',
        name: 'Revocar sesiones activas de seguridad',
        description: 'Cierre forzoso e inmediato de sesiones de un usuario.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
      {
        id: 'roles.manage',
        code: 'roles.manage',
        name: 'Autoridad para configurar Roles Subordinados',
        description: 'Creación de roles y ajuste de matriz de permisos exclusivamente para rangos inferiores a la jerarquía del usuario.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION'],
      },
    ],
  },
  {
    id: 'organization',
    name: 'Multiempresa, Branding & Auditoría',
    category: 'Sistema',
    description: 'Gestión corporativa global, unidades de negocio y logs inmutables.',
    permissions: [
      {
        id: 'organization.manage',
        code: 'organization.manage',
        name: 'Gestionar y conmutar múltiples empresas',
        description: 'Crear y alternar entre unidades de negocio / clínicas (Exclusivo Super Admin).',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN'],
      },
      {
        id: 'organization.branding',
        code: 'organization.branding',
        name: 'Configurar Marca, Colores y Razón Social',
        description: 'Ajuste de logotipo, RUC, paleta cromática y datos fiscales (Exclusivo Super Admin).',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN'],
      },
      {
        id: 'audit.view',
        code: 'audit.view',
        name: 'Bitácora de auditoría forense',
        description: 'Consulta inmutable de registros de seguridad y trazabilidad.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR'],
      },
    ],
  },
  {
    id: 'security',
    name: 'Seguridad ASVS & Base de Datos',
    category: 'Sistema',
    description: 'Gobernanza técnica, integridad criptográfica y respaldos del sistema.',
    permissions: [
      {
        id: 'security.manage',
        code: 'security.manage',
        name: 'Políticas de seguridad y hardening ASVS',
        description: 'Gestión de bloqueo de fuerza bruta, políticas de contraseñas y headers.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN'],
      },
      {
        id: 'database.seed',
        code: 'database.seed',
        name: 'Restauración de catálogos y seed de pruebas',
        description: 'Carga de datos estándar de Paraguay y restauración de demostración.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN'],
      },
      {
        id: 'data.export_sensitive',
        code: 'data.export_sensitive',
        name: 'Exportación masiva de datos clínicos y fiscales',
        description: 'Descarga completa de base de datos para respaldos externos.',
        category: 'Sistema',
        defaultRoles: ['SUPER_ADMIN'],
      },
    ],
  },
];

/**
 * Obtiene el nivel de jerarquía numérica de un rol dado
 */
export function getRoleHierarchyLevel(roleId: string): number {
  return ROLE_HIERARCHY[roleId]?.level ?? 10;
}

/**
 * Verifica si un rol tiene un permiso determinado (soporta roles dinámicos de dbStore y ROLE_HIERARCHY)
 */
export function hasPermission(roleId: string, requiredPermission: string, dynamicPermissions?: string[]): boolean {
  if (roleId === 'SUPER_ADMIN') return true;

  if (dynamicPermissions && Array.isArray(dynamicPermissions)) {
    if (dynamicPermissions.includes('system.all')) return true;
    return dynamicPermissions.includes(requiredPermission);
  }

  const def = ROLE_HIERARCHY[roleId];
  if (!def) return false;
  if (def.permissions.includes('system.all')) return true;
  return def.permissions.includes(requiredPermission);
}

/**
 * Valida si un rol emisor (actorRole) tiene jerarquía suficiente para administrar un rol objetivo (targetRole)
 * REGLA DE ORO: Ningún rol inferior o igual puede administrar a otro rol superior o igual,
 * excepto SUPER_ADMIN que puede administrar otros SUPER_ADMIN o roles inferiores.
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'SUPER_ADMIN') {
    return true; // Super Admin puede gestionar todos los roles
  }

  const actorLevel = getRoleHierarchyLevel(actorRole);
  const targetLevel = getRoleHierarchyLevel(targetRole);

  // Un actor solo puede administrar estrictamente a roles de MENOR jerarquía
  return actorLevel > targetLevel;
}

/**
 * Determina si el rol objetivo es un SUPER_ADMIN (usuario estrictamente protegido)
 */
export function isSuperAdminRole(roleId: string): boolean {
  return roleId === 'SUPER_ADMIN';
}

export interface BackendAuthorizationParams {
  actor: {
    userId: string;
    role: string;
    organizationId: string;
    allowedBranchIds?: string[];
  };
  resource: 'BRANCH' | 'USER' | 'ORGANIZATION' | 'ROLE' | 'DATABASE' | 'BRANCH_SETTINGS' | 'CASH' | 'CLINICAL' | 'QUOTE';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'DEACTIVATE' | 'RESET_PASSWORD' | 'MANAGE_ROLES' | 'SEED' | 'SWITCH_CONTEXT';
  permission?: string;
  targetOrgId?: string;
  targetBranchId?: string;
  targetUserRole?: string;
  targetUserId?: string;
  newRoleToAssign?: string;
}

/**
 * Validador formal en Backend de Autorización y Mínimo Privilegio.
 * Cada operación crítica debe pasar por esta función en el backend.
 */
export function validateBackendAuthorization(params: BackendAuthorizationParams): {
  authorized: boolean;
  statusCode: number;
  reason?: string;
} {
  const { actor, resource, action, permission, targetOrgId, targetBranchId, targetUserRole, targetUserId, newRoleToAssign } = params;

  if (!actor || !actor.userId || !actor.role || !actor.organizationId) {
    return {
      authorized: false,
      statusCode: 401,
      reason: '401 No autenticado: Parámetros de sesión y actor ausentes o inválidos.',
    };
  }

  // 1. REGLA CROSS-TENANT: Aislamiento estricto de Organización
  // Un usuario de Organización A NUNCA puede acceder o modificar información de Organización B
  if (targetOrgId && targetOrgId !== actor.organizationId && actor.role !== 'SUPER_ADMIN') {
    return {
      authorized: false,
      statusCode: 403,
      reason: '403 Prohibido: Violación de aislamiento multi-inquilino (Cross-Tenant). No tiene acceso a recursos de otra organización.',
    };
  }

  // 2. SUPER ADMIN bypass: el Super Administrador del sistema posee gobernanza global
  if (actor.role === 'SUPER_ADMIN') {
    return { authorized: true, statusCode: 200 };
  }

  // 3. PROTECCIÓN DEL SUPER ADMINISTRADOR:
  // Ningún rol inferior puede ver, modificar, desactivar, restablecer o administrar un SUPER_ADMIN
  if (targetUserRole && isSuperAdminRole(targetUserRole)) {
    return {
      authorized: false,
      statusCode: 403,
      reason: '403 Prohibido: El usuario Super Administrador está estrictamente protegido y no puede ser administrado por roles inferiores.',
    };
  }

  // 4. PREVENCIÓN DE ESCALAMIENTO DE PRIVILEGIOS:
  // Ningún usuario puede auto-asignarse o asignar el rol SUPER_ADMIN o roles iguales/superiores al propio
  if (newRoleToAssign) {
    if (isSuperAdminRole(newRoleToAssign)) {
      return {
        authorized: false,
        statusCode: 403,
        reason: '403 Prohibido: Intento de escalamiento de privilegios al rol SUPER_ADMIN denegado.',
      };
    }
    if (!canManageRole(actor.role, newRoleToAssign)) {
      return {
        authorized: false,
        statusCode: 403,
        reason: `403 Prohibido: No tiene jerarquía suficiente para asignar el rol ${newRoleToAssign}.`,
      };
    }
  }

  // 5. JERARQUÍA ENTRE USUARIOS:
  // Un rol inferior nunca puede modificar a un usuario de rol superior o igual (salvo el propio usuario en operaciones permitidas de su perfil)
  if (targetUserRole && targetUserId !== actor.userId) {
    if (!canManageRole(actor.role, targetUserRole)) {
      return {
        authorized: false,
        statusCode: 403,
        reason: `403 Prohibido: Su rol (${actor.role}) no tiene jerarquía suficiente para administrar a un usuario con rol ${targetUserRole}.`,
      };
    }
  }

  // 6. REGLAS ESPECÍFICAS PARA SUCURSALES (BRANCH ADMIN):
  // Un Administrador de Sucursal NO debe poder:
  // - Crear sucursales.
  // - Eliminar o desactivar sucursales.
  // - Modificar otras sucursales fuera de sus asignadas.
  if (resource === 'BRANCH') {
    if (action === 'CREATE') {
      if (actor.role === 'ADMIN_SUCURSAL' || !hasPermission(actor.role, 'branches.create')) {
        return {
          authorized: false,
          statusCode: 403,
          reason: '403 Prohibido: El Administrador de Sucursal no tiene autorización para crear sucursales.',
        };
      }
    }
    if (action === 'DELETE' || action === 'DEACTIVATE') {
      if (actor.role === 'ADMIN_SUCURSAL' || !hasPermission(actor.role, 'branches.delete')) {
        return {
          authorized: false,
          statusCode: 403,
          reason: '403 Prohibido: El Administrador de Sucursal no puede eliminar ni desactivar sucursales.',
        };
      }
    }
    if (action === 'UPDATE' && targetBranchId) {
      if (actor.role === 'ADMIN_SUCURSAL') {
        const allowedBranches = actor.allowedBranchIds || [];
        if (!allowedBranches.includes(targetBranchId)) {
          return {
            authorized: false,
            statusCode: 403,
            reason: '403 Prohibido: El Administrador de Sucursal no puede modificar sucursales ajenas a las autorizadas.',
          };
        }
      }
    }
  }

  // 7. REGLAS PARA CONFIGURACIÓN DE SUCURSAL:
  if (resource === 'BRANCH_SETTINGS' && targetBranchId) {
    if (actor.role === 'ADMIN_SUCURSAL') {
      const allowedBranches = actor.allowedBranchIds || [];
      if (!allowedBranches.includes(targetBranchId)) {
        return {
          authorized: false,
          statusCode: 403,
          reason: '403 Prohibido: No posee permisos sobre las políticas de una sucursal no asignada.',
        };
      }
    }
  }

  // 8. ACCIONES CRÍTICAS GLOBALES: SEED, RESET, REINICIALIZAR:
  if (resource === 'DATABASE' && (action === 'SEED' || action === 'DELETE')) {
    return {
      authorized: false,
      statusCode: 403,
      reason: '403 Prohibido: La inicialización o restauración de datos es una operación de alta criticidad exclusiva de SUPER_ADMIN.',
    };
  }

  // 9. GOBERNANZA DE ORGANIZACIÓN & BRANDING:
  if (resource === 'ORGANIZATION' && (action === 'CREATE' || action === 'UPDATE')) {
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN_ORGANIZACION') {
      return {
        authorized: false,
        statusCode: 403,
        reason: '403 Prohibido: Solo administradores de organización pueden modificar parámetros de empresa.',
      };
    }
  }

  // 10. Validación de permiso explícito si fue provisto
  if (permission && !hasPermission(actor.role, permission)) {
    return {
      authorized: false,
      statusCode: 403,
      reason: `403 Prohibido: El rol ${actor.role} no tiene asignado el permiso "${permission}".`,
    };
  }

  return { authorized: true, statusCode: 200 };
}
