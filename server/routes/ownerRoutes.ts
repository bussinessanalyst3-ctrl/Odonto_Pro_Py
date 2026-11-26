import express from 'express';
import crypto from 'crypto';
import { authenticateServerRequest } from '../security.ts';
import { getServerDbState, saveDatabaseState } from '../stateStore.ts';
import { getOwnerSystemHealth } from '../healthMonitor.ts';

function getConfiguredOwnerEmail(): string {
  return String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
}

function buildOrganizationSummary(org: any, branches: any[], users: any[], ownerOrgId: string) {
  const orgBranches = branches.filter((b: any) => b.organizationId === org.id);
  const orgUsers = users.filter((u: any) => u.organizationId === org.id);
  const activeUsers = orgUsers.filter((u: any) => String(u.status || 'ACTIVE').toUpperCase() === 'ACTIVE');

  return {
    id: org.id,
    code: org.code || '',
    name: org.name || '',
    legalName: org.legalName || org.name || '',
    taxId: org.taxId || '',
    status: String(org.status || 'ACTIVE').toUpperCase(),
    createdAt: org.createdAt ? new Date(org.createdAt).toISOString() : null,
    updatedAt: org.updatedAt ? new Date(org.updatedAt).toISOString() : null,
    branchesCount: orgBranches.length,
    usersCount: orgUsers.length,
    activeUsersCount: activeUsers.length,
    isOwnerOrganization: Boolean(ownerOrgId && org.id === ownerOrgId),
  };
}

/**
 * Middleware minimalista para /api/owner/*:
 * - Reutiliza la sesión existente sin modificarla.
 * - Solo permite el acceso si OWNER_EMAIL está definido y coincide exactamente con el correo del usuario autenticado.
 * - En cualquier otro caso responde 404 (como una ruta inexistente) sin revelar su existencia.
 */
export function requireOwner(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const configuredOwnerEmail = getConfiguredOwnerEmail();
  if (!configuredOwnerEmail) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const auth = authenticateServerRequest(req);
  if (!auth.authenticated || !auth.user) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const userEmail = String(auth.user.email || '').trim().toLowerCase();
  if (!userEmail || userEmail !== configuredOwnerEmail) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  (req as any).ownerAuth = auth;
  next();
}

