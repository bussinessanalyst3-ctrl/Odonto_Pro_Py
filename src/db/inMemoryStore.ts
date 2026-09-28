import { generateInitialSeedData, SeedDataResult } from './seeds/initial-seed.ts';
import { PARAGUAY_DEPARTMENTS, BASE_ROLES, STANDARD_SERVICES, formatPYG } from './seeds/paraguay-catalogs.ts';
import {
  hasPermission,
  canManageRole,
  isSuperAdminRole,
  getRoleHierarchyLevel,
  ROLE_HIERARCHY,
} from '../security/rbacHierarchy.ts';

export interface BackendActorContext {
  userId: string;
  role: string;
  organizationId: string;
  allowedBranchIds?: string[];
}

const DB_STORAGE_KEY = 'odontopro_db_state_v3';

class DatabaseStore {
  private data!: SeedDataResult;
  private listeners: Array<() => void> = [];
  private revokedUserSessions: Map<string, number> = new Map();
  private organizationsList: Array<any> = [];
  private currentBackendActor: BackendActorContext | null = null;

  constructor() {
    let loadedFromStorage = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(DB_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.data && parsed.organizationsList) {
            this.data = parsed.data;
            this.organizationsList = parsed.organizationsList;
            loadedFromStorage = true;
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo hidratar base de datos desde almacenamiento local:', e);
    }

    if (!loadedFromStorage) {
      this.data = generateInitialSeedData();
      this.organizationsList = [this.data.organization];
    }
  }

  public setBackendActorContext(actor: BackendActorContext | null) {
    this.currentBackendActor = actor;
  }

  public getBackendActorContext(): BackendActorContext | null {
    return this.currentBackendActor;
  }

