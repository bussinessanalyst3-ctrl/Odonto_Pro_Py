import { generateInitialSeedData } from '../seeds/initial-seed.ts';
import {
  canManageRole,
  getUserEffectivePermissions as computeUserEffectivePermissions,
  hasPermission,
  isSuperAdminRole,
  REGULATORY_RESTRICTIONS_CATALOG,
  RegulatoryRestrictionItem,
  ROLE_HIERARCHY,
  UserEffectivePermissions,
} from '../../security/rbacHierarchy.ts';
import type { BackendActorContext, StoreContext } from './types.ts';

export function revokeUserSessions(ctx: StoreContext, userId: string, adminUserId?: string) {
  const data = ctx.getData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return false;

  const revocationTime = Date.now();
  ctx.revokedUserSessions.set(userId, revocationTime);
  (user as any).sessionRevokedAt = new Date(revocationTime).toISOString();
  user.permissionsVersion = (user.permissionsVersion || 0) + 1;

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: adminUserId || data.users[0]?.id || null,
    action: 'SESSION_REVOCATION',
    entity: 'USER_SESSION',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Security Manager',
    oldValues: null,
    newValues: { revokedAt: new Date(revocationTime).toISOString(), userId },
    description: `Revocación forzosa inmediata de todas las sesiones activas para ${user.firstName} ${user.lastName} (${user.email})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function isSessionRevoked(ctx: StoreContext, userId: string, sessionIssuedAtIso: string): boolean {
  const sessionTime = new Date(sessionIssuedAtIso).getTime();
  const user = ctx.getData().users?.find((u) => u.id === userId);
  if ((user as any)?.sessionRevokedAt) {
    const revokedAt = new Date((user as any).sessionRevokedAt).getTime();
    if (sessionTime <= revokedAt) return true;
  }
  const inMemRevokedAt = ctx.revokedUserSessions.get(userId);
  if (inMemRevokedAt && sessionTime <= inMemRevokedAt) return true;
  return false;
}

export function findUserByEmailOrUsername(ctx: StoreContext, identifier: string) {
  if (!identifier) return null;
  const users = ctx.getData().users;
  const safe = identifier.toLowerCase().trim();

  const exactEmail = users.find((u) => u.email.toLowerCase() === safe);
  if (exactEmail) return exactEmail;

  const exactUsername = users.find((u: any) => u.username && u.username.toLowerCase() === safe);
  if (exactUsername) return exactUsername;

  const matchPrefix = users.find((u) => {
    const emailPrefix = u.email.split('@')[0].toLowerCase();
    return emailPrefix === safe;
  });
  if (matchPrefix) return matchPrefix;

  if (
    safe === 'bussinessanalyst3@gmail.com' ||
    safe === 'bussinessanalyst3' ||
    safe === 'businessanalyst3@gmail.com' ||
    safe === 'businessanalyst3'
  ) {
    return (
      users.find((u) => u.username === 'bussinessanalyst3' || u.email === 'bussinessanalyst3@gmail.com') || null
    );
  }

  if (safe === 'admin' || safe === 'superadmin') {
    return users.find((u) => u.roleId === 'SUPER_ADMIN') || null;
  }

  return null;
}

export function getUsers(ctx: StoreContext, branchId?: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const orgId =
    effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
      ? effectiveActor.organizationId
      : data.organization.id;
  let orgUsers = data.users.filter((u) => u.organizationId === orgId);

  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    orgUsers = orgUsers.filter((u) => u.roleId !== 'SUPER_ADMIN');
  }

  if (
    effectiveActor &&
    effectiveActor.role === 'ADMIN_SUCURSAL' &&
    effectiveActor.allowedBranchIds &&
    effectiveActor.allowedBranchIds.length > 0
  ) {
    const allowedUserIds = new Set(
      data.userBranches.filter((ub) => effectiveActor.allowedBranchIds!.includes(ub.branchId)).map((ub) => ub.userId)
    );
    orgUsers = orgUsers.filter((u) => allowedUserIds.has(u.id));
  }

  if (!branchId) return orgUsers;
  const userIds = data.userBranches.filter((ub) => ub.branchId === branchId).map((ub) => ub.userId);
  return orgUsers.filter((u) => userIds.includes(u.id));
}

export function getUserById(ctx: StoreContext, id: string, actor?: BackendActorContext) {
  const effectiveActor = ctx.getEffectiveActor(actor);
  const user = ctx.getData().users.find((u) => u.id === id);
  if (!user) return null;

  if (isSuperAdminRole(user.roleId)) {
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
      return null;
    }
  }

  return user;
}

export function addUser(
  ctx: StoreContext,
  newUser: {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    organizationId?: string;
    roleId: string;
    phone: string;
    specialty?: string;
    professionalLicense?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    branchIds: string[];
    defaultBranchId?: string;
    passwordRecord?: { hash: string; salt: string; iterations: number };
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);

  if (effectiveActor) {
    if (isSuperAdminRole(newUser.roleId) && effectiveActor.role !== 'SUPER_ADMIN') {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        userId: effectiveActor.userId,
        description: `Intento denegado de crear usuario SUPER_ADMIN por usuario con rol inferior ${effectiveActor.role}.`,
      });
      throw new Error('403 Prohibido: Solo un Super Administrador puede crear cuentas con rol SUPER_ADMIN.');
    }

    if (!canManageRole(effectiveActor.role, newUser.roleId)) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        userId: effectiveActor.userId,
        description: `Intento denegado de crear usuario con rol ${newUser.roleId} por actor con rol ${effectiveActor.role}. Violación jerárquica.`,
      });
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para crear usuarios con rol ${newUser.roleId}.`
      );
    }
  }

  const safeEmail = newUser.email.toLowerCase().trim();
  const existingEmail = data.users.find((u) => u.email.toLowerCase() === safeEmail);
  if (existingEmail) {
    throw new Error(`400 Error: Ya existe un usuario registrado con el correo "${newUser.email}".`);
  }

  const rawUsername = newUser.username?.trim() || safeEmail.split('@')[0];
  const safeUsername = rawUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const existingUsername = data.users.find((u: any) => u.username && u.username.toLowerCase() === safeUsername);
  if (existingUsername) {
    throw new Error(`400 Error: El nombre de usuario "${safeUsername}" ya se encuentra en uso.`);
  }

  const targetOrgId =
    effectiveActor?.role === 'SUPER_ADMIN' && newUser.organizationId
      ? newUser.organizationId
      : effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
        ? effectiveActor.organizationId
        : data.organization.id;

  const id = crypto.randomUUID();
  const userRecord = {
    id,
    organizationId: targetOrgId,
    roleId: newUser.roleId,
    username: safeUsername,
    firstName: newUser.firstName.trim(),
    lastName: newUser.lastName.trim(),
    email: safeEmail,
    passwordHash: newUser.passwordRecord?.hash as any,
    passwordSalt: newUser.passwordRecord?.salt as any,
    passwordIterations: newUser.passwordRecord?.iterations || (newUser.passwordRecord ? 100000 : undefined),
    phone: newUser.phone.trim(),
    professionalLicense: newUser.professionalLicense?.trim() || null,
    specialty: newUser.specialty?.trim() || 'Odontología General',
    status: (newUser.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.users.push(userRecord);

  const activeBranches = ctx.getBranches(effectiveActor || undefined);
  const safeDefault =
    newUser.defaultBranchId || newUser.branchIds[0] || activeBranches[0]?.id || data.branches[0]?.id;
  newUser.branchIds.forEach((bId) => {
    data.userBranches.push({
      userId: id,
      branchId: bId,
      isDefault: bId === safeDefault,
      createdAt: new Date(),
    });
  });

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: targetOrgId,
    branchId: safeDefault,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'CREATE',
    entity: 'USER',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: {
      name: `${newUser.firstName} ${newUser.lastName}`,
      username: safeUsername,
      email: newUser.email,
      role: newUser.roleId,
      license: newUser.professionalLicense,
      branches: newUser.branchIds,
    },
    description: `Alta de usuario institucional: ${newUser.firstName} ${newUser.lastName} (@${safeUsername} - ${newUser.roleId})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return userRecord;
}

export function updateUser(
  ctx: StoreContext,
  userId: string,
  updates: Record<string, any> & {
    branchIds?: string[];
    defaultBranchId?: string;
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const idx = data.users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  const targetUser = data.users[idx];

  if (updates.email && updates.email.toLowerCase().trim() !== targetUser.email.toLowerCase().trim()) {
    const safeNewEmail = updates.email.toLowerCase().trim();
    const duplicateEmail = data.users.find((u) => u.id !== userId && u.email.toLowerCase() === safeNewEmail);
    if (duplicateEmail) {
      throw new Error(`400 Error: Ya existe otro usuario registrado con el correo "${updates.email}".`);
    }
  }

  if (
    updates.username &&
    updates.username.toLowerCase().trim() !== (targetUser as any).username?.toLowerCase()?.trim()
  ) {
    const safeNewUsername = updates.username.toLowerCase().trim();
    const duplicateUsername = data.users.find(
      (u: any) => u.id !== userId && u.username && u.username.toLowerCase() === safeNewUsername
    );
    if (duplicateUsername) {
      throw new Error(`400 Error: El nombre de usuario "${updates.username}" ya se encuentra registrado por otro usuario.`);
    }
  }

  if (effectiveActor) {
    if (isSuperAdminRole(targetUser.roleId) && effectiveActor.role !== 'SUPER_ADMIN') {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: targetUser.id,
        userId: effectiveActor.userId,
        description: `Intento denegado de modificar al SUPER_ADMIN por usuario con rol ${effectiveActor.role}. Acción bloqueada.`,
      });
      throw new Error(
        '403 Prohibido: El Super Administrador es un usuario protegido y no puede ser modificado por roles inferiores.'
      );
    }

    if (effectiveActor.userId === targetUser.id && updates.roleId && updates.roleId !== targetUser.roleId) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: targetUser.id,
        userId: effectiveActor.userId,
        description: `Intento de auto-escalamiento de privilegios bloqueado: El usuario ${effectiveActor.userId} intentó modificar su propio rol a ${updates.roleId}.`,
      });
      throw new Error(
        '403 Prohibido: Por seguridad institucional y prevención de auto-elevación de privilegios, no está permitido modificar su propio rol.'
      );
    }

    if (updates.roleId && updates.roleId !== targetUser.roleId) {
      if (updates.roleId === 'SUPER_ADMIN' && effectiveActor.role !== 'SUPER_ADMIN') {
        ctx.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: targetUser.id,
          userId: effectiveActor.userId,
          description: `Intento denegado de escalar privilegios al rol SUPER_ADMIN por usuario ${effectiveActor.userId}.`,
        });
        throw new Error('403 Prohibido: Escalamiento de privilegios no autorizado. No puede asignar el rol SUPER_ADMIN.');
      }

      if (!canManageRole(effectiveActor.role, updates.roleId)) {
        ctx.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: targetUser.id,
          userId: effectiveActor.userId,
          description: `Intento denegado de asignar rol ${updates.roleId} por usuario con rol ${effectiveActor.role}. Jerarquía insuficiente.`,
        });
        throw new Error(
          `403 Prohibido: No tiene jerarquía para asignar el rol ${updates.roleId}. Solo puede asignar roles subordinados.`
        );
      }
    }

    if (effectiveActor.userId !== targetUser.id && !canManageRole(effectiveActor.role, targetUser.roleId)) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: targetUser.id,
        userId: effectiveActor.userId,
        description: `Intento denegado de modificar a usuario con rol ${targetUser.roleId} por rol ${effectiveActor.role}. Jerarquía insuficiente.`,
      });
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para modificar usuarios con rol ${targetUser.roleId}.`
      );
    }
  }

  if (updates.status === 'INACTIVE' && targetUser.status !== 'INACTIVE') {
    ctx.revokeUserSessions(userId, effectiveActor?.userId);
  }

  const old = { ...data.users[idx] };
  const { branchIds, defaultBranchId, ...userProps } = updates;

  data.users[idx] = {
    ...data.users[idx],
    ...userProps,
    updatedAt: new Date(),
  };

  if (branchIds && branchIds.length > 0) {
    data.userBranches = data.userBranches.filter((ub) => ub.userId !== userId);
    const safeDefault = defaultBranchId || branchIds[0];
    branchIds.forEach((bId) => {
      data.userBranches.push({
        userId,
        branchId: bId,
        isDefault: bId === safeDefault,
        createdAt: new Date(),
      });
    });
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: data.userBranches.find((ub) => ub.userId === userId)?.branchId || null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'UPDATE',
    entity: 'USER',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: old,
    newValues: updates,
    description: `Modificación de perfil y permisos para ${data.users[idx].firstName} ${data.users[idx].lastName}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return data.users[idx];
}

export function toggleUserStatus(ctx: StoreContext, userId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const user = data.users.find((u) => u.id === userId);
  if (!user) return null;

  if (isSuperAdminRole(user.roleId)) {
    if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: user.id,
        userId: effectiveActor?.userId || null,
        description: `Intento denegado de inactivar al Super Administrador (${user.email}) por usuario con rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
      });
      throw new Error(
        '403 Prohibido: El usuario Super Administrador está protegido y no puede ser desactivado por administradores inferiores.'
      );
    }
  }

  if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
    throw new Error(
      `403 Prohibido: No tiene jerarquía suficiente para cambiar el estado de acceso de este usuario (${user.roleId}).`
    );
  }

  const newStatus = user.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const);
  user.status = newStatus;
  user.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'STATUS_CHANGE',
    entity: 'USER',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: { status: newStatus },
    description: `Cambio de estado de acceso para usuario ${user.firstName} ${user.lastName} a ${newStatus}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return user;
}

export function deleteUser(ctx: StoreContext, userId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const targetUser = data.users.find((u) => u.id === userId);
  if (!targetUser) {
    throw new Error('Usuario no encontrado en el sistema.');
  }

  if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
    ctx.addAuditLog({
      action: 'ACCESS_DENIED_SECURITY',
      entity: 'USER',
      entityId: targetUser.id,
      userId: effectiveActor?.userId || null,
      description: `Intento no autorizado de eliminar usuario (${targetUser.email}) por rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
    });
    throw new Error(
      '403 Prohibido: Solo el Super Administrador tiene autorización para eliminar cuentas de usuario.'
    );
  }

  if (isSuperAdminRole(targetUser.roleId)) {
    const activeSuperAdmins = data.users.filter((u) => isSuperAdminRole(u.roleId));
    if (activeSuperAdmins.length <= 1) {
      throw new Error('403 Prohibido: No se puede eliminar el único Super Administrador del sistema.');
    }
  }

  const doctorHistoricalName = `Dr(a). ${targetUser.firstName} ${targetUser.lastName} (Registro Histórico)`;
  const staffHistoricalName = `${targetUser.firstName} ${targetUser.lastName} (Histórico)`;

  (data.appointments || []).forEach((a: any) => {
    if (a.odontologistId === userId && !a.historicalDoctorName) {
      a.historicalDoctorName = doctorHistoricalName;
    }
    if (a.createdBy === userId && !a.historicalCreatedByName) {
      a.historicalCreatedByName = staffHistoricalName;
    }
  });

  (data.clinicalRecords || []).forEach((c: any) => {
    if (c.odontologistId === userId && !c.historicalDoctorName) {
      c.historicalDoctorName = doctorHistoricalName;
    }
  });

  (data.odontograms || []).forEach((o: any) => {
    if (o.odontologistId === userId && !o.historicalDoctorName) {
      o.historicalDoctorName = doctorHistoricalName;
    }
  });

  (data.quotes || []).forEach((q: any) => {
    if (q.odontologistId === userId && !q.historicalDoctorName) {
      q.historicalDoctorName = doctorHistoricalName;
    }
  });

  (data.cashRegisters || []).forEach((cr: any) => {
    if (cr.openedBy === userId && !cr.historicalOpenedByName) cr.historicalOpenedByName = staffHistoricalName;
    if (cr.closedBy === userId && !cr.historicalClosedByName) cr.historicalClosedByName = staffHistoricalName;
  });

  (data.cashMovements || []).forEach((cm: any) => {
    if (cm.performedBy === userId && !cm.historicalPerformedByName) cm.historicalPerformedByName = staffHistoricalName;
  });

  (data.payments || []).forEach((p: any) => {
    if (p.receivedBy === userId && !p.historicalReceivedByName) p.historicalReceivedByName = staffHistoricalName;
  });

  data.userBranches = (data.userBranches || []).filter((ub) => ub.userId !== userId);
  ctx.revokeUserSessions(userId, effectiveActor.userId);
  data.users = data.users.filter((u) => u.id !== userId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor.userId,
    action: 'DELETE',
    entity: 'USER',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: {
      id: targetUser.id,
      email: targetUser.email,
      username: targetUser.username,
      roleId: targetUser.roleId,
      name: `${targetUser.firstName} ${targetUser.lastName}`,
    },
    newValues: null,
    description: `Eliminación controlada de cuenta de usuario ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}, Rol: ${targetUser.roleId}). Datos clínicos e históricos conservados.`,
    createdAt: new Date(),
  });

  ctx.saveToStorage();
  ctx.notify();
  return true;
}

