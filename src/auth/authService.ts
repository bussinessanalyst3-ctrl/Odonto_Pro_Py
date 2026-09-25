import { UserRole, UserSession, AuthCredentials, LoginResult } from './types.ts';
import { dbStore } from '../db/inMemoryStore.ts';
import { verifyPassword } from './cryptoUtils.ts';

// Hashes Criptográficos PBKDF2-HMAC-SHA256 (100,000 iteraciones + Salt Criptográfico)
// ¡NINGUNA CONTRASEÑA EN TEXTO PLANO EXISTE EN ESTE CÓDIGO NI PUEDE SER EXTRAÍDA POR UN ATACANTE!
// Único usuario predeterminado: Super Administrador Lucas Eliezer Arrua Almada.
// Todos los demás usuarios son creados y gestionados por él directamente desde el sistema.
export const INITIAL_USER_HASHES: Record<
  string,
  {
    role: UserRole;
    roleTitle: string;
    email: string;
    salt: string;
    hash: string;
    fullName: string;
    specialty: string;
    license: string | null;
    defaultBranchName: string;
    badgeColor: string;
  }
> = {
  'lucas.arrua@odontosol.com.py': {
    role: 'SUPER_ADMIN' as UserRole,
    roleTitle: 'Super Administrador',
    email: 'lucas.arrua@odontosol.com.py',
    salt: 'c8d0b03515a26fc11a2a6093d16b7e53',
    hash: '5e3f6d970893e87f221b7445ae5fc55f99fea90719d243590d1806cd3fb01465',
    fullName: 'Lucas Eliezer Arrua Almada',
    specialty: 'Dirección General & Auditoría',
    license: null,
    defaultBranchName: 'Acceso Total Multi-Sucursal',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
};

// Objeto de compatibilidad para metadatos públicos de perfiles (sin contraseñas)
export const DEMO_CREDENTIALS = Object.values(INITIAL_USER_HASHES);

interface FailedAttemptTracker {
  count: number;
  lockedUntil: number | null; // timestamp ms
}

class AuthService {
  private failedAttempts: Map<string, FailedAttemptTracker> = new Map();
  private maxAttempts = 5;
  private lockoutDurationMs = 15 * 60 * 1000; // 15 minutos

  public async login(credentials: AuthCredentials): Promise<LoginResult> {
    const email = credentials.email.trim().toLowerCase();
    const now = Date.now();

    // 1. Verificar bloqueo por fuerza bruta
    const tracker = this.failedAttempts.get(email);
    if (tracker && tracker.lockedUntil && tracker.lockedUntil > now) {
      const remainingMinutes = Math.ceil((tracker.lockedUntil - now) / 60000);
      return {
        success: false,
        error: `Cuenta temporalmente bloqueada por seguridad tras 5 intentos fallidos. Intente nuevamente en ${remainingMinutes} minuto(s).`,
        blockedUntilMinutes: remainingMinutes,
        attemptsLeft: 0,
      };
    }

    const snapshot = dbStore.getSnapshot();
    const user = snapshot.users.find((u) => u.email.toLowerCase() === email);
    const org = snapshot.organization;

    if (!user) {
      this.recordFailedAttempt(email);
      const remaining = this.getRemainingAttempts(email);
      this.logAudit('LOGIN_FAILED', null, null, `Intento fallido: Correo no registrado (${email})`);
      return {
        success: false,
        error: 'Credenciales inválidas. Verifique su correo electrónico y contraseña.',
        attemptsLeft: remaining,
      };
    }

    // 2. Obtener el Hash PBKDF2 y Salt Criptográfico del usuario
    let targetHashRecord = dbStore.getUserPasswordRecord(email);
    if (!targetHashRecord && INITIAL_USER_HASHES[email]) {
      targetHashRecord = {
        hash: INITIAL_USER_HASHES[email].hash,
        salt: INITIAL_USER_HASHES[email].salt,
        iterations: 100000,
      };
    }

    // Si no hay hash disponible para este usuario (fallback)
    if (!targetHashRecord) {
      this.recordFailedAttempt(email);
      return {
        success: false,
        error: 'Usuario sin credenciales criptográficas configuradas. Solicite restablecimiento al Super Administrador.',
        attemptsLeft: this.getRemainingAttempts(email),
      };
    }

    // 3. Verificación Criptográfica PBKDF2 (Anti-Timing Attacks)
    const passwordMatch = await verifyPassword(
      credentials.password,
      targetHashRecord.hash,
      targetHashRecord.salt,
      targetHashRecord.iterations
    );

    if (!passwordMatch) {
      this.recordFailedAttempt(email);
      const remaining = this.getRemainingAttempts(email);
      this.logAudit('LOGIN_FAILED', org.id, user.id, `Contraseña incorrecta para ${email}`);

      if (remaining === 0) {
        return {
          success: false,
          error: 'Ha superado el límite de 5 intentos fallidos. Su cuenta ha sido bloqueada por 15 minutos como medida de seguridad médica.',
          attemptsLeft: 0,
          blockedUntilMinutes: 15,
        };
      }

      return {
        success: false,
        error: `Contraseña incorrecta. Le quedan ${remaining} intento(s) antes del bloqueo de seguridad.`,
        attemptsLeft: remaining,
      };
    }

    // 3. Login Exitoso: Limpiar tracker de intentos fallidos
    this.failedAttempts.delete(email);

    // 4. Determinar sucursales autorizadas
    const userBranchLinks = snapshot.userBranches.filter((ub) => ub.userId === user.id);
    let allowedBranchIds = userBranchLinks.map((ub) => ub.branchId);

    // Si es Super Admin, tiene acceso a todas las sucursales de la organización
    if (user.roleId === 'SUPER_ADMIN') {
      allowedBranchIds = snapshot.branches.map((b) => b.id);
    }

    // Sucursal activa seleccionada o predeterminada
    let safeBranchId: string;
    if (credentials.branchId && allowedBranchIds.includes(credentials.branchId)) {
      safeBranchId = credentials.branchId;
    } else {
      const defaultUb = userBranchLinks.find((ub) => ub.isDefault);
      safeBranchId = defaultUb?.branchId || allowedBranchIds[0] || snapshot.branches[0]?.id || 'branch-asu';
    }

    // 5. Generar token de sesión seguro con fecha de caducidad (8 horas)
    const sessionToken = `sess_${crypto.randomUUID().replace(/-/g, '')}`;
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    const roleObj = snapshot.roles.find((r) => r.id === user.roleId);

    const session: UserSession = {
      userId: user.id,
      organizationId: org.id,
      organizationName: org.name,
      organizationTaxId: org.taxId,
      role: user.roleId as UserRole,
      roleName: roleObj ? roleObj.name : user.roleId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      professionalLicense: user.professionalLicense,
      specialty: user.specialty,
      allowedBranchIds,
      currentBranchId: safeBranchId,
      sessionToken,
      issuedAt,
      expiresAt,
      cookieConfig: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAgeSeconds: 8 * 3600,
      },
    };

    // Actualizar último login del usuario
    user.lastLoginAt = new Date();

    // 6. Registrar en bitácora inmutable de auditoría
    const currentBranch = snapshot.branches.find((b) => b.id === safeBranchId);
    this.logAudit(
      'LOGIN_SUCCESS',
      org.id,
      user.id,
      `Inicio de sesión exitoso: ${user.firstName} ${user.lastName} (${user.roleId}) en ${currentBranch?.name || 'General'}`
    );

    return {
      success: true,
      session,
    };
  }

  public logout(session: UserSession | null): void {
    if (session) {
      this.logAudit(
        'LOGOUT',
        session.organizationId,
        session.userId,
        `Cierre de sesión seguro: ${session.firstName} ${session.lastName}`
      );
    }
  }

  public switchBranch(session: UserSession, newBranchId: string): UserSession {
    // Validar anti-IDOR: ¿El usuario tiene permiso para esta sucursal?
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
