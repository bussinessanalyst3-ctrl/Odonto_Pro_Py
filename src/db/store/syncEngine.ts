import { generateInitialSeedData, SeedDataResult } from '../seeds/initial-seed.ts';
import { getApiBaseUrl } from '../../config/apiConfig.ts';
import { ensurePayrollIntegrity } from '../payrollEngine.ts';
import type { BackendActorContext, StoreContext } from './types.ts';

export const SYNC_COLLECTIONS = [
  'roles',
  'organizationsList',
  'branches',
  'branchSettings',
  'dentalChairs',
  'users',
  'userBranches',
  'services',
  'branchServices',
  'insurancePlans',
  'planServicePrices',
  'employees',
  'employeeSalaries',
  'commissionRules',
  'patients',
  'patientBranches',
  'appointments',
  'clinicalRecords',
  'odontograms',
  'odontogramItems',
  'quotes',
  'quoteItems',
  'treatments',
  'insuranceClaims',
  'cashRegisters',
  'cashMovements',
  'payments',
  'payrollSettlements',
  'generatedCommissions',
  'payrollSettlementItems',
  'staffPayments',
  'auditLogs',
] as const;

export function getSyncRecordKey(collection: string, item: any): string {
  if (!item || typeof item !== 'object') return '';
  switch (collection) {
    case 'branchSettings':
      return String(item.branchId || item.id || '');
    case 'userBranches':
      return `${String(item.userId || '')}::${String(item.branchId || '')}`;
    case 'branchServices':
      return `${String(item.branchId || '')}::${String(item.serviceId || '')}`;
    case 'patientBranches':
      return `${String(item.patientId || '')}::${String(item.branchId || '')}`;
    default:
      return String(item.id || '');
  }
}

export class StoreSyncEngine {
  public serverStateVersion: number = 1;
  public serverPermissionsVersion: number | null = null;
  public hasSyncedFromServer: boolean = false;
  public lastSyncedSnapshots: Map<string, Map<string, string>> = new Map();
  public lastSyncedActiveOrgId: string | null = null;
  public lastSyncedRestrictionsJson: string = '[]';
  public deltaFlushQueue: Promise<void> = Promise.resolve();
  public deltaFlushScheduled: boolean = false;
  public mutationEpoch: number = 0;

  private ctx: StoreContext;

  constructor(ctx: StoreContext) {
    this.ctx = ctx;
  }

  public resetTracking(): void {
    this.hasSyncedFromServer = false;
    this.serverPermissionsVersion = null;
    this.lastSyncedSnapshots.clear();
    this.lastSyncedActiveOrgId = null;
  }

  public resetHasSynced(): void {
    this.hasSyncedFromServer = false;
    this.serverPermissionsVersion = null;
  }

  public bumpMutationEpoch(): void {
    this.mutationEpoch += 1;
  }

  public getCollectionArray(col: string): any[] {
    if (col === 'organizationsList') {
      const list = this.ctx.getOrganizationsList();
      return Array.isArray(list) ? list : [];
    }
    const list = (this.ctx.getData() as any)?.[col];
    return Array.isArray(list) ? list : [];
  }

  public commitSyncedSnapshot(stateVersion?: number): void {
    if (typeof stateVersion === 'number' && Number.isFinite(stateVersion)) {
      this.serverStateVersion = stateVersion;
    }
    const data = this.ctx.getData();
    const nextSnapshots = new Map<string, Map<string, string>>();
    for (const col of SYNC_COLLECTIONS) {
      const colMap = new Map<string, string>();
      for (const item of this.getCollectionArray(col)) {
        const key = getSyncRecordKey(col, item);
        if (!key) continue;
        colMap.set(key, JSON.stringify(item));
      }
      nextSnapshots.set(col, colMap);
    }
    this.lastSyncedSnapshots = nextSnapshots;
    this.lastSyncedActiveOrgId = data?.organization?.id || null;
    this.lastSyncedRestrictionsJson = JSON.stringify((data as any)?.regulatoryRestrictions || []);
  }

