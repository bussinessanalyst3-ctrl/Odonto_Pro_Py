// ============================================================================
// CATÁLOGO ÚNICO DE MÓDULOS DE ODONTOPRO (FUENTE ÚNICA DE VERDAD)
// Compartido por: Sidebar, Header, App, Gestión de Permisos y Backend RBAC.
// Al agregar un módulo nuevo aquí, aparece automáticamente en el menú y en la
// pantalla de permisos de usuarios.
// ============================================================================

export type SystemModuleId =
  | 'dashboard'
  | 'agenda'
  | 'patients'
  | 'odontogram'
  | 'treatments'
  | 'clinical'
  | 'quotes'
  | 'cash'
  | 'staff-payroll'
  | 'branches'
  | 'organization'
  | 'users'
  | 'audit';

export type ModuleGroupId =
  | 'principal'
  | 'operacion'
  | 'clinica'
  | 'administracion'
  | 'rrhh'
  | 'sistema';

export interface ModuleGroupDefinition {
  id: ModuleGroupId;
  label: string;
}

export interface SystemModuleDefinition {
  id: SystemModuleId;
  label: string;
  sidebarLabel: string;
  description: string;
  groupId: ModuleGroupId;
  category: 'clinical' | 'management';
  defaultRoles: string[];
  aliases?: string[];
  badge?: string;
}

export const MODULE_GROUPS: ModuleGroupDefinition[] = [
  { id: 'principal', label: 'PANEL PRINCIPAL' },
  { id: 'operacion', label: 'OPERACIÓN CLÍNICA' },
  { id: 'clinica', label: 'ODONTOLOGÍA Y TRATAMIENTOS' },
  { id: 'administracion', label: 'ADMINISTRACIÓN Y CAJA' },
  { id: 'rrhh', label: 'RRHH' },
  { id: 'sistema', label: 'GESTIÓN Y SEGURIDAD' },
];

export const SYSTEM_MODULES: SystemModuleDefinition[] = [
  {
    id: 'dashboard',
    label: 'Panel Principal y Métricas',
    sidebarLabel: 'Dashboard & Métricas',
    description: 'Resumen diario, métricas clave e indicadores generales de la clínica.',
    groupId: 'principal',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
  },
  {
    id: 'agenda',
    label: 'Agenda y Citas',
    sidebarLabel: 'Agenda de Citas',
    description: 'Calendario de turnos, reservas, confirmaciones y sala de espera.',
    groupId: 'operacion',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
    aliases: ['appointments'],
  },
  {
    id: 'patients',
    label: 'Fichas de Pacientes',
    sidebarLabel: 'Fichas de Pacientes',
    description: 'Registro de pacientes, datos de contacto, seguros médicos e historial.',
    groupId: 'operacion',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
  },
  {
    id: 'odontogram',
    label: 'Odontograma FDI',
    sidebarLabel: 'Odontograma FDI',
    description: 'Registro gráfico interactivo por pieza dental y hallazgos clínicos.',
    groupId: 'clinica',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    badge: 'FDI',
  },
  {
    id: 'treatments',
    label: 'Planes y Tratamientos',
    sidebarLabel: 'Planes & Tratamientos',
    description: 'Planes odontológicos, procedimientos realizados y catálogo de servicios.',
    groupId: 'clinica',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
  },
  {
    id: 'clinical',
    label: 'Historias Clínicas MSPBS',
    sidebarLabel: 'Historias Clínicas MSPBS',
    description: 'Evoluciones clínicas, diagnósticos, recetas y documentación sanitaria.',
    groupId: 'clinica',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
  },
  {
    id: 'quotes',
    label: 'Presupuestos y Planes',
    sidebarLabel: 'Presupuestos & Planes',
    description: 'Cotizaciones de tratamientos, planes de pago y seguimiento comercial.',
    groupId: 'administracion',
    category: 'clinical',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
  },
  {
    id: 'cash',
    label: 'Caja y Facturación',
    sidebarLabel: 'Caja & Facturación',
    description: 'Apertura y cierre de caja, cobros, pagos, recibos y movimientos.',
    groupId: 'administracion',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION', 'CAJA'],
  },
  {
    id: 'staff-payroll',
    label: 'Gestión del Funcionario',
    sidebarLabel: 'Gestión del Funcionario',
    description: 'Sueldos, comisiones, liquidaciones y pagos al equipo de la clínica.',
    groupId: 'rrhh',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'VENDEDOR', 'ODONTOLOGO', 'CAJA'],
  },
  {
    id: 'branches',
    label: 'Sucursales y Sillones',
    sidebarLabel: 'Sucursales & Sillones',
    description: 'Configuración de sedes, horarios de atención y sillones dentales.',
    groupId: 'sistema',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
  },
  {
    id: 'organization',
    label: 'Empresa y Branding',
    sidebarLabel: 'Empresa & Branding',
    description: 'Datos legales de la clínica, RUC, membretes e identidad corporativa.',
    groupId: 'sistema',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'users',
    label: 'Equipo, Roles y Accesos',
    sidebarLabel: 'Equipo, Roles & Accesos',
    description: 'Alta de usuarios, asignación de sucursales, roles y permisos.',
    groupId: 'sistema',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
  },
  {
    id: 'audit',
    label: 'Auditoría y Registros',
    sidebarLabel: 'Auditoría & Logs',
    description: 'Historial de actividad, trazabilidad de cambios y control de seguridad.',
    groupId: 'sistema',
    category: 'management',
    defaultRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
  },
];

