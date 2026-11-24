import express from 'express';
import crypto from 'crypto';
import { generateInitialSeedData } from '../../src/db/seeds/initial-seed.ts';
import {
  canManageRole,
  isSuperAdminRole,
  validateBackendAuthorization,
} from '../../src/security/rbacHierarchy.ts';
import { ensurePayrollIntegrity, UNKNOWN_CREATOR_LABEL } from '../../src/db/payrollEngine.ts';
import {
  COLLECTION_PARENT_TO_CHILD_ORDER,
  DbDeltaPayload,
  getRecordKey,
} from '../../src/db/pgRepository.ts';
import { createPbkdf2Hash, sanitizeUsersForClient } from '../crypto.ts';
import {
  actorHasDynamicPermission,
  CLINICAL_ACCESS_ROLES,
  filterStateForTenant,
  getPgPool,
  getRecordVersion,
  getServerDbState,
  getServerStateVersion,
  saveDatabaseState,
  saveDatabaseStateStrict,
  setServerDbState,
  TenantActorContext,
  withOrgTransactionLock,
} from '../stateStore.ts';
import {
  activeServerSessions,
  authenticateServerRequest,
  deleteSessionFromDb,
  denyIfModuleNotAllowed,
  getRequiredModulesForDeltaCollection,
  saveServerSessions,
} from '../security.ts';

function validateCollectionPermissionForActor(
  col: string,
  operation: 'upsert' | 'delete',
  actor: TenantActorContext,
  roles: any[],
  canWriteClinical: boolean
): string | null {
  const can = (perm: string) => actorHasDynamicPermission(actor, perm, roles);

  switch (col) {
    case 'organizationsList':
      return '403 Prohibido: Solo el Super Administrador puede modificar organizaciones.';
    case 'roles':
      return '403 Prohibido: Solo el Super Administrador puede modificar roles del sistema.';
    case 'auditLogs':
      if (operation === 'delete') {
        return '403 Prohibido: Los registros de auditoría son inmutables y no pueden eliminarse.';
      }
      return null;
    case 'branches':
    case 'dentalChairs':
      if (col === 'branches' && operation === 'delete' && !can('branches.delete')) {
        return '403 Prohibido: No posee permiso branches.delete para eliminar sucursales.';
      }
      if (
        !can('branches.create') &&
        !can('branches.update') &&
        !can('branches.update_own') &&
        !can('branches.delete')
      ) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'branchSettings':
      if (
        !can('settings.update') &&
        !can('settings.update_own_branch') &&
        !can('branches.update') &&
        !can('branches.update_own')
      ) {
        return '403 Prohibido: Permiso insuficiente para modificar configuración de sucursal.';
      }
      return null;
    case 'users':
    case 'userBranches':
      if (
        col === 'users' &&
        operation === 'delete' &&
        !can('users.deactivate') &&
        !can('users.deactivate_operational') &&
        !can('users.update')
      ) {
        return '403 Prohibido: Permiso insuficiente para eliminar usuarios.';
      }
      if (
        !can('users.create') &&
        !can('users.create_operational') &&
        !can('users.update') &&
        !can('users.update_operational') &&
        !can('users.deactivate') &&
        !can('users.deactivate_operational') &&
        !can('roles.manage')
      ) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'services':
    case 'branchServices':
      if (!can('treatments.manage') && !can('settings.update') && !can('branches.update')) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'insurancePlans':
    case 'planServicePrices':
      if (!can('plans.manage')) {
        return `403 Prohibido: No posee permiso plans.manage para modificar ${col}.`;
      }
      return null;
    case 'patients':
    case 'patientBranches':
      if (col === 'patients' && operation === 'delete') {
        return '403 Prohibido: Prohibido eliminar físicamente fichas de pacientes; use baja lógica.';
      }
      if (
        !can('patients.manage') &&
        !can('patients.assign_advisor') &&
        !can('appointments.manage') &&
        !can('appointments.manage_own_branch') &&
        !can('clinical.manage') &&
        !can('odontogram.manage')
      ) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'appointments':
      if (
        !can('appointments.manage') &&
        !can('appointments.manage_own_branch') &&
        !can('appointments.checkin') &&
        !can('appointments.block') &&
        !can('clinical.manage')
      ) {
        return '403 Prohibido: Permiso insuficiente para modificar turnos y agenda.';
      }
      return null;
    case 'clinicalRecords':
    case 'odontograms':
    case 'odontogramItems':
      if (
        !canWriteClinical ||
        (!can('clinical.manage') && !can('odontogram.manage') && !can('anamnesis.manage'))
      ) {
        return '403 Prohibido: Su rol no tiene permisos para modificar registros clínicos u odontogramas.';
      }
      return null;
    case 'quotes':
    case 'quoteItems':
      if (!can('quotes.create') && !can('quotes.manage') && !can('quotes.approve')) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'treatments':
      if (
        !can('treatments.manage') &&
        !can('clinical.manage') &&
        !can('odontogram.manage') &&
        !can('quotes.manage') &&
        !can('quotes.approve') &&
        !can('payments.create') &&
        !can('payments.annul')
      ) {
        return '403 Prohibido: Permiso insuficiente para modificar tratamientos.';
      }
      return null;
    case 'insuranceClaims':
      if (
        !can('plans.manage') &&
        !can('treatments.manage') &&
        !can('clinical.manage') &&
        !can('payments.create')
      ) {
        return '403 Prohibido: Permiso insuficiente para modificar reclamos de seguro.';
      }
      return null;
    case 'cashRegisters':
    case 'cashMovements':
    case 'payments':
      if (
        !can('cash.open_close') &&
        !can('cash.movement') &&
        !can('cash.manage_own_branch') &&
        !can('payments.create') &&
        !can('payments.annul') &&
        !can('invoices.issue')
      ) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'employees':
      if (!can('staff.manage')) {
        return '403 Prohibido: No posee permiso staff.manage para modificar personal.';
      }
      return null;
    case 'employeeSalaries':
      if (!can('salaries.manage')) {
        return '403 Prohibido: No posee permiso salaries.manage para modificar salarios.';
      }
      return null;
    case 'commissionRules':
      if (!can('commissions.rules_manage')) {
        return '403 Prohibido: No posee permiso commissions.rules_manage.';
      }
      return null;
    case 'generatedCommissions':
      if (operation === 'delete' && !can('payroll.approve') && !can('commissions.rules_manage')) {
        return '403 Prohibido: Permiso insuficiente para eliminar comisiones.';
      }
      if (
        !can('payroll.create') &&
        !can('payroll.approve') &&
        !can('payroll.pay') &&
        !can('commissions.rules_manage') &&
        !can('payments.create') &&
        !can('payments.annul') &&
        !can('treatments.manage') &&
        !can('patients.manage')
      ) {
        return '403 Prohibido: Permiso insuficiente para modificar comisiones generadas.';
      }
      return null;
    case 'payrollSettlements':
    case 'payrollSettlementItems':
      if (!can('payroll.create') && !can('payroll.approve') && !can('payroll.pay')) {
        return `403 Prohibido: Permiso insuficiente para modificar ${col}.`;
      }
      return null;
    case 'staffPayments':
      if (!can('payroll.pay') && !can('payroll.approve')) {
        return '403 Prohibido: No posee permiso payroll.pay para modificar pagos al personal.';
      }
      return null;
    default:
      return `403 Prohibido: Colección no autorizada (${col}).`;
  }
}