export function addRole(
  ctx: StoreContext,
  roleData: {
    id: string;
    name: string;
    description: string;
    allowedNavTabs?: string[];
    permissions?: string[];
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const roleId = roleData.id.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (!hasPermission(effectiveActor, 'roles.manage')) {
      throw new Error('403 Prohibido: No tiene autorización para crear nuevos roles.');
    }
    if (roleId === 'SUPER_ADMIN' || roleId === 'ADMIN_ORGANIZACION' || !canManageRole(effectiveActor.role, roleId)) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'ROLE',
        entityId: roleId,
        userId: effectiveActor.userId,
        description: `Intento denegado de crear rol ${roleId} con jerarquía no subordinada por usuario ${effectiveActor.userId}.`,
      });
      throw new Error(
        `403 Prohibido: Solo puede crear roles estrictamente subordinados a su jerarquía (${effectiveActor.role}).`
      );
    }

    const superAdminModules = new Set([
      'organization',
      'production',
      'security',
      'testing',
      'auth-session',
      'database',
      'data-explorer',
      'paraguay',
      'architecture',
      'roadmap',
    ]);
    const hasExclusiveModule = (roleData.allowedNavTabs || []).some((m) => superAdminModules.has(m));
    if (hasExclusiveModule) {
      throw new Error('403 Prohibido: No puede asignar módulos reservados exclusivamente al Super Administrador.');
    }
  }

  const existing = data.roles.find((r) => r.id === roleId);
  if (existing) {
    throw new Error(`Ya existe un rol con el código identificador ${roleId}`);
  }

  const defaultPerms = ROLE_HIERARCHY[roleId]?.permissions || ['dashboard.view', 'patients.view'];
  const newRole = {
    id: roleId,
    name: roleData.name.trim(),
    description: roleData.description.trim(),
    isSystem: false,
    allowedNavTabs: roleData.allowedNavTabs || ['dashboard', 'appointments', 'patients'],
    permissions: roleData.permissions || defaultPerms,
    createdAt: new Date(),
  };

  data.roles.push(newRole);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'CREATE',
    entity: 'ROLE',
    entityId: roleId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: newRole,
    description: `Creación de nuevo rol institucional subordinado: "${newRole.name}" (${newRole.id}) con ${newRole.allowedNavTabs.length} módulos habilitados`,
    createdAt: new Date(),
  });

  ctx.notify();
  return newRole;
}

