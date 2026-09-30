import { UserRole, UserSession, AuthCredentials, LoginResult, PasswordChangeResult } from './types.ts';
import { dbStore } from '../db/inMemoryStore.ts';
import { verifyPassword, hashPassword, generateSalt } from './cryptoUtils.ts';

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
   * Autenticación Segura PBKDF2 delegada al backend con protección contra Timing Attacks, Enumeración y Fuerza Bruta
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          password: cleanedPassword,
          rememberMe: !!credentials.rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Las credenciales ingresadas no son válidas.',
          locked: data.locked,
          blockedUntilMinutes: data.remainingMinutes,
        };
      }

      // Sincronizar contexto local del usuario
      if (data.session) {
        dbStore.switchOrganization(data.session.organizationId);
      }

      return {
        success: true,
        session: data.session,
      };
    } catch (netErr) {
      return {
        success: false,
        error: 'No se pudo conectar con el servidor de autenticación. Verifique su conexión de red.',
      };
    }
  }

  /**
   * Cierre de sesión seguro invalidando token en el servidor y registrando auditoría
   */
  public logout(session: UserSession | null): void {
    if (session?.sessionToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ token: session.sessionToken }),
      }).catch(() => {});
    }

    if (session) {
      this.logAudit(
        'LOGOUT',
        session.organizationId,
        session.userId,
        `Cierre de sesión: ${session.firstName} ${session.lastName}`
      );
    }
  }

  /**
   * Valida si una sesión en memoria sigue siendo válida y no fue revocada
   */
  public isSessionValid(session: UserSession | null): boolean {
    if (!session) return false;

    // Verificar si expiró por tiempo
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return false;
    }

    // Verificar si fue revocada por un administrador
    if (dbStore.isSessionRevoked(session.userId, session.issuedAt)) {
      return false;
    }

    return true;
  }

  /**
   * Cambio de contraseña para el usuario actualmente autenticado
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<PasswordChangeResult> {
    const snapshot = dbStore.getSnapshot();
    const user = snapshot.users.find((u) => u.id === userId);
    if (!user) {
      return { success: false, error: 'Usuario no encontrado en el sistema.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'La nueva contraseña debe tener como mínimo 8 caracteres.' };
    }

    // 1. Validar contraseña actual
    const currentHashRec = dbStore.getUserPasswordRecord(user.email);
    if (currentHashRec) {
      const match = await verifyPassword(
        currentPassword.trim(),
        currentHashRec.hash,
        currentHashRec.salt,
        currentHashRec.iterations
      );
      if (!match) {
        return { success: false, error: 'La contraseña actual ingresada es incorrecta.' };
      }
    }

    // 2. Generar nuevo hash criptográfico PBKDF2 con nueva sal
    const newSalt = generateSalt();
    const newHashRec = await hashPassword(newPassword.trim(), newSalt, 100000);

    // 3. Almacenar en el store
    dbStore.setUserPasswordHash(userId, {
      hash: newHashRec.hash,
      salt: newHashRec.salt,
      iterations: newHashRec.iterations,
    });

    // 4. Revocar sesiones anteriores por seguridad
    dbStore.revokeUserSessions(userId);

    this.logAudit(
      'PASSWORD_CHANGE',
      snapshot.organization.id,
      userId,
      `Cambio voluntario de contraseña realizado por el usuario ${user.firstName} ${user.lastName}`
    );

    return {
      success: true,
      message: 'Su contraseña ha sido actualizada con éxito.',
    };
  }

  /**
   * Solicitud de restablecimiento de contraseña (procedimiento seguro contra enumeración de usuarios)
   */
  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const response = await fetch('/api/auth/recover-password', {
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
      const response = await fetch('/api/auth/reset-password', {
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
   * Cambio de sucursal activa con validación anti-IDOR
   */
  public switchBranch(session: UserSession, newBranchId: string): UserSession {
    if (session.role !== 'SUPER_ADMIN' && !session.allowedBranchIds.includes(newBranchId)) {
      throw new Error('Violación de Seguridad: El usuario no tiene asignada esta sucursal.');
    }

    const updatedSession: UserSession = {
      ...session,
      currentBranchId: newBranchId,
    };

    const snapshot = dbStore.getSnapshot();
    const branch = snapshot.branches.find((b) => b.id === newBranchId);

    this.logAudit(
      'BRANCH_SWITCH',
      session.organizationId,
      session.userId,
      `Cambio de contexto a sucursal: ${branch?.name || newBranchId}`
    );

    return updatedSession;
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
      ipAddress: '190.52.144.12',
      userAgent: 'OdontoPro Web Secure Client',
      oldValues: null,
      newValues: { action, timestamp: new Date().toISOString() },
      description,
      createdAt: new Date(),
    });
  }
}

export const authService = new AuthService();
