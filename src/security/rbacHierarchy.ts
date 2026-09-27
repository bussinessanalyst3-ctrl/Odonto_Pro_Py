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
      'settings.view',
      'settings.update',
      'audit.view',
      'quotes.manage',
      'cash.view',
      'appointments.manage',
      'patients.manage',
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

/**
 * Obtiene el nivel de jerarquía numérica de un rol dado
 */
export function getRoleHierarchyLevel(roleId: string): number {
  return ROLE_HIERARCHY[roleId]?.level ?? 10;
}

/**
 * Verifica si un rol tiene un permiso determinado
 */
export function hasPermission(roleId: string, requiredPermission: string): boolean {
  if (roleId === 'SUPER_ADMIN') return true;
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
