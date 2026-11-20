import { STANDARD_SERVICES } from '../seeds/paraguay-catalogs.ts';
import { hasPermission } from '../../security/rbacHierarchy.ts';
import type { AuditLogInput, BackendActorContext, StoreContext } from './types.ts';

export function getNextReceiptNumber(ctx: StoreContext): string {
  const existingPayments = ctx.getData().payments || [];
  let maxSequential = 4120;
  for (const p of existingPayments) {
    if (p.receiptNumber) {
      const match = p.receiptNumber.match(/REC-\d{3}-\d{3}-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSequential) {
          maxSequential = num;
        }
      }
    }
  }
  const nextSeq = maxSequential + 1;
  return `REC-001-001-${String(nextSeq).padStart(7, '0')}`;
}

export function getNextInvoiceNumber(ctx: StoreContext): string {
  const existingPayments = ctx.getData().payments || [];
  let maxInvoice = 100000;
  for (const p of existingPayments) {
    if (p.invoiceNumber) {
      const match = p.invoiceNumber.match(/001-001-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxInvoice) {
          maxInvoice = num;
        }
      }
    }
  }
  return `001-001-${String(maxInvoice + 1).padStart(7, '0')}`;
}

export function getNextQuoteNumber(ctx: StoreContext): string {
  const existingQuotes = ctx.getData().quotes || [];
  let maxQuoteSeq = 142;
  for (const q of existingQuotes) {
    if (q.quoteNumber) {
      const match = q.quoteNumber.match(/PRE-2026-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxQuoteSeq) {
          maxQuoteSeq = num;
        }
      }
    }
  }
  return `PRE-2026-${String(maxQuoteSeq + 1).padStart(5, '0')}`;
}

export function getAuditLogs(ctx: StoreContext, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role === 'SUPER_ADMIN') {
    return data.auditLogs || [];
  }
  const orgId = effectiveActor?.organizationId || data.organization.id;
  return (data.auditLogs || []).filter((l) => l.organizationId === orgId);
}

export function addAuditLog(ctx: StoreContext, entry: AuditLogInput) {
  const data = ctx.getData();
  const log = {
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: entry.branchId || null,
    userId: entry.userId || null,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId || null,
    ipAddress: entry.ipAddress || '190.52.144.12',
    userAgent: entry.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'OdontoPro Web Client'),
    oldValues: entry.oldValues || null,
    newValues: entry.newValues || null,
    description: entry.description,
    createdAt: new Date(),
  };

  data.auditLogs.unshift(log);
  ctx.notify();
  return log;
}