export const ALL_SYSTEM_MODULE_IDS: SystemModuleId[] = SYSTEM_MODULES.map((m) => m.id);

const MODULE_BY_ID = new Map<SystemModuleId, SystemModuleDefinition>(
  SYSTEM_MODULES.map((m) => [m.id, m])
);

const ALIAS_TO_CANONICAL = new Map<string, SystemModuleId>();
for (const mod of SYSTEM_MODULES) {
  ALIAS_TO_CANONICAL.set(mod.id, mod.id);
  for (const alias of mod.aliases || []) {
    ALIAS_TO_CANONICAL.set(alias, mod.id);
  }
}

export function getModuleById(id: string): SystemModuleDefinition | undefined {
  const canonical = normalizeModuleId(id);
  return canonical ? MODULE_BY_ID.get(canonical) : undefined;
}

/**
 * Convierte un ID de módulo o alias histórico (ej. "appointments" -> "agenda")
 * a su identificador canónico en SYSTEM_MODULES. Devuelve null si no es un módulo válido.
 */
export function normalizeModuleId(rawId: unknown): SystemModuleId | null {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  return ALIAS_TO_CANONICAL.get(trimmed) || null;
}

/**
 * Normaliza y deduplica una lista de módulos manteniendo el orden del catálogo.
 */
export function normalizeModuleList(rawList: unknown): SystemModuleId[] {
  if (!Array.isArray(rawList)) return [];
  const present = new Set<SystemModuleId>();
  for (const item of rawList) {
    const canonical = normalizeModuleId(item);
    if (canonical) {
      present.add(canonical);
    }
  }
  return ALL_SYSTEM_MODULE_IDS.filter((id) => present.has(id));
}

