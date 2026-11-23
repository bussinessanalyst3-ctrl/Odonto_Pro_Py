import express from 'express';
import crypto from 'crypto';
import { authenticateServerRequest } from '../security.ts';
import { getServerDbState, saveDatabaseState } from '../stateStore.ts';

function getConfiguredOwnerEmail(): string {
  return String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
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