  public computeDeltaAgainstSynced() {
    const data = this.ctx.getData();
    const upserts: Record<string, any[]> = {};
    const deletes: Record<string, string[]> = {};
    const serializedUpserts = new Map<string, Map<string, string>>();
    const deletedKeys = new Map<string, string[]>();
    let hasChanges = false;

    for (const col of SYNC_COLLECTIONS) {
      const prevMap = this.lastSyncedSnapshots.get(col) || new Map<string, string>();
      const curList = this.getCollectionArray(col);
      const seenKeys = new Set<string>();
      const colUpserts: any[] = [];
      const colSerialized = new Map<string, string>();

      for (const item of curList) {
        const key = getSyncRecordKey(col, item);
        if (!key) continue;
        seenKeys.add(key);
        const serialized = JSON.stringify(item);
        if (prevMap.get(key) !== serialized) {
          colUpserts.push(JSON.parse(serialized));
          colSerialized.set(key, serialized);
        }
      }

      if (colUpserts.length > 0) {
        upserts[col] = colUpserts;
        serializedUpserts.set(col, colSerialized);
        hasChanges = true;
      }

      const colDeletes: string[] = [];
      for (const prevKey of prevMap.keys()) {
        if (!seenKeys.has(prevKey)) {
          colDeletes.push(prevKey);
        }
      }
      if (colDeletes.length > 0) {
        deletes[col] = colDeletes;
        deletedKeys.set(col, colDeletes);
        hasChanges = true;
      }
    }

    const nextActiveOrgId = data?.organization?.id || null;
    const activeOrgChanged = nextActiveOrgId !== null && nextActiveOrgId !== this.lastSyncedActiveOrgId;
    const nextRestrictions = Array.isArray((data as any)?.regulatoryRestrictions)
      ? (data as any).regulatoryRestrictions
      : [];
    const nextRestrictionsJson = JSON.stringify(nextRestrictions);
    const restrictionsChanged = nextRestrictionsJson !== this.lastSyncedRestrictionsJson;

    const delta: any = {
      baseVersion: this.serverStateVersion,
      upserts,
      deletes,
    };

    const isSuperAdmin = this.ctx.getCurrentActor()?.role === 'SUPER_ADMIN';
    if (isSuperAdmin && activeOrgChanged) {
      delta.activeOrganizationId = nextActiveOrgId;
      hasChanges = true;
    }
    if (isSuperAdmin && restrictionsChanged) {
      delta.regulatoryRestrictions = [...nextRestrictions];
      hasChanges = true;
    }

    return {
      delta,
      serializedUpserts,
      deletedKeys,
      nextActiveOrgId,
      nextRestrictionsJson,
      hasChanges,
    };
  }

  private lastFlushError: Error | null = null;