export function createOwnerRouter(): express.Router {
  const router = express.Router();

  router.use(requireOwner);

  // GET /api/owner/me — Confirma acceso exclusivo del propietario (404 para el resto)
  router.get('/me', (req, res) => {
    const auth = (req as any).ownerAuth;
    const user = auth.user;
    return res.json({
      isOwner: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleId,
      },
    });
  });

  // GET /api/owner/health — Estado del servidor, BD y fallas por módulo (404 para no propietarios)
  router.get('/health', async (req, res, next) => {
    try {
      const fresh = String(req.query?.fresh || '') === '1';
      const health = await getOwnerSystemHealth({ fresh });
      return res.json(health);
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/owner/organizations — Metadatos de empresas/clientes (sin datos clínicos de pacientes)
  router.get('/organizations', (req, res) => {
    const auth = (req as any).ownerAuth;
    const serverDbState = getServerDbState();
    const orgs = Array.isArray(serverDbState.organizationsList) ? serverDbState.organizationsList : [];
    const branches = Array.isArray(serverDbState.data?.branches) ? serverDbState.data.branches : [];
    const users = Array.isArray(serverDbState.data?.users) ? serverDbState.data.users : [];
    const ownerOrgId = String(auth.user?.organizationId || '');

    const summaries = orgs
      .map((org: any) => buildOrganizationSummary(org, branches, users, ownerOrgId))
      .sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

    return res.json({ organizations: summaries });
  });

  // PATCH /api/owner/organizations/:id/status — Suspender o reactivar clínica usando el campo status existente
  router.patch('/organizations/:id/status', async (req, res, next) => {
    try {
      const auth = (req as any).ownerAuth;
      const user = auth.user;
      const orgId = String(req.params.id || '').trim();
      const nextStatus = String(req.body?.status || '').trim().toUpperCase();

      if (nextStatus !== 'ACTIVE' && nextStatus !== 'SUSPENDED') {
        return res.status(400).json({
          error: 'Estado inválido. Valores permitidos: ACTIVE o SUSPENDED.',
        });
      }

      const serverDbState = getServerDbState();
      const orgs = Array.isArray(serverDbState.organizationsList) ? serverDbState.organizationsList : [];
      const orgIdx = orgs.findIndex((o: any) => o.id === orgId);

      if (orgIdx < 0) {
        return res.status(404).json({ error: 'Organización no encontrada.' });
      }

      const targetOrg = orgs[orgIdx];
      if (nextStatus === 'SUSPENDED' && targetOrg.id === user.organizationId) {
        return res.status(400).json({
          error: 'No puede suspender la organización vinculada a su propia cuenta de propietario.',
        });
      }

      const prevStatus = String(targetOrg.status || 'ACTIVE').toUpperCase();
      const nowIso = new Date().toISOString();

      targetOrg.status = nextStatus;
      targetOrg.updatedAt = nowIso;

      if (serverDbState.data?.organization?.id === targetOrg.id) {
        serverDbState.data.organization = { ...targetOrg };
      }

      // Registrar acción usando la tabla audit_logs existente sin cambios de estructura
      const actionCode = nextStatus === 'SUSPENDED' ? 'OWNER_ORG_SUSPEND' : 'OWNER_ORG_REACTIVATE';
      const auditEntry = {
        id: crypto.randomUUID(),
        organizationId: targetOrg.id,
        branchId: null,
        userId: user.id,
        action: actionCode,
        entity: 'ORGANIZATION',
        entityId: targetOrg.id,
        ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
        userAgent: String(req.headers['user-agent'] || 'OwnerConsole'),
        oldValues: { status: prevStatus },
        newValues: { status: nextStatus },
        description:
          nextStatus === 'SUSPENDED'
            ? `Suspensión de acceso para nuevos inicios de sesión de la clínica "${targetOrg.name}" (${targetOrg.code || targetOrg.id})`
            : `Reactivación de acceso para la clínica "${targetOrg.name}" (${targetOrg.code || targetOrg.id})`,
        createdAt: nowIso,
      };
      serverDbState.data.auditLogs?.unshift(auditEntry);

      await saveDatabaseState({
        upserts: {
          organizationsList: [targetOrg],
          auditLogs: [auditEntry],
        },
      });

      const branches = Array.isArray(serverDbState.data?.branches) ? serverDbState.data.branches : [];
      const users = Array.isArray(serverDbState.data?.users) ? serverDbState.data.users : [];
      const summary = buildOrganizationSummary(targetOrg, branches, users, String(user.organizationId || ''));

      return res.json({
        success: true,
        organization: summary,
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/owner/audit — Registra ingreso/navegación en la auditoría existente sin cambios de esquema
  router.post('/audit', async (req, res, next) => {
    try {
      const auth = (req as any).ownerAuth;
      const user = auth.user;
      const serverDbState = getServerDbState();

      const rawAction = String(req.body?.action || 'OWNER_CONSOLE_VIEW').trim().toUpperCase().slice(0, 60);
      const safeAction = /^[A-Z0-9_]+$/.test(rawAction) ? rawAction : 'OWNER_CONSOLE_VIEW';
      const moduleName = String(req.body?.module || 'overview').trim().slice(0, 60);
      const orgId = user.organizationId || serverDbState.data?.organization?.id;

      if (orgId) {
        const entry = {
          id: crypto.randomUUID(),
          organizationId: orgId,
          branchId: null,
          userId: user.id,
          action: safeAction,
          entity: 'OWNER_CONSOLE',
          entityId: moduleName,
          ipAddress: req.ip || req.socket?.remoteAddress || '127.0.0.1',
          userAgent: String(req.headers['user-agent'] || 'OwnerConsole'),
          oldValues: null,
          newValues: { module: moduleName },
          description: `Acceso a Consola del Propietario (${moduleName})`,
          createdAt: new Date().toISOString(),
        };
        serverDbState.data.auditLogs?.unshift(entry);
        await saveDatabaseState({ upserts: { auditLogs: [entry] } });
      }

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
