import express from 'express';
import crypto from 'crypto';
import { createPbkdf2Hash, verifyPbkdf2Hash } from '../crypto.ts';
import { getServerDbState, saveDatabaseState, saveDatabaseStateStrict } from '../stateStore.ts';
import { isSuperAdminRole } from '../../src/security/rbacHierarchy.ts';
import {
  activeServerSessions,
  authenticateServerRequest,
  buildSafeSessionPayload,
  clearSessionCookie,
  deleteSessionFromDb,
  deleteUserSessionsFromDb,
  extractSessionToken,
  failedAttemptsMap,
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  passwordRecoveryTokens,
  persistSessionToDb,
  saveServerSessions,
  ServerSessionRecord,
  setSessionCookie,
  updateUserSessionsPermissionsVersion,
} from '../security.ts';

export function createAuthRouter(): express.Router {
  const router = express.Router();

  // POST /api/auth/login
  router.post('/login', async (req, res, next) => {
    try {
      const serverDbState = getServerDbState();
      const { identifier, password, rememberMe } = req.body || {};
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

      if (!identifier || typeof identifier !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({
          error: 'Debe ingresar su correo electrónico o nombre de usuario y su contraseña.',
        });
      }

      const cleanIdentifier = identifier.trim().toLowerCase();
      const cleanPassword = password.trim();
      const lockoutKey = `user_${cleanIdentifier}`;
      const now = Date.now();

      const attemptRecord = failedAttemptsMap.get(lockoutKey);
      if (attemptRecord?.lockedUntil && attemptRecord.lockedUntil > now) {
        const remainingMinutes = Math.max(1, Math.ceil((attemptRecord.lockedUntil - now) / 60000));
        return res.status(429).json({
          error: `Acceso temporalmente restringido por múltiples intentos fallidos. Intente nuevamente en ${remainingMinutes} minuto(s).`,
          locked: true,
          remainingMinutes,
        });
      }

      const users = serverDbState.data.users || [];
      const user = users.find((u: any) => {
        const emailMatch = Boolean(u.email && u.email.toLowerCase() === cleanIdentifier);
        const usernameMatch = Boolean(u.username && u.username.toLowerCase() === cleanIdentifier);
        const aliasAdminMatch = cleanIdentifier === 'admin' && u.roleId === 'SUPER_ADMIN';
        const analystMatch =
          (cleanIdentifier === 'businessanalyst3' || cleanIdentifier === 'businessanalyst3@gmail.com') &&
          (u.username === 'bussinessanalyst3' ||
            (u.email && u.email.toLowerCase() === 'bussinessanalyst3@gmail.com'));
        return emailMatch || usernameMatch || aliasAdminMatch || analystMatch;
      });

      const registerFailedAttempt = () => {
        const prev = failedAttemptsMap.get(lockoutKey);
        const expired = Boolean(prev?.lockedUntil && prev.lockedUntil <= now);
        const nextCount = expired ? 1 : (prev?.count || 0) + 1;
        const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null;
        failedAttemptsMap.set(lockoutKey, { count: nextCount, lockedUntil });
        return nextCount;
      };

      if (!user) {
        createPbkdf2Hash(cleanPassword, 100000);
        registerFailedAttempt();
        return res.status(401).json({
          error: 'Credenciales inválidas. Verifique su usuario y contraseña.',
        });
      }

      if (user.status === 'INACTIVE') {
        createPbkdf2Hash(cleanPassword, 100000);
        registerFailedAttempt();
        return res.status(401).json({
          error: 'Su cuenta se encuentra inactiva. Contacte al administrador de su clínica.',
        });
      }

      const isValidPassword =
        Boolean(user.passwordSalt && user.passwordHash) &&
        verifyPbkdf2Hash(
          cleanPassword,
          user.passwordSalt,
          user.passwordIterations || 100000,
          user.passwordHash
        );

      if (!isValidPassword) {
        const attemptsCount = registerFailedAttempt();
        const failedAuditLog = {
          id: crypto.randomUUID(),
          organizationId: user.organizationId,
          branchId: null,
          userId: user.id,
          action: 'LOGIN_FAILED',
          entity: 'AUTH',
          entityId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers['user-agent'] || 'API Client',
          oldValues: null,
          newValues: { attempts: attemptsCount },
          description: 'Intento de acceso fallido para cuenta protegida',
          createdAt: new Date().toISOString(),
        };
        serverDbState.data.auditLogs?.unshift(failedAuditLog);
        await saveDatabaseState({ upserts: { auditLogs: [failedAuditLog] } });

        return res.status(401).json({
          error: 'Credenciales inválidas. Verifique su usuario y contraseña.',
        });
      }

      failedAttemptsMap.delete(lockoutKey);

      // Si la organización de la clínica está suspendida, solo se impide iniciar sesión nueva (sin afectar sesiones activas ni clínicas activas)
      const configuredOwnerEmail = String(process.env.OWNER_EMAIL || '').trim().toLowerCase();
      const isConfiguredOwner = Boolean(
        configuredOwnerEmail && String(user.email || '').trim().toLowerCase() === configuredOwnerEmail
      );
      const userOrg = (serverDbState.organizationsList || []).find(
        (o: any) => o.id === user.organizationId
      );
      if (!isConfiguredOwner && userOrg && String(userOrg.status || '').toUpperCase() === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error:
            'El acceso de su clínica se encuentra temporalmente suspendido. Por favor, comuníquese con el equipo de soporte de OdontoPro para regularizar y reactivar el servicio.',
        });
      }

      const userBranches = (serverDbState.data.userBranches || []).filter((ub: any) => ub.userId === user.id);
      const defaultBranch =
        userBranches.find((ub: any) => ub.isDefault)?.branchId ||
        userBranches[0]?.branchId ||
        (serverDbState.data.branches || []).find((b: any) => b.organizationId === user.organizationId)?.id ||
        serverDbState.data.branches?.[0]?.id ||
        'branch-default';

      const sessionToken = `sess_${crypto.randomBytes(32).toString('hex')}`;
      const expirationHours = rememberMe ? 30 * 24 : 8;
      const maxAgeSeconds = expirationHours * 3600;
      const issuedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();

      const sessRecord: ServerSessionRecord = {
        userId: user.id,
        role: user.roleId,
        organizationId: user.organizationId,
        branchId: defaultBranch,
        issuedAt,
        expiresAt,
        permissionsVersion: user.permissionsVersion || 1,
      };

      activeServerSessions.set(sessionToken, sessRecord);
      persistSessionToDb(sessionToken, sessRecord);
      saveServerSessions();

      user.lastLoginAt = issuedAt;
      const loginAuditLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: defaultBranch || null,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'USER_AUTH',
        entityId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'API Client',
        oldValues: null,
        newValues: { role: user.roleId, branchId: defaultBranch, rememberMe: Boolean(rememberMe) },
        description: `Inicio de sesión exitoso de ${user.firstName} ${user.lastName} (${user.roleId})`,
        createdAt: issuedAt,
      };
      if (!Array.isArray(serverDbState.data.auditLogs)) {
        serverDbState.data.auditLogs = [];
      }
      serverDbState.data.auditLogs.unshift(loginAuditLog);
      await saveDatabaseState({ upserts: { users: [user], auditLogs: [loginAuditLog] } });

      setSessionCookie(req, res, sessionToken, maxAgeSeconds);
      const safeSession = buildSafeSessionPayload(
        user,
        sessionToken,
        issuedAt,
        expiresAt,
        defaultBranch
      );

      return res.json({
        success: true,
        session: safeSession,
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res, next) => {
    try {
      const token = extractSessionToken(req);
      if (token) {
        const sess = activeServerSessions.get(token);
        activeServerSessions.delete(token);
        deleteSessionFromDb(token);
        saveServerSessions();

        if (sess) {
          const serverDbState = getServerDbState();
          const logoutLog = {
            id: crypto.randomUUID(),
            organizationId: sess.organizationId,
            branchId: sess.branchId || null,
            userId: sess.userId,
            action: 'LOGOUT',
            entity: 'USER_AUTH',
            entityId: sess.userId,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Backend API',
            oldValues: null,
            newValues: { timestamp: new Date().toISOString() },
            description: 'Cierre de sesión autenticado en servidor',
            createdAt: new Date().toISOString(),
          };
          serverDbState.data.auditLogs?.unshift(logoutLog);
          await saveDatabaseState({ upserts: { auditLogs: [logoutLog] } });
        }
      }
      clearSessionCookie(req, res);
      return res.json({ success: true, message: 'Sesión cerrada correctamente.' });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/auth/session
  router.get('/session', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.user || !auth.sessionData || !auth.token) {
      clearSessionCookie(req, res);
      return res.status(auth.statusCode || 401).json({ valid: false, error: auth.error || 'No autorizado' });
    }

    const safeSession = buildSafeSessionPayload(
      auth.user,
      auth.token,
      auth.sessionData.issuedAt,
      auth.sessionData.expiresAt,
      auth.sessionData.branchId
    );

    return res.json({
      valid: true,
      userId: auth.sessionData.userId,
      role: auth.sessionData.role,
      expiresAt: auth.sessionData.expiresAt,
      session: safeSession,
    });
  });

  // POST /api/auth/switch-branch - Persiste la sucursal activa de la sesión en servidor y PostgreSQL
  router.post('/switch-branch', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user || !auth.sessionData || !auth.token || !auth.actor) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const branchId = String(req.body?.branchId || '').trim();
      if (!branchId) {
        return res.status(400).json({ error: 'Debe indicar la sucursal a seleccionar.' });
      }

      const serverDbState = getServerDbState();
      const isSuperAdmin = isSuperAdminRole(auth.user.roleId);
      const targetBranch = (serverDbState.data.branches || []).find((b: any) => b.id === branchId);
      if (!targetBranch) {
        return res.status(404).json({ error: 'La sucursal seleccionada no existe.' });
      }

      if (!isSuperAdmin) {
        if (targetBranch.organizationId !== auth.actor.organizationId) {
          return res.status(403).json({ error: '403 Prohibido: No puede acceder a una sucursal de otra clínica.' });
        }
        const allowed = auth.actor.allowedBranchIds || [];
        if (allowed.length > 0 && !allowed.includes(branchId)) {
          return res.status(403).json({
            error: '403 Prohibido: Su cuenta no tiene asignada la sucursal seleccionada.',
          });
        }
      }

      const previousBranchId = auth.sessionData.branchId;
      auth.sessionData.branchId = branchId;
      persistSessionToDb(auth.token, auth.sessionData);
      saveServerSessions();

      const nowIso = new Date().toISOString();
      const switchAuditLog = {
        id: crypto.randomUUID(),
        organizationId: targetBranch.organizationId || auth.user.organizationId,
        branchId,
        userId: auth.user.id,
        action: 'BRANCH_SWITCH',
        entity: 'USER_AUTH',
        entityId: auth.user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: { branchId: previousBranchId },
        newValues: { branchId, branchName: targetBranch.name },
        description: `Cambio de sucursal activa a ${targetBranch.name}`,
        createdAt: nowIso,
      };
      if (!Array.isArray(serverDbState.data.auditLogs)) {
        serverDbState.data.auditLogs = [];
      }
      serverDbState.data.auditLogs.unshift(switchAuditLog);
      await saveDatabaseState({ upserts: { auditLogs: [switchAuditLog] } });

      const safeSession = buildSafeSessionPayload(
        auth.user,
        auth.token,
        auth.sessionData.issuedAt,
        auth.sessionData.expiresAt,
        branchId
      );

      return res.json({
        success: true,
        session: safeSession,
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/auth/permissions-version - Chequeo liviano de versión de permisos
  router.get('/permissions-version', (req, res) => {
    const auth = authenticateServerRequest(req);
    if (!auth.authenticated || !auth.user) {
      return res.status(auth.statusCode || 401).json({ valid: false, error: auth.error || 'No autorizado' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      valid: true,
      userId: auth.user.id,
      role: auth.user.roleId,
      permissionsVersion: Number(auth.user.permissionsVersion) || 1,
      updatedAt: auth.user.updatedAt || null,
    });
  });

  // POST /api/auth/change-password
  router.post('/change-password', async (req, res, next) => {
    try {
      const auth = authenticateServerRequest(req);
      if (!auth.authenticated || !auth.user) {
        return res.status(auth.statusCode || 401).json({ error: auth.error || '401 No autorizado' });
      }

      const currentPassword = String(req.body?.currentPassword || '').trim();
      const newPassword = String(req.body?.newPassword || '').trim();

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener como mínimo 8 caracteres.' });
      }
      if (currentPassword && currentPassword === newPassword) {
        return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la contraseña actual.' });
      }

      const user = auth.user;
      if (user.passwordHash && user.passwordSalt) {
        const valid = verifyPbkdf2Hash(
          currentPassword,
          user.passwordSalt,
          user.passwordIterations || 100000,
          user.passwordHash
        );
        if (!valid) {
          return res.status(400).json({ error: 'La contraseña actual ingresada es incorrecta.' });
        }
      }

      const prevPasswordState = {
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
        passwordIterations: user.passwordIterations,
        permissionsVersion: user.permissionsVersion,
        updatedAt: user.updatedAt,
      };

      const newHashRecord = createPbkdf2Hash(newPassword, 100000);
      user.passwordHash = newHashRecord.hash;
      user.passwordSalt = newHashRecord.salt;
      user.passwordIterations = newHashRecord.iterations;
      user.permissionsVersion = (user.permissionsVersion || 1) + 1;
      user.updatedAt = new Date().toISOString();

      const serverDbState = getServerDbState();
      const pwdAuditLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        entity: 'USER_AUTH',
        entityId: user.id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: null,
        newValues: { updatedAt: user.updatedAt },
        description: `Cambio voluntario de contraseña por ${user.firstName} ${user.lastName}`,
        createdAt: user.updatedAt,
      };
      serverDbState.data.auditLogs?.unshift(pwdAuditLog);

      try {
        await saveDatabaseStateStrict({ upserts: { users: [user], auditLogs: [pwdAuditLog] } });
      } catch (persistErr) {
        user.passwordHash = prevPasswordState.passwordHash;
        user.passwordSalt = prevPasswordState.passwordSalt;
        user.passwordIterations = prevPasswordState.passwordIterations;
        user.permissionsVersion = prevPasswordState.permissionsVersion;
        user.updatedAt = prevPasswordState.updatedAt;
        serverDbState.data.auditLogs = (serverDbState.data.auditLogs || []).filter((al: any) => al.id !== pwdAuditLog.id);
        throw persistErr;
      }

      for (const [tok, sess] of activeServerSessions.entries()) {
        if (sess.userId === user.id && tok !== auth.token) {
          activeServerSessions.delete(tok);
          deleteSessionFromDb(tok);
        }
      }
      await updateUserSessionsPermissionsVersion(user.id, user.permissionsVersion, user.roleId);
      saveServerSessions();

      return res.json({
        success: true,
        permissionsVersion: user.permissionsVersion,
        message: 'Su contraseña ha sido actualizada con éxito.',
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/auth/recover-password
  router.post('/recover-password', async (req, res, next) => {
    try {
      const serverDbState = getServerDbState();
      const { email } = req.body || {};
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Debe ingresar un correo electrónico.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const user = (serverDbState.data.users || []).find(
        (u: any) => u.email && u.email.toLowerCase() === cleanEmail
      );

      if (user && user.status === 'ACTIVE') {
        const resetToken = `rst_${crypto.randomBytes(24).toString('hex')}`;
        const expiresAt = Date.now() + 15 * 60 * 1000;

        passwordRecoveryTokens.set(resetToken, {
          userId: user.id,
          email: user.email,
          expiresAt,
          used: false,
        });

        const recoverAuditLog = {
          id: crypto.randomUUID(),
          organizationId: user.organizationId,
          branchId: null,
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entity: 'SECURITY',
          entityId: user.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'API Client',
          oldValues: null,
          newValues: { requestedAt: new Date().toISOString() },
          description: 'Solicitud de restablecimiento de contraseña registrada para cuenta institucional',
          createdAt: new Date().toISOString(),
        };
        serverDbState.data.auditLogs?.unshift(recoverAuditLog);
        await saveDatabaseState({ upserts: { auditLogs: [recoverAuditLog] } });
      }

      return res.json({
        success: true,
        message:
          'Si el correo electrónico ingresado coincide con una cuenta activa, recibirá las instrucciones para restablecer su acceso institucional.',
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/auth/reset-password
  router.post('/reset-password', async (req, res, next) => {
    try {
      const serverDbState = getServerDbState();
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const resetLockKey = `reset_ip_${clientIp}`;
      const now = Date.now();
      const lockRec = failedAttemptsMap.get(resetLockKey);
      if (lockRec?.lockedUntil && lockRec.lockedUntil > now) {
        const remainingMinutes = Math.max(1, Math.ceil((lockRec.lockedUntil - now) / 60000));
        return res.status(429).json({
          error: `Demasiados intentos inválidos de restablecimiento. Intente nuevamente en ${remainingMinutes} minuto(s).`,
        });
      }

      const { resetToken, newPassword } = req.body || {};
      if (!resetToken || !newPassword) {
        return res.status(400).json({ error: 'Datos insuficientes para el restablecimiento.' });
      }

      const tokenRecord = passwordRecoveryTokens.get(String(resetToken));
      if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < now) {
        const expired = Boolean(lockRec?.lockedUntil && lockRec.lockedUntil <= now);
        const nextCount = expired ? 1 : (lockRec?.count || 0) + 1;
        const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null;
        failedAttemptsMap.set(resetLockKey, { count: nextCount, lockedUntil });
        return res.status(400).json({
          error: 'El enlace de recuperación es inválido o ha expirado. Por favor solicite uno nuevo.',
        });
      }

      if (typeof newPassword !== 'string' || newPassword.trim().length < 8) {
        return res.status(400).json({
          error: 'La nueva contraseña debe tener como mínimo 8 caracteres.',
        });
      }

      const user = (serverDbState.data.users || []).find((u: any) => u.id === tokenRecord.userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      const prevState = {
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
        passwordIterations: user.passwordIterations,
        permissionsVersion: user.permissionsVersion,
        updatedAt: user.updatedAt,
      };

      const newHashRecord = createPbkdf2Hash(newPassword.trim(), 100000);
      const nowIso = new Date().toISOString();
      user.passwordHash = newHashRecord.hash;
      user.passwordSalt = newHashRecord.salt;
      user.passwordIterations = newHashRecord.iterations;
      user.permissionsVersion = (user.permissionsVersion || 1) + 1;
      user.updatedAt = nowIso;

      const resetCompletedLog = {
        id: crypto.randomUUID(),
        organizationId: user.organizationId,
        branchId: null,
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        entity: 'USER_AUTH',
        entityId: user.id,
        ipAddress: clientIp,
        userAgent: req.headers['user-agent'] || 'Backend API',
        oldValues: null,
        newValues: { resetAt: nowIso },
        description: `Restablecimiento de contraseña completado con token temporal para ${user.firstName} ${user.lastName}`,
        createdAt: nowIso,
      };
      if (!Array.isArray(serverDbState.data.auditLogs)) {
        serverDbState.data.auditLogs = [];
      }
      serverDbState.data.auditLogs.unshift(resetCompletedLog);

      try {
        await saveDatabaseStateStrict({ upserts: { users: [user], auditLogs: [resetCompletedLog] } });
      } catch (persistErr) {
        user.passwordHash = prevState.passwordHash;
        user.passwordSalt = prevState.passwordSalt;
        user.passwordIterations = prevState.passwordIterations;
        user.permissionsVersion = prevState.permissionsVersion;
        user.updatedAt = prevState.updatedAt;
        serverDbState.data.auditLogs = serverDbState.data.auditLogs.filter((al: any) => al.id !== resetCompletedLog.id);
        throw persistErr;
      }

      failedAttemptsMap.delete(resetLockKey);
      tokenRecord.used = true;
      passwordRecoveryTokens.delete(String(resetToken));

      for (const [token, session] of activeServerSessions.entries()) {
        if (session.userId === user.id) {
          activeServerSessions.delete(token);
        }
      }
      deleteUserSessionsFromDb(user.id);
      saveServerSessions();

      return res.json({
        success: true,
        message: 'Su contraseña ha sido actualizada exitosamente. Inicie sesión con sus nuevas credenciales.',
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}