  private getEffectiveActor(actor?: BackendActorContext | null): BackendActorContext | null {
    return actor || this.currentBackendActor;
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(
          DB_STORAGE_KEY,
          JSON.stringify({
            data: this.data,
            organizationsList: this.organizationsList,
          })
        );
      }
    } catch (e) {
      // Ignore quota exceeded or storage disabled
    }
  }

  public getSnapshot(actor?: BackendActorContext): SeedDataResult {
    const effectiveActor = this.getEffectiveActor(actor);
    const orgId = (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
      ? effectiveActor.organizationId
      : this.data.organization.id;

    const orgBranches = this.data.branches.filter((b) => b.organizationId === orgId);
    const branchIds = new Set(orgBranches.map((b) => b.id));

    let orgUsers = this.data.users.filter((u) => u.organizationId === orgId);
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
      orgUsers = orgUsers.filter((u) => u.roleId !== 'SUPER_ADMIN');
    }

    const orgUserBranches = this.data.userBranches.filter((ub) => branchIds.has(ub.branchId));

    return {
      ...this.data,
      organization: this.data.organization,
      branches: orgBranches,
      users: orgUsers,
      userBranches: orgUserBranches,
      patients: (this.data.patients || []).filter((p) => p.organizationId === orgId),
      dentalChairs: (this.data.dentalChairs || []).filter((c) => c.organizationId === orgId),
      appointments: (this.data.appointments || []).filter((a) => a.organizationId === orgId),
      clinicalRecords: (this.data.clinicalRecords || []).filter((cr) => cr.organizationId === orgId),
      odontograms: (this.data.odontograms || []).filter((o) => o.organizationId === orgId),
      treatments: (this.data.treatments || []).filter((t) => t.organizationId === orgId),
      payments: (this.data.payments || []).filter((p) => p.organizationId === orgId),
      cashRegisters: (this.data.cashRegisters || []).filter((c) => c.organizationId === orgId),
      quotes: (this.data.quotes || []).filter((q) => q.organizationId === orgId),
      auditLogs: (this.data.auditLogs || []).filter((l) => l.organizationId === orgId),
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach(l => l());
  }

  /**
   * Restablecimiento protegido de base de datos a seed inicial.
   * REGLA DE SEGURIDAD: Solo puede ser invocado por SUPER_ADMIN con confirmación explícita o en entorno de tests.
   */
  public resetToSeed(actor?: BackendActorContext | null, allowUnrestrictedForTesting = false) {
    const effectiveActor = this.getEffectiveActor(actor);
    if (!allowUnrestrictedForTesting) {
      if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
        throw new Error('403 Prohibido: Solo el Super Administrador tiene autorización para reinicializar datos a semilla.');
      }
    }

    this.data = generateInitialSeedData();
    this.organizationsList = [this.data.organization];
    this.revokedUserSessions.clear();
    this.saveToStorage();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: effectiveActor?.userId || null,
      action: 'SYSTEM_RESET_SEED',
      entity: 'DATABASE',
      entityId: 'ALL',
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Security Engine',
      oldValues: null,
      newValues: { resetAt: new Date().toISOString() },
      description: 'Restablecimiento de fábrica a catálogo inicial autorizado por Super Administrador',
      createdAt: new Date(),
    });

    this.notify();
  }

  public getActiveOrganization() {
    return this.data.organization;
  }

  public getOrganizations() {
    return this.organizationsList;
  }

  public addOrganization(newOrg: {
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
  }, actor?: BackendActorContext) {
    if (actor && !hasPermission(actor.role, 'organization.create')) {
      throw new Error('403 Prohibido: No tiene permisos para registrar nuevas organizaciones médicas.');
    }

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

    this.organizationsList.push(createdOrg);

    // Crear automáticamente sede principal operativa para la nueva empresa
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
    this.data.branches.push(defaultBranch);

    this.data.branchSettings.push({
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

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: actor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return createdOrg;
  }

  /**
   * CAMBIO EXCLUSIVO DE CONTEXTO ACTIVO.
   * REGLA FUNDAMENTAL: Seleccionar una empresa activa debe ser una acción de CONTEXTO/NAVEGACIÓN,
   * NUNCA una acción de reset, sobrescritura, inicialización o seed.
   */
  public switchOrganization(orgId: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
      // Un usuario que no sea Super Admin no puede conmutar a una organización ajena
      if (effectiveActor.organizationId !== orgId) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'ORGANIZATION',
          entityId: orgId,
          userId: effectiveActor.userId,
          description: `Intento denegado de conmutar a organización ajena (${orgId}) por usuario con rol ${effectiveActor.role}.`,
        });
        throw new Error('403 Prohibido: Aislamiento cross-tenant. No tiene acceso a conmutar a otra organización.');
      }
    }

    const target = this.organizationsList.find((o) => o.id === orgId);
    if (!target) return false;

    // Solo cambia la referencia activa en el almacén de datos (sin mutar configuraciones previas)
    this.data.organization = target;

    this.data.auditLogs.unshift({
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

    this.notify();
    return true;
  }

  public revokeUserSessions(userId: string, adminUserId?: string) {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;

    const revocationTime = Date.now();
    this.revokedUserSessions.set(userId, revocationTime);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: adminUserId || this.data.users[0]?.id || null,
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

    this.notify();
    return true;
  }

  public isSessionRevoked(userId: string, sessionIssuedAtIso: string): boolean {
    const revokedAt = this.revokedUserSessions.get(userId);
    if (!revokedAt) return false;
    const sessionTime = new Date(sessionIssuedAtIso).getTime();
    return sessionTime <= revokedAt;
  }

  // --- GENERACIÓN SEGURA DE CORRELATIVOS (FISCALES / CLÍNICOS) ---
  public getNextReceiptNumber(): string {
    const existingPayments = this.data.payments || [];
    let maxSequential = 4120; // Base inicial del sistema
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

  public getNextInvoiceNumber(): string {
    const existingPayments = this.data.payments || [];
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

  public getNextQuoteNumber(): string {
    const existingQuotes = this.data.quotes || [];
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

  public getBranches(actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const orgId = (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
      ? effectiveActor.organizationId
      : this.data.organization.id;
    let list = this.data.branches.filter(b => b.organizationId === orgId);

    // Si el actor es un rol de sucursal con restricción explícita de sucursales autorizadas
    if (effectiveActor && effectiveActor.role === 'ADMIN_SUCURSAL' && effectiveActor.allowedBranchIds && effectiveActor.allowedBranchIds.length > 0) {
      // Un ADMIN_SUCURSAL únicamente visualiza las sucursales donde está asignado
      list = list.filter(b => effectiveActor.allowedBranchIds?.includes(b.id));
    }

    return list;
  }

  public getBranchById(id: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const orgId = (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
      ? effectiveActor.organizationId
      : this.data.organization.id;
    const branch = this.data.branches.find(b => b.id === id && b.organizationId === orgId);
    if (!branch) return null;

    if (effectiveActor && effectiveActor.role === 'ADMIN_SUCURSAL' && effectiveActor.allowedBranchIds && !effectiveActor.allowedBranchIds.includes(id)) {
      return null; // Prohibido acceso a sucursales ajenas
    }
    return branch;
  }

  public findUserByEmail(email: string) {
    const safeEmail = email.toLowerCase().trim();
    const exact = this.data.users.find((u) => u.email.toLowerCase() === safeEmail);
    if (exact) return exact;

    // Soporte para alias directos de administración
    if (
      safeEmail === 'admin@odontosol.com.py' ||
      safeEmail === 'superadmin@odontosol.com.py' ||
      safeEmail === 'admin@odontopro.com.py' ||
      safeEmail === 'admin' ||
      safeEmail === 'lucas' ||
      safeEmail === 'lucas.arrua'
    ) {
      return this.data.users.find((u) => u.roleId === 'SUPER_ADMIN') || this.data.users[0] || null;
    }

    if (
      safeEmail === 'sofia' ||
      safeEmail === 'sofia.benitez' ||
      safeEmail === 'orgadmin@odontosol.com.py'
    ) {
      return this.data.users.find((u) => u.roleId === 'ADMIN_ORGANIZACION') || null;
    }

    return null;
  }

  /**
   * Obtiene la lista de usuarios con filtrado estricto en backend.
   * REGLA DE PROTECCIÓN FUNDAMENTAL:
   * Si el actor NO es SUPER_ADMIN:
   * 1. Se filtran e invisibilizan TOTALMENTE los usuarios con rol SUPER_ADMIN.
   * 2. Si el actor es ADMIN_SUCURSAL, solo recibe los usuarios pertenecientes a sus sucursales asignadas.
   */
  public getUsers(branchId?: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const orgId = (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
      ? effectiveActor.organizationId
      : this.data.organization.id;
    let orgUsers = this.data.users.filter(u => u.organizationId === orgId);

    // PROTECCIÓN DE PRIVILEGIO: Si el actor no es SUPER_ADMIN, NUNCA se envía SUPER_ADMIN
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
      orgUsers = orgUsers.filter(u => u.roleId !== 'SUPER_ADMIN');
    }

    // AISLAMIENTO DE SUCURSAL PARA BRANCH ADMIN
    if (effectiveActor && effectiveActor.role === 'ADMIN_SUCURSAL' && effectiveActor.allowedBranchIds && effectiveActor.allowedBranchIds.length > 0) {
      const allowedUserIds = new Set(
        this.data.userBranches
          .filter(ub => effectiveActor.allowedBranchIds!.includes(ub.branchId))
          .map(ub => ub.userId)
      );
      orgUsers = orgUsers.filter(u => allowedUserIds.has(u.id));
    }

    if (!branchId) return orgUsers;
    const userIds = this.data.userBranches
      .filter(ub => ub.branchId === branchId)
      .map(ub => ub.userId);
    return orgUsers.filter(u => userIds.includes(u.id));
  }

  public getUserById(id: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const user = this.data.users.find(u => u.id === id);
    if (!user) return null;

    // Si el usuario objetivo es SUPER_ADMIN y el actor no es SUPER_ADMIN, denegar visibilidad
    if (isSuperAdminRole(user.roleId)) {
      if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
        return null;
      }
    }

    return user;
  }

  public getPatients(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgPatients = this.data.patients.filter(p => p.organizationId === orgId);
    if (!branchId) return orgPatients;
    return orgPatients.filter(p => p.primaryBranchId === branchId);
  }

  public getDentalChairs(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgChairs = (this.data.dentalChairs || []).filter(c => c.organizationId === orgId);
    if (!branchId) return orgChairs;
    return orgChairs.filter(c => c.branchId === branchId);
  }

  public getAppointments(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgAppointments = this.data.appointments.filter(a => a.organizationId === orgId);
    if (!branchId) return orgAppointments;
    return orgAppointments.filter(a => a.branchId === branchId);
  }

  public getClinicalRecords(patientId?: string) {
    const orgId = this.data.organization.id;
    const orgRecords = (this.data.clinicalRecords || []).filter(cr => cr.organizationId === orgId);
    if (!patientId) return orgRecords;
    return orgRecords.filter(cr => cr.patientId === patientId);
  }

  public getOdontograms(patientId?: string) {
    const orgId = this.data.organization.id;
    const orgOdontograms = (this.data.odontograms || []).filter(o => o.organizationId === orgId);
    if (!patientId) return orgOdontograms;
    return orgOdontograms.filter(o => o.patientId === patientId);
  }

  public getOdontogramItems(odontogramId?: string) {
    if (!odontogramId) return this.data.odontogramItems || [];
    return (this.data.odontogramItems || []).filter(oi => oi.odontogramId === odontogramId);
  }

  public getServices() {
    const orgId = this.data.organization.id;
    return this.data.services.filter(s => s.organizationId === orgId);
  }

  public getTreatments(branchId?: string, patientId?: string) {
    const orgId = this.data.organization.id;
    let list = (this.data.treatments || []).filter(t => t.organizationId === orgId);
    if (branchId) list = list.filter(t => t.branchId === branchId);
    if (patientId) list = list.filter(t => t.patientId === patientId);
    return list;
  }

  public getPayments(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgPayments = (this.data.payments || []).filter(p => p.organizationId === orgId);
    if (!branchId) return orgPayments;
    return orgPayments.filter(p => p.branchId === branchId);
  }

  public getCashRegisters(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgRegisters = (this.data.cashRegisters || []).filter(c => c.organizationId === orgId);
    if (!branchId) return orgRegisters;
    return orgRegisters.filter(c => c.branchId === branchId);
  }

  public getCashMovements(cashRegisterId?: string) {
    if (!cashRegisterId) return this.data.cashMovements || [];
    return (this.data.cashMovements || []).filter(m => m.cashRegisterId === cashRegisterId);
  }

  public getQuotes(branchId?: string) {
    const orgId = this.data.organization.id;
    const orgQuotes = (this.data.quotes || []).filter(q => q.organizationId === orgId);
    if (!branchId) return orgQuotes;
    return orgQuotes.filter(q => q.branchId === branchId);
  }

  public getQuoteItems(quoteId?: string) {
    if (!quoteId) return this.data.quoteItems || [];
    return (this.data.quoteItems || []).filter(qi => qi.quoteId === quoteId);
  }

  public getBranchServices(branchId?: string) {
    if (!branchId) return this.data.branchServices || [];
    return (this.data.branchServices || []).filter(bs => bs.branchId === branchId);
  }

  public getOrganization() {
    return this.data.organization;
  }

  public getAuditLogs() {
    const orgId = this.data.organization.id;
    return (this.data.auditLogs || []).filter(l => l.organizationId === orgId);
  }

  public addAuditLog(entry: {
    action: string;
    entity: string;
    entityId?: string | null;
    userId?: string | null;
    branchId?: string | null;
    description: string;
    oldValues?: any;
    newValues?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const log = {
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
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

    this.data.auditLogs.unshift(log);
    this.notify();
    return log;
  }

  public updateOrganization(updates: Partial<typeof this.data.organization>) {
    this.data.organization = {
      ...this.data.organization,
      ...updates,
      updatedAt: new Date(),
    };

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: this.data.users[0]?.id || null,
      action: 'UPDATE',
      entity: 'ORGANIZATION',
      entityId: this.data.organization.id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: null,
      newValues: updates,
      description: `Actualización de parámetros institucionales de la clínica (${this.data.organization.name})`,
      createdAt: new Date(),
    });

    this.notify();
    return this.data.organization;
  }

  public addBranch(newBranch: {
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
  }, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);

    // REGLA DE SEGURIDAD N° 1: Un Administrador de Sucursal (ADMIN_SUCURSAL) o roles operativos
    // NO tienen permitido crear nuevas sucursales bajo ninguna circunstancia.
    if (effectiveActor) {
      if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor.role, 'branches.create')) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'BRANCH',
          userId: effectiveActor.userId,
          description: `Intento denegado de crear sucursal por usuario ${effectiveActor.userId} con rol ${effectiveActor.role}. Privilegios insuficientes.`,
        });
        throw new Error('403 Prohibido: El Administrador de Sucursal o roles operativos no tienen autorización para crear nuevas sucursales.');
      }
    } else {
      throw new Error('401 No autorizado: Se requiere contexto de usuario para crear sucursales.');
    }

    const id = `branch-${newBranch.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`;
    const branchRecord = {
      id,
      organizationId: (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
        ? effectiveActor.organizationId
        : this.data.organization.id,
      code: newBranch.code.toUpperCase(),
      name: newBranch.name,
      department: newBranch.department,
      city: newBranch.city,
      neighborhood: newBranch.neighborhood || 'Centro',
      address: newBranch.address,
      phone: newBranch.phone,
      whatsapp: newBranch.whatsapp || newBranch.phone,
      email: newBranch.email || `sucursal.${newBranch.code.toLowerCase()}@odontosol.com.py`,
      openingTime: newBranch.openingTime || '07:30',
      closingTime: newBranch.closingTime || '19:30',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.branches.push(branchRecord);

    // Initial branch settings
    this.data.branchSettings.push({
      id: crypto.randomUUID(),
      branchId: id,
      appointmentDurationDefault: 30,
      slotIntervalMinutes: 15,
      allowDoubleBooking: false,
      requireDocumentOnBooking: true,
      maxAdvanceBookingDays: 60,
      receiptSeries: `001-00${this.data.branches.length}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Auditoría
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: id,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return branchRecord;
  }

  public updateBranch(branchId: string, updates: Partial<(typeof this.data.branches)[0]>, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);

    // REGLA DE SEGURIDAD: Un Administrador de Sucursal solo puede modificar su propia sucursal asignada
    if (effectiveActor) {
      if (effectiveActor.role === 'ADMIN_SUCURSAL') {
        const allowed = effectiveActor.allowedBranchIds || [];
        if (!allowed.includes(branchId)) {
          this.addAuditLog({
            action: 'ACCESS_DENIED_SECURITY',
            entity: 'BRANCH',
            entityId: branchId,
            userId: effectiveActor.userId,
            description: `Intento denegado de modificar sucursal ajena (${branchId}) por usuario con rol ADMIN_SUCURSAL.`,
          });
          throw new Error('403 Prohibido: El Administrador de Sucursal no puede modificar sucursales ajenas a las asignadas.');
        }
      } else if (!hasPermission(effectiveActor.role, 'branches.update')) {
        throw new Error('403 Prohibido: No tiene permisos para modificar parámetros de sucursales.');
      }
    }

    const idx = this.data.branches.findIndex((b) => b.id === branchId);
    if (idx === -1) return null;

    const old = this.data.branches[idx];
    this.data.branches[idx] = {
      ...old,
      ...updates,
      updatedAt: new Date(),
    };

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
      action: 'UPDATE',
      entity: 'BRANCH',
      entityId: branchId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: old,
      newValues: updates,
      description: `Modificación de datos operativos en sucursal ${this.data.branches[idx].name}`,
      createdAt: new Date(),
    });

    this.notify();
    return this.data.branches[idx];
  }

  public deleteBranch(branchId: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);

    if (effectiveActor) {
      if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor.role, 'branches.delete')) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'BRANCH',
          entityId: branchId,
          userId: effectiveActor.userId,
          description: `Intento denegado de eliminar sucursal ${branchId} por usuario sin rol de alta administración.`,
        });
        throw new Error('403 Prohibido: Solo Administradores Globales u Organizacionales pueden eliminar sucursales.');
      }
    }

    const branch = this.data.branches.find((b) => b.id === branchId);
    if (!branch) return false;

    this.data.branches = this.data.branches.filter((b) => b.id !== branchId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
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

    this.notify();
    return true;
  }

  public toggleBranchStatus(branchId: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);

    if (effectiveActor) {
      if (effectiveActor.role === 'ADMIN_SUCURSAL' || !hasPermission(effectiveActor.role, 'branches.delete')) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'BRANCH',
          entityId: branchId,
          userId: effectiveActor.userId,
          description: `Intento denegado de cambiar estado de sucursal ${branchId} por usuario sin rol de alta administración.`,
        });
        throw new Error('403 Prohibido: Solo Administradores Globales u Organizacionales pueden activar o desactivar sucursales.');
      }
    }

    const branch = this.data.branches.find((b) => b.id === branchId);
    if (!branch) return null;

    const newStatus = branch.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const);
    branch.status = newStatus;
    branch.updatedAt = new Date();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return branch;
  }

  public getBranchSettings(branchId: string) {
    return this.data.branchSettings.find((bs) => bs.branchId === branchId);
  }

  public updateBranchSettings(
    branchId: string,
    updates: Partial<(typeof this.data.branchSettings)[0]>,
    actor?: BackendActorContext
  ) {
    const effectiveActor = this.getEffectiveActor(actor);
    if (effectiveActor) {
      if (
        effectiveActor.role === 'ADMIN_SUCURSAL' &&
        effectiveActor.allowedBranchIds &&
        !effectiveActor.allowedBranchIds.includes(branchId)
      ) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'BRANCH_SETTINGS',
          entityId: branchId,
          userId: effectiveActor.userId,
          description: `Intento denegado de modificar configuraciones de sucursal ajena (${branchId}) por ADMIN_SUCURSAL ${effectiveActor.userId}.`,
        });
        throw new Error(
          '403 Prohibido: Solo puede configurar parámetros de las sucursales que tiene asignadas.'
        );
      }
    }

    let setting = this.data.branchSettings.find((bs) => bs.branchId === branchId);
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
      this.data.branchSettings.push(setting);
    }

    Object.assign(setting, updates, { updatedAt: new Date() });

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return setting;
  }

  // --- FASE 5: GESTIÓN DE USUARIOS & PERMISOS (RBAC) ---
  public addUser(newUser: {
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    phone: string;
    specialty?: string;
    professionalLicense?: string;
    branchIds: string[];
    defaultBranchId?: string;
  }, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);

    // REGLA DE SEGURIDAD N° 2: Jerarquía estricta al crear usuarios
    // Ningún rol inferior puede crear administradores superiores ni SUPER_ADMIN.
    if (effectiveActor) {
      if (isSuperAdminRole(newUser.roleId) && effectiveActor.role !== 'SUPER_ADMIN') {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          userId: effectiveActor.userId,
          description: `Intento denegado de crear usuario SUPER_ADMIN por usuario con rol inferior ${effectiveActor.role}.`,
        });
        throw new Error('403 Prohibido: Solo un Super Administrador puede crear cuentas con rol SUPER_ADMIN.');
      }

      if (!canManageRole(effectiveActor.role, newUser.roleId)) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          userId: effectiveActor.userId,
          description: `Intento denegado de crear usuario con rol ${newUser.roleId} por actor con rol ${effectiveActor.role}. Violación jerárquica.`,
        });
        throw new Error(`403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para crear usuarios con rol ${newUser.roleId}.`);
      }
    }

    const id = crypto.randomUUID();
    const userRecord = {
      id,
      organizationId: (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN')
        ? effectiveActor.organizationId
        : this.data.organization.id,
      roleId: newUser.roleId,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email.toLowerCase().trim(),
      passwordHash: '$2b$10$e8wDbgW2n2v19WfG7h.HquK9eR6q7yB3e1gL2m1p0o9n8b7v6c5x4',
      phone: newUser.phone,
      professionalLicense: newUser.professionalLicense?.trim() || null,
      specialty: newUser.specialty?.trim() || 'Odontología General',
      status: 'ACTIVE' as const,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.users.push(userRecord);

    const activeBranches = this.getBranches(effectiveActor || undefined);
    const safeDefault = newUser.defaultBranchId || newUser.branchIds[0] || activeBranches[0]?.id || this.data.branches[0]?.id;
    newUser.branchIds.forEach((bId) => {
      this.data.userBranches.push({
        userId: id,
        branchId: bId,
        isDefault: bId === safeDefault,
        createdAt: new Date(),
      });
    });

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: safeDefault,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
      action: 'CREATE',
      entity: 'USER',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: null,
      newValues: {
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        role: newUser.roleId,
        license: newUser.professionalLicense,
        branches: newUser.branchIds,
      },
      description: `Alta de usuario institucional: ${newUser.firstName} ${newUser.lastName} (${newUser.roleId})`,
      createdAt: new Date(),
    });

    this.notify();
    return userRecord;
  }

  public updateUser(
    userId: string,
    updates: Partial<(typeof this.data.users)[0]> & {
      branchIds?: string[];
      defaultBranchId?: string;
    },
    actor?: BackendActorContext
  ) {
    const effectiveActor = this.getEffectiveActor(actor);
    const idx = this.data.users.findIndex((u) => u.id === userId);
    if (idx === -1) return null;

    const targetUser = this.data.users[idx];

    // REGLA DE SEGURIDAD N° 2: Protección del SUPER_ADMIN y jerarquía
    if (effectiveActor) {
      // 1. Prohibido que un usuario no-SUPER_ADMIN modifique a un SUPER_ADMIN
      if (isSuperAdminRole(targetUser.roleId) && effectiveActor.role !== 'SUPER_ADMIN') {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: targetUser.id,
          userId: effectiveActor.userId,
          description: `Intento denegado de modificar al SUPER_ADMIN por usuario con rol ${effectiveActor.role}. Acción bloqueada.`,
        });
        throw new Error('403 Prohibido: El Super Administrador es un usuario protegido y no puede ser modificado por roles inferiores.');
      }

      // 2. Prohibido auto-elevarse a SUPER_ADMIN o promover a roles superiores a los del actor
      if (updates.roleId && updates.roleId !== targetUser.roleId) {
        if (updates.roleId === 'SUPER_ADMIN' && effectiveActor.role !== 'SUPER_ADMIN') {
          this.addAuditLog({
            action: 'ACCESS_DENIED_SECURITY',
            entity: 'USER',
            entityId: targetUser.id,
            userId: effectiveActor.userId,
            description: `Intento denegado de escalar privilegios al rol SUPER_ADMIN por usuario ${effectiveActor.userId}.`,
          });
          throw new Error('403 Prohibido: Escalamiento de privilegios no autorizado. No puede asignar el rol SUPER_ADMIN.');
        }

        if (!canManageRole(effectiveActor.role, updates.roleId)) {
          throw new Error(`403 Prohibido: No tiene jerarquía para asignar el rol ${updates.roleId}.`);
        }
      }

      // 3. Prohibido modificar a usuarios de jerarquía igual o superior
      if (effectiveActor.userId !== targetUser.id && !canManageRole(effectiveActor.role, targetUser.roleId)) {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: targetUser.id,
          userId: effectiveActor.userId,
          description: `Intento denegado de modificar a usuario con rol ${targetUser.roleId} por rol ${effectiveActor.role}. Jerarquía insuficiente.`,
        });
        throw new Error(`403 Prohibido: El rol ${effectiveActor.role} no tiene jerarquía para modificar usuarios con rol ${targetUser.roleId}.`);
      }
    }

    const old = { ...this.data.users[idx] };
    const { branchIds, defaultBranchId, ...userProps } = updates;

    this.data.users[idx] = {
      ...this.data.users[idx],
      ...userProps,
      updatedAt: new Date(),
    };

    if (branchIds && branchIds.length > 0) {
      this.data.userBranches = this.data.userBranches.filter((ub) => ub.userId !== userId);
      const safeDefault = defaultBranchId || branchIds[0];
      branchIds.forEach((bId) => {
        this.data.userBranches.push({
          userId,
          branchId: bId,
          isDefault: bId === safeDefault,
          createdAt: new Date(),
        });
      });
    }

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: this.data.userBranches.find((ub) => ub.userId === userId)?.branchId || null,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
      action: 'UPDATE',
      entity: 'USER',
      entityId: userId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: old,
      newValues: updates,
      description: `Modificación de perfil y permisos para ${this.data.users[idx].firstName} ${this.data.users[idx].lastName}`,
      createdAt: new Date(),
    });

    this.notify();
    return this.data.users[idx];
  }

  public toggleUserStatus(userId: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;

    // REGLA DE SEGURIDAD N° 2: Protección contra desactivación de SUPER_ADMIN
    if (isSuperAdminRole(user.roleId)) {
      if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: user.id,
          userId: effectiveActor?.userId || null,
          description: `Intento denegado de inactivar al Super Administrador (${user.email}) por usuario con rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
        });
        throw new Error('403 Prohibido: El usuario Super Administrador está protegido y no puede ser desactivado por administradores inferiores.');
      }
    }

    if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
      throw new Error(`403 Prohibido: No tiene jerarquía suficiente para cambiar el estado de acceso de este usuario (${user.roleId}).`);
    }

    const newStatus = user.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const);
    user.status = newStatus;
    user.updatedAt = new Date();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return user;
  }

  public getRoles() {
    return this.data.roles;
  }

  public addRole(roleData: {
    id: string;
    name: string;
    description: string;
    allowedNavTabs?: string[];
    permissions?: string[];
  }) {
    const roleId = roleData.id.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
    const existing = this.data.roles.find((r) => r.id === roleId);
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

    this.data.roles.push(newRole);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: this.data.users[0]?.id || null,
      action: 'CREATE',
      entity: 'ROLE',
      entityId: roleId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: null,
      newValues: newRole,
      description: `Creación de nuevo rol institucional: "${newRole.name}" (${newRole.id}) con ${newRole.allowedNavTabs.length} módulos habilitados`,
      createdAt: new Date(),
    });

    this.notify();
    return newRole;
  }

  public updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      allowedNavTabs?: string[];
      permissions?: string[];
    }
  ) {
    const idx = this.data.roles.findIndex((r) => r.id === roleId);
    if (idx === -1) return null;

    const old = { ...this.data.roles[idx] };
    this.data.roles[idx] = {
      ...this.data.roles[idx],
      name: updates.name !== undefined ? updates.name.trim() : this.data.roles[idx].name,
      description: updates.description !== undefined ? updates.description.trim() : this.data.roles[idx].description,
      allowedNavTabs: updates.allowedNavTabs || this.data.roles[idx].allowedNavTabs || [],
      permissions: updates.permissions || (this.data.roles[idx] as any).permissions || ROLE_HIERARCHY[roleId]?.permissions || [],
    };

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: this.data.users[0]?.id || null,
      action: 'UPDATE',
      entity: 'ROLE',
      entityId: roleId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Admin',
      oldValues: old,
      newValues: updates,
      description: `Actualización de permisos y configuración para rol ${this.data.roles[idx].name} (${roleId})`,
      createdAt: new Date(),
    });

    this.notify();
    return this.data.roles[idx];
  }

  public getRolePermissions(roleId: string): string[] {
    const role = this.data.roles.find((r) => r.id === roleId);
    if (role && (role as any).permissions && Array.isArray((role as any).permissions)) {
      return (role as any).permissions;
    }
    return ROLE_HIERARCHY[roleId]?.permissions || [];
  }

  public updateRolePermissions(roleId: string, permissions: string[], actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN' && !hasPermission(effectiveActor.role, 'roles.manage')) {
      throw new Error('403 Prohibido: Solo el Super Administrador o usuarios con permiso de autoridad pueden modificar la matriz de permisos.');
    }

    const idx = this.data.roles.findIndex((r) => r.id === roleId);
    if (idx === -1) {
      throw new Error(`Rol no encontrado: ${roleId}`);
    }

    // Proteger SUPER_ADMIN para que mantenga system.all
    let finalPermissions = [...permissions];
    if (roleId === 'SUPER_ADMIN' && !finalPermissions.includes('system.all')) {
      finalPermissions.unshift('system.all');
    }

    const oldPerms = (this.data.roles[idx] as any).permissions || ROLE_HIERARCHY[roleId]?.permissions || [];
    (this.data.roles[idx] as any).permissions = finalPermissions;

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
      action: 'ROLE_PERMISSIONS_UPDATE',
      entity: 'ROLE_PERMISSIONS',
      entityId: roleId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro RBAC Matrix',
      oldValues: { count: oldPerms.length, permissions: oldPerms },
      newValues: { count: finalPermissions.length, permissions: finalPermissions },
      description: `Actualización de matriz de permisos para rol ${this.data.roles[idx].name} (${roleId}): ${finalPermissions.length} permisos habilitados.`,
      createdAt: new Date(),
    });

    this.notify();
    return finalPermissions;
  }

  public resetRolePermissionsToDefault(roleId: string, actor?: BackendActorContext) {
    const defaultPerms = ROLE_HIERARCHY[roleId]?.permissions || [];
    return this.updateRolePermissions(roleId, defaultPerms, actor);
  }

  public deleteRole(roleId: string) {
    const role = this.data.roles.find((r) => r.id === roleId);
    if (!role) return false;
    if (role.isSystem) {
      throw new Error(`El rol base de sistema ${role.name} está protegido y no puede ser eliminado.`);
    }

    const assignedUsers = this.data.users.filter((u) => u.roleId === roleId);
    if (assignedUsers.length > 0) {
      throw new Error(`No se puede eliminar el rol ${role.name} porque hay ${assignedUsers.length} usuario(s) asignados.`);
    }

    this.data.roles = this.data.roles.filter((r) => r.id !== roleId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: this.data.users[0]?.id || null,
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

    this.notify();
    return true;
  }

  public resetUserPassword(userId: string, actor?: BackendActorContext) {
    const effectiveActor = this.getEffectiveActor(actor);
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;

    if (isSuperAdminRole(user.roleId)) {
      if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: user.id,
          userId: effectiveActor?.userId || null,
          description: `Intento denegado de restablecer al Super Administrador (${user.email}) por usuario con rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
        });
        throw new Error('403 Prohibido: El Super Administrador es un usuario protegido y no puede ser restablecido por roles inferiores.');
      }
    }

    if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
      throw new Error(`403 Prohibido: No tiene jerarquía para restablecer las credenciales de este usuario (${user.roleId}).`);
    }

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return true;
  }

  public setUserPasswordHash(
    userId: string,
    record: { hash: string; salt: string; iterations: number },
    actor?: BackendActorContext
  ) {
    const effectiveActor = this.getEffectiveActor(actor);
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;

    if (isSuperAdminRole(user.roleId)) {
      if (!effectiveActor || effectiveActor.role !== 'SUPER_ADMIN') {
        this.addAuditLog({
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'USER',
          entityId: user.id,
          userId: effectiveActor?.userId || null,
          description: `Intento denegado de modificar credenciales criptográficas del Super Administrador por rol ${effectiveActor?.role || 'DESCONOCIDO'}.`,
        });
        throw new Error('403 Prohibido: El Super Administrador es un usuario protegido y no puede ser modificado por roles inferiores.');
      }
    }

    if (effectiveActor && effectiveActor.userId !== user.id && !canManageRole(effectiveActor.role, user.roleId)) {
      throw new Error(`403 Prohibido: No tiene jerarquía para modificar credenciales de este usuario (${user.roleId}).`);
    }

    // Almacenar en el usuario
    (user as any).passwordHash = record.hash;
    (user as any).passwordSalt = record.salt;
    (user as any).passwordIterations = record.iterations;
    (user as any).updatedAt = new Date();

    // Guardar también en localStorage para persistencia segura en el navegador
    try {
      const key = `odontopro_user_pwd_hash_${user.email.toLowerCase()}`;
      localStorage.setItem(
        key,
        JSON.stringify({
          hash: record.hash,
          salt: record.salt,
          iterations: record.iterations,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {}

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: effectiveActor?.userId || this.data.users[0]?.id || null,
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

    this.notify();
    return true;
  }

  public getUserPasswordRecord(email: string, actor?: BackendActorContext): { hash: string; salt: string; iterations: number } | null {
    const effectiveActor = this.getEffectiveActor(actor);
    const safeEmail = email.toLowerCase().trim();
    const user = this.data.users.find((u) => u.email.toLowerCase() === safeEmail);

    if (user && isSuperAdminRole(user.roleId)) {
      if (effectiveActor && effectiveActor.role !== 'SUPER_ADMIN') {
        return null; // Oculto para roles no autorizados
      }
    }

    // 1. Revisar en localStorage si hay hash actualizado
    try {
      const key = `odontopro_user_pwd_hash_${safeEmail}`;
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    } catch (e) {}

    // 2. Revisar en memoria
    if (user && (user as any).passwordSalt && (user as any).passwordHash) {
      return {
        hash: (user as any).passwordHash,
        salt: (user as any).passwordSalt,
        iterations: (user as any).passwordIterations || 100000,
      };
    }

    return null;
  }

  // --- FASE 6: GESTIÓN DE PACIENTES (FICHA CLÍNICA ÚNICA) ---
  public updatePatient(patientId: string, updates: Partial<(typeof this.data.patients)[0]>) {
    const idx = this.data.patients.findIndex((p) => p.id === patientId);
    if (idx === -1) return null;

    const old = { ...this.data.patients[idx] };
    this.data.patients[idx] = {
      ...old,
      ...updates,
      updatedAt: new Date(),
    };

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: this.data.patients[idx].primaryBranchId,
      userId: this.data.users[0]?.id || null,
      action: 'UPDATE',
      entity: 'PATIENT',
      entityId: patientId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: old,
      newValues: updates,
      description: `Actualización de Ficha Clínica del paciente ${this.data.patients[idx].firstName} ${this.data.patients[idx].lastName} (C.I. ${this.data.patients[idx].documentNumber})`,
      createdAt: new Date(),
    });

    this.notify();
    return this.data.patients[idx];
  }

  public togglePatientStatus(patientId: string) {
    const pat = this.data.patients.find((p) => p.id === patientId);
    if (!pat) return null;

    const newStatus = pat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    pat.status = newStatus;
    pat.updatedAt = new Date();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: pat.primaryBranchId,
      userId: this.data.users[0]?.id || null,
      action: 'STATUS_CHANGE',
      entity: 'PATIENT',
      entityId: patientId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: null,
      newValues: { status: newStatus },
      description: `Cambio de estado de ficha clínica para ${pat.firstName} ${pat.lastName} a ${newStatus}`,
      createdAt: new Date(),
    });

    this.notify();
    return pat;
  }

  public addPatientVisit(patientId: string, branchId: string) {
    const existing = this.data.patientBranches.find(
      (pb) => pb.patientId === patientId && pb.branchId === branchId
    );
    const todayStr = new Date().toISOString().split('T')[0];
    if (existing) {
      existing.lastVisitDate = todayStr;
    } else {
      this.data.patientBranches.push({
        patientId,
        branchId,
        firstVisitDate: todayStr,
        lastVisitDate: todayStr,
      });
    }
    this.notify();
  }

  public addPatient(newPatient: {
    documentNumber: string;
    documentType: string;
    firstName: string;
    lastName: string;
    phone: string;
    primaryBranchId: string;
    department?: string;
    city?: string;
    allergies?: string;
  }) {
    const id = crypto.randomUUID();
    const patientRecord = {
      id,
      organizationId: this.data.organization.id,
      primaryBranchId: newPatient.primaryBranchId,
      documentType: newPatient.documentType || 'CI',
      documentNumber: newPatient.documentNumber,
      firstName: newPatient.firstName,
      lastName: newPatient.lastName,
      birthDate: '1995-01-01',
      gender: 'NO_ESPECIFICA',
      phone: newPatient.phone,
      whatsapp: newPatient.phone,
      email: `${newPatient.firstName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
      department: newPatient.department || 'Central',
      city: newPatient.city || 'San Lorenzo',
      neighborhood: 'Centro',
      address: 'Calle principal',
      emergencyContactName: 'Familiar directo',
      emergencyContactPhone: newPatient.phone,
      bloodType: 'O+',
      allergies: newPatient.allergies || 'Ninguna conocida',
      medicalConditions: 'Ninguna',
      medications: 'Ninguna',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.patients.unshift(patientRecord);
    this.data.patientBranches.push({
      patientId: id,
      branchId: newPatient.primaryBranchId,
      firstVisitDate: new Date().toISOString().split('T')[0],
      lastVisitDate: new Date().toISOString().split('T')[0],
    });

    // Auditoría
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: newPatient.primaryBranchId,
      userId: this.data.users[0]?.id,
      action: 'CREATE',
      entity: 'PATIENT',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: null,
      newValues: { firstName: newPatient.firstName, lastName: newPatient.lastName, doc: newPatient.documentNumber },
      description: `Registro de nuevo paciente ${newPatient.firstName} ${newPatient.lastName} (CI: ${newPatient.documentNumber})`,
      createdAt: new Date(),
    });

    this.notify();
    return patientRecord;
  }

  public recordPatientBranchVisit(patientId: string, branchId: string) {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.data.patientBranches.find(
      (pb) => pb.patientId === patientId && pb.branchId === branchId
    );
    if (existing) {
      existing.lastVisitDate = today;
    } else {
      this.data.patientBranches.push({
        patientId,
        branchId,
        firstVisitDate: today,
        lastVisitDate: today,
      });
    }
  }

  public checkDoubleBooking(params: {
    branchId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    odontologistId?: string;
    dentalChairId?: string;
    excludeAppointmentId?: string;
  }): { hasConflict: boolean; reason?: string } {
    const settings = this.getBranchSettings(params.branchId);
    if (settings && settings.allowDoubleBooking) {
      return { hasConflict: false };
    }

    const startMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const newStart = startMinutes(params.startTime);
    const newEnd = startMinutes(params.endTime);

    // Active appointments that occupy time
    const activeAppointments = this.data.appointments.filter((a) => {
      if (a.id === params.excludeAppointmentId) return false;
      if (a.branchId !== params.branchId) return false;
      if (a.appointmentDate !== params.appointmentDate) return false;
      if (a.status === 'CANCELADA' || a.status === 'NO_ASISTIO') return false;
      return true;
    });

    for (const existing of activeAppointments) {
      const exStart = startMinutes(existing.startTime);
      const exEnd = startMinutes(existing.endTime);

      const timesOverlap = (newStart < exEnd) && (newEnd > exStart);
      if (timesOverlap) {
        // Check odontologist collision
        if (params.odontologistId && existing.odontologistId === params.odontologistId) {
          const doc = this.data.users.find(u => u.id === params.odontologistId);
          return {
            hasConflict: true,
            reason: `Conflicto de agenda: El Dr(a). ${doc?.firstName || ''} ${doc?.lastName || ''} ya tiene una cita asignada de ${existing.startTime.slice(0, 5)} a ${existing.endTime.slice(0, 5)}.`,
          };
        }

        // Check dental chair collision
        if (params.dentalChairId && existing.dentalChairId && existing.dentalChairId === params.dentalChairId) {
          const chair = (this.data.dentalChairs || []).find(c => c.id === params.dentalChairId);
          return {
            hasConflict: true,
            reason: `Conflicto de sillón: El ${chair?.name || 'Sillón Seleccionado'} ya está ocupado en ese horario (${existing.startTime.slice(0, 5)} - ${existing.endTime.slice(0, 5)}).`,
          };
        }
      }
    }

    return { hasConflict: false };
  }

  public addAppointment(appointment: {
    branchId: string;
    dentalChairId?: string;
    patientId: string;
    odontologistId: string;
    serviceId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    reason: string;
    notes?: string;
    actorUserId?: string;
  }) {
    // Strict Double Booking Validation
    const conflictCheck = this.checkDoubleBooking({
      branchId: appointment.branchId,
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      odontologistId: appointment.odontologistId,
      dentalChairId: appointment.dentalChairId,
    });

    if (conflictCheck.hasConflict) {
      throw new Error(conflictCheck.reason || 'Doble reserva detectada en el servidor.');
    }

    const id = crypto.randomUUID();
    const record = {
      id,
      organizationId: this.data.organization.id,
      branchId: appointment.branchId,
      dentalChairId: appointment.dentalChairId || null,
      patientId: appointment.patientId,
      odontologistId: appointment.odontologistId,
      serviceId: appointment.serviceId,
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      durationMin: appointment.durationMin,
      status: 'PENDIENTE',
      reason: appointment.reason,
      notes: appointment.notes || 'Turno registrado vía panel de agendamiento.',
      createdBy: appointment.actorUserId || this.data.users[3]?.id, // Recepción
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.data.appointments.unshift(record);

    // Record branch visit for patient if not recorded
    this.recordPatientBranchVisit(appointment.patientId, appointment.branchId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: appointment.branchId,
      userId: appointment.actorUserId || this.data.users[3]?.id,
      action: 'CREATE',
      entity: 'APPOINTMENT',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: null,
      newValues: record,
      description: `Agendamiento de turno odontológico para fecha ${appointment.appointmentDate} a las ${appointment.startTime.slice(0, 5)} hs (Zona America/Asuncion)`,
      createdAt: new Date(),
    });

    this.notify();
    return record;
  }

  public updateAppointmentStatus(
    appointmentId: string,
    newStatus: 'PENDIENTE' | 'CONFIRMADA' | 'EN_SALA' | 'EN_ATENCION' | 'FINALIZADA' | 'CANCELADA' | 'NO_ASISTIO',
    cancellationReason?: string,
    actorUserId?: string
  ) {
    const app = this.data.appointments.find((a) => a.id === appointmentId);
    if (!app) return null;

    const oldStatus = app.status;
    app.status = newStatus;
    if (cancellationReason) {
      app.cancellationReason = cancellationReason;
    }
    app.updatedAt = new Date();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: app.branchId,
      userId: actorUserId || this.data.users[3]?.id,
      action: 'STATUS_CHANGE',
      entity: 'APPOINTMENT',
      entityId: appointmentId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Client',
      oldValues: { status: oldStatus },
      newValues: { status: newStatus, cancellationReason },
      description: `Cambio de estado de turno a "${newStatus}"${cancellationReason ? ` (Motivo: ${cancellationReason})` : ''}`,
      createdAt: new Date(),
    });

    this.notify();
    return app;
  }

  public addClinicalRecord(record: {
    branchId: string;
    patientId: string;
    odontologistId: string;
    appointmentId?: string;
    reasonForConsultation: string;
    diagnosis: string;
    treatmentPerformed: string;
    prescriptions?: string;
    recommendations?: string;
    internalNotes?: string;
    actorUserId?: string;
  }) {
    const id = crypto.randomUUID();
    const newRecord = {
      id,
      organizationId: this.data.organization.id,
      branchId: record.branchId,
      patientId: record.patientId,
      odontologistId: record.odontologistId,
      appointmentId: record.appointmentId || null,
      reasonForConsultation: record.reasonForConsultation,
      diagnosis: record.diagnosis,
      treatmentPerformed: record.treatmentPerformed,
      prescriptions: record.prescriptions || '',
      recommendations: record.recommendations || '',
      internalNotes: record.internalNotes || '',
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.data.clinicalRecords) {
      this.data.clinicalRecords = [];
    }
    this.data.clinicalRecords.unshift(newRecord);

    // If linked to appointment, set appointment to FINALIZADA
    if (record.appointmentId) {
      const app = this.data.appointments.find((a) => a.id === record.appointmentId);
      if (app && app.status !== 'FINALIZADA') {
        app.status = 'FINALIZADA';
        app.updatedAt = new Date();
      }
    }

    // Register visit
    this.recordPatientBranchVisit(record.patientId, record.branchId);

    // Audit with professional license tracking
    const dentist = this.data.users.find(u => u.id === record.odontologistId);
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: record.branchId,
      userId: record.actorUserId || record.odontologistId,
      action: 'CREATE',
      entity: 'CLINICAL_RECORD',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Clinical Workspace',
      oldValues: null,
      newValues: {
        diagnosis: record.diagnosis,
        treatment: record.treatmentPerformed,
        dentistMSPBS: dentist?.professionalLicense || 'N/A'
      },
      description: `Registro de evolución y nota clínica firmado por Dr(a). ${dentist?.firstName} ${dentist?.lastName} (${dentist?.professionalLicense || 'Sin Reg.'}) - Ley 1682/01`,
      createdAt: new Date(),
    });

    this.notify();
    return newRecord;
  }

  // --- FASE 9: ODONTOGRAMA DIGITAL INTERACTIVO (FDI) ---
  public createOdontogramVersion(params: {
    patientId: string;
    odontologistId: string;
    odontogramType: 'ADULTO' | 'PEDIATRICO';
    generalObservations?: string;
    items?: Array<{
      toothNumber: number;
      surface: string;
      condition: string;
      material?: string;
      notes?: string;
      colorCode?: string;
    }>;
    actorUserId?: string;
  }) {
    const existing = (this.data.odontograms || []).filter(
      (o) => o.patientId === params.patientId && o.odontogramType === params.odontogramType
    );
    const nextVersion = existing.length > 0 ? Math.max(...existing.map((o) => o.version || 1)) + 1 : 1;

    const id = crypto.randomUUID();
    const newOdontogram = {
      id,
      organizationId: this.data.organization.id,
      patientId: params.patientId,
      odontologistId: params.odontologistId,
      clinicalRecordId: null,
      version: nextVersion,
      odontogramType: params.odontogramType,
      generalObservations: params.generalObservations || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.data.odontograms) {
      this.data.odontograms = [];
    }
    this.data.odontograms.unshift(newOdontogram);

    // Copy or set items
    if (!this.data.odontogramItems) {
      this.data.odontogramItems = [];
    }

    if (params.items && params.items.length > 0) {
      params.items.forEach((it) => {
        this.data.odontogramItems.push({
          id: crypto.randomUUID(),
          odontogramId: id,
          toothNumber: it.toothNumber,
          surface: it.surface || 'GENERAL',
          condition: it.condition,
          material: it.material || null,
          notes: it.notes || '',
          colorCode: it.colorCode || '#EF4444',
          createdAt: new Date(),
        });
      });
    }

    const dentist = this.data.users.find((u) => u.id === params.odontologistId);
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: params.actorUserId || params.odontologistId,
      action: 'CREATE',
      entity: 'ODONTOGRAM',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro FDI Engine',
      oldValues: null,
      newValues: { version: nextVersion, type: params.odontogramType, itemsCount: params.items?.length || 0 },
      description: `Nueva versión v${nextVersion} de Odontograma (${params.odontogramType}) registrada por Dr(a). ${dentist?.firstName} ${dentist?.lastName}`,
      createdAt: new Date(),
    });

    this.notify();
    return newOdontogram;
  }

  public updateToothCondition(params: {
    odontogramId: string;
    toothNumber: number;
    surface: string;
    condition: string;
    material?: string;
    notes?: string;
    colorCode?: string;
    actorUserId?: string;
  }) {
    if (!this.data.odontogramItems) {
      this.data.odontogramItems = [];
    }

    // Find existing item for this tooth + surface in this odontogram
    const existingIndex = this.data.odontogramItems.findIndex(
      (item) =>
        item.odontogramId === params.odontogramId &&
        item.toothNumber === params.toothNumber &&
        item.surface === params.surface
    );

    let item;
    if (params.condition === 'SANO' || params.condition === 'BORRAR') {
      // If reset to sano / clear
      if (existingIndex !== -1) {
        this.data.odontogramItems.splice(existingIndex, 1);
      }
    } else if (existingIndex !== -1) {
      this.data.odontogramItems[existingIndex] = {
        ...this.data.odontogramItems[existingIndex],
        condition: params.condition,
        material: params.material || null,
        notes: params.notes || '',
        colorCode: params.colorCode || '#EF4444',
      };
      item = this.data.odontogramItems[existingIndex];
    } else {
      item = {
        id: crypto.randomUUID(),
        odontogramId: params.odontogramId,
        toothNumber: params.toothNumber,
        surface: params.surface,
        condition: params.condition,
        material: params.material || null,
        notes: params.notes || '',
        colorCode: params.colorCode || '#EF4444',
        createdAt: new Date(),
      };
      this.data.odontogramItems.push(item);
    }

    // Update odontogram timestamp
    const odon = this.data.odontograms.find((o) => o.id === params.odontogramId);
    if (odon) {
      odon.updatedAt = new Date();
    }

    this.notify();
    return item;
  }

  // --- FASE 10: TRATAMIENTOS & CATÁLOGO DE SERVICIOS ---
  public addTreatment(treatment: {
    patientId: string;
    branchId: string;
    title: string;
    totalAmount: number;
    paidAmount?: number;
    toothNumbers?: number[];
    odontologistId?: string;
    quoteId?: string;
    status?: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO';
    startDate?: string;
    notes?: string;
    actorUserId?: string;
  }) {
    const id = crypto.randomUUID();
    const paid = treatment.paidAmount || 0;
    const balance = Math.max(0, treatment.totalAmount - paid);

    const newTreatment = {
      id,
      organizationId: this.data.organization.id,
      branchId: treatment.branchId,
      patientId: treatment.patientId,
      quoteId: treatment.quoteId || null,
      title: treatment.title,
      totalAmount: treatment.totalAmount,
      paidAmount: paid,
      balanceDue: balance,
      status: treatment.status || 'PLANIFICADO',
      startDate: treatment.startDate || new Date().toISOString().split('T')[0],
      completedDate: null,
      toothNumbers: treatment.toothNumbers || [],
      odontologistId: treatment.odontologistId || this.data.users.find((u) => u.roleId === 'ODONTOLOGO')?.id,
      notes: treatment.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.data.treatments) {
      this.data.treatments = [];
    }
    this.data.treatments.unshift(newTreatment);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: treatment.branchId,
      userId: treatment.actorUserId || this.data.users[0]?.id,
      action: 'CREATE',
      entity: 'TREATMENT',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Treatments Manager',
      oldValues: null,
      newValues: newTreatment,
      description: `Creación de plan de tratamiento "${treatment.title}" por valor de ₲ ${treatment.totalAmount.toLocaleString('es-PY')}`,
      createdAt: new Date(),
    });

    this.notify();
    return newTreatment;
  }

  public updateTreatmentStatus(
    treatmentId: string,
    status: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO',
    completedDate?: string,
    actorUserId?: string
  ) {
    const treat = (this.data.treatments || []).find((t) => t.id === treatmentId);
    if (!treat) return null;

    const oldStatus = treat.status;
    treat.status = status;
    if (status === 'COMPLETADO') {
      treat.completedDate = completedDate || new Date().toISOString().split('T')[0];
    }
    treat.updatedAt = new Date();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: treat.branchId,
      userId: actorUserId || this.data.users[0]?.id,
      action: 'STATUS_CHANGE',
      entity: 'TREATMENT',
      entityId: treatmentId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Treatments Manager',
      oldValues: { status: oldStatus },
      newValues: { status, completedDate: treat.completedDate },
      description: `Actualización de estado de tratamiento "${treat.title}" a "${status}"`,
      createdAt: new Date(),
    });

    this.notify();
    return treat;
  }

  public recordTreatmentPayment(
    treatmentId: string,
    amount: number,
    paymentMethod: string,
    receiptNumber: string,
    actorUserId?: string
  ) {
    if (amount <= 0) {
      throw new Error('El monto a abonar debe ser superior a ₲ 0.');
    }

    const treat = (this.data.treatments || []).find((t) => t.id === treatmentId);
    if (!treat) throw new Error('El tratamiento especificado no existe.');

    if (treat.balanceDue > 0 && amount > treat.balanceDue) {
      throw new Error(`El monto (₲ ${amount.toLocaleString('es-PY')}) excede el saldo pendiente (₲ ${treat.balanceDue.toLocaleString('es-PY')}).`);
    }

    treat.paidAmount = (treat.paidAmount || 0) + amount;
    treat.balanceDue = Math.max(0, treat.totalAmount - treat.paidAmount);
    treat.updatedAt = new Date();

    // Create payment entry
    const paymentId = crypto.randomUUID();
    const invoiceNumber = this.getNextInvoiceNumber();
    const paymentRecord = {
      id: paymentId,
      organizationId: this.data.organization.id,
      branchId: treat.branchId,
      patientId: treat.patientId,
      treatmentId: treat.id,
      appointmentId: null,
      cashMovementId: null as string | null,
      receiptNumber: receiptNumber || this.getNextReceiptNumber(),
      invoiceNumber,
      amount,
      paymentMethod,
      status: 'COMPLETADO',
      notes: `Pago abonado a cuenta del tratamiento ${treat.title}`,
      receivedBy: actorUserId || this.data.users[0]?.id,
      createdAt: new Date(),
    };

    if (!this.data.payments) {
      this.data.payments = [];
    }
    this.data.payments.unshift(paymentRecord);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: treat.branchId,
      userId: actorUserId || this.data.users[0]?.id,
      action: 'PAYMENT',
      entity: 'TREATMENT',
      entityId: treatmentId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Financial Engine',
      oldValues: null,
      newValues: { amount, balanceDue: treat.balanceDue, receiptNumber: paymentRecord.receiptNumber },
      description: `Cobro de ₲ ${amount.toLocaleString('es-PY')} registrado para tratamiento "${treat.title}" (Recibo: ${paymentRecord.receiptNumber})`,
      createdAt: new Date(),
    });

    // Auto-create cash movement in active cash register if one is open
    const openRegister = (this.data.cashRegisters || []).find(
      (cr) => cr.branchId === treat.branchId && cr.status === 'ABIERTA'
    );
    if (openRegister) {
      const movementId = crypto.randomUUID();
      this.data.cashMovements.unshift({
        id: movementId,
        cashRegisterId: openRegister.id,
        movementType: 'INGRESO',
        amount,
        paymentMethod,
        concept: `Cobro tratamiento ${treat.title} (Recibo ${paymentRecord.receiptNumber})`,
        referenceNumber: paymentRecord.receiptNumber,
        performedBy: actorUserId || this.data.users[0]?.id,
        createdAt: new Date(),
      });
      paymentRecord.cashMovementId = movementId;
    }

    this.notify();
    return treat;
  }

  // --- ANULACIÓN ATÓMICA DE RECIBOS Y PAGOS ---
  public annulPayment(params: {
    paymentId: string;
    reason: string;
    actorUserId: string;
  }) {
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('Debe proporcionar un motivo válido de anulación (mínimo 5 caracteres).');
    }

    const payment = (this.data.payments || []).find(p => p.id === params.paymentId);
    if (!payment) {
      throw new Error('El recibo / pago no fue encontrado.');
    }

    if (payment.status === 'ANULADO') {
      throw new Error('Este recibo ya se encuentra anulado.');
    }

    const previousStatus = payment.status;
    payment.status = 'ANULADO';
    (payment as any).annulledAt = new Date();
    (payment as any).annulledReason = params.reason;
    (payment as any).annulledBy = params.actorUserId;

    // 1. Revertir saldo en tratamiento si estaba vinculado
    let restoredTreatment = null;
    if (payment.treatmentId) {
      const treat = (this.data.treatments || []).find(t => t.id === payment.treatmentId);
      if (treat) {
        treat.paidAmount = Math.max(0, (treat.paidAmount || 0) - payment.amount);
        treat.balanceDue = Math.max(0, treat.totalAmount - treat.paidAmount);
        treat.updatedAt = new Date();
        restoredTreatment = treat;
      }
    }

    // 2. Registrar contra-asiento contable (EGRESO por anulación) si la caja está abierta
    let counterMovement = null;
    const openRegister = (this.data.cashRegisters || []).find(
      (cr) => cr.branchId === payment.branchId && cr.status === 'ABIERTA'
    );
    if (openRegister) {
      const counterMovementId = crypto.randomUUID();
      counterMovement = {
        id: counterMovementId,
        cashRegisterId: openRegister.id,
        movementType: 'EGRESO' as const,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        concept: `[ANULACIÓN] Recibo ${payment.receiptNumber}: ${params.reason}`,
        referenceNumber: `ANUL-${payment.receiptNumber}`,
        performedBy: params.actorUserId,
        createdAt: new Date(),
      };
      this.data.cashMovements.unshift(counterMovement);
    }

    // 3. Bitácora forense de auditoría
    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: payment.branchId,
      userId: params.actorUserId,
      action: 'ANNUL_PAYMENT',
      entity: 'PAYMENT',
      entityId: payment.id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Audit & Security Manager',
      oldValues: { status: previousStatus, amount: payment.amount, receiptNumber: payment.receiptNumber },
      newValues: { status: 'ANULADO', reason: params.reason, treatmentBalanceRestored: restoredTreatment?.balanceDue },
      description: `Anulación de Recibo ${payment.receiptNumber} por ₲ ${payment.amount.toLocaleString('es-PY')}. Motivo: "${params.reason}"`,
      createdAt: new Date(),
    });

    this.notify();
    return {
      payment,
      restoredTreatment,
      counterMovement,
    };
  }

  public addService(service: {
    category: string;
    code: string;
    name: string;
    description?: string;
    defaultDurationMin: number;
    basePrice: number;
    actorUserId?: string;
  }) {
    const id = crypto.randomUUID();
    const record = {
      id,
      organizationId: this.data.organization.id,
      category: service.category,
      code: service.code,
      name: service.name,
      description: service.description || '',
      defaultDurationMin: service.defaultDurationMin,
      basePrice: service.basePrice,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    this.data.services.push(record);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: service.actorUserId || this.data.users[0]?.id,
      action: 'CREATE',
      entity: 'SERVICE',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Catalogs Admin',
      oldValues: null,
      newValues: record,
      description: `Nuevo servicio odontológico incorporado: "${service.name}" (${service.code}) - ₲ ${service.basePrice.toLocaleString('es-PY')}`,
      createdAt: new Date(),
    });

    this.notify();
    return record;
  }

  public updateService(
    serviceId: string,
    updates: Partial<{
      category: string;
      code: string;
      name: string;
      description: string;
      defaultDurationMin: number;
      basePrice: number;
      status: string;
    }>,
    actorUserId?: string
  ) {
    const s = this.data.services.find((serv) => serv.id === serviceId);
    if (!s) return null;

    Object.assign(s, updates, { updatedAt: new Date() });

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: actorUserId || this.data.users[0]?.id,
      action: 'UPDATE',
      entity: 'SERVICE',
      entityId: serviceId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Catalogs Admin',
      oldValues: null,
      newValues: updates,
      description: `Modificación de parámetros del servicio odontológico "${s.name}"`,
      createdAt: new Date(),
    });

    this.notify();
    return s;
  }

  public setBranchServicePrice(
    branchId: string,
    serviceId: string,
    customPrice: number,
    isAvailable: boolean = true,
    actorUserId?: string
  ) {
    if (!this.data.branchServices) {
      this.data.branchServices = [];
    }

    const existing = this.data.branchServices.find(
      (bs) => bs.branchId === branchId && bs.serviceId === serviceId
    );

    const branch = this.data.branches.find((b) => b.id === branchId);
    const service = this.data.services.find((s) => s.id === serviceId);

    if (existing) {
      existing.customPrice = customPrice;
      existing.isAvailable = isAvailable;
    } else {
      this.data.branchServices.push({
        branchId,
        serviceId,
        customPrice,
        isAvailable,
      });
    }

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId,
      userId: actorUserId || this.data.users[0]?.id,
      action: 'UPDATE_PRICING',
      entity: 'BRANCH_SERVICE',
      entityId: `${branchId}-${serviceId}`,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Pricing Engine',
      oldValues: null,
      newValues: { customPrice, isAvailable },
      description: `Ajuste de precio diferenciado para "${service?.name}" en sucursal ${branch?.name}: ₲ ${customPrice.toLocaleString('es-PY')}`,
      createdAt: new Date(),
    });

    this.notify();
    return { branchId, serviceId, customPrice, isAvailable };
  }

  // --- FASE 11: PRESUPUESTOS (QUOTES) EN GUARANÍES ---
  public createQuote(params: {
    branchId: string;
    patientId: string;
    odontologistId?: string;
    validUntil?: string;
    notes?: string;
    discountAmount?: number;
    items: Array<{
      serviceId?: string;
      toothNumber?: number;
      description: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    actorUserId?: string;
  }) {
    const id = crypto.randomUUID();
    const quoteNumber = this.getNextQuoteNumber();

    const totalAmount = params.items.reduce((sum, item) => sum + (item.subtotal || item.unitPrice * item.quantity), 0);
    const discountAmount = params.discountAmount || 0;
    const finalAmount = Math.max(0, totalAmount - discountAmount);

    // Calculate default validUntil to 30 days ahead if not provided
    let validUntilDate = params.validUntil;
    if (!validUntilDate) {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      validUntilDate = d.toISOString().split('T')[0];
    }

    const newQuote = {
      id,
      organizationId: this.data.organization.id,
      branchId: params.branchId,
      patientId: params.patientId,
      odontologistId: params.odontologistId || this.data.users.find((u) => u.roleId === 'ODONTOLOGO')?.id || null,
      quoteNumber,
      totalAmount,
      discountAmount,
      finalAmount,
      status: 'PENDIENTE',
      validUntil: validUntilDate,
      notes: params.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.data.quotes) {
      this.data.quotes = [];
    }
    this.data.quotes.unshift(newQuote);

    if (!this.data.quoteItems) {
      this.data.quoteItems = [];
    }

    params.items.forEach((item) => {
      this.data.quoteItems.push({
        id: crypto.randomUUID(),
        quoteId: id,
        serviceId: item.serviceId || null,
        toothNumber: item.toothNumber || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal || item.quantity * item.unitPrice,
      });
    });

    const patient = this.data.patients.find((p) => p.id === params.patientId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: params.branchId,
      userId: params.actorUserId || this.data.users[0]?.id,
      action: 'CREATE',
      entity: 'QUOTE',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Quotes Engine',
      oldValues: null,
      newValues: { quoteNumber, finalAmount, itemsCount: params.items.length },
      description: `Presupuesto ${quoteNumber} emitido para ${patient?.firstName} ${patient?.lastName} por ₲ ${finalAmount.toLocaleString('es-PY')}`,
      createdAt: new Date(),
    });

    this.notify();
    return newQuote;
  }

  public updateQuoteStatus(
    quoteId: string,
    status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO',
    actorUserId?: string,
    autoCreateTreatment: boolean = true
  ) {
    const q = (this.data.quotes || []).find((quote) => quote.id === quoteId);
    if (!q) return null;

    const oldStatus = q.status;
    if (oldStatus === status) {
      // Idempotency: si ya está en el mismo estado, retornar sin duplicar tratamientos
      const existingTreatment = (this.data.treatments || []).find((t) => t.quoteId === quoteId);
      return { quote: q, treatment: existingTreatment || null };
    }

    q.status = status;
    q.updatedAt = new Date();

    let createdTreatment = null;

    // When quote is approved, check if treatment already exists before creating a new one
    if (status === 'APROBADO' && autoCreateTreatment) {
      const existingTreatment = (this.data.treatments || []).find((t) => t.quoteId === quoteId);
      if (existingTreatment) {
        createdTreatment = existingTreatment;
      } else {
        const items = (this.data.quoteItems || []).filter((it) => it.quoteId === quoteId);
        const toothNumbers = items
          .map((it) => it.toothNumber)
          .filter((tn): tn is number => tn !== null && tn !== undefined);

        createdTreatment = this.addTreatment({
          patientId: q.patientId,
          branchId: q.branchId,
          title: `Plan Presupuesto ${q.quoteNumber} (${items[0]?.description || 'Odontología Integral'})`,
          totalAmount: q.finalAmount,
          paidAmount: 0,
          toothNumbers,
          odontologistId: q.odontologistId || undefined,
          quoteId: q.id,
          status: 'EN_PROGRESO',
          notes: `Generado automáticamente por aprobación del presupuesto ${q.quoteNumber}`,
          actorUserId,
        });
      }
    }

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: q.branchId,
      userId: actorUserId || this.data.users[0]?.id,
      action: 'STATUS_CHANGE',
      entity: 'QUOTE',
      entityId: quoteId,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Quotes Engine',
      oldValues: { status: oldStatus },
      newValues: { status, generatedTreatmentId: createdTreatment?.id },
      description: `Presupuesto ${q.quoteNumber} actualizado a estado "${status}"`,
      createdAt: new Date(),
    });

    this.notify();
    return { quote: q, treatment: createdTreatment };
  }

  // --- FASE 12: CAJA DIARIA & MOVIMIENTOS FINANCIEROS (PYG) ---
  public openCashRegister(params: {
    branchId: string;
    openingAmount: number;
    observations?: string;
    actorUserId: string;
  }) {
    if (!this.data.cashRegisters) {
      this.data.cashRegisters = [];
    }

    // Check if user or branch already has an open cash register
    const openRegister = this.data.cashRegisters.find(
      (cr) => cr.branchId === params.branchId && cr.status === 'ABIERTA'
    );
    if (openRegister) {
      throw new Error('Ya existe una caja abierta en esta sucursal. Debe cerrar la caja activa antes de abrir un nuevo turno.');
    }

    const id = crypto.randomUUID();
    const newRegister = {
      id,
      organizationId: this.data.organization.id,
      branchId: params.branchId,
      openedBy: params.actorUserId,
      closedBy: null,
      openingAmount: params.openingAmount,
      closingAmountExpected: null,
      closingAmountReal: null,
      differenceAmount: null,
      status: 'ABIERTA',
      openedAt: new Date(),
      closedAt: null,
      observations: params.observations || 'Apertura de turno.',
    };

    this.data.cashRegisters.unshift(newRegister);

    const user = this.data.users.find((u) => u.id === params.actorUserId);
    const branch = this.data.branches.find((b) => b.id === params.branchId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: params.branchId,
      userId: params.actorUserId,
      action: 'OPEN_CASH_REGISTER',
      entity: 'CASH_REGISTER',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Cash Engine',
      oldValues: null,
      newValues: { openingAmount: params.openingAmount },
      description: `Apertura de caja en ${branch?.name} con fondo de ₲ ${params.openingAmount.toLocaleString('es-PY')} por ${user?.firstName} ${user?.lastName}`,
      createdAt: new Date(),
    });

    this.notify();
    return newRegister;
  }

  public addCashMovement(params: {
    cashRegisterId: string;
    movementType: 'INGRESO' | 'EGRESO' | 'AJUSTE';
    amount: number;
    paymentMethod: string; // EFECTIVO, TRANSFERENCIA_SIPAP, QR_BANCARIO, TARJETA_DEBITO, TARJETA_CREDITO
    concept: string;
    referenceNumber?: string;
    receiptNumber?: string;
    patientId?: string;
    treatmentId?: string;
    appointmentId?: string;
    actorUserId: string;
  }) {
    if (!this.data.cashMovements) {
      this.data.cashMovements = [];
    }

    const register = (this.data.cashRegisters || []).find((cr) => cr.id === params.cashRegisterId);
    if (!register || register.status !== 'ABIERTA') {
      throw new Error('La caja especificada no existe o se encuentra cerrada.');
    }

    const id = crypto.randomUUID();
    const newMovement = {
      id,
      cashRegisterId: params.cashRegisterId,
      movementType: params.movementType,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      concept: params.concept,
      referenceNumber: params.referenceNumber || null,
      performedBy: params.actorUserId,
      createdAt: new Date(),
    };

    this.data.cashMovements.unshift(newMovement);

    // If receiptNumber or patientId is passed, register a payment record too
    if (params.receiptNumber || params.patientId) {
      if (!this.data.payments) {
        this.data.payments = [];
      }
      this.data.payments.unshift({
        id: crypto.randomUUID(),
        organizationId: this.data.organization.id,
        branchId: register.branchId,
        patientId: params.patientId || this.data.patients[0]?.id,
        treatmentId: params.treatmentId || null,
        appointmentId: params.appointmentId || null,
        cashMovementId: id,
        receiptNumber: params.receiptNumber || this.getNextReceiptNumber(),
        invoiceNumber: this.getNextInvoiceNumber(),
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        status: 'COMPLETADO',
        notes: params.concept,
        receivedBy: params.actorUserId,
        createdAt: new Date(),
      });
    }

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: register.branchId,
      userId: params.actorUserId,
      action: 'CASH_MOVEMENT',
      entity: 'CASH_MOVEMENT',
      entityId: id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Cash Engine',
      oldValues: null,
      newValues: {
        movementType: params.movementType,
        amount: params.amount,
        paymentMethod: params.paymentMethod,
        concept: params.concept,
      },
      description: `Movimiento de caja (${params.movementType}): ${params.concept} - ₲ ${params.amount.toLocaleString('es-PY')} (${params.paymentMethod})`,
      createdAt: new Date(),
    });

    this.notify();
    return newMovement;
  }

  public closeCashRegister(params: {
    cashRegisterId: string;
    closingAmountReal: number;
    observations?: string;
    actorUserId: string;
  }) {
    const register = (this.data.cashRegisters || []).find((cr) => cr.id === params.cashRegisterId);
    if (!register) throw new Error('Caja no encontrada.');
    if (register.status === 'CERRADA') throw new Error('Esta caja ya ha sido cerrada.');

    // Calculate expected cash in register
    // Only EFECTIVO affects physical cash count in drawer!
    const movements = (this.data.cashMovements || []).filter((m) => m.cashRegisterId === params.cashRegisterId);
    const cashIngresos = movements
      .filter((m) => m.movementType === 'INGRESO' && m.paymentMethod === 'EFECTIVO')
      .reduce((sum, m) => sum + m.amount, 0);

    const cashEgresos = movements
      .filter((m) => m.movementType === 'EGRESO' && m.paymentMethod === 'EFECTIVO')
      .reduce((sum, m) => sum + m.amount, 0);

    const expectedCash = register.openingAmount + cashIngresos - cashEgresos;
    const difference = params.closingAmountReal - expectedCash;

    register.status = 'CERRADA';
    register.closedBy = params.actorUserId;
    register.closedAt = new Date();
    register.closingAmountExpected = expectedCash;
    register.closingAmountReal = params.closingAmountReal;
    register.differenceAmount = difference;
    if (params.observations) {
      register.observations = (register.observations ? register.observations + ' | ' : '') + params.observations;
    }

    const branch = this.data.branches.find((b) => b.id === register.branchId);

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: register.branchId,
      userId: params.actorUserId,
      action: 'CLOSE_CASH_REGISTER',
      entity: 'CASH_REGISTER',
      entityId: register.id,
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Cash Engine',
      oldValues: { status: 'ABIERTA', openingAmount: register.openingAmount },
      newValues: {
        expectedCash,
        closingAmountReal: params.closingAmountReal,
        difference,
      },
      description: `Cierre de caja en ${branch?.name}. Esperado: ₲ ${expectedCash.toLocaleString('es-PY')} | Real: ₲ ${params.closingAmountReal.toLocaleString('es-PY')} (Diferencia: ₲ ${difference.toLocaleString('es-PY')})`,
      createdAt: new Date(),
    });

    this.notify();
    return register;
  }
}

export const dbStore = new DatabaseStore();