export function updateRole(
  ctx: StoreContext,
  roleId: string,
  updates: {
    name?: string;
    description?: string;
    allowedNavTabs?: string[];
    permissions?: string[];
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (!hasPermission(effectiveActor, 'roles.manage')) {
      throw new Error('403 Prohibido: No tiene autorización para modificar roles.');
    }
    if (!canManageRole(effectiveActor.role, roleId)) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'ROLE',
        entityId: roleId,
        userId: effectiveActor.userId,
        description: `Intento denegado de modificar rol ${roleId} por actor con rol ${effectiveActor.role}. Jerarquía insuficiente.`,
      });
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} solo puede administrar roles de menor jerarquía. No puede modificar el rol ${roleId}.`
      );
    }
  }

  const idx = data.roles.findIndex((r) => r.id === roleId);
  if (idx === -1) return null;

  const old = { ...data.roles[idx] };
  data.roles[idx] = {
    ...data.roles[idx],
    name: updates.name !== undefined ? updates.name.trim() : data.roles[idx].name,
    description: updates.description !== undefined ? updates.description.trim() : data.roles[idx].description,
    allowedNavTabs: updates.allowedNavTabs || data.roles[idx].allowedNavTabs || [],
    permissions:
      updates.permissions || (data.roles[idx] as any).permissions || ROLE_HIERARCHY[roleId]?.permissions || [],
  };

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'UPDATE',
    entity: 'ROLE',
    entityId: roleId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: old,
    newValues: updates,
    description: `Actualización de permisos y configuración para rol ${data.roles[idx].name} (${roleId})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return data.roles[idx];
}