export function createDbSyncRouter(): express.Router {
  const router = express.Router();

  // GET /api/health
  router.get('/health', async (_req, res) => {
    const pgPool = getPgPool();
    let dbStatus = 'local-fallback';
    let migrationsApplied: number | null = null;
    if (pgPool) {
      try {
        await pgPool.query('SELECT 1');
        dbStatus = 'connected';
        try {
          const migRes = await pgPool.query('SELECT COUNT(*)::int AS cnt FROM schema_migrations');
          migrationsApplied = migRes.rows?.[0]?.cnt ?? 0;
        } catch {
          migrationsApplied = null;
        }
      } catch {
        dbStatus = 'error';
        return res.status(503).json({
          status: 'degraded',
          timestamp: new Date().toISOString(),
          uptimeSec: Math.round(process.uptime()),
          db: dbStatus,
        });
      }
    }
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      db: dbStatus,
      ...(migrationsApplied !== null ? { migrationsApplied } : {}),
    });
  });

  // GET /api/db/state
  router.get('/db/state', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({
        error: auth.error || '401 No autorizado: Se requiere sesión autenticada.',
      });
    }
    const serverDbState = getServerDbState();
    const stateVersion = getServerStateVersion();

    if (isSuperAdminRole(auth.user.roleId)) {
      return res.json({
        stateVersion,
        ...serverDbState,
        data: {
          ...serverDbState.data,
          users: sanitizeUsersForClient(serverDbState.data.users || []),
        },
      });
    }

    const isolatedState = filterStateForTenant(serverDbState, auth.actor);
    return res.json({
      stateVersion,
      ...isolatedState,
    });
  });

  // POST /api/db/reset-seed - Exclusivo SUPER_ADMIN
  router.post('/db/reset-seed', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({
          error: auth.error || '401 No autorizado: Se requiere autenticación válida.',
        });
      }

      const authz = validateBackendAuthorization({
        actor: auth.actor,
        resource: 'DATABASE',
        action: 'SEED',
        permission: 'database.seed',
      });

      const serverDbState = getServerDbState();
      if (!authz.authorized || !isSuperAdminRole(auth.user.roleId)) {
        const deniedLog = {
          id: crypto.randomUUID(),
          organizationId: auth.user.organizationId || serverDbState.data.organization?.id,
          branchId: null,
          userId: auth.user.id,
          action: 'ACCESS_DENIED_SECURITY',
          entity: 'DATABASE',
          entityId: 'RESET_SEED',
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Backend API',
          oldValues: null,
          newValues: { attemptedRole: auth.user.roleId },
          description: `Intento bloqueado de restaurar datos de prueba por rol no autorizado (${auth.user.roleId} - ${auth.user.email})`,
          createdAt: new Date().toISOString(),
        };
        serverDbState.data.auditLogs?.unshift(deniedLog);
        await saveDatabaseState({ upserts: { auditLogs: [deniedLog] } });

        return res.status(403).json({
          error:
            '403 Prohibido: Solo el Super Administrador tiene autorización para restaurar los datos iniciales de prueba de Paraguay.',
        });
      }

      const initial = generateInitialSeedData();
      initial.auditLogs.unshift({
        id: crypto.randomUUID(),
        organizationId: initial.organization.id,
        branchId: null,
        userId: auth.user.id,
        action: 'SYSTEM_RESET_SEED',
        entity: 'DATABASE',
        entityId: 'ALL',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'OdontoPro Security Engine',
        oldValues: null,
        newValues: { resetAt: new Date().toISOString(), executedBy: auth.user.email },
        description: 'Restablecimiento de fábrica a catálogo inicial autorizado por Super Administrador',
        createdAt: new Date().toISOString(),
      });

      const nextState = {
        data: initial,
        organizationsList: [initial.organization],
      };
      setServerDbState(nextState);

      const survivingUserIds = new Set((nextState.data.users || []).map((u: any) => u.id));
      for (const [sessToken, sess] of activeServerSessions.entries()) {
        if (!survivingUserIds.has(sess.userId)) {
          activeServerSessions.delete(sessToken);
          deleteSessionFromDb(sessToken);
        }
      }

      await saveDatabaseState();
      saveServerSessions();

      return res.json({
        success: true,
        stateVersion: getServerStateVersion(),
        timestamp: new Date().toISOString(),
        data: {
          ...nextState.data,
          users: sanitizeUsersForClient(nextState.data.users || []),
        },
        organizationsList: nextState.organizationsList,
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/db/delta - Sincronización granular transaccional con RBAC y bloqueo optimista por clave
  router.post('/db/delta', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({
          error: auth.error || '401 No autorizado: Se requiere sesión autenticada para sincronizar cambios.',
        });
      }

      const actor = auth.actor;
      const authUser = auth.user;
      const body = (req.body || {}) as DbDeltaPayload;
      const upserts = body.upserts && typeof body.upserts === 'object' ? body.upserts : {};
      const deletes = body.deletes && typeof body.deletes === 'object' ? body.deletes : {};

      const isSuperAdmin = isSuperAdminRole(authUser.roleId);
      const actorOrgId = actor.organizationId;
      const lockOrgId = isSuperAdmin
        ? String(body.activeOrganizationId || getServerDbState().data?.organization?.id || '__global__')
        : String(actorOrgId || '__global__');

      return await withOrgTransactionLock(lockOrgId, async () => {
        const serverDbState = getServerDbState();
        const cur = serverDbState.data || {};
        const curOrgs = serverDbState.organizationsList || [];
        const roles = cur.roles || [];

        const canWriteClinical =
          CLINICAL_ACCESS_ROLES.has(auth.actor!.role) ||
          actorHasDynamicPermission(auth.actor!, 'clinical.manage', roles) ||
          actorHasDynamicPermission(auth.actor!, 'odontogram.manage', roles);

        const allowedCollections = new Set<string>(COLLECTION_PARENT_TO_CHILD_ORDER);

        // Detección de conflicto optimista a nivel de registro (si el cliente envía baseVersion atrasada)
        const currentVersion = getServerStateVersion();
        if (
          typeof body.baseVersion === 'number' &&
          Number.isFinite(body.baseVersion) &&
          body.baseVersion < currentVersion
        ) {
          const conflicts: Array<{ collection: string; key: string; recordVersion: number }> = [];
          for (const [col, items] of Object.entries(upserts)) {
            if (col === 'auditLogs' || !allowedCollections.has(col) || !Array.isArray(items)) continue;
            for (const item of items) {
              const key = getRecordKey(col, item);
              if (!key) continue;
              const recVer = getRecordVersion(col, key);
              if (recVer > body.baseVersion) {
                conflicts.push({ collection: col, key, recordVersion: recVer });
              }
            }
          }
          for (const [col, keys] of Object.entries(deletes)) {
            if (col === 'auditLogs' || !allowedCollections.has(col) || !Array.isArray(keys)) continue;
            for (const key of keys) {
              const strKey = String(key || '');
              if (!strKey) continue;
              const recVer = getRecordVersion(col, strKey);
              if (recVer > body.baseVersion) {
                conflicts.push({ collection: col, key: strKey, recordVersion: recVer });
              }
            }
          }
          if (conflicts.length > 0) {
            return res.status(409).json({
              error:
                'Conflicto de concurrencia optimista: otro usuario modificó este registro recientemente. Sincronice los datos antes de reintentar.',
              code: 'CONFLICT_OPTIMISTIC_LOCK',
              serverStateVersion: currentVersion,
              conflicts,
            });
          }
        }

      const branchOrgMap = new Map<string, string>(
        [...(cur.branches || []), ...(upserts.branches || [])].map((b: any) => [
          String(b.id),
          String(b.organizationId),
        ])
      );
      const patientOrgMap = new Map<string, string>(
        [...(cur.patients || []), ...(upserts.patients || [])].map((p: any) => [
          String(p.id),
          String(p.organizationId),
        ])
      );
      const quoteOrgMap = new Map<string, string>(
        [...(cur.quotes || []), ...(upserts.quotes || [])].map((q: any) => [
          String(q.id),
          String(q.organizationId),
        ])
      );
      const planOrgMap = new Map<string, string>(
        [...(cur.insurancePlans || []), ...(upserts.insurancePlans || [])].map((p: any) => [
          String(p.id),
          String(p.organizationId),
        ])
      );
      const odontogramOrgMap = new Map<string, string>(
        [...(cur.odontograms || []), ...(upserts.odontograms || [])].map((o: any) => [
          String(o.id),
          String(o.organizationId),
        ])
      );
      const cashRegOrgMap = new Map<string, string>(
        [...(cur.cashRegisters || []), ...(upserts.cashRegisters || [])].map((c: any) => [
          String(c.id),
          String(c.organizationId),
        ])
      );
      const empOrgMap = new Map<string, string>(
        [...(cur.employees || []), ...(upserts.employees || [])].map((e: any) => [
          String(e.id),
          String(e.organizationId),
        ])
      );
      const settleOrgMap = new Map<string, string>(
        [...(cur.payrollSettlements || []), ...(upserts.payrollSettlements || [])].map((s: any) => [
          String(s.id),
          String(s.organizationId),
        ])
      );

      const belongsToActorOrg = (col: string, item: any): boolean => {
        if (!item || typeof item !== 'object') return false;
        if (item.organizationId !== undefined && item.organizationId !== null) {
          return item.organizationId === actorOrgId;
        }
        switch (col) {
          case 'branchSettings':
          case 'branchServices':
          case 'userBranches':
            return branchOrgMap.get(String(item.branchId)) === actorOrgId;
          case 'patientBranches':
            return patientOrgMap.get(String(item.patientId)) === actorOrgId;
          case 'planServicePrices':
            return planOrgMap.get(String(item.planId || item.insurancePlanId)) === actorOrgId;
          case 'odontogramItems':
            return odontogramOrgMap.get(String(item.odontogramId)) === actorOrgId;
          case 'quoteItems':
            return quoteOrgMap.get(String(item.quoteId)) === actorOrgId;
          case 'cashMovements':
            return cashRegOrgMap.get(String(item.cashRegisterId)) === actorOrgId;
          case 'employeeSalaries':
            return empOrgMap.get(String(item.employeeId)) === actorOrgId;
          case 'payrollSettlementItems':
            return settleOrgMap.get(String(item.settlementId)) === actorOrgId;
          default:
            return false;
        }
      };

      const existingUserMap = new Map<string, any>((cur.users || []).map((u: any) => [u.id, u]));
      const existingPatientsMap = new Map<string, any>((cur.patients || []).map((p: any) => [p.id, p]));
      const existingBranchesMap = new Map<string, any>((cur.branches || []).map((b: any) => [b.id, b]));

      const normalizeUserRecord = (incomingUser: any) => {
        const existing = existingUserMap.get(incomingUser.id);
        if (existing) {
          return {
            ...existing,
            ...incomingUser,
            passwordHash: existing.passwordHash,
            passwordSalt: existing.passwordSalt,
            passwordIterations: existing.passwordIterations || 100000,
          };
        }
        if (
          !incomingUser.passwordHash ||
          !incomingUser.passwordSalt ||
          String(incomingUser.passwordHash).startsWith('$2b$10$e8wDbg')
        ) {
          const defaultRecord = createPbkdf2Hash(crypto.randomBytes(16).toString('hex'));
          return {
            ...incomingUser,
            passwordHash: defaultRecord.hash,
            passwordSalt: defaultRecord.salt,
            passwordIterations: defaultRecord.iterations,
          };
        }
        return incomingUser;
      };

      if (!isSuperAdmin) {
        if (body.regulatoryRestrictions !== undefined || (body.activeOrganizationId && body.activeOrganizationId !== actorOrgId)) {
          return res.status(403).json({
            error: '403 Prohibido: Solo el Super Administrador puede modificar directivas globales o cambiar de organización.',
          });
        }
        if ((upserts.auditLogs || []).some((log: any) => log?.action === 'SYSTEM_RESET_SEED')) {
          return res.status(403).json({ error: '403 Prohibido: Acción reservada para el Super Administrador.' });
        }

        // Validación RBAC estricta y control de módulos por colección en upserts y deletes
        for (const [col, items] of Object.entries(upserts)) {
          if (!allowedCollections.has(col) || !Array.isArray(items) || items.length === 0) continue;
          const requiredMods = getRequiredModulesForDeltaCollection(col);
          if (requiredMods && denyIfModuleNotAllowed(auth, res, requiredMods, `POST /api/db/delta upsert:${col}`)) {
            return;
          }
          const errMsg = validateCollectionPermissionForActor(col, 'upsert', actor, roles, canWriteClinical);
          if (errMsg) {
            return res.status(403).json({ error: errMsg });
          }
        }
        for (const [col, keys] of Object.entries(deletes)) {
          if (!allowedCollections.has(col) || !Array.isArray(keys) || keys.length === 0) continue;
          const requiredMods = getRequiredModulesForDeltaCollection(col);
          if (requiredMods && denyIfModuleNotAllowed(auth, res, requiredMods, `POST /api/db/delta delete:${col}`)) {
            return;
          }
          const errMsg = validateCollectionPermissionForActor(col, 'delete', actor, roles, canWriteClinical);
          if (errMsg) {
            return res.status(403).json({ error: errMsg });
          }
        }
      }

      if ((deletes.payrollSettlements?.length || 0) > 0) {
        const delSettleIds = new Set(deletes.payrollSettlements);
        const blocked = (cur.payrollSettlements || []).some(
          (s: any) => delSettleIds.has(s.id) && s.status !== 'BORRADOR'
        );
        if (blocked) {
          return res.status(403).json({
            error: '403 Prohibido: No se permite eliminar físicamente liquidaciones confirmadas; use anulación lógica.',
          });
        }
      }
      if ((deletes.staffPayments?.length || 0) > 0) {
        return res.status(403).json({
          error: '403 Prohibido: No se permite eliminar físicamente pagos al personal; use anulación lógica.',
        });
      }

      const sanitizedUpserts: Record<string, any[]> = {};
      const sanitizedDeletes: Record<string, string[]> = {};

      for (const [col, items] of Object.entries(upserts)) {
        if (!allowedCollections.has(col) || !Array.isArray(items) || items.length === 0) continue;
        const accepted: any[] = [];

        for (const rawItem of items) {
          if (!rawItem || typeof rawItem !== 'object') continue;
          if (!isSuperAdmin && col !== 'organizationsList' && col !== 'roles' && !belongsToActorOrg(col, rawItem)) {
            return res.status(403).json({ error: `403 Prohibido: Violación de aislamiento multiempresa en colección ${col}.` });
          }

          let item = { ...rawItem };
          if (col === 'users') {
            if (!isSuperAdmin && isSuperAdminRole(item.roleId)) {
              return res.status(403).json({ error: '403 Prohibido: No puede crear o modificar cuentas de Super Administrador.' });
            }
            if (!isSuperAdmin && item.id !== authUser.id && !canManageRole(actor.role, item.roleId)) {
              return res.status(403).json({
                error: `403 Prohibido: Jerarquía insuficiente para crear o editar un usuario con rol ${item.roleId}.`,
              });
            }
            const existingTarget = existingUserMap.get(item.id);
            const sameList = (a: unknown, b: unknown): boolean => {
              const arrA = Array.isArray(a) ? Array.from(new Set(a.map((v) => String(v)))).sort() : [];
              const arrB = Array.isArray(b) ? Array.from(new Set(b.map((v) => String(v)))).sort() : [];
              if (arrA.length !== arrB.length) return false;
              return arrA.every((val, idx) => val === arrB[idx]);
            };

            if (existingTarget) {
              const triesToChangeOverrides =
                (rawItem.customPermissions !== undefined &&
                  !sameList(rawItem.customPermissions, existingTarget.customPermissions)) ||
                (rawItem.revokedPermissions !== undefined &&
                  !sameList(rawItem.revokedPermissions, existingTarget.revokedPermissions)) ||
                (rawItem.assignedRestrictions !== undefined &&
                  !sameList(rawItem.assignedRestrictions, existingTarget.assignedRestrictions)) ||
                (rawItem.allowedNavTabs !== undefined &&
                  !sameList(rawItem.allowedNavTabs, existingTarget.allowedNavTabs));

              if (item.id === authUser.id) {
                // Prevenir auto-escalamiento incluso en allowedNavTabs
                item.roleId = existingTarget.roleId;
                item.customPermissions = Array.isArray(existingTarget.customPermissions)
                  ? [...existingTarget.customPermissions]
                  : [];
                item.revokedPermissions = Array.isArray(existingTarget.revokedPermissions)
                  ? [...existingTarget.revokedPermissions]
                  : [];
                item.assignedRestrictions = Array.isArray(existingTarget.assignedRestrictions)
                  ? [...existingTarget.assignedRestrictions]
                  : [];
                item.allowedNavTabs = Array.isArray(existingTarget.allowedNavTabs)
                  ? [...existingTarget.allowedNavTabs]
                  : [];
                item.permissionsVersion = Number(existingTarget.permissionsVersion) || 1;
              } else if (triesToChangeOverrides) {
                return res.status(403).json({
                  error:
                    '403 Prohibido: Los permisos individuales de usuarios solo pueden modificarse mediante PUT /api/users/:id/permissions.',
                });
              }
            } else {
              // Alta nueva por delta: sin inyección directa de overrides de permisos
              item.customPermissions = [];
              item.revokedPermissions = [];
              item.assignedRestrictions = [];
              item.allowedNavTabs = [];
              item.permissionsVersion = 1;
            }

            item = normalizeUserRecord(item);
          } else if (col === 'branches' && !isSuperAdmin) {
            const exists = existingBranchesMap.has(item.id);
            if (!exists && !actorHasDynamicPermission(actor, 'branches.create', roles)) {
              return res.status(403).json({ error: '403 Prohibido: No posee permiso branches.create para crear sucursales.' });
            }
            if (actor.role === 'ADMIN_SUCURSAL' && !actor.allowedBranchIds.includes(item.id)) {
              return res.status(403).json({ error: '403 Prohibido: No puede modificar una sucursal no asignada.' });
            }
          } else if (col === 'branchSettings' && !isSuperAdmin && actor.role === 'ADMIN_SUCURSAL') {
            if (!actor.allowedBranchIds.includes(item.branchId)) {
              return res.status(403).json({ error: '403 Prohibido: No puede modificar parámetros de una sucursal no asignada.' });
            }
          } else if (col === 'patients') {
            const existingPat = existingPatientsMap.get(item.id);
            const advisorChanged = existingPat
              ? item.assignedAdvisorId !== undefined && item.assignedAdvisorId !== existingPat.assignedAdvisorId
              : Boolean(item.assignedAdvisorId);
            if (!isSuperAdmin && advisorChanged && !actorHasDynamicPermission(auth.actor!, 'patients.assign_advisor', roles)) {
              return res.status(403).json({ error: '403 Prohibido: No posee permiso patients.assign_advisor.' });
            }
            if (existingPat) {
              item.createdByUserId = existingPat.createdByUserId ?? null;
              item.createdByNameSnapshot = existingPat.createdByNameSnapshot || UNKNOWN_CREATOR_LABEL;
            }
          } else if (col === 'cashRegisters') {
            if (item.status === 'ABIERTA' && item.branchId) {
              const conflictOpen = [...(cur.cashRegisters || []), ...accepted].some(
                (cr: any) => cr.id !== item.id && cr.branchId === item.branchId && cr.status === 'ABIERTA'
              );
              if (conflictOpen) {
                return res.status(409).json({
                  error: 'Ya existe una caja abierta en esta sucursal. Cierre la caja activa antes de abrir otra.',
                  code: 'CONFLICT_OPEN_CASH_REGISTER',
                });
              }
            }
          } else if (col === 'payments') {
            const amt = Number(item.amount);
            if (!Number.isFinite(amt) || amt <= 0) {
              return res.status(400).json({ error: 'El monto del pago debe ser superior a ₲ 0.' });
            }
            if (item.status !== 'ANULADO' && item.receiptNumber) {
              const dupReceipt = [...(cur.payments || []), ...accepted].some(
                (p: any) =>
                  p.id !== item.id &&
                  p.organizationId === item.organizationId &&
                  p.status !== 'ANULADO' &&
                  String(p.receiptNumber).trim() === String(item.receiptNumber).trim()
              );
              if (dupReceipt) {
                return res.status(409).json({
                  error: `El número de recibo ${item.receiptNumber} ya fue emitido en esta organización.`,
                  code: 'CONFLICT_DUPLICATE_RECEIPT',
                });
              }
            }
          } else if (col === 'cashMovements') {
            const amt = Number(item.amount);
            if (!Number.isFinite(amt) || amt <= 0) {
              return res.status(400).json({ error: 'El monto del movimiento de caja debe ser superior a ₲ 0.' });
            }
          }
          accepted.push(item);
        }

        if (accepted.length > 0) sanitizedUpserts[col] = accepted;
      }

      for (const [col, keys] of Object.entries(deletes)) {
        if (!allowedCollections.has(col) || !Array.isArray(keys) || keys.length === 0) continue;
        const currentList: any[] = col === 'organizationsList' ? curOrgs : cur[col] || [];
        const currentByKey = new Map<string, any>(currentList.map((r: any) => [getRecordKey(col, r), r]));
        const validDeletes: string[] = [];

        for (const key of keys) {
          const strKey = String(key);
          const existing = currentByKey.get(strKey);
          if (!existing) continue;
          if (!isSuperAdmin && !belongsToActorOrg(col, existing)) {
            return res.status(403).json({ error: `403 Prohibido: Violación multiempresa al eliminar en ${col}.` });
          }
          if (!isSuperAdmin && col === 'users') {
            if (isSuperAdminRole(existing.roleId)) {
              return res.status(403).json({ error: '403 Prohibido: No puede eliminar al Super Administrador.' });
            }
            if (!canManageRole(actor.role, existing.roleId)) {
              return res.status(403).json({
                error: `403 Prohibido: Jerarquía insuficiente para eliminar usuario con rol ${existing.roleId}.`,
              });
            }
          }
          validDeletes.push(strKey);
        }

        if (validDeletes.length > 0) sanitizedDeletes[col] = validDeletes;
      }

      const prevCollectionsSnapshot = new Map<string, any[]>();
      const touchedCols = new Set<string>([
        ...Object.keys(sanitizedUpserts),
        ...Object.keys(sanitizedDeletes),
      ]);
      for (const col of touchedCols) {
        prevCollectionsSnapshot.set(
          col,
          col === 'organizationsList'
            ? [...serverDbState.organizationsList]
            : [...(serverDbState.data[col] || [])]
        );
      }
      const prevOrg = serverDbState.data.organization;
      const prevRestrictions = serverDbState.data.regulatoryRestrictions;

      try {
        for (const [col, items] of Object.entries(sanitizedUpserts)) {
          const targetArray: any[] =
            col === 'organizationsList' ? [...serverDbState.organizationsList] : [...(serverDbState.data[col] || [])];
          const idxByKey = new Map<string, number>();
          targetArray.forEach((row, idx) => idxByKey.set(getRecordKey(col, row), idx));

          for (const item of items) {
            const key = getRecordKey(col, item);
            if (!key) continue;
            const existingIdx = idxByKey.get(key);
            if (existingIdx !== undefined) {
              targetArray[existingIdx] = item;
            } else {
              if (col === 'auditLogs' || col === 'patients' || col === 'employees') {
                targetArray.unshift(item);
                idxByKey.clear();
                targetArray.forEach((row, idx) => idxByKey.set(getRecordKey(col, row), idx));
              } else {
                idxByKey.set(key, targetArray.length);
                targetArray.push(item);
              }
            }
          }

          if (col === 'organizationsList') {
            serverDbState.organizationsList = targetArray;
          } else {
            serverDbState.data[col] = targetArray;
          }
        }

        for (const [col, keys] of Object.entries(sanitizedDeletes)) {
          const delSet = new Set(keys);
          if (col === 'organizationsList') {
            serverDbState.organizationsList = serverDbState.organizationsList.filter(
              (r: any) => !delSet.has(getRecordKey(col, r))
            );
          } else {
            serverDbState.data[col] = (serverDbState.data[col] || []).filter(
              (r: any) => !delSet.has(getRecordKey(col, r))
            );
          }
        }

        if (isSuperAdmin && body.regulatoryRestrictions !== undefined && Array.isArray(body.regulatoryRestrictions)) {
          serverDbState.data.regulatoryRestrictions = [...body.regulatoryRestrictions];
        }

        if (isSuperAdmin && body.activeOrganizationId) {
          const nextOrg = serverDbState.organizationsList.find((o: any) => o.id === body.activeOrganizationId);
          if (nextOrg) {
            serverDbState.data.organization = nextOrg;
          }
        } else if (serverDbState.data.organization?.id) {
          const refreshedOrg = serverDbState.organizationsList.find(
            (o: any) => o.id === serverDbState.data.organization.id
          );
          if (refreshedOrg) {
            serverDbState.data.organization = refreshedOrg;
          }
        }

        ensurePayrollIntegrity(serverDbState.data);

        const appliedDelta: DbDeltaPayload = {
          upserts: sanitizedUpserts,
          deletes: sanitizedDeletes,
          activeOrganizationId: serverDbState.data.organization?.id,
          regulatoryRestrictions: serverDbState.data.regulatoryRestrictions,
        };

        const committedVersion = await saveDatabaseStateStrict(appliedDelta);

        return res.json({
          success: true,
          stateVersion: committedVersion,
          timestamp: new Date().toISOString(),
        });
      } catch (persistErr: any) {
        // Rollback en memoria si falla la persistencia relacional
        for (const [col, oldArr] of prevCollectionsSnapshot.entries()) {
          if (col === 'organizationsList') {
            serverDbState.organizationsList = oldArr;
          } else {
            serverDbState.data[col] = oldArr;
          }
        }
        serverDbState.data.organization = prevOrg;
        serverDbState.data.regulatoryRestrictions = prevRestrictions;
        if (persistErr?.code === '23505') {
          return res.status(409).json({
            error: 'Conflicto de unicidad en base de datos al sincronizar cambios.',
            code: 'CONFLICT_DB_UNIQUE',
          });
        }
        throw persistErr;
      }
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/db/sync (Deprecado)
  router.post('/db/sync', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({
          error: auth.error || '401 No autorizado.',
        });
      }
      res.setHeader('Deprecation', 'true');
      if (!isSuperAdminRole(auth.user.roleId)) {
        return res.status(410).json({
          error: '410 Endpoint deprecado: Use POST /api/db/delta para sincronización incremental segura.',
        });
      }

      const { data, organizationsList } = req.body || {};
      if (!data || !organizationsList || !Array.isArray(organizationsList)) {
        return res.status(400).json({ error: 'Payload inválido.' });
      }

      const serverDbState = getServerDbState();
      const existingUserMap = new Map<string, any>((serverDbState.data.users || []).map((u: any) => [u.id, u]));
      const mergedUsers = (data.users || []).map((incomingUser: any) => {
        const existing = existingUserMap.get(incomingUser.id);
        if (existing) {
          return {
            ...incomingUser,
            passwordHash: existing.passwordHash,
            passwordSalt: existing.passwordSalt,
            passwordIterations: existing.passwordIterations || 100000,
          };
        }
        if (
          !incomingUser.passwordHash ||
          !incomingUser.passwordSalt ||
          String(incomingUser.passwordHash).startsWith('$2b$10$e8wDbg')
        ) {
          const defaultRecord = createPbkdf2Hash(crypto.randomBytes(16).toString('hex'));
          return {
            ...incomingUser,
            passwordHash: defaultRecord.hash,
            passwordSalt: defaultRecord.salt,
            passwordIterations: defaultRecord.iterations,
          };
        }
        return incomingUser;
      });

      const nextState = {
        data: {
          ...data,
          users: mergedUsers,
        },
        organizationsList,
      };
      ensurePayrollIntegrity(nextState.data);
      setServerDbState(nextState);
      await saveDatabaseState();
      return res.json({
        success: true,
        stateVersion: getServerStateVersion(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