  public async executeDeltaFlush(throwOnError = false): Promise<void> {
    const actor = this.ctx.getCurrentActor();
    const token = this.ctx.getSessionToken();
    if (typeof fetch === 'undefined' || (!actor && !token)) {
      return;
    }
    const {
      delta,
      serializedUpserts,
      deletedKeys,
      nextActiveOrgId,
      nextRestrictionsJson,
      hasChanges,
    } = this.computeDeltaAgainstSynced();

    if (!hasChanges) {
      this.lastFlushError = null;
      return;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token && !token.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${baseUrl}/api/db/delta`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(delta),
      });

      if (res.ok) {
        this.lastFlushError = null;
        const payload = await res.json().catch(() => ({}));
        if (typeof payload?.stateVersion === 'number') {
          this.serverStateVersion = payload.stateVersion;
        }
        for (const [col, upMap] of serializedUpserts.entries()) {
          let colSnap = this.lastSyncedSnapshots.get(col);
          if (!colSnap) {
            colSnap = new Map<string, string>();
            this.lastSyncedSnapshots.set(col, colSnap);
          }
          for (const [k, v] of upMap.entries()) {
            colSnap.set(k, v);
          }
        }
        for (const [col, delList] of deletedKeys.entries()) {
          const colSnap = this.lastSyncedSnapshots.get(col);
          if (colSnap) {
            for (const k of delList) {
              colSnap.delete(k);
            }
          }
        }
        if (delta.activeOrganizationId !== undefined) {
          this.lastSyncedActiveOrgId = nextActiveOrgId;
        }
        if (delta.regulatoryRestrictions !== undefined) {
          this.lastSyncedRestrictionsJson = nextRestrictionsJson;
        }
      } else {
        const errPayload = await res.json().catch(() => ({}));
        const errMessage =
          errPayload?.error ||
          (res.status === 403
            ? 'No tiene permisos para guardar este cambio en la base de datos.'
            : res.status === 401
              ? 'Sesión expirada. Vuelva a iniciar sesión para guardar los cambios.'
              : res.status === 409
                ? 'Conflicto de actualización: otro usuario modificó este registro. Se actualizaron los datos.'
                : `No se pudo guardar en el servidor (HTTP ${res.status}).`);
        const flushErr = new Error(errMessage);
        this.lastFlushError = flushErr;

        if (res.status === 409) {
          await this.syncFromServer();
        } else if (res.status === 401 || res.status === 403) {
          if (throwOnError) {
            await this.syncFromServer();
          } else {
            this.commitSyncedSnapshot();
          }
        }
        if (throwOnError) {
          throw flushErr;
        }
      }
    } catch (err: any) {
      const flushErr =
        err instanceof Error
          ? err
          : new Error('No se pudo conectar con el servidor para guardar los cambios en la base de datos.');
      this.lastFlushError = flushErr;
      if (throwOnError) {
        throw flushErr;
      }
      // Desconexión transitoria en modo silencioso: conservar lastSyncedSnapshots para reintentar
    }
  }

  public scheduleDeltaFlush(): void {
    const actor = this.ctx.getCurrentActor();
    const token = this.ctx.getSessionToken();
    if (typeof fetch === 'undefined' || (!actor && !token)) {
      return;
    }
    if (!this.hasSyncedFromServer) {
      return;
    }
    if (this.deltaFlushScheduled) return;
    this.deltaFlushScheduled = true;

    const runFlush = () => {
      if (!this.deltaFlushScheduled) return;
      this.deltaFlushScheduled = false;
      this.deltaFlushQueue = this.deltaFlushQueue
        .then(async () => {
          await this.executeDeltaFlush(false);
        })
        .catch(() => {});
    };

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(runFlush);
    } else {
      Promise.resolve().then(runFlush);
    }
  }

  public async flushPendingSync(): Promise<void> {
    if (!this.hasSyncedFromServer) return;
    await Promise.resolve();
    await this.deltaFlushQueue;
    if (this.computeDeltaAgainstSynced().hasChanges) {
      this.deltaFlushQueue = this.deltaFlushQueue
        .then(() => this.executeDeltaFlush(false))
        .catch(() => {});
      await this.deltaFlushQueue;
    }
  }

  public async flushPendingSyncStrict(): Promise<void> {
    const actor = this.ctx.getCurrentActor();
    const token = this.ctx.getSessionToken();
    if (typeof fetch === 'undefined' || (!actor && !token) || !this.hasSyncedFromServer) {
      return;
    }

    // Tomar control del flush pendiente para esperar confirmación real del servidor
    this.deltaFlushScheduled = false;
    this.lastFlushError = null;
    await this.deltaFlushQueue;

    if (this.computeDeltaAgainstSynced().hasChanges) {
      let strictError: Error | null = null;
      this.deltaFlushQueue = this.deltaFlushQueue
        .then(async () => {
          try {
            await this.executeDeltaFlush(true);
          } catch (err: any) {
            strictError = err instanceof Error ? err : new Error(String(err || 'Error al sincronizar cambios.'));
          }
        })
        .catch(() => {});
      await this.deltaFlushQueue;
      if (strictError) {
        throw strictError;
      }
    } else if (this.lastFlushError) {
      const err = this.lastFlushError;
      this.lastFlushError = null;
      throw err;
    }
  }

  public async syncFromServer(): Promise<boolean> {
    try {
      if (typeof fetch === 'undefined') return false;
      const actor = this.ctx.getCurrentActor();
      const token = this.ctx.getSessionToken();
      if (!actor && !token) return false;

      if (this.hasSyncedFromServer) {
        await Promise.resolve();
        await this.deltaFlushQueue;
        if (this.computeDeltaAgainstSynced().hasChanges) {
          this.deltaFlushQueue = this.deltaFlushQueue.then(() => this.executeDeltaFlush()).catch(() => {});
          await this.deltaFlushQueue;
        }
      }

      const epochBeforeGet = this.mutationEpoch;
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = {};
      if (token && !token.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${token}`;
      }
      const query = new URLSearchParams({ auditLimit: '100' });
      if (this.hasSyncedFromServer && Number.isFinite(this.serverStateVersion)) {
        query.set('sinceVersion', String(this.serverStateVersion));
        if (this.serverPermissionsVersion !== null) {
          query.set('sincePermVersion', String(this.serverPermissionsVersion));
        }
      }
      const res = await fetch(`${baseUrl}/api/db/state?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const payload = await res.json();
        if (this.mutationEpoch !== epochBeforeGet) {
          return false;
        }
        if (payload?.unchanged === true) {
          if (typeof payload.stateVersion === 'number' && Number.isFinite(payload.stateVersion)) {
            this.serverStateVersion = payload.stateVersion;
          }
          if (typeof payload.permissionsVersion === 'number' && Number.isFinite(payload.permissionsVersion)) {
            this.serverPermissionsVersion = payload.permissionsVersion;
          }
          return true;
        }
        if (payload && payload.data && payload.organizationsList && Array.isArray(payload.organizationsList)) {
          this.ctx.setData(payload.data);
          this.ctx.setOrganizationsList(payload.organizationsList);
          if (typeof payload.permissionsVersion === 'number' && Number.isFinite(payload.permissionsVersion)) {
            this.serverPermissionsVersion = payload.permissionsVersion;
          }
          const data = this.ctx.getData();
          const orgsList = this.ctx.getOrganizationsList();

          const defaultSeed = generateInitialSeedData();
          if (!Array.isArray(data.insurancePlans)) {
            data.insurancePlans = defaultSeed.insurancePlans || [];
          }
          if (!Array.isArray(data.planServicePrices)) {
            data.planServicePrices = defaultSeed.planServicePrices || [];
          }
          if (!Array.isArray(data.insuranceClaims)) {
            data.insuranceClaims = defaultSeed.insuranceClaims || [];
          }
          if (data.patients && Array.isArray(data.patients)) {
            data.patients.forEach((p: any) => {
              if (!p.modality) {
                p.modality = 'PARTICULAR';
                p.insurancePlanId = null;
                p.insuranceMemberNumber = null;
              }
            });
          }
          ensurePayrollIntegrity(data);

          const currentActiveId = data.organization?.id;
          const matched = orgsList.find((o) => o.id === currentActiveId);
          if (matched) {
            data.organization = matched;
          } else if (orgsList.length > 0) {
            data.organization = orgsList[0];
          }
          this.hasSyncedFromServer = true;
          this.commitSyncedSnapshot(Number(payload.stateVersion) || this.serverStateVersion);
          this.ctx.saveToLocalStorageOnly();
          this.ctx.emitListeners();
          return true;
        }
      }
    } catch {
      // Fallback a almacenamiento local si el backend no responde
    }
    return false;
  }

  public applyAuthoritativeUpserts(upserts: Record<string, any[]>, stateVersion?: number): void {
    const data = this.ctx.getData() as any;
    if (!data || !upserts || typeof upserts !== 'object') return;

    const prependCollections = new Set([
      'auditLogs',
      'patients',
      'employees',
      'appointments',
      'payments',
      'cashMovements',
      'cashRegisters',
      'generatedCommissions',
    ]);

    for (const [col, items] of Object.entries(upserts)) {
      if (!Array.isArray(items) || items.length === 0) continue;
      if (col === 'organizationsList') {
        const list = [...this.ctx.getOrganizationsList()];
        for (const item of items) {
          const key = getSyncRecordKey(col, item);
          if (!key) continue;
          const idx = list.findIndex((r) => getSyncRecordKey(col, r) === key);
          if (idx >= 0) list[idx] = item;
          else list.push(item);
        }
        this.ctx.setOrganizationsList(list);
      } else {
        if (!Array.isArray(data[col])) {
          data[col] = [];
        }
        const arr: any[] = data[col];
        for (const item of items) {
          const key = getSyncRecordKey(col, item);
          if (!key) continue;
          const idx = arr.findIndex((r) => getSyncRecordKey(col, r) === key);
          if (idx >= 0) {
            arr[idx] = item;
          } else if (prependCollections.has(col)) {
            arr.unshift(item);
          } else {
            arr.push(item);
          }
        }
      }

      let colSnap = this.lastSyncedSnapshots.get(col);
      if (!colSnap) {
        colSnap = new Map<string, string>();
        this.lastSyncedSnapshots.set(col, colSnap);
      }
      for (const item of items) {
        const key = getSyncRecordKey(col, item);
        if (key) {
          colSnap.set(key, JSON.stringify(item));
        }
      }
    }

    if (typeof stateVersion === 'number' && Number.isFinite(stateVersion)) {
      this.serverStateVersion = stateVersion;
    }
    this.hasSyncedFromServer = true;
    this.bumpMutationEpoch();
    this.ctx.saveToLocalStorageOnly();
    this.ctx.emitListeners();
  }

  public applyServerSeedState(serverData: SeedDataResult, serverOrganizationsList: any[], stateVersion?: number): void {
    if (!serverData || !Array.isArray(serverOrganizationsList)) return;
    this.ctx.setData(serverData);
    this.ctx.setOrganizationsList(serverOrganizationsList);
    this.ctx.revokedUserSessions.clear();
    this.hasSyncedFromServer = true;
    this.commitSyncedSnapshot(stateVersion);
    this.ctx.saveToLocalStorageOnly();
    this.ctx.emitListeners();
  }

  public async resetToSeedFromServer(
    sessionToken?: string | null,
    actor?: BackendActorContext | null
  ): Promise<{ success: boolean; error?: string }> {
    const token = sessionToken || this.ctx.getSessionToken();
    const effectiveActor = actor || this.ctx.getCurrentActor();
    if (!token && !effectiveActor) {
      throw new Error('401 No autorizado: Se requiere sesión activa de Super Administrador.');
    }

    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token && !token.startsWith('httpOnly_')) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/db/reset-seed`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({}),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.success) {
      throw new Error(
        payload.error ||
          (res.status === 401
            ? '401 No autorizado: Sesión inválida o expirada.'
            : '403 Prohibido: Solo el Super Administrador puede restaurar los datos iniciales de prueba.')
      );
    }

    if (payload.data && Array.isArray(payload.organizationsList)) {
      this.applyServerSeedState(payload.data, payload.organizationsList, Number(payload.stateVersion) || undefined);
    } else {
      await this.syncFromServer();
    }

    return { success: true };
  }
}