export function getRolePermissions(ctx: StoreContext, roleId: string): string[] {
  const role = ctx.getData().roles.find((r) => r.id === roleId);
  if (role && (role as any).permissions && Array.isArray((role as any).permissions)) {
    return (role as any).permissions;
  }
  return ROLE_HIERARCHY[roleId]?.permissions || [];
}

export function updateRolePermissions(
  ctx: StoreContext,
  roleId: string,
  permissions: string[],
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (!hasPermission(effectiveActor, 'roles.manage')) {
      throw new Error(
        '403 Prohibido: Solo el Super Administrador o usuarios con permiso de autoridad pueden modificar la matriz de permisos.'
      );
    }

    if (!canManageRole(effectiveActor.role, roleId)) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'ROLE_PERMISSIONS',
        entityId: roleId,
        userId: effectiveActor.userId,
        description: `Intento denegado de escalamiento de privilegios: El rol ${effectiveActor.role} intentó modificar permisos para el rol ${roleId}.`,
      });
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} solo tiene autorización para asignar permisos a roles de menor jerarquía. No puede auto-asignarse permisos ni modificar roles superiores o iguales.`
      );
    }

    const superAdminExclusives = new Set([
      'system.all',
      'organization.create',
      'organization.manage',
      'organization.branding',
      'super_admin.manage',
      'security.manage',
      'database.seed',
      'data.export_sensitive',
    ]);
    const hasExclusivePerm = permissions.some((p) => superAdminExclusives.has(p));
    if (hasExclusivePerm) {
      throw new Error(
        '403 Prohibido: No tiene autorización para asignar permisos reservados exclusivamente al Super Administrador.'
      );
    }
  }

  const idx = data.roles.findIndex((r) => r.id === roleId);
  if (idx === -1) {
    throw new Error(`Rol no encontrado: ${roleId}`);
  }

  const finalPermissions = [...permissions];
  if (roleId === 'SUPER_ADMIN' && !finalPermissions.includes('system.all')) {
    finalPermissions.unshift('system.all');
  }

  const oldPerms = (data.roles[idx] as any).permissions || ROLE_HIERARCHY[roleId]?.permissions || [];
  (data.roles[idx] as any).permissions = finalPermissions;

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'ROLE_PERMISSIONS_UPDATE',
    entity: 'ROLE_PERMISSIONS',
    entityId: roleId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro RBAC Matrix',
    oldValues: { count: oldPerms.length, permissions: oldPerms },
    newValues: { count: finalPermissions.length, permissions: finalPermissions },
    description: `Actualización de matriz de permisos para rol ${data.roles[idx].name} (${roleId}): ${finalPermissions.length} permisos habilitados.`,
    createdAt: new Date(),
  });

  ctx.notify();
  return finalPermissions;
}

export function resetRolePermissionsToDefault(ctx: StoreContext, roleId: string, actor?: BackendActorContext) {
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (!canManageRole(effectiveActor.role, roleId)) {
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para restablecer permisos del rol ${roleId}.`
      );
    }
  }
  const defaultPerms = ROLE_HIERARCHY[roleId]?.permissions || [];
  return updateRolePermissions(ctx, roleId, defaultPerms, actor);
}