export function addOrganization(
  ctx: StoreContext,
  newOrg: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId: string;
    countryCode?: string;
    defaultCurrency?: string;
    timezone?: string;
    phone?: string;
    email?: string;
    address?: string;
    primaryColor?: string;
    logoUrl?: string;
    initialAdmin?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
  },
  actor?: BackendActorContext
) {
  if (actor && !hasPermission(actor, 'organization.create')) {
    throw new Error('403 Prohibido: No tiene permisos para registrar nuevas organizaciones médicas.');
  }

  const data = ctx.getData();
  const orgsList = ctx.getOrganizationsList();
  const id = crypto.randomUUID();
  const createdOrg = {
    id,
    code: `ORG-${newOrg.taxId ? newOrg.taxId.replace(/[^A-Za-z0-9]/g, '') : Date.now()}`,
    name: newOrg.name || newOrg.tradeName || 'Nueva Organización',
    legalName: newOrg.legalName || newOrg.name,
    taxId: newOrg.taxId || '80000000-1',
    countryCode: newOrg.countryCode || 'PRY',
    defaultCurrency: newOrg.defaultCurrency || 'PYG',
    timezone: newOrg.timezone || 'America/Asuncion',
    status: 'ACTIVE',
    phone: newOrg.phone || '+595 21 000 000',
    email: newOrg.email || 'contacto@clinica.com.py',
    address: newOrg.address || 'Asunción, Paraguay',
    primaryColor: newOrg.primaryColor || 'teal',
    logoUrl: newOrg.logoUrl,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  orgsList.push(createdOrg);

  const defaultBranchId = crypto.randomUUID();
  const defaultBranch = {
    id: defaultBranchId,
    organizationId: id,
    code: 'SUC-01',
    name: `Casa Central - ${createdOrg.name}`,
    department: 'Capital',
    city: 'Asunción',
    neighborhood: 'Centro',
    address: createdOrg.address,
    phone: createdOrg.phone,
    whatsapp: createdOrg.phone,
    email: createdOrg.email,
    openingTime: '07:30',
    closingTime: '19:30',
    status: 'ACTIVE' as const,
    isMain: true,
    operatingHours: 'Lun a Vie 08:00 - 18:00, Sáb 08:00 - 12:00',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  data.branches.push(defaultBranch);

  data.branchSettings.push({
    id: crypto.randomUUID(),
    branchId: defaultBranchId,
    allowOnlineBooking: true,
    requireDocumentId: true,
    enableWaitlist: true,
    maxOverbookingSlots: 0,
    reminderChannels: ['WHATSAPP', 'EMAIL'],
    defaultAppointmentDurationMinutes: 30,
    cancellationNoticeHours: 24,
    requireDepositForSpecialties: false,
    depositAmountPyg: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const adminEmail =
    newOrg.initialAdmin?.email || (newOrg.email && !ctx.findUserByEmailOrUsername(newOrg.email) ? newOrg.email : null);
  if (adminEmail) {
    const existing = ctx.findUserByEmailOrUsername(adminEmail);
    if (existing) {
      existing.organizationId = id;
      existing.roleId = 'ADMIN_ORGANIZACION';
      data.userBranches = data.userBranches.filter((ub) => ub.userId !== existing.id);
      data.userBranches.push({
        userId: existing.id,
        branchId: defaultBranchId,
        isDefault: true,
        createdAt: new Date(),
      });
    } else {
      const adminUserId = crypto.randomUUID();
      data.users.push({
        id: adminUserId,
        organizationId: id,
        roleId: 'ADMIN_ORGANIZACION',
        firstName: newOrg.initialAdmin?.firstName || 'Administrador',
        lastName: newOrg.initialAdmin?.lastName || createdOrg.name,
        email: adminEmail.toLowerCase().trim(),
        passwordHash: undefined as any,
        phone: newOrg.initialAdmin?.phone || createdOrg.phone,
        professionalLicense: null,
        specialty: 'Administración Clínica',
        status: 'ACTIVE' as const,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      data.userBranches.push({
        userId: adminUserId,
        branchId: defaultBranchId,
        isDefault: true,
        createdAt: new Date(),
      });
    }
  }

  const initialServices = STANDARD_SERVICES.map((s) => ({
    id: crypto.randomUUID(),
    organizationId: id,
    category: s.category,
    code: s.code,
    name: s.name,
    description: s.description,
    defaultDurationMin: s.defaultDurationMin,
    basePrice: s.basePrice,
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (!data.services) data.services = [];
  data.services.push(...initialServices);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: null,
    userId: actor?.userId || data.users[0]?.id || null,
    action: 'CREATE',
    entity: 'ORGANIZATION',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Multi-Tenant Admin',
    oldValues: null,
    newValues: createdOrg,
    description: `Creación de nueva Organización / Cliente: ${createdOrg.name} (RUC: ${createdOrg.taxId})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return createdOrg;
}

export function switchOrganization(ctx: StoreContext, orgId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const orgsList = ctx.getOrganizationsList();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (effectiveActor.organizationId !== orgId) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'ORGANIZATION',
        entityId: orgId,
        userId: effectiveActor.userId,
        description: `Intento denegado de conmutar a organización ajena (${orgId}) por usuario con rol ${effectiveActor.role}.`,
      });
      throw new Error('403 Prohibido: Aislamiento cross-tenant. No tiene acceso a conmutar a otra organización.');
    }
  }

  const target = orgsList.find((o) => o.id === orgId);
  if (!target) return false;

  data.organization = target;

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: target.id,
    branchId: null,
    userId: actor?.userId || null,
    action: 'SWITCH_CONTEXT_ORGANIZATION',
    entity: 'ORGANIZATION',
    entityId: target.id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Context Manager',
    oldValues: null,
    newValues: { activeOrgId: target.id, name: target.name },
    description: `Cambio de contexto activo de navegación a: ${target.name}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function deleteOrganization(ctx: StoreContext, orgId: string, actor?: BackendActorContext): boolean {
  const data = ctx.getData();
  const orgsList = ctx.getOrganizationsList();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    ctx.addAuditLog({
      action: 'ACCESS_DENIED_SECURITY',
      entity: 'ORGANIZATION',
      entityId: orgId,
      userId: effectiveActor.userId,
      description: `Intento denegado de dar de baja la organización (${orgId}) por usuario sin rol SUPER_ADMIN.`,
    });
    throw new Error('403 Prohibido: Solo el Super Administrador tiene autorización para dar de baja organizaciones.');
  }

  if (orgsList.length <= 1) {
    throw new Error('400 Error: No es posible dar de baja la única organización registrada en el sistema.');
  }

  const orgIndex = orgsList.findIndex((o) => o.id === orgId);
  if (orgIndex < 0) {
    throw new Error('404 No encontrado: La organización solicitada no existe.');
  }

  const targetOrg = orgsList[orgIndex];
  targetOrg.status = 'INACTIVE';
  targetOrg.deletedAt = new Date();

  if (data.organization.id === orgId) {
    const nextActive = orgsList.find((o) => o.id !== orgId && o.status === 'ACTIVE') || orgsList[0];
    data.organization = nextActive;
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: orgId,
    branchId: null,
    userId: effectiveActor?.userId || null,
    action: 'DELETE',
    entity: 'ORGANIZATION',
    entityId: orgId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: { status: 'INACTIVE', deletedAt: targetOrg.deletedAt },
    description: `Baja lógica / Inactivación de organización: ${targetOrg.name} (RUC: ${targetOrg.taxId})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function updateOrganization(
  ctx: StoreContext,
  updates: Record<string, any>,
  targetOrgId?: string,
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const orgsList = ctx.getOrganizationsList();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const orgId = targetOrgId || data.organization.id;

  if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
    if (effectiveActor.organizationId !== orgId) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'ORGANIZATION',
        entityId: orgId,
        userId: effectiveActor.userId,
        description: `Intento denegado de modificar organización ajena (${orgId}) por usuario con rol ${effectiveActor.role}.`,
      });
      throw new Error('403 Prohibido: No tiene permisos para modificar organizaciones distintas a la suya.');
    }
  }

  const orgIndex = orgsList.findIndex((o) => o.id === orgId);
  let updatedOrg: any;
  if (orgIndex >= 0) {
    orgsList[orgIndex] = {
      ...orgsList[orgIndex],
      ...updates,
      updatedAt: new Date(),
    };
    updatedOrg = orgsList[orgIndex];
  } else {
    updatedOrg = {
      ...data.organization,
      ...updates,
      id: orgId,
      updatedAt: new Date(),
    };
    orgsList.push(updatedOrg);
  }

  if (data.organization.id === orgId) {
    data.organization = { ...updatedOrg };
  }

  const sanitizedAuditUpdates: any = { ...updates };
  if (
    sanitizedAuditUpdates.logoUrl &&
    typeof sanitizedAuditUpdates.logoUrl === 'string' &&
    sanitizedAuditUpdates.logoUrl.startsWith('data:')
  ) {
    sanitizedAuditUpdates.logoUrl = `[Imagen Logo Base64: ${sanitizedAuditUpdates.logoUrl.length} bytes]`;
  }

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: orgId,
    branchId: null,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'UPDATE',
    entity: 'ORGANIZATION',
    entityId: orgId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: sanitizedAuditUpdates,
    description: `Actualización de parámetros institucionales de la clínica (${updatedOrg.name})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return updatedOrg;
}

export function getBranches(ctx: StoreContext, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const orgId =
    effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
      ? effectiveActor.organizationId
      : data.organization.id;
  let list = data.branches.filter((b) => b.organizationId === orgId);

  if (
    effectiveActor &&
    effectiveActor.role === 'ADMIN_SUCURSAL' &&
    effectiveActor.allowedBranchIds &&
    effectiveActor.allowedBranchIds.length > 0
  ) {
    list = list.filter((b) => effectiveActor.allowedBranchIds?.includes(b.id));
  }

  return list;
}

export function getBranchById(ctx: StoreContext, id: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  const orgId =
    effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
      ? effectiveActor.organizationId
      : data.organization.id;
  const branch = data.branches.find((b) => b.id === id && b.organizationId === orgId);
  if (!branch) return null;

  if (
    effectiveActor &&
    effectiveActor.role === 'ADMIN_SUCURSAL' &&
    effectiveActor.allowedBranchIds &&
    !effectiveActor.allowedBranchIds.includes(id)
  ) {
    return null;
  }
  return branch;
}

export function addBranch(
  ctx: StoreContext,
  newBranch: {
    code: string;
    name: string;
    department: string;
    city: string;
    neighborhood?: string;
    address: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    openingTime?: string;
    closingTime?: string;
    dentalChairsCount?: number;
  },
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);

  if (effectiveActor) {
    if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor, 'branches.create')) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'BRANCH',
        userId: effectiveActor.userId,
        description: `Intento denegado de crear sucursal por usuario ${effectiveActor.userId} con rol ${effectiveActor.role}. Privilegios insuficientes.`,
      });
      throw new Error(
        '403 Prohibido: El Administrador de Sucursal o roles operativos no tienen autorización para crear nuevas sucursales.'
      );
    }
  } else {
    throw new Error('401 No autorizado: Se requiere contexto de usuario para crear sucursales.');
  }

  const id = crypto.randomUUID();
  const branchRecord = {
    id,
    organizationId:
      effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
        ? effectiveActor.organizationId
        : data.organization.id,
    code: newBranch.code.toUpperCase(),
    name: newBranch.name,
    department: newBranch.department,
    city: newBranch.city,
    neighborhood: newBranch.neighborhood || 'Centro',
    address: newBranch.address,
    phone: newBranch.phone,
    whatsapp: newBranch.whatsapp || newBranch.phone,
    email: newBranch.email || `sucursal.${newBranch.code.toLowerCase()}@odontopro.com.py`,
    openingTime: newBranch.openingTime || '07:30',
    closingTime: newBranch.closingTime || '19:30',
    status: 'ACTIVE' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  data.branches.push(branchRecord);

  data.branchSettings.push({
    id: crypto.randomUUID(),
    branchId: id,
    appointmentDurationDefault: 30,
    slotIntervalMinutes: 15,
    allowDoubleBooking: false,
    requireDocumentOnBooking: true,
    maxAdvanceBookingDays: 60,
    receiptSeries: `001-00${data.branches.length}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId: id,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'CREATE',
    entity: 'BRANCH',
    entityId: id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: branchRecord,
    description: `Creación de nueva sucursal clínica: ${newBranch.name} (${newBranch.city}, ${newBranch.department})`,
    createdAt: new Date(),
  });

  ctx.notify();
  return branchRecord;
}

export function updateBranch(
  ctx: StoreContext,
  branchId: string,
  updates: Record<string, any>,
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);

  if (effectiveActor) {
    if (effectiveActor.role === 'ADMIN_SUCURSAL') {
      const allowed = effectiveActor.allowedBranchIds || [];
      if (!allowed.includes(branchId)) {
        ctx.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'BRANCH',
          entityId: branchId,
          userId: effectiveActor.userId,
          description: `Intento denegado de modificar sucursal ajena (${branchId}) por usuario con rol ADMIN_SUCURSAL.`,
        });
        throw new Error(
          '403 Prohibido: El Administrador de Sucursal no puede modificar sucursales ajenas a las asignadas.'
        );
      }
    } else if (!hasPermission(effectiveActor, 'branches.update')) {
      throw new Error('403 Prohibido: No tiene permisos para modificar parámetros de sucursales.');
    }
  }

  const idx = data.branches.findIndex((b) => b.id === branchId);
  if (idx === -1) return null;

  const old = data.branches[idx];
  data.branches[idx] = {
    ...old,
    ...updates,
    updatedAt: new Date(),
  };

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'UPDATE',
    entity: 'BRANCH',
    entityId: branchId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: old,
    newValues: updates,
    description: `Modificación de datos operativos en sucursal ${data.branches[idx].name}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return data.branches[idx];
}

export function deleteBranch(ctx: StoreContext, branchId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);

  if (effectiveActor) {
    if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor, 'branches.delete')) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'BRANCH',
        entityId: branchId,
        userId: effectiveActor.userId,
        description: `Intento denegado de eliminar sucursal ${branchId} por usuario sin rol de alta administración.`,
      });
      throw new Error('403 Prohibido: Solo Administradores Globales u Organizacionales pueden eliminar sucursales.');
    }
  }

  const branch = data.branches.find((b) => b.id === branchId);
  if (!branch) return false;

  data.branches = data.branches.filter((b) => b.id !== branchId);

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId,
    userId: effectiveActor?.userId || null,
    action: 'DELETE',
    entity: 'BRANCH',
    entityId: branchId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: branch,
    newValues: null,
    description: `Eliminación permanente de sucursal ${branch.name}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return true;
}

export function toggleBranchStatus(ctx: StoreContext, branchId: string, actor?: BackendActorContext) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);

  if (effectiveActor) {
    if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor, 'branches.delete')) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'BRANCH',
        entityId: branchId,
        userId: effectiveActor.userId,
        description: `Intento denegado de cambiar estado de sucursal ${branchId} por usuario sin rol de alta administración.`,
      });
      throw new Error(
        '403 Prohibido: Solo Administradores Globales u Organizacionales pueden activar o desactivar sucursales.'
      );
    }
  }

  const branch = data.branches.find((b) => b.id === branchId);
  if (!branch) return null;

  const newStatus = branch.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const);
  branch.status = newStatus;
  branch.updatedAt = new Date();

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'STATUS_CHANGE',
    entity: 'BRANCH',
    entityId: branchId,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: { status: newStatus },
    description: `Cambio de estado de sucursal ${branch.name} a ${newStatus}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return branch;
}

export function getBranchSettings(ctx: StoreContext, branchId: string) {
  return ctx.getData().branchSettings.find((bs) => bs.branchId === branchId);
}

export function updateBranchSettings(
  ctx: StoreContext,
  branchId: string,
  updates: Record<string, any>,
  actor?: BackendActorContext
) {
  const data = ctx.getData();
  const effectiveActor = ctx.getEffectiveActor(actor);
  if (effectiveActor) {
    if (
      effectiveActor.role === 'ADMIN_SUCURSAL' &&
      effectiveActor.allowedBranchIds &&
      !effectiveActor.allowedBranchIds.includes(branchId)
    ) {
      ctx.addAuditLog({
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'BRANCH_SETTINGS',
        entityId: branchId,
        userId: effectiveActor.userId,
        description: `Intento denegado de modificar configuraciones de sucursal ajena (${branchId}) por ADMIN_SUCURSAL ${effectiveActor.userId}.`,
      });
      throw new Error('403 Prohibido: Solo puede configurar parámetros de las sucursales que tiene asignadas.');
    }
  }

  let setting = data.branchSettings.find((bs) => bs.branchId === branchId);
  if (!setting) {
    setting = {
      id: crypto.randomUUID(),
      branchId,
      appointmentDurationDefault: 30,
      slotIntervalMinutes: 15,
      allowDoubleBooking: false,
      requireDocumentOnBooking: true,
      maxAdvanceBookingDays: 60,
      receiptSeries: '001-001',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    data.branchSettings.push(setting);
  }

  Object.assign(setting, updates, { updatedAt: new Date() });

  data.auditLogs.unshift({
    id: crypto.randomUUID(),
    organizationId: data.organization.id,
    branchId,
    userId: effectiveActor?.userId || data.users[0]?.id || null,
    action: 'UPDATE_SETTINGS',
    entity: 'BRANCH_SETTINGS',
    entityId: setting.id,
    ipAddress: '190.52.144.12',
    userAgent: 'OdontoPro Web Admin',
    oldValues: null,
    newValues: updates,
    description: `Actualización de políticas de agendamiento y facturación en sucursal ${branchId}`,
    createdAt: new Date(),
  });

  ctx.notify();
  return setting;
}
