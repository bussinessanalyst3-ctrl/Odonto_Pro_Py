import { UserRole, UserSession, AuthCredentials, LoginResult, PasswordChangeResult } from './types.ts';
import { dbStore } from '../db/inMemoryStore.ts';
import { getApiBaseUrl } from '../config/apiConfig.ts';

// Configuración de sesiones y seguridad desde variables de entorno
const SESSION_EXPIRATION_HOURS =
  Number(import.meta?.env?.VITE_SESSION_EXPIRATION_HOURS) || 8;
const MAX_LOGIN_ATTEMPTS =
  Number(import.meta?.env?.VITE_MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_DURATION_MINUTES =
  Number(import.meta?.env?.VITE_LOCKOUT_DURATION_MINUTES) || 15;

interface FailedAttemptTracker {
  count: number;
  lockedUntil: number | null; // timestamp ms
}

class AuthService {
  private failedAttempts: Map<string, FailedAttemptTracker> = new Map();
  private maxAttempts = MAX_LOGIN_ATTEMPTS;
  private lockoutDurationMs = LOCKOUT_DURATION_MINUTES * 60 * 1000;

  /**
   * Restablece el contador de intentos fallidos (desbloqueo manual por administrador)
   */
  public resetFailedAttempts(email?: string): void {
    if (email) {
      this.failedAttempts.delete(email.trim().toLowerCase());
    } else {
      this.failedAttempts.clear();
    }
  }

  /**
   * Verifica si un correo está actualmente bloqueado por exceso de intentos
   */
  public isLockedOut(email: string): { locked: boolean; remainingMinutes?: number } {
    const safeEmail = email.trim().toLowerCase();
    const tracker = this.failedAttempts.get(safeEmail);
    if (!tracker || !tracker.lockedUntil) return { locked: false };

    const now = Date.now();
    if (tracker.lockedUntil > now) {
      const remainingMinutes = Math.ceil((tracker.lockedUntil - now) / 60000);
      return { locked: true, remainingMinutes };
    }

    // El tiempo de bloqueo ya expiró
    this.failedAttempts.delete(safeEmail);
    return { locked: false };
  }

  /**
   * Autenticación Segura PBKDF2 delegada exclusivamente al backend (sin contraseñas maestras ni fallback offline en cliente)
   */
  public async login(credentials: AuthCredentials): Promise<LoginResult> {
    const rawPassword = credentials.password || '';
    const cleanedPassword = rawPassword.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const identifier = (credentials.email || credentials.username || '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

    if (!identifier || !cleanedPassword) {
      return {
        success: false,
        error: 'Las credenciales ingresadas no son válidas.',
      };
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: cleanedPassword,
          rememberMe: !!credentials.rememberMe,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Las credenciales ingresadas no son válidas.',
          locked: data.locked,
          blockedUntilMinutes: data.remainingMinutes,
        };
      }

      if (data.session) {
        dbStore.setSessionToken(data.session.sessionToken || null);
        dbStore.setBackendActorContext({
          userId: data.session.userId,
          role: data.session.role,
          organizationId: data.session.organizationId,
          allowedBranchIds: data.session.allowedBranchIds,
          customPermissions: data.session.customPermissions,
          revokedPermissions: data.session.revokedPermissions,
          assignedRestrictions: data.session.assignedRestrictions,
          allowedNavTabs: data.session.allowedNavTabs,
          permissionsVersion: data.session.permissionsVersion,
        });
        await dbStore.syncFromServer();
        dbStore.switchOrganization(data.session.organizationId);
      }

      return {
        success: true,
        session: data.session,
      };
    } catch {
      return {
        success: false,
        error: 'No se pudo conectar con el servidor de autenticación. Verifique su conexión e intente nuevamente.',
      };
    }
  }

  /**
   * Hidrata y valida la sesión activa desde el servidor usando la cookie HttpOnly
   */
  public async getCurrentSession(sessionToken?: string | null): Promise<UserSession | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = {};
      if (sessionToken && !sessionToken.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const response = await fetch(`${baseUrl}/api/auth/session`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.valid && data.session) {
        return data.session as UserSession;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Consulta liviana de versión de permisos y rol vigente sin recargar toda la sesión
   */
  public async getPermissionsVersion(
    sessionToken?: string | null
  ): Promise<
    | { status: 'ok'; permissionsVersion: number; role: string; updatedAt?: string }
    | { status: 'unauthorized' }
    | { status: 'error' }
  > {
    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = {};
      if (sessionToken && !sessionToken.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }
      const response = await fetch(`${baseUrl}/api/auth/permissions-version`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers,
      });
      if (response.status === 401) {
        return { status: 'unauthorized' };
      }
      if (!response.ok) {
        return { status: 'error' };
      }
      const data = await response.json().catch(() => null);
      if (data?.valid) {
        return {
          status: 'ok',
          permissionsVersion: Number(data.permissionsVersion) || 1,
          role: String(data.role || ''),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
        };
      }
      return { status: 'error' };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * Cierre de sesión seguro invalidando token/cookie HttpOnly en el servidor
   */
  public logout(session: UserSession | null): void {
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }
    fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({}),
    }).catch(() => {});

    if (session) {
      this.logAudit(
        'LOGOUT',
        session.organizationId,
        session.userId,
        `Cierre de sesión: ${session.firstName} ${session.lastName}`
      );
    }

    dbStore.setSessionToken(null);
    dbStore.setBackendActorContext(null);
  }

  /**
   * Valida si una sesión en memoria sigue siendo válida y no fue revocada
   */
  public isSessionValid(session: UserSession | null): boolean {
    if (!session) return false;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return false;
    }

    if (dbStore.isSessionRevoked(session.userId, session.issuedAt)) {
      return false;
    }

    return true;
  }

  /**
   * Cambio de contraseña para el usuario actualmente autenticado (en servidor)
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<PasswordChangeResult> {
    if (!newPassword || newPassword.trim().length < 8) {
      return { success: false, error: 'La nueva contraseña debe tener como mínimo 8 caracteres.' };
    }

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'No se pudo actualizar la contraseña.',
        };
      }
      return {
        success: true,
        message: data.message || 'Su contraseña ha sido actualizada con éxito.',
      };
    } catch {
      return {
        success: false,
        error: 'Error de conexión con el servidor al actualizar la contraseña.',
      };
    }
  }

  /**
   * Solicitud de restablecimiento de contraseña (procedimiento seguro contra enumeración de usuarios)
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/recover-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await response.json();
      return {
        success: true,
        message:
          data.message ||
          'Si el correo electrónico ingresado coincide con una cuenta activa, recibirá las instrucciones para restablecer su acceso institucional.',
      };
    } catch (e) {
      return {
        success: true,
        message:
          'Si el correo electrónico ingresado coincide con una cuenta activa, recibirá las instrucciones para restablecer su acceso institucional.',
      };
    }
  }

  /**
   * Restablecimiento de contraseña con token temporal de un solo uso
   */
  public async resetPasswordWithToken(
    resetToken: string,
    newPassword: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken: resetToken.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'El enlace o token de recuperación es inválido o ha expirado.',
        };
      }
      return {
        success: true,
        message: data.message || 'Su contraseña ha sido actualizada con éxito.',
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message || 'Error de comunicación con el servidor al restablecer contraseña.',
      };
    }
  }

  /**
   * Cambio de sucursal activa con validación anti-IDOR y persistencia en servidor (POST /api/auth/switch-branch)
   */
  public async switchBranch(session: UserSession, newBranchId: string): Promise<UserSession> {
    if (session.role !== 'SUPER_ADMIN' && !session.allowedBranchIds.includes(newBranchId)) {
      throw new Error('Violación de Seguridad: El usuario no tiene asignada esta sucursal.');
    }

    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${session.sessionToken}`;
      }
      const response = await fetch(`${baseUrl}/api/auth/switch-branch`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ branchId: newBranchId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.success && data.session) {
        return data.session as UserSession;
      }
      if (!response.ok && data?.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('403') || err.message.includes('Prohibido') || err.message.includes('asignada'))) {
        throw err;
      }
    }

    return {
      ...session,
      currentBranchId: newBranchId,
    };
  }

  private recordFailedAttempt(email: string) {
    const current = this.failedAttempts.get(email) || { count: 0, lockedUntil: null };
    current.count += 1;

    if (current.count >= this.maxAttempts) {
      current.lockedUntil = Date.now() + this.lockoutDurationMs;
    }

    this.failedAttempts.set(email, current);
  }

  private getRemainingAttempts(email: string): number {
    const current = this.failedAttempts.get(email);
    if (!current) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - current.count);
  }

  private logAudit(
    action: string,
    orgId: string | null,
    userId: string | null,
    description: string
  ) {
    const snapshot = dbStore.getSnapshot();
    snapshot.auditLogs.unshift({
      id: crypto.randomUUID(),
      organizationId: orgId || snapshot.organization.id,
      branchId: null,
      userId: userId || null,
      action,
      entity: 'USER_AUTH',
      entityId: userId || null,
      ipAddress: null,
      userAgent: 'ODONTOPRO Web Client',
      oldValues: null,
      newValues: { action, timestamp: new Date().toISOString() },
      description,
      createdAt: new Date(),
    });
  }
}

export const authService = new AuthService();
