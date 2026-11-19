import type { SeedDataResult } from '../seeds/initial-seed.ts';

export interface BackendActorContext {
  userId: string;
  role: string;
  organizationId: string;
  allowedBranchIds?: string[];
  customPermissions?: string[];
  revokedPermissions?: string[];
  assignedRestrictions?: string[];
  allowedNavTabs?: string[];
  permissionsVersion?: number;
}

export interface AuditLogInput {
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
}

export interface StoreContext {
  getData(): SeedDataResult;
  setData(nextData: SeedDataResult): void;
  getOrganizationsList(): any[];
  setOrganizationsList(nextList: any[]): void;
  revokedUserSessions: Map<string, number>;
  getEffectiveActor(actor?: BackendActorContext | null): BackendActorContext | null;
  getCurrentActor(): BackendActorContext | null;
  getSessionToken(): string | null;
  notify(): void;
  saveToStorage(): void;
  saveToLocalStorageOnly(): void;
  emitListeners(): void;
  addAuditLog(entry: AuditLogInput): any;
  revokeUserSessions(userId: string, adminUserId?: string): boolean;
  findUserByEmailOrUsername(identifier: string): any | null;
  getBranches(actor?: BackendActorContext): any[];
  getBranchSettings(branchId: string): any;
  getNextReceiptNumber(): string;
  getNextInvoiceNumber(): string;
  getNextQuoteNumber(): string;
  addCashMovement(params: {
    cashRegisterId: string;
    movementType: 'INGRESO' | 'EGRESO' | 'AJUSTE';
    amount: number;
    paymentMethod: string;
    concept: string;
    referenceNumber?: string;
    receiptNumber?: string;
    patientId?: string;
    treatmentId?: string;
    appointmentId?: string;
    actorUserId: string;
  }): any;
  addTreatment(treatment: {
    patientId: string;
    branchId: string;
    title: string;
    totalAmount: number;
    paidAmount?: number;
    toothNumbers?: number[];
    odontologistId?: string;
    quoteId?: string;
    serviceId?: string;
    appliedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
    appliedPlanId?: string;
    appliedPlanName?: string;
    originalListPrice?: number;
    status?: 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO';
    startDate?: string;
    notes?: string;
    actorUserId?: string;
  }): any;
  recordPatientBranchVisit(patientId: string, branchId: string): void;
}