export function deleteRole(ctx: StoreContext, roleId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (!canManageRole(effectiveActor.role, roleId)) {
      throw new Error(
        `403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para eliminar el rol ${roleId}.`
      );
    }
  }
  const role = data.roles.find((r) => r.id === roleId);
  if (!role) return false;
  if (role.isSystem) {
    throw new Error(`El rol base de sistema ${role.name} está protegido y no puede ser eliminado.`);
  }

  const assignedUsers = data.users.filter((u) => u.roleId === roleId);
  if (assignedUsers.length > 0) {
    throw new Error(`No se puede eliminar el rol ${role.name} porque hay ${assignedUsers.length} usuario(s) asignados.`);
  }

  data.roles = data.roles.filter((r) => r.id !== roleId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: data.users[0]?.id || null,
    action: 'DELETE',
    entity: 'ROLE',
    entityId: roleId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: role,
    newValues: null,
    description: `Eliminación de rol personalizado: ${role.name} (${roleId})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function getUserEffectivePermissions(ctx: StoreContext, userId: string): UserEffectivePermissions {
  const data = ctx.getData();
  const user = data.users.find((u) => u.id === userId);
  return computeUserEffectivePermissions(user, data.roles);
}

export function getRegulatoryRestrictionsCatalog(): RegulatoryRestrictionItem[] {
  return REGULATORY_RESTRICTIONS_CATALOG;
}

export function getActiveRegulatoryRestrictions(ctx: StoreContext): string[] {
  const data = ctx.getData();
  if (!Array.isArray((data as any).regulatoryRestrictions)) {
    (data as any).regulatoryRestrictions = REGULATORY_RESTRICTIONS_CATALOG.filter((r) => r.defaultEnforced).map(
      (r) => r.id
    );
  }
  return (data as any).regulatoryRestrictions;
}

export function updateRegulatoryRestrictions(
  ctx: StoreContext,
  restrictions: string[],
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    throw new Error(
      '403 Prohibido: Solo el Super Administrador tiene autorización para modificar restricciones sanitarias regulatorias globales.'
    );
  }

  const oldRestrictions = [...getActiveRegulatoryRestrictions(ctx)];
  (data as any).regulatoryRestrictions = [...restrictions];

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || null,
    action: 'REGULATORY_RESTRICTIONS_UPDATE',
    entity: 'SYSTEM_SECURITY',
    entityId: 'MSPBS_GLOBAL',
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Security Governance',
    oldValues: { count: oldRestrictions.length, restrictions: oldRestrictions },
    newValues: { count: restrictions.length, restrictions },
    description: `Actualización de directivas sanitarias del MSPBS: ${restrictions.length} restricciones regulatorias activas.`,
    createdAt: new Date(),
  });

  ctx.notify();
  return (data as any).regulatoryRestrictions;
}

export function updateUserPermissions(
  ctx: StoreContext,
  targetUserId: string,
  overrides: {
    customPermissions?: string[];
    revokedPermissions?: string[];
    assignedRestrictions?: string[];
    allowedNavTabs?: string[];
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const targetIdx = data.users.findIndex((u) => u.id === targetUserId);
  if (targetIdx === -1) {
    throw new Error(`Usuario no encontrado: ${targetUserId}`);
  }

  const targetUser = data.users[targetIdx];

  if (effectiveActor) {
    if (effectiveActor.role !== 'SUPER_ADMIN') {
      if (!hasPermission(effectiveActor, 'users.edit')) {
        throw new Error('403 Prohibido: No tiene autorización para modificar la seguridad de usuarios.');
      }
      if (targetUser.roleId === 'SUPER_ADMIN') {
        throw new Error('403 Prohibido: No se pueden modificar los permisos de un Super Administrador.');
      }
      if (!canManageRole(effectiveActor.role, targetUser.roleId)) {
        throw new Error(
          `403 Prohibido: Su rol (${effectiveActor.role}) no tiene jerarquía para alterar permisos del rol ${targetUser.roleId}.`
        );
      }
      const superAdminExclusives = new Set([
        'system.all',
        'organization.create',
        'organization.manage',
        'organization.branding',
        'super_admin.manage',
        'security.manage',
        'database.seed',
        'data.export_sensitive',
      ]);
      if (overrides.customPermissions?.some((p) => superAdminExclusives.has(p))) {
        throw new Error('403 Prohibido: No puede otorgar permisos reservados exclusivamente al Super Administrador.');
      }
    }
  }

  const oldCustom = targetUser.customPermissions || [];
  const oldRevoked = targetUser.revokedPermissions || [];
  const oldRestrictions = targetUser.assignedRestrictions || [];
  const oldNavTabs = targetUser.allowedNavTabs || [];

  targetUser.customPermissions = Array.isArray(overrides.customPermissions)
    ? [...overrides.customPermissions]
    : targetUser.customPermissions || [];

  targetUser.revokedPermissions = Array.isArray(overrides.revokedPermissions)
    ? [...overrides.revokedPermissions]
    : targetUser.revokedPermissions || [];

  targetUser.assignedRestrictions = Array.isArray(overrides.assignedRestrictions)
    ? [...overrides.assignedRestrictions]
    : targetUser.assignedRestrictions || [];

  targetUser.allowedNavTabs = Array.isArray(overrides.allowedNavTabs)
    ? [...overrides.allowedNavTabs]
    : targetUser.allowedNavTabs || [];

  targetUser.permissionsVersion = (targetUser.permissionsVersion || 0) + 1;
  targetUser.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: targetUser.organizationId,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'USER_PERMISSIONS_OVERRIDE',
    entity: 'USER_SECURITY',
    entityId: targetUserId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Security Governance',
    oldValues: {
      customPermissions: oldCustom,
      revokedPermissions: oldRevoked,
      assignedRestrictions: oldRestrictions,
      allowedNavTabs: oldNavTabs,
    },
    newValues: {
      customPermissions: targetUser.customPermissions,
      revokedPermissions: targetUser.revokedPermissions,
      assignedRestrictions: targetUser.assignedRestrictions,
      allowedNavTabs: targetUser.allowedNavTabs,
      permissionsVersion: targetUser.permissionsVersion,
    },
    description: `Ajuste granular de permisos y restricciones para ${targetUser.firstName} ${targetUser.lastName} (${targetUser.email}). Grants: ${targetUser.customPermissions.length}, Revocaciones: ${targetUser.revokedPermissions.length}, Restricciones: ${targetUser.assignedRestrictions.length}.`,
    createdAt: new Date(),
  });

  ctx.notify();

  const effective = getUserEffectivePermissions(ctx, targetUserId);
  return {
    user: targetUser,
    effective,
  };
}

export function resetUserPassword(ctx: StoreContext, userId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const user = data.users.find((u) => u.id === userId);
  if (!user) return null;

  if (isSuperAdminRole(user.roleId)) {
    if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: user.id,
        userId: effectiveActor?.userId || null,
        description: `Intento denegado de restablecer al Super Administrador (${user.email}) por usuario con rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
      });
      throw new Error(
        '403 Prohibido: El Super Administrador es un usuario protegido y no puede ser restablecido por roles inferiores.'
      );
    }
  }

  if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
    throw new Error(
      `403 Prohibido: No tiene jerarquía para restablecer las credenciales de este usuario (${user.roleId}).`
    );
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'PASSWORD_RESET',
    entity: 'USER',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: { timestamp: new Date().toISOString() },
    description: `Generación de enlace seguro de restablecimiento de contraseña para ${user.email}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function setUserPasswordHash(
  ctx: StoreContext,
  userId: string,
  record: { hash: string; salt: string; iterations: number },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const user = data.users.find((u) => u.id === userId);
  if (!user) return false;

  if (isSuperAdminRole(user.roleId)) {
    if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'USER',
        entityId: user.id,
        userId: effectiveActor?.userId || null,
        description: `Intento denegado de modificar credenciales criptográficas del Super Administrador por rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
      });
      throw new Error(
        '403 Prohibido: El Super Administrador es un usuario protegido y no puede ser modificado por roles inferiores.'
      );
    }
  }

  if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
    throw new Error(
      `403 Prohibido: No tiene jerarquía para modificar credenciales de este usuario (${user.roleId}).`
    );
  }

  (user as any).passwordHash = record.hash;
  (user as any).passwordSalt = record.salt;
  (user as any).passwordIterations = record.iterations;
  (user as any).updatedAt = new Date();

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`odontopro_user_pwd_hash_${user.email.toLowerCase()}`);
    }
  } catch {
    // ignorar
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'PASSWORD_UPDATE',
    entity: 'USER',
    entityId: userId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Security PBKDF2',
    oldValues: null,
    newValues: {
      hashAlg: 'PBKDF2-HMAC-SHA256',
      iterations: record.iterations,
      saltHexLength: record.salt.length,
    },
    description: `Actualización y cifrado PBKDF2 de credenciales para ${user.firstName} ${user.lastName} (${user.email})`,
    createdAt: new Date(),
  });

  ctx.saveToStorage();
  ctx.notify();
  return true;
}

export function getUserPasswordRecord(
  ctx: StoreContext,
  identifier: string,
  actor?: BackendActorContext
): { hash: string; salt: string; iterations: number } | null {
  const effectiveActor = ctx.getEffectiveActor(actor);
  const user = findUserByEmailOrUsername(ctx, identifier);
  if (!user) return null;

  if (isSuperAdminRole(user.roleId)) {
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
      return null;
    }
  }

  if ((user as any).passwordSalt && (user as any).passwordHash) {
    return {
      hash: (user as any).passwordHash,
      salt: (user as any).passwordSalt,
      iterations: (user as any).passwordIterations || 100000,
    };
  }

  const seed = generateInitialSeedData();
  const seedUser = seed.users.find(
    (u) => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase())
  );
  if (seedUser && seedUser.passwordSalt && seedUser.passwordHash) {
    return {
      hash: seedUser.passwordHash,
      salt: seedUser.passwordSalt,
      iterations: seedUser.passwordIterations || 100000,
    };
  }

  return null;
}
