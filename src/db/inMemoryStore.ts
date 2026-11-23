import { generateInitialSeedData, SeedDataResult } from './seeds/initial-seed.ts';
import {
  isSuperAdminRole,
  ROLE_HIERARCHY,
  REGULATORY_RESTRICTIONS_CATALOG,
  RegulatoryRestrictionItem,
  UserEffectivePermissions,
  validateBackendAuthorization,
} from '../security/rbacHierarchy.ts';
import {
  ensurePayrollIntegrity,
  StaffArea,
  RemunerationModality,
  PaymentFrequency,
  CommissionTriggerType,
  CommissionCalculationMode,
  createPayrollSettlementRecord,
} from './payrollEngine.ts';
import type { AuditLogInput, BackendActorContext, StoreContext } from './store/types.ts';
import { StoreSyncEngine } from './store/syncEngine.ts';
import * as orgBranchStore from './store/organizationBranchStore.ts';
import * as usersRbacStore from './store/usersRbacStore.ts';
import * as clinicalStore from './store/clinicalStore.ts';
import * as billingInsuranceStore from './store/billingInsuranceStore.ts';
import * as payrollStore from './store/payrollStore.ts';

export type { BackendActorContext } from './store/types.ts';

const DB_STORAGE_KEY = 'odontopro_db_state_v3';