export function moduleSetsEqual(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(normalizeModuleList(a));
  const setB = new Set(normalizeModuleList(b));
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * Devuelve los módulos predeterminados del rol.
 * Respeta primero roleObj.allowedNavTabs si está definido y tiene módulos válidos;
 * en caso contrario cae al mapa estándar defaultRoles del catálogo.
 */
export function getRoleDefaultModules(roleObj: any, roleId: string): SystemModuleId[] {
  if (roleId === 'SUPER_ADMIN') {
    return [...ALL_SYSTEM_MODULE_IDS];
  }
  const fromRoleObj = normalizeModuleList(roleObj?.allowedNavTabs);
  if (fromRoleObj.length > 0) {
    return fromRoleObj;
  }
  const fromCatalog = SYSTEM_MODULES.filter((m) => m.defaultRoles.includes(roleId)).map((m) => m.id);
  return fromCatalog.length > 0 ? fromCatalog : ['dashboard'];
}

export interface UserModuleResolution {
  roleDefaultModules: SystemModuleId[];
  effectiveModules: SystemModuleId[];
  hasIndividualOverride: boolean;
  addedModules: SystemModuleId[];
  removedModules: SystemModuleId[];
}

/**
 * Calcula los módulos efectivos de un usuario y distingue claramente
 * cuáles provienen del rol y cuáles son ajustes individuales.
 */
export function resolveUserEffectiveModules(user: any, roles: any[] = []): UserModuleResolution {
  if (!user) {
    return {
      roleDefaultModules: [],
      effectiveModules: [],
      hasIndividualOverride: false,
      addedModules: [],
      removedModules: [],
    };
  }

  const roleId = String(user.roleId || user.role || '');
  const roleObj = roles.find((r) => r.id === roleId);
  const roleDefaultModules = getRoleDefaultModules(roleObj, roleId);

  if (roleId === 'SUPER_ADMIN') {
    return {
      roleDefaultModules: [...ALL_SYSTEM_MODULE_IDS],
      effectiveModules: [...ALL_SYSTEM_MODULE_IDS],
      hasIndividualOverride: false,
      addedModules: [],
      removedModules: [],
    };
  }

  const customModules = normalizeModuleList(user.allowedNavTabs);
  const effectiveModules = customModules.length > 0 ? customModules : roleDefaultModules;

  const roleSet = new Set(roleDefaultModules);
  const effSet = new Set(effectiveModules);
  const addedModules = effectiveModules.filter((id) => !roleSet.has(id));
  const removedModules = roleDefaultModules.filter((id) => !effSet.has(id));

  return {
    roleDefaultModules,
    effectiveModules,
    hasIndividualOverride: addedModules.length > 0 || removedModules.length > 0,
    addedModules,
    removedModules,
  };
}

/**
 * Evalúa si una sesión activa tiene acceso a un módulo del catálogo,
 * soportando alias históricos ("appointments" -> "agenda") y herencia de rol.
 */
export function hasModuleAccess(
  session: { role?: string; allowedNavTabs?: string[] } | null | undefined,
  moduleId: SystemModuleId,
  roleObj?: any
): boolean {
  if (!session?.role) return false;
  if (session.role === 'SUPER_ADMIN') return true;

  const sessionModules = normalizeModuleList(session.allowedNavTabs);
  if (sessionModules.length > 0) {
    return sessionModules.includes(moduleId);
  }

  const roleModules = normalizeModuleList(roleObj?.allowedNavTabs);
  if (roleModules.length > 0) {
    return roleModules.includes(moduleId);
  }

  const modDef = MODULE_BY_ID.get(moduleId);
  return modDef ? modDef.defaultRoles.includes(session.role) : false;
}

/**
 * Devuelve el primer módulo permitido para la sesión actual.
 */
export function getFirstAllowedModule(
  session: { role?: string; allowedNavTabs?: string[] } | null | undefined,
  roleObj?: any
): SystemModuleId {
  if (!session?.role) return 'dashboard';
  if (session.role === 'SUPER_ADMIN') return 'dashboard';

  const sessionModules = normalizeModuleList(session.allowedNavTabs);
  if (sessionModules.length > 0) {
    return sessionModules[0];
  }

  const roleModules = normalizeModuleList(roleObj?.allowedNavTabs);
  if (roleModules.length > 0) {
    return roleModules[0];
  }

  const fallback = SYSTEM_MODULES.find((m) => m.defaultRoles.includes(session.role!));
  return fallback ? fallback.id : 'dashboard';
}

export interface CopiedPermissionsDraft {
  allowedNavTabs: SystemModuleId[];
  customPermissions: string[];
  revokedPermissions: string[];
  assignedRestrictions: string[];
  skippedModules: SystemModuleId[];
}

/**
 * Prepara un borrador de permisos copiando la configuración efectiva de otro usuario,
 * respetando siempre los módulos y permisos que el administrador actual posee.
 */
export function buildCopyPermissionsDraft(params: {
  sourceUser: any;
  roles: any[];
  actorAllowedModules: ReadonlySet<SystemModuleId>;
  actorEffectivePermissions: ReadonlySet<string>;
  actorHasAllPermissions: boolean;
}): CopiedPermissionsDraft {
  const { sourceUser, roles, actorAllowedModules, actorEffectivePermissions, actorHasAllPermissions } = params;
  const sourceModResolution = resolveUserEffectiveModules(sourceUser, roles);

  const allowedNavTabs: SystemModuleId[] = [];
  const skippedModules: SystemModuleId[] = [];
  for (const modId of sourceModResolution.effectiveModules) {
    if (actorAllowedModules.has(modId)) {
      allowedNavTabs.push(modId);
    } else {
      skippedModules.push(modId);
    }
  }

  if (allowedNavTabs.length === 0) {
    const firstActorMod = ALL_SYSTEM_MODULE_IDS.find((id) => actorAllowedModules.has(id));
    if (firstActorMod) allowedNavTabs.push(firstActorMod);
  }

  const rawCustom: string[] = Array.isArray(sourceUser?.customPermissions)
    ? sourceUser.customPermissions.map((p: unknown) => String(p || '').trim()).filter(Boolean)
    : [];
  const customPermissions: string[] = actorHasAllPermissions
    ? Array.from(new Set<string>(rawCustom))
    : Array.from(new Set<string>(rawCustom.filter((p) => actorEffectivePermissions.has(p))));

  const rawRevoked: string[] = Array.isArray(sourceUser?.revokedPermissions)
    ? sourceUser.revokedPermissions.map((p: unknown) => String(p || '').trim()).filter(Boolean)
    : [];
  const revokedPermissions: string[] = Array.from(new Set<string>(rawRevoked));

  const rawRestrictions: string[] = Array.isArray(sourceUser?.assignedRestrictions)
    ? sourceUser.assignedRestrictions.map((r: unknown) => String(r || '').trim()).filter(Boolean)
    : [];
  const assignedRestrictions: string[] = Array.from(new Set<string>(rawRestrictions));

  return {
    allowedNavTabs,
    customPermissions,
    revokedPermissions,
    assignedRestrictions,
    skippedModules,
  };
}
