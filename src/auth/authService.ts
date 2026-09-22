import { UserRole, UserSession, AuthCredentials, LoginResult } from './types.ts';
import { dbStore } from '../db/inMemoryStore.ts';

// Credenciales estándar de prueba para la demostración clínica
export const DEMO_CREDENTIALS = [
  {
    role: 'SUPER_ADMIN' as UserRole,
    roleTitle: 'Super Administrador',
    email: 'rodrigo.benitez@odontosol.com.py',
    password: 'Admin2026!#',
    fullName: 'Lic. Rodrigo Benítez',
    specialty: 'Dirección Médica & Auditoría',
    license: null,
    defaultBranchName: 'Acceso Total Multi-Sucursal',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    role: 'ODONTOLOGO' as UserRole,
    roleTitle: 'Odontóloga Especialista',
    email: 'dra.gonzalez@odontosol.com.py',
    password: 'DraBelen2026!',
    fullName: 'Dra. María Belén González',
    specialty: 'Ortodoncia & Ortopedia Maxilofacial',
    license: 'MSPBS N° 7.842',
    defaultBranchName: 'Asunción Centro & San Lorenzo',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    role: 'ODONTOLOGO' as UserRole,
    roleTitle: 'Odontólogo Especialista',
    email: 'dr.villalba@odontosol.com.py',
    password: 'DrCarlos2026!',
    fullName: 'Dr. Carlos Eduardo Villalba',
    specialty: 'Endodoncia e Implantología',
    license: 'MSPBS N° 9.155',
    defaultBranchName: 'Asunción Centro & Luque',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  },
  {
    role: 'RECEPCION' as UserRole,
    roleTitle: 'Recepción & Agendamiento',
    email: 'recepcion.asu@odontosol.com.py',
    password: 'RecepAsu2026!',
    fullName: 'Ana Sofía Giménez',
    specialty: 'Atención al Paciente & Agendas',
    license: null,
    defaultBranchName: 'Sucursal Asunción Centro',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    role: 'CAJA' as UserRole,
    roleTitle: 'Caja & Facturación',
    email: 'caja.asu@odontosol.com.py',
    password: 'CajaAsu2026!',
    fullName: 'Fabio Manuel Ortiz',
    specialty: 'Facturación Legal & Cobros PYG',
    license: null,
    defaultBranchName: 'Sucursal Asunción Centro',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
];

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

    // 2. Verificar contraseña
    // Verificamos contra la demo o credenciales
    const demoUser = DEMO_CREDENTIALS.find((d) => d.email.toLowerCase() === email);
    const validPassword = demoUser ? demoUser.password : 'OdontoSol2026!';
    const passwordMatch = credentials.password === validPassword;

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
