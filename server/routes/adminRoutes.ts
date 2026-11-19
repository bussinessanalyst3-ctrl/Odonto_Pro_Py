import express from 'express';
import crypto from 'crypto';
import {
  canManageRole,
  hasPermission,
  isSuperAdminRole,
} from '../../src/security/rbacHierarchy.ts';
import { createPbkdf2Hash, sanitizeUsersForClient } from '../crypto.ts';
import {
  actorHasDynamicPermission,
  getPgPool,
  getServerDbState,
  saveDatabaseState,
} from '../stateStore.ts';
import {
  activeServerSessions,
  authenticateServerRequest,
  deleteUserSessionsFromDb,
  saveServerSessions,
} from '../security.ts';

export function createAdminRouter(): express.Router {
  const router = express.Router();

  // GET /api/organizations
  router.get('/organizations', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.actor || !auth.user) {
      return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
    }
    const serverDbState = getServerDbState();
    if (isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN') {
      return res.json(serverDbState.organizationsList);
    }
    const ownOrgs = (serverDbState.organizationsList || []).filter(
      (o: any) => o.id === auth.actor!.organizationId
    );
    return res.json(ownOrgs);
  });

  // POST /api/organizations - Exclusivo SUPER_ADMIN
  router.post('/organizations', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }
      if (!isSuperAdminRole(auth.user.roleId) || auth.user.roleId !== 'SUPER_ADMIN') {
        return res.status(403).json({
          error: '403 Prohibido: Solo el Super Administrador puede crear organizaciones.',
        });
      }

      const newOrg = req.body;
      if (!newOrg || !newOrg.name) {
        return res.status(400).json({ error: 'El nombre de la organización es obligatorio.' });
      }

      const serverDbState = getServerDbState();
      const id = newOrg.id || crypto.randomUUID();
      const createdOrg = {
        id,
        code: newOrg.code || `ORG-${newOrg.taxId ? newOrg.taxId.replace(/[^A-Za-z0-9]/g, '') : Date.now()}`,
        name: newOrg.name,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      serverDbState.organizationsList.push(createdOrg);

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
        status: 'ACTIVE',
        isMain: true,
        operatingHours: 'Lun a Vie 08:00 - 18:00, Sáb 08:00 - 12:00',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      serverDbState.data.branches.push(defaultBranch);

      const defaultBranchSettings = {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      serverDbState.data.branchSettings.push(defaultBranchSettings);

      await saveDatabaseState({
        upserts: {
          organizationsList: [createdOrg],
          branches: [defaultBranch],
          branchSettings: [defaultBranchSettings],
        },
      });
      return res.status(201).json(createdOrg);
    } catch (err) {
      return next(err);
    }
  });

  // PUT /api/organizations/:id
  router.put('/organizations/:id', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const { id } = req.params;
      const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';
      if (!isSuperAdmin && (auth.actor.organizationId !== id || auth.actor.role !== 'ADMIN_ORGANIZACION')) {
        return res.status(403).json({
          error: '403 Prohibido: No tiene autorización para modificar esta organización.',
        });
      }

      const serverDbState = getServerDbState();
      const idx = serverDbState.organizationsList.findIndex((o) => o.id === id);
      if (idx < 0) {
        return res.status(404).json({ error: 'Organización no encontrada.' });
      }

      const updates = { ...(req.body || {}) };
      delete updates.id;
      if (!isSuperAdmin) {
        delete updates.status;
        delete updates.deletedAt;
      }

      serverDbState.organizationsList[idx] = {
        ...serverDbState.organizationsList[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (serverDbState.data.organization?.id === id) {
        serverDbState.data.organization = { ...serverDbState.organizationsList[idx] };
      }

      await saveDatabaseState({
        upserts: { organizationsList: [serverDbState.organizationsList[idx]] },
        activeOrganizationId: serverDbState.data.organization?.id,
      });
      return res.json(serverDbState.organizationsList[idx]);
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/organizations/:id - Exclusivo SUPER_ADMIN
  router.delete('/organizations/:id', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }
      if (!isSuperAdminRole(auth.user.roleId) || auth.user.roleId !== 'SUPER_ADMIN') {
        return res.status(403).json({
          error: '403 Prohibido: Solo el Super Administrador puede dar de baja organizaciones.',
        });
      }

      const serverDbState = getServerDbState();
      const { id } = req.params;
      if (serverDbState.organizationsList.length <= 1) {
        return res.status(400).json({ error: 'No se puede eliminar la única organización registrada.' });
      }
      const idx = serverDbState.organizationsList.findIndex((o) => o.id === id);
      if (idx < 0) {
        return res.status(404).json({ error: 'Organización no encontrada.' });
      }

      serverDbState.organizationsList[idx].status = 'INACTIVE';
      serverDbState.organizationsList[idx].deletedAt = new Date().toISOString();

      if (serverDbState.data.organization?.id === id) {
        const active =
          serverDbState.organizationsList.find((o) => o.id !== id && o.status === 'ACTIVE') ||
          serverDbState.organizationsList[0];
        serverDbState.data.organization = active;
      }

      await saveDatabaseState({
        upserts: { organizationsList: [serverDbState.organizationsList[idx]] },
        activeOrganizationId: serverDbState.data.organization?.id,
      });
      return res.json({ success: true, message: 'Organización dada de baja correctamente.' });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/users
  router.get('/users', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.user || !auth.actor) {
      return res.status(auth.statusCode || 401).json({
        error: auth.error || '401 No autorizado. Se requiere inicio de sesión.',
      });
    }
    const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';
    if (!isSuperAdmin && !hasPermission(auth.actor, 'users.view')) {
      return res.status(403).json({ error: '403 Prohibido: No posee permiso users.view.' });
    }

    const serverDbState = getServerDbState();
    let list = serverDbState.data.users || [];
    if (!isSuperAdmin) {
      list = list.filter((u: any) => u.organizationId === auth.actor!.organizationId && !isSuperAdminRole(u.roleId));
    }

    return res.json(sanitizeUsersForClient(list));
  });

  // PUT /api/users/:id/permissions
  router.put('/users/:id/permissions', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const serverDbState = getServerDbState();
      const { id } = req.params;
      const { overrides } = req.body || {};

      const user = serverDbState.data.users?.find((u: any) => u.id === id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';

      if (!isSuperAdmin) {
        if (user.organizationId !== auth.actor.organizationId) {
          return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
        }
        if (!hasPermission(auth.actor, 'roles.manage') && !hasPermission(auth.actor, 'users.update')) {
          return res.status(403).json({
            error: '403 Prohibido: Permiso insuficiente para modificar permisos de usuario.',
          });
        }
        if (isSuperAdminRole(user.roleId)) {
          return res.status(403).json({
            error: '403 Prohibido: El usuario Super Administrador está estrictamente protegido y no puede ser alterado.',
          });
        }
        if (!canManageRole(auth.actor.role, user.roleId)) {
          return res.status(403).json({
            error: `403 Prohibido: Su rol (${auth.actor.role}) no tiene jerarquía para alterar los permisos de un usuario con rol ${user.roleId}.`,
          });
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
        if (overrides?.customPermissions?.some((p: string) => superAdminExclusives.has(p))) {
          return res.status(403).json({
            error: '403 Prohibido: No puede asignar permisos exclusivos del Super Administrador.',
          });
        }
      }

      const oldValues = {
        customPermissions: user.customPermissions || [],
        revokedPermissions: user.revokedPermissions || [],
        assignedRestrictions: user.assignedRestrictions || [],
        allowedNavTabs: user.allowedNavTabs || [],
        permissionsVersion: user.permissionsVersion || 1,
      };

      if (overrides) {
        if (Array.isArray(overrides.customPermissions)) {
          user.customPermissions = [...overrides.customPermissions];
        }
        if (Array.isArray(overrides.revokedPermissions)) {
          user.revokedPermissions = [...overrides.revokedPermissions];
        }
        if (Array.isArray(overrides.assignedRestrictions)) {
          user.assignedRestrictions = [...overrides.assignedRestrictions];
        }
        if (Array.isArray(overrides.allowedNavTabs)) {
          user.allowedNavTabs = [...overrides.allowedNavTabs];
        }
      }

      user.permissionsVersion = (user.permissionsVersion || 0) + 1;
      user.updatedAt = new Date().toISOString();

      const permAuditLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: auth.user.id,
        action: 'USER_PERMISSIONS_OVERRIDE',
        entity: 'USER_SECURITY',
        entityId: id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues,
        newValues: {
          customPermissions: user.customPermissions,
          revokedPermissions: user.revokedPermissions,
          assignedRestrictions: user.assignedRestrictions,
          allowedNavTabs: user.allowedNavTabs,
          permissionsVersion: user.permissionsVersion,
        },
        description: `Ajuste granular en Backend de permisos y restricciones para ${user.firstName} ${user.lastName} (Versión ${user.permissionsVersion})`,
        createdAt: new Date().toISOString(),
      };
      serverDbState.data.auditLogs.unshift(permAuditLog);

      await saveDatabaseState({ upserts: { users: [user], auditLogs: [permAuditLog] } });

      const { passwordHash, passwordSalt, passwordIterations, ...safeUser } = user;
      return res.json({ success: true, user: safeUser, permissionsVersion: user.permissionsVersion });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/users/:id/reset-password - Restablecimiento administrativo seguro en servidor
  router.post('/users/:id/reset-password', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const serverDbState = getServerDbState();
      const { id } = req.params;
      const newPassword = String(req.body?.newPassword || '').trim();
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener un mínimo de 8 caracteres.' });
      }

      const user = serverDbState.data.users?.find((u: any) => u.id === id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';
      if (!isSuperAdmin) {
        if (user.organizationId !== auth.actor.organizationId) {
          return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
        }
        if (
          !hasPermission(auth.actor, 'users.reset_password') &&
          !hasPermission(auth.actor, 'users.update') &&
          !hasPermission(auth.actor, 'roles.manage')
        ) {
          return res.status(403).json({ error: '403 Prohibido: No posee permiso users.reset_password.' });
        }
        if (isSuperAdminRole(user.roleId)) {
          return res.status(403).json({
            error: '403 Prohibido: El Super Administrador está estrictamente protegido y no puede ser restablecido.',
          });
        }
        if (user.id !== auth.user.id && !canManageRole(auth.actor.role, user.roleId)) {
          return res.status(403).json({
            error: `403 Prohibido: Jerarquía insuficiente para restablecer la contraseña de un ${user.roleId}.`,
          });
        }
      }

      const hashRecord = createPbkdf2Hash(newPassword, 100000);
      const now = new Date().toISOString();
      user.passwordHash = hashRecord.hash;
      user.passwordSalt = hashRecord.salt;
      user.passwordIterations = hashRecord.iterations;
      user.sessionRevokedAt = now;
      user.permissionsVersion = (user.permissionsVersion || 0) + 1;
      user.updatedAt = now;

      for (const [token, sess] of activeServerSessions.entries()) {
        if (sess.userId === id) {
          activeServerSessions.delete(token);
        }
      }
      deleteUserSessionsFromDb(id);
      saveServerSessions();

      const resetAuditLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: auth.user.id,
        action: 'ADMIN_PASSWORD_RESET',
        entity: 'USER_AUTH',
        entityId: id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: null,
        newValues: { updatedAt: now, sessionsRevoked: true },
        description: `Restablecimiento administrativo PBKDF2 de contraseña y revocación de sesiones para ${user.firstName} ${user.lastName}`,
        createdAt: now,
      };
      serverDbState.data.auditLogs.unshift(resetAuditLog);

      await saveDatabaseState({ upserts: { users: [user], auditLogs: [resetAuditLog] } });

      return res.json({
        success: true,
        revokedAt: now,
        message: `Contraseña actualizada y sesiones revocadas para ${user.firstName} ${user.lastName}.`,
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/users/:id/revoke-sessions
  router.post('/users/:id/revoke-sessions', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const serverDbState = getServerDbState();
      const { id } = req.params;
      const user = serverDbState.data.users?.find((u: any) => u.id === id);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';
      if (!isSuperAdmin) {
        if (user.organizationId !== auth.actor.organizationId) {
          return res.status(403).json({ error: '403 Prohibido: Violación de aislamiento multiempresa.' });
        }
        if (
          !hasPermission(auth.actor, 'users.revoke_sessions') &&
          !hasPermission(auth.actor, 'users.update') &&
          !hasPermission(auth.actor, 'roles.manage')
        ) {
          return res.status(403).json({ error: '403 Prohibido: Permiso insuficiente para revocar sesiones.' });
        }
        if (isSuperAdminRole(user.roleId)) {
          return res.status(403).json({ error: '403 Prohibido: No se pueden revocar las sesiones del Super Administrador.' });
        }
        if (!canManageRole(auth.actor.role, user.roleId)) {
          return res.status(403).json({
            error: `403 Prohibido: Jerarquía insuficiente para revocar sesiones de ${user.roleId}.`,
          });
        }
      }

      const now = new Date().toISOString();
      user.sessionRevokedAt = now;
      user.permissionsVersion = (user.permissionsVersion || 0) + 1;

      for (const [token, sess] of activeServerSessions.entries()) {
        if (sess.userId === id) {
          activeServerSessions.delete(token);
        }
      }
      deleteUserSessionsFromDb(id);
      saveServerSessions();

      const revokeAuditLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: auth.user.id,
        action: 'SESSION_REVOCATION',
        entity: 'USER_SESSION',
        entityId: id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: null,
        newValues: { revokedAt: now, userId: id },
        description: `Revocación backend forzosa de sesiones para ${user.firstName} ${user.lastName}`,
        createdAt: now,
      };
      serverDbState.data.auditLogs.unshift(revokeAuditLog);

      await saveDatabaseState({ upserts: { users: [user], auditLogs: [revokeAuditLog] } });
      return res.json({ success: true, revokedAt: now });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/audit-logs - Bitácora paginada, filtrable y aislada por tenant/sucursal
  router.get('/audit-logs', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.actor) {
        return res.status(auth.statusCode || 401).json({
          error: auth.error || '401 No autorizado: Se requiere sesión autenticada.',
        });
      }

      const serverDbState = getServerDbState();
      const roles = serverDbState.data?.roles || [];
      const isSuperAdmin = isSuperAdminRole(auth.user.roleId) && auth.user.roleId === 'SUPER_ADMIN';
      const canViewAll = isSuperAdmin || actorHasDynamicPermission(auth.actor, 'audit.view', roles);
      const canViewOwnBranch = actorHasDynamicPermission(auth.actor, 'audit.view_own_branch', roles);

      if (!canViewAll && !canViewOwnBranch) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización (audit.view) para consultar la bitácora de auditoría.',
        });
      }

      const rawLimit = Number.parseInt(String(req.query.limit ?? '50'), 10);
      const rawOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
      const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

      const action = typeof req.query.action === 'string' && req.query.action !== 'ALL' ? req.query.action.trim() : '';
      const entity = typeof req.query.entity === 'string' && req.query.entity !== 'ALL' ? req.query.entity.trim() : '';
      const branchId = typeof req.query.branchId === 'string' ? req.query.branchId.trim() : '';
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const requestedOrgId = typeof req.query.organizationId === 'string' ? req.query.organizationId.trim() : '';

      const allowedBranches = auth.actor.allowedBranchIds || [];
      if (!canViewAll && branchId && !allowedBranches.includes(branchId)) {
        return res.status(403).json({
          error: '403 Prohibido: No posee autorización para consultar eventos de auditoría de otra sucursal.',
        });
      }

      const scopedOrgId = isSuperAdmin ? requestedOrgId || '' : auth.actor.organizationId;
      const pgPool = getPgPool();

      if (pgPool) {
        try {
          const conditions: string[] = [];
          const params: any[] = [];
          const pushParam = (val: any) => {
            params.push(val);
            return `$${params.length}`;
          };

          if (scopedOrgId) {
            conditions.push(`al.organization_id = ${pushParam(scopedOrgId)}::uuid`);
          }
          if (!canViewAll) {
            if (allowedBranches.length > 0) {
              conditions.push(`(al.branch_id IS NULL OR al.branch_id = ANY(${pushParam(allowedBranches)}::uuid[]))`);
            } else {
              conditions.push(`al.branch_id IS NULL`);
            }
          }
          if (branchId) {
            conditions.push(`al.branch_id = ${pushParam(branchId)}::uuid`);
          }
          if (userId) {
            conditions.push(`al.user_id = ${pushParam(userId)}::uuid`);
          }
          if (action) {
            conditions.push(`al.action = ${pushParam(action)}`);
          }
          if (entity) {
            conditions.push(`al.entity = ${pushParam(entity)}`);
          }
          if (search) {
            const p = pushParam(`%${search}%`);
            conditions.push(
              `(COALESCE(al.description, '') ILIKE ${p} OR COALESCE(al.ip_address, '') ILIKE ${p} OR COALESCE(al.entity, '') ILIKE ${p} OR COALESCE(al.action, '') ILIKE ${p} OR COALESCE(u.first_name || ' ' || u.last_name, '') ILIKE ${p})`
            );
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          const limitPlaceholder = pushParam(limit);
          const offsetPlaceholder = pushParam(offset);

          const [rowsRes, countRes] = await Promise.all([
            pgPool.query(
              `SELECT al.*
               FROM audit_logs al
               LEFT JOIN users u ON al.user_id = u.id
               ${whereClause}
               ORDER BY al.created_at DESC
               LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
              params
            ),
            pgPool.query(
              `SELECT
                 COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE al.action = 'READ_SENSITIVE' OR al.entity = 'CLINICAL_RECORD')::int AS sensitive_count,
                 COUNT(*) FILTER (WHERE al.action IN ('CASH_MOVEMENT', 'CLOSE_CASH_REGISTER') OR al.entity = 'PAYMENT')::int AS financial_count,
                 COUNT(DISTINCT al.ip_address) FILTER (WHERE al.ip_address IS NOT NULL)::int AS unique_ips
               FROM audit_logs al
               LEFT JOIN users u ON al.user_id = u.id
               ${whereClause}`,
              params.slice(0, params.length - 2)
            ),
          ]);

          const logs = rowsRes.rows.map((r: any) => ({
            id: r.id,
            organizationId: r.organization_id,
            branchId: r.branch_id,
            userId: r.user_id,
            action: r.action,
            entity: r.entity,
            entityId: r.entity_id,
            ipAddress: r.ip_address,
            userAgent: r.user_agent,
            oldValues: r.old_values,
            newValues: r.new_values,
            description: r.description,
            createdAt: r.created_at,
          }));
          const agg = countRes.rows[0] || {};
          const total = Number(agg.total || 0);

          return res.json({
            logs,
            total,
            limit,
            offset,
            hasMore: offset + logs.length < total,
            stats: {
              sensitiveAccessesCount: Number(agg.sensitive_count || 0),
              financialOperationsCount: Number(agg.financial_count || 0),
              uniqueIpsCount: Number(agg.unique_ips || 0),
            },
          });
        } catch (pgErr: any) {
          console.error('[AuditLogs PG] Fallback a memoria tras error SQL:', pgErr?.message);
        }
      }

      const usersList = serverDbState.data?.users || [];
      const userMap = new Map<string, any>(usersList.map((u: any) => [u.id, u]));
      const allowedBranchSet = new Set(allowedBranches);

      const allScoped = (serverDbState.data?.auditLogs || []).filter((log: any) => {
        if (scopedOrgId && log.organizationId !== scopedOrgId) return false;
        if (!canViewAll && log.branchId && !allowedBranchSet.has(log.branchId)) return false;
        if (branchId && log.branchId !== branchId) return false;
        if (userId && log.userId !== userId) return false;
        if (action && log.action !== action) return false;
        if (entity && log.entity !== entity) return false;
        if (search) {
          const term = search.toLowerCase();
          const u = log.userId ? userMap.get(log.userId) : null;
          const userMatch =
            u &&
            (`${u.firstName} ${u.lastName}`.toLowerCase().includes(term) ||
              String(u.documentNumber || '').includes(term) ||
              String(u.email || '').toLowerCase().includes(term));
          const ipMatch = String(log.ipAddress || '').toLowerCase().includes(term);
          const descMatch = String(log.description || '').toLowerCase().includes(term);
          const entityMatch = String(log.entity || '').toLowerCase().includes(term);
          const actionMatch = String(log.action || '').toLowerCase().includes(term);
          if (!userMatch && !ipMatch && !descMatch && !entityMatch && !actionMatch) return false;
        }
        return true;
      });

      const total = allScoped.length;
      const logs = allScoped.slice(offset, offset + limit);
      const sensitiveAccessesCount = allScoped.filter(
        (l: any) => l.action === 'READ_SENSITIVE' || l.entity === 'CLINICAL_RECORD'
      ).length;
      const financialOperationsCount = allScoped.filter(
        (l: any) => l.action === 'CASH_MOVEMENT' || l.action === 'CLOSE_CASH_REGISTER' || l.entity === 'PAYMENT'
      ).length;
      const uniqueIpsCount = new Set(allScoped.map((l: any) => l.ipAddress).filter(Boolean)).size;

      return res.json({
        logs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
        stats: {
          sensitiveAccessesCount,
          financialOperationsCount,
          uniqueIpsCount,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