class DatabaseStore {
  private data!: SeedDataResult;
  private listeners: Array<() => void> = [];
  private revokedUserSessions: Map<string, number> = new Map();
  private organizationsList: Array<any> = [];
  private currentBackendActor: BackendActorContext | null = null;
  private currentSessionToken: string | null = null;
  private syncEngine: StoreSyncEngine;
  private ctx: StoreContext;

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('odontopro_auth_session');
        localStorage.removeItem(DB_STORAGE_KEY);
      }
    } catch {
      // Ignorar errores de storage
    }

    this.data = generateInitialSeedData();
    this.organizationsList = [this.data.organization];

    try {
      if (this.data && this.data.roles) {
        this.data.roles.forEach((r) => {
          const defaultPerms = ROLE_HIERARCHY[r.id]?.permissions;
          if (defaultPerms && defaultPerms.length > 0) {
            if (!(r as any).permissions || !Array.isArray((r as any).permissions) || (r as any).permissions.length === 0) {
              (r as any).permissions = [...defaultPerms];
            }
          }
        });
      }
      if (this.data && this.data.users) {
        this.data.users.forEach((u: any) => {
          if (!u.username && u.email) {
            u.username = u.email.split('@')[0];
          }
          if (!Array.isArray(u.customPermissions)) u.customPermissions = [];
          if (!Array.isArray(u.revokedPermissions)) u.revokedPermissions = [];
          if (!Array.isArray(u.assignedRestrictions)) u.assignedRestrictions = [];
          if (typeof u.permissionsVersion !== 'number') u.permissionsVersion = 1;
        });
      }
      if (this.data && !(this.data as any).regulatoryRestrictions) {
        (this.data as any).regulatoryRestrictions = REGULATORY_RESTRICTIONS_CATALOG.filter(
          (r) => r.defaultEnforced
        ).map((r) => r.id);
      }
      const defaultSeed = generateInitialSeedData();
      if (!this.data.insurancePlans || !Array.isArray(this.data.insurancePlans) || this.data.insurancePlans.length === 0) {
        this.data.insurancePlans = defaultSeed.insurancePlans || [];
      }
      if (!this.data.planServicePrices || !Array.isArray(this.data.planServicePrices) || this.data.planServicePrices.length === 0) {
        this.data.planServicePrices = defaultSeed.planServicePrices || [];
      }
      if (!this.data.insuranceClaims || !Array.isArray(this.data.insuranceClaims)) {
        this.data.insuranceClaims = [];
      }
      if (this.data.patients && Array.isArray(this.data.patients)) {
        this.data.patients.forEach((p: any) => {
          if (!p.modality) {
            p.modality = 'PARTICULAR';
            p.insurancePlanId = null;
            p.insuranceMemberNumber = null;
          }
        });
      }
      ensurePayrollIntegrity(this.data);
    } catch {
      // Ignorar
    }

    this.ctx = {
      getData: () => this.data,
      setData: (next) => {
        this.data = next;
      },
      getOrganizationsList: () => this.organizationsList,
      setOrganizationsList: (nextList) => {
        this.organizationsList = nextList;
      },
      revokedUserSessions: this.revokedUserSessions,
      getEffectiveActor: (actor) => this.getEffectiveActor(actor),
      getCurrentActor: () => this.currentBackendActor,
      getSessionToken: () => this.currentSessionToken,
      notify: () => this.notify(),
      saveToStorage: () => this.saveToStorage(),
      saveToLocalStorageOnly: () => this.saveToLocalStorageOnly(),
      emitListeners: () => this.listeners.forEach((l) => l()),
      addAuditLog: (entry) => this.addAuditLog(entry),
      revokeUserSessions: (userId, adminUserId) => this.revokeUserSessions(userId, adminUserId),
      findUserByEmailOrUsername: (identifier) => this.findUserByEmailOrUsername(identifier),
      getBranches: (actor) => this.getBranches(actor),
      getBranchSettings: (branchId) => this.getBranchSettings(branchId),
      getNextReceiptNumber: () => this.getNextReceiptNumber(),
      getNextInvoiceNumber: () => this.getNextInvoiceNumber(),
      getNextQuoteNumber: () => this.getNextQuoteNumber(),
      addCashMovement: (params) => this.addCashMovement(params),
      addTreatment: (treatment) => this.addTreatment(treatment),
      recordPatientBranchVisit: (patientId, branchId) => this.recordPatientBranchVisit(patientId, branchId),
    };

    this.syncEngine = new StoreSyncEngine(this.ctx);
    this.syncEngine.commitSyncedSnapshot();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (this.currentBackendActor) {
          this.syncFromServer();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.currentBackendActor) {
          this.syncFromServer();
        }
      });
      setInterval(() => {
        if (this.currentBackendActor) {
          this.syncFromServer();
        }
      }, 15000);
    }
  }

  public syncFromServer(): Promise<boolean> {
    return this.syncEngine.syncFromServer();
  }

  public flushPendingSync(): Promise<void> {
    return this.syncEngine.flushPendingSync();
  }

  public setBackendActorContext(actor: BackendActorContext | null) {
    this.currentBackendActor = actor;
    if (!actor) {
      this.syncEngine.resetTracking();
    }
  }

  public getBackendActorContext(): BackendActorContext | null {
    return this.currentBackendActor;
  }

  public setSessionToken(token: string | null) {
    this.currentSessionToken = token;
    if (!token) {
      this.syncEngine.resetHasSynced();
    }
  }

  public getSessionToken(): string | null {
    return this.currentSessionToken;
  }

  private getEffectiveActor(actor?: BackendActorContext | null): BackendActorContext | null {
    const raw = actor || this.currentBackendActor;
    if (!raw) return null;
    const userInDb = this.data?.users?.find((u) => u.id === raw.userId);
    if (userInDb) {
      return {
        ...raw,
        role: userInDb.roleId || raw.role,
        organizationId: userInDb.organizationId || raw.organizationId,
        customPermissions: userInDb.customPermissions || [],
        revokedPermissions: userInDb.revokedPermissions || [],
        assignedRestrictions: userInDb.assignedRestrictions || [],
        allowedNavTabs: userInDb.allowedNavTabs || [],
        permissionsVersion: userInDb.permissionsVersion || 1,
      };
    }
    return raw;
  }

  private saveToLocalStorageOnly() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(DB_STORAGE_KEY);
      }
    } catch {
      // Ignorar errores de acceso a storage
    }
  }

  private saveToStorage() {
    this.syncEngine.bumpMutationEpoch();
    this.saveToLocalStorageOnly();

    if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
      import('fs')
        .then((fs) => {
          import('path').then((path) => {
            try {
              const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
              const DB_FILE = path.join(DATA_DIR, 'db_store.json');
              if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
              }
              const tmp = `${DB_FILE}.tmp`;
              fs.writeFileSync(
                tmp,
                JSON.stringify(
                  {
                    data: this.data,
                    organizationsList: this.organizationsList,
                    stateVersion: this.syncEngine.serverStateVersion,
                  },
                  null,
                  2
                ),
                'utf-8'
              );
              fs.renameSync(tmp, DB_FILE);
            } catch {
              // ignore
            }
          });
        })
        .catch(() => {});
    }

    this.syncEngine.scheduleDeltaFlush();
  }

  public getSnapshot(actor?: BackendActorContext): SeedDataResult {
    const effectiveActor = this.getEffectiveActor(actor);
    const orgId =
      effectiveActor && effectiveActor.role !== 'SUPER_ADMIN'
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
      insurancePlans: (this.data.insurancePlans || []).filter((p) => p.organizationId === orgId),
      planServicePrices: this.data.planServicePrices || [],
      insuranceClaims: (this.data.insuranceClaims || []).filter((ic: any) => ic.organizationId === orgId),
      auditLogs: (this.data.auditLogs || []).filter((l) => l.organizationId === orgId),
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach((l) => l());
  }

  public applyAuthoritativeSync(upserts: Record<string, any[]>, stateVersion?: number) {
    this.syncEngine.applyAuthoritativeUpserts(upserts, stateVersion);
  }

  public applyServerSeedState(serverData: SeedDataResult, serverOrganizationsList: any[], stateVersion?: number) {
    this.syncEngine.applyServerSeedState(serverData, serverOrganizationsList, stateVersion);
  }

  public resetToSeedFromServer(
    sessionToken?: string | null,
    actor?: BackendActorContext | null
  ): Promise<{ success: boolean; error?: string }> {
    return this.syncEngine.resetToSeedFromServer(sessionToken, actor);
  }

  public resetToSeed(actor?: BackendActorContext | null) {
    const rawActor = actor || this.currentBackendActor;
    if (!rawActor || !rawActor.userId) {
      throw new Error(
        '403 Prohibido: Solo el Super Administrador tiene autorización para reinicializar datos a semilla.'
      );
    }

    const userInDb = this.data?.users?.find((u) => u.id === rawActor.userId);
    if (!userInDb || userInDb.status === 'INACTIVE') {
      throw new Error('403 Prohibido: Actor no verificado o inactivo para ejecutar restauración de semilla.');
    }

    const verifiedActor = {
      userId: userInDb.id,
      role: userInDb.roleId,
      organizationId: userInDb.organizationId,
      customPermissions: userInDb.customPermissions || [],
      revokedPermissions: userInDb.revokedPermissions || [],
      assignedRestrictions: userInDb.assignedRestrictions || [],
    };

    const authz = validateBackendAuthorization({
      actor: verifiedActor,
      resource: 'DATABASE',
      action: 'SEED',
      permission: 'database.seed',
    });

    if (!authz.authorized || !isSuperAdminRole(userInDb.roleId)) {
      this.data.auditLogs.unshift({
        id: crypto.randomUUID(),
        organizationId: userInDb.organizationId || this.data.organization.id,
        branchId: null,
        userId: userInDb.id,
        action: 'ACCESS_DENIED_SECURITY',
        entity: 'DATABASE',
        entityId: 'RESET_SEED',
        ipAddress: '190.52.144.12',
        userAgent: 'OdontoPro Security Engine',
        oldValues: null,
        newValues: { attemptedRole: userInDb.roleId },
        description: `Intento bloqueado de restaurar datos iniciales por rol no autorizado (${userInDb.roleId})`,
        createdAt: new Date(),
      });
      this.notify();
      throw new Error(
        '403 Prohibido: Solo el Super Administrador tiene autorización para reinicializar datos a semilla.'
      );
    }

    this.data = generateInitialSeedData();
    this.organizationsList = [this.data.organization];
    this.revokedUserSessions.clear();

    this.data.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: this.data.organization.id,
      branchId: null,
      userId: userInDb.id,
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

  // --- Organizaciones, Sucursales, Correlativos & Auditoría ---
  public getActiveOrganization() {
    return this.data.organization;
  }
  public getOrganizations() {
    return this.organizationsList;
  }
  public getOrganization() {
    return this.data.organization;
  }
  public addOrganization(
    newOrg: Parameters<typeof orgBranchStore.addOrganization>[1],
    actor?: BackendActorContext
  ) {
    return orgBranchStore.addOrganization(this.ctx, newOrg, actor);
  }
  public switchOrganization(orgId: string, actor?: BackendActorContext) {
    return orgBranchStore.switchOrganization(this.ctx, orgId, actor);
  }
  public deleteOrganization(orgId: string, actor?: BackendActorContext): boolean {
    return orgBranchStore.deleteOrganization(this.ctx, orgId, actor);
  }
  public updateOrganization(
    updates: Partial<typeof this.data.organization>,
    targetOrgId?: string,
    actor?: BackendActorContext
  ) {
    return orgBranchStore.updateOrganization(this.ctx, updates, targetOrgId, actor);
  }
  public getNextReceiptNumber(): string {
    return orgBranchStore.getNextReceiptNumber(this.ctx);
  }
  public getNextInvoiceNumber(): string {
    return orgBranchStore.getNextInvoiceNumber(this.ctx);
  }
  public getNextQuoteNumber(): string {
    return orgBranchStore.getNextQuoteNumber(this.ctx);
  }
  public getAuditLogs(actor?: BackendActorContext) {
    return orgBranchStore.getAuditLogs(this.ctx, actor);
  }
  public addAuditLog(entry: AuditLogInput) {
    return orgBranchStore.addAuditLog(this.ctx, entry);
  }
  public getBranches(actor?: BackendActorContext) {
    return orgBranchStore.getBranches(this.ctx, actor);
  }
  public getBranchById(id: string, actor?: BackendActorContext) {
    return orgBranchStore.getBranchById(this.ctx, id, actor);
  }
  public addBranch(
    newBranch: Parameters<typeof orgBranchStore.addBranch>[1],
    actor?: BackendActorContext
  ) {
    return orgBranchStore.addBranch(this.ctx, newBranch, actor);
  }
  public updateBranch(
    branchId: string,
    updates: Partial<(typeof this.data.branches)[0]>,
    actor?: BackendActorContext
  ) {
    return orgBranchStore.updateBranch(this.ctx, branchId, updates, actor);
  }
  public deleteBranch(branchId: string, actor?: BackendActorContext) {
    return orgBranchStore.deleteBranch(this.ctx, branchId, actor);
  }
  public toggleBranchStatus(branchId: string, actor?: BackendActorContext) {
    return orgBranchStore.toggleBranchStatus(this.ctx, branchId, actor);
  }
  public getBranchSettings(branchId: string) {
    return orgBranchStore.getBranchSettings(this.ctx, branchId);
  }
  public updateBranchSettings(
    branchId: string,
    updates: Partial<(typeof this.data.branchSettings)[0]>,
    actor?: BackendActorContext
  ) {
    return orgBranchStore.updateBranchSettings(this.ctx, branchId, updates, actor);
  }

  // --- Usuarios, Roles, RBAC & Sesiones ---
  public revokeUserSessions(userId: string, adminUserId?: string) {
    return usersRbacStore.revokeUserSessions(this.ctx, userId, adminUserId);
  }
  public isSessionRevoked(userId: string, sessionIssuedAtIso: string): boolean {
    return usersRbacStore.isSessionRevoked(this.ctx, userId, sessionIssuedAtIso);
  }
  public findUserByEmailOrUsername(identifier: string) {
    return usersRbacStore.findUserByEmailOrUsername(this.ctx, identifier);
  }
  public findUserByEmail(email: string) {
    return usersRbacStore.findUserByEmailOrUsername(this.ctx, email);
  }
  public getUsers(branchId?: string, actor?: BackendActorContext) {
    return usersRbacStore.getUsers(this.ctx, branchId, actor);
  }
  public getUserById(id: string, actor?: BackendActorContext) {
    return usersRbacStore.getUserById(this.ctx, id, actor);
  }
  public findUserById(id: string) {
    return this.data.users.find((u) => u.id === id) || null;
  }
  public addUser(
    newUser: Parameters<typeof usersRbacStore.addUser>[1],
    actor?: BackendActorContext
  ) {
    return usersRbacStore.addUser(this.ctx, newUser, actor);
  }
  public updateUser(
    userId: string,
    updates: Partial<(typeof this.data.users)[0]> & { branchIds?: string[]; defaultBranchId?: string },
    actor?: BackendActorContext
  ) {
    return usersRbacStore.updateUser(this.ctx, userId, updates, actor);
  }
  public toggleUserStatus(userId: string, actor?: BackendActorContext) {
    return usersRbacStore.toggleUserStatus(this.ctx, userId, actor);
  }
  public deleteUser(userId: string, actor?: BackendActorContext) {
    return usersRbacStore.deleteUser(this.ctx, userId, actor);
  }
  public getRoles() {
    return this.data.roles || [];
  }
  public addRole(
    roleData: Parameters<typeof usersRbacStore.addRole>[1],
    actor?: BackendActorContext
  ) {
    return usersRbacStore.addRole(this.ctx, roleData, actor);
  }
  public updateRole(
    roleId: string,
    updates: Parameters<typeof usersRbacStore.updateRole>[2],
    actor?: BackendActorContext
  ) {
    return usersRbacStore.updateRole(this.ctx, roleId, updates, actor);
  }
  public getRolePermissions(roleId: string): string[] {
    return usersRbacStore.getRolePermissions(this.ctx, roleId);
  }
  public updateRolePermissions(roleId: string, permissions: string[], actor?: BackendActorContext) {
    return usersRbacStore.updateRolePermissions(this.ctx, roleId, permissions, actor);
  }
  public resetRolePermissionsToDefault(roleId: string, actor?: BackendActorContext) {
    return usersRbacStore.resetRolePermissionsToDefault(this.ctx, roleId, actor);
  }
  public deleteRole(roleId: string, actor?: BackendActorContext) {
    return usersRbacStore.deleteRole(this.ctx, roleId, actor);
  }
  public getUserEffectivePermissions(userId: string): UserEffectivePermissions {
    return usersRbacStore.getUserEffectivePermissions(this.ctx, userId);
  }
  public getRegulatoryRestrictionsCatalog(): RegulatoryRestrictionItem[] {
    return usersRbacStore.getRegulatoryRestrictionsCatalog();
  }
  public getActiveRegulatoryRestrictions(): string[] {
    return usersRbacStore.getActiveRegulatoryRestrictions(this.ctx);
  }
  public updateRegulatoryRestrictions(restrictions: string[], actor?: BackendActorContext) {
    return usersRbacStore.updateRegulatoryRestrictions(this.ctx, restrictions, actor);
  }
  public updateUserPermissions(
    targetUserId: string,
    overrides: Parameters<typeof usersRbacStore.updateUserPermissions>[2],
    actor?: BackendActorContext
  ) {
    return usersRbacStore.updateUserPermissions(this.ctx, targetUserId, overrides, actor);
  }
  public resetUserPassword(userId: string, actor?: BackendActorContext) {
    return usersRbacStore.resetUserPassword(this.ctx, userId, actor);
  }
  public setUserPasswordHash(
    userId: string,
    record: { hash: string; salt: string; iterations: number },
    actor?: BackendActorContext
  ) {
    return usersRbacStore.setUserPasswordHash(this.ctx, userId, record, actor);
  }
  public getUserPasswordRecord(
    identifier: string,
    actor?: BackendActorContext
  ): { hash: string; salt: string; iterations: number } | null {
    return usersRbacStore.getUserPasswordRecord(this.ctx, identifier, actor);
  }

  // --- Pacientes, Agenda, Historias Clínicas & Odontograma ---
  public getPatients(branchId?: string, advisorId?: string | null) {
    return clinicalStore.getPatients(this.ctx, branchId, advisorId);
  }
  public getDentalChairs(branchId?: string) {
    return clinicalStore.getDentalChairs(this.ctx, branchId);
  }
  public getAppointments(branchId?: string) {
    return clinicalStore.getAppointments(this.ctx, branchId);
  }
  public getClinicalRecords(patientId?: string) {
    return clinicalStore.getClinicalRecords(this.ctx, patientId);
  }
  public getOdontograms(patientId?: string) {
    return clinicalStore.getOdontograms(this.ctx, patientId);
  }
  public getOdontogramItems(odontogramId?: string) {
    return clinicalStore.getOdontogramItems(this.ctx, odontogramId);
  }
  public updatePatient(
    patientId: string,
    updates: Partial<(typeof this.data.patients)[0]>,
    actorUserId?: string | null
  ) {
    return clinicalStore.updatePatient(this.ctx, patientId, updates, actorUserId);
  }
  public togglePatientStatus(patientId: string) {
    return clinicalStore.togglePatientStatus(this.ctx, patientId);
  }
  public addPatientVisit(patientId: string, branchId: string) {
    return clinicalStore.addPatientVisit(this.ctx, patientId, branchId);
  }
  public addPatient(newPatient: Parameters<typeof clinicalStore.addPatient>[1]) {
    return clinicalStore.addPatient(this.ctx, newPatient);
  }
  public recordPatientBranchVisit(patientId: string, branchId: string) {
    return clinicalStore.recordPatientBranchVisit(this.ctx, patientId, branchId);
  }
  public checkDoubleBooking(params: Parameters<typeof clinicalStore.checkDoubleBooking>[1]) {
    return clinicalStore.checkDoubleBooking(this.ctx, params);
  }
  public addAppointment(appointment: Parameters<typeof clinicalStore.addAppointment>[1]) {
    return clinicalStore.addAppointment(this.ctx, appointment);
  }
  public updateAppointmentStatus(
    appointmentId: string,
    newStatus: 'PENDIENTE' | 'CONFIRMADA' | 'EN_SALA' | 'EN_ATENCION' | 'FINALIZADA' | 'CANCELADA' | 'NO_ASISTIO',
    cancellationReason?: string,
    actorUserId?: string
  ) {
    return clinicalStore.updateAppointmentStatus(this.ctx, appointmentId, newStatus, cancellationReason, actorUserId);
  }
  public addClinicalRecord(record: Parameters<typeof clinicalStore.addClinicalRecord>[1]) {
    return clinicalStore.addClinicalRecord(this.ctx, record);
  }
  public createOdontogramVersion(params: Parameters<typeof clinicalStore.createOdontogramVersion>[1]) {
    return clinicalStore.createOdontogramVersion(this.ctx, params);
  }
  public updateToothCondition(params: Parameters<typeof clinicalStore.updateToothCondition>[1]) {
    return clinicalStore.updateToothCondition(this.ctx, params);
  }

  // --- Servicios, Planes/Seguros, Presupuestos, Tratamientos, Pagos & Caja ---
  public getServices(targetOrgId?: string) {
    return billingInsuranceStore.getServices(this.ctx, targetOrgId);
  }
  public getTreatments(branchId?: string, patientId?: string) {
    return billingInsuranceStore.getTreatments(this.ctx, branchId, patientId);
  }
  public getPayments(branchId?: string) {
    return billingInsuranceStore.getPayments(this.ctx, branchId);
  }
  public getCashRegisters(branchId?: string) {
    return billingInsuranceStore.getCashRegisters(this.ctx, branchId);
  }
  public getCashMovements(cashRegisterId?: string) {
    return billingInsuranceStore.getCashMovements(this.ctx, cashRegisterId);
  }
  public getQuotes(branchId?: string) {
    return billingInsuranceStore.getQuotes(this.ctx, branchId);
  }
  public getQuoteItems(quoteId?: string) {
    return billingInsuranceStore.getQuoteItems(this.ctx, quoteId);
  }
  public getBranchServices(branchId?: string) {
    return billingInsuranceStore.getBranchServices(this.ctx, branchId);
  }
  public getInsurancePlans(includeInactive: boolean = false, branchId?: string) {
    return billingInsuranceStore.getInsurancePlans(this.ctx, includeInactive, branchId);
  }
  public getAllInsurancePlans(branchId?: string) {
    return billingInsuranceStore.getAllInsurancePlans(this.ctx, branchId);
  }
  public getInsurancePlan(planId: string) {
    return billingInsuranceStore.getInsurancePlan(this.ctx, planId);
  }
  public getPlanServicePrices(planId?: string) {
    return billingInsuranceStore.getPlanServicePrices(this.ctx, planId);
  }
  public resolveServicePrice(params: Parameters<typeof billingInsuranceStore.resolveServicePrice>[1]) {
    return billingInsuranceStore.resolveServicePrice(this.ctx, params);
  }
  public addTreatment(treatment: Parameters<typeof billingInsuranceStore.addTreatment>[1]) {
    return billingInsuranceStore.addTreatment(this.ctx, treatment);
  }
  public updateTreatmentStatus(
    treatmentId: string,
    status: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO',
    completedDate?: string,
    actorUserId?: string
  ) {
    return billingInsuranceStore.updateTreatmentStatus(this.ctx, treatmentId, status, completedDate, actorUserId);
  }
  public recordTreatmentPayment(
    treatmentId: string,
    amount: number,
    paymentMethod: string,
    receiptNumber: string,
    actorUserId?: string
  ) {
    return billingInsuranceStore.recordTreatmentPayment(
      this.ctx,
      treatmentId,
      amount,
      paymentMethod,
      receiptNumber,
      actorUserId
    );
  }
  public annulPayment(params: Parameters<typeof billingInsuranceStore.annulPayment>[1]) {
    return billingInsuranceStore.annulPayment(this.ctx, params);
  }
  public addService(service: Parameters<typeof billingInsuranceStore.addService>[1]) {
    return billingInsuranceStore.addService(this.ctx, service);
  }
  public updateService(
    serviceId: string,
    updates: Parameters<typeof billingInsuranceStore.updateService>[2],
    actorUserId?: string
  ) {
    return billingInsuranceStore.updateService(this.ctx, serviceId, updates, actorUserId);
  }
  public setBranchServicePrice(
    branchId: string,
    serviceId: string,
    customPrice: number,
    isAvailable: boolean = true,
    actorUserId?: string
  ) {
    return billingInsuranceStore.setBranchServicePrice(
      this.ctx,
      branchId,
      serviceId,
      customPrice,
      isAvailable,
      actorUserId
    );
  }
  public createInsurancePlan(plan: Parameters<typeof billingInsuranceStore.createInsurancePlan>[1]) {
    return billingInsuranceStore.createInsurancePlan(this.ctx, plan);
  }
  public updateInsurancePlan(
    planId: string,
    updates: Parameters<typeof billingInsuranceStore.updateInsurancePlan>[2],
    actorUserId?: string
  ) {
    return billingInsuranceStore.updateInsurancePlan(this.ctx, planId, updates, actorUserId);
  }
  public toggleInsurancePlanStatus(planId: string, actorUserId?: string) {
    return billingInsuranceStore.toggleInsurancePlanStatus(this.ctx, planId, actorUserId);
  }
  public setPlanServicePrice(
    planId: string,
    serviceId: string,
    price: number,
    notes?: string,
    actorUserId?: string
  ) {
    return billingInsuranceStore.setPlanServicePrice(this.ctx, planId, serviceId, price, notes, actorUserId);
  }
  public getEffectiveServicePrice(serviceId: string, patientId?: string, branchId?: string) {
    return billingInsuranceStore.getEffectiveServicePrice(this.ctx, serviceId, patientId, branchId);
  }
  public getInsuranceClaims(filters?: Parameters<typeof billingInsuranceStore.getInsuranceClaims>[1]) {
    return billingInsuranceStore.getInsuranceClaims(this.ctx, filters);
  }
  public getNextClaimNumber(planCode = 'SEG') {
    return billingInsuranceStore.getNextClaimNumber(this.ctx, planCode);
  }
  public createInsuranceClaim(params: Parameters<typeof billingInsuranceStore.createInsuranceClaim>[1]) {
    return billingInsuranceStore.createInsuranceClaim(this.ctx, params);
  }
  public updateInsuranceClaimStatus(
    claimId: string,
    status: 'PENDIENTE_ENVIO' | 'EN_AUDITORIA' | 'APROBADO' | 'LIQUIDADO_COBRADO' | 'RECHAZADO',
    options?: { settlementReference?: string; notes?: string; actorUserId?: string }
  ) {
    return billingInsuranceStore.updateInsuranceClaimStatus(this.ctx, claimId, status, options);
  }
  public batchSettleInsuranceClaims(params: Parameters<typeof billingInsuranceStore.batchSettleInsuranceClaims>[1]) {
    return billingInsuranceStore.batchSettleInsuranceClaims(this.ctx, params);
  }
  public getInsuranceClaimsMetrics() {
    return billingInsuranceStore.getInsuranceClaimsMetrics(this.ctx);
  }
  public createQuote(params: Parameters<typeof billingInsuranceStore.createQuote>[1]) {
    return billingInsuranceStore.createQuote(this.ctx, params);
  }
  public updateQuote(quoteId: string, params: Parameters<typeof billingInsuranceStore.updateQuote>[2]) {
    return billingInsuranceStore.updateQuote(this.ctx, quoteId, params);
  }
  public updateQuoteStatus(
    quoteId: string,
    status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'VENCIDO',
    actorUserId?: string,
    autoCreateTreatment: boolean = true
  ) {
    return billingInsuranceStore.updateQuoteStatus(this.ctx, quoteId, status, actorUserId, autoCreateTreatment);
  }
  public openCashRegister(params: Parameters<typeof billingInsuranceStore.openCashRegister>[1]) {
    return billingInsuranceStore.openCashRegister(this.ctx, params);
  }
  public addCashMovement(params: Parameters<typeof billingInsuranceStore.addCashMovement>[1]) {
    return billingInsuranceStore.addCashMovement(this.ctx, params);
  }
  public closeCashRegister(params: Parameters<typeof billingInsuranceStore.closeCashRegister>[1]) {
    return billingInsuranceStore.closeCashRegister(this.ctx, params);
  }

  // --- Gestión Financiera del Personal, Salarios, Comisiones y Pagos ---
  public getEmployeeLinkedToUser(userId?: string | null) {
    return payrollStore.getEmployeeLinkedToUser(this.ctx, userId);
  }
  public getEmployees(filters?: {
    branchId?: string | null;
    area?: StaffArea | 'ALL';
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
    search?: string;
  }) {
    return payrollStore.getEmployees(this.ctx, filters);
  }
  public getAdvisorEmployees(branchId?: string | null) {
    return payrollStore.getAdvisorEmployees(this.ctx, branchId);
  }
  public createEmployee(payload: Parameters<typeof payrollStore.createEmployee>[1]) {
    return payrollStore.createEmployee(this.ctx, payload);
  }
  public updateEmployee(employeeId: string, updates: any, actorUserId?: string | null) {
    return payrollStore.updateEmployee(this.ctx, employeeId, updates, actorUserId);
  }
  public toggleEmployeeStatus(employeeId: string, status?: 'ACTIVE' | 'INACTIVE', actorUserId?: string | null) {
    return payrollStore.toggleEmployeeStatus(this.ctx, employeeId, status, actorUserId);
  }
  public getEmployeeSalaries(employeeId?: string) {
    return payrollStore.getEmployeeSalaries(this.ctx, employeeId);
  }
  public getActiveSalary(employeeId: string) {
    return payrollStore.getActiveSalary(this.ctx, employeeId);
  }
  public registerEmployeeSalary(payload: Parameters<typeof payrollStore.registerEmployeeSalary>[1]) {
    return payrollStore.registerEmployeeSalary(this.ctx, payload);
  }
  public getCommissionRules(filters?: { area?: StaffArea | 'ALL'; status?: 'ACTIVE' | 'INACTIVE' | 'ALL' }) {
    return payrollStore.getCommissionRules(this.ctx, filters);
  }
  public createCommissionRule(payload: Parameters<typeof payrollStore.createCommissionRule>[1]) {
    return payrollStore.createCommissionRule(this.ctx, payload);
  }
  public updateCommissionRule(ruleId: string, updates: any, actorUserId?: string | null) {
    return payrollStore.updateCommissionRule(this.ctx, ruleId, updates, actorUserId);
  }
  public getGeneratedCommissions(filters?: {
    employeeId?: string | null;
    area?: StaffArea | 'ALL';
    status?: string | 'ALL';
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
  }) {
    return payrollStore.getGeneratedCommissions(this.ctx, filters);
  }
  public createManualCommission(payload: Parameters<typeof payrollStore.createManualCommission>[1]) {
    return payrollStore.createManualCommission(this.ctx, payload);
  }
  public getPayrollSettlements(filters?: {
    employeeId?: string | null;
    status?: string | 'ALL';
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
    branchId?: string | null;
    area?: StaffArea | 'ALL';
  }) {
    return payrollStore.getPayrollSettlements(this.ctx, filters);
  }
  public getPayrollSettlementItems(settlementId: string) {
    return payrollStore.getPayrollSettlementItems(this.ctx, settlementId);
  }
  public createPayrollSettlement(
    payload: Parameters<typeof createPayrollSettlementRecord>[1] & { actorUserId?: string | null }
  ) {
    return payrollStore.createPayrollSettlement(this.ctx, payload);
  }
  public submitPayrollSettlement(settlementId: string, actorUserId?: string | null) {
    return payrollStore.submitPayrollSettlement(this.ctx, settlementId, actorUserId);
  }
  public approvePayrollSettlement(settlementId: string, actorUserId?: string | null) {
    return payrollStore.approvePayrollSettlement(this.ctx, settlementId, actorUserId);
  }
  public annulPayrollSettlement(settlementId: string, reason: string, actorUserId?: string | null) {
    return payrollStore.annulPayrollSettlement(this.ctx, settlementId, reason, actorUserId);
  }
  public getStaffPayments(filters?: {
    employeeId?: string | null;
    settlementId?: string | null;
    status?: string | 'ALL';
  }) {
    return payrollStore.getStaffPayments(this.ctx, filters);
  }
  public recordStaffPayment(payload: Parameters<typeof payrollStore.recordStaffPayment>[1]) {
    return payrollStore.recordStaffPayment(this.ctx, payload);
  }
  public annulStaffPayment(paymentId: string, reason: string, actorUserId?: string | null) {
    return payrollStore.annulStaffPayment(this.ctx, paymentId, reason, actorUserId);
  }
  public getPayrollDashboardMetrics(filters?: {
    branchId?: string | null;
    area?: StaffArea | 'ALL';
    employeeId?: string | null;
    periodYear?: number | 'ALL';
    periodMonth?: number | 'ALL';
    status?: string | 'ALL';
  }) {
    return payrollStore.getPayrollDashboardMetrics(this.ctx, filters);
  }
}

export const dbStore = new DatabaseStore();
