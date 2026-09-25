export type SystemBaseRole =
  | 'SUPER_ADMIN'
  | 'ADMIN_SUCURSAL'
  | 'SUPERVISOR'
  | 'ODONTOLOGO'
  | 'RECEPCION'
  | 'CAJA'
  | 'ASISTENTE'
  | 'VENDEDOR';

export type UserRole = SystemBaseRole | string;

export interface UserSession {
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationTaxId: string; // RUC
  role: UserRole;
  roleName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  professionalLicense?: string | null; // Reg. MSPBS
  specialty?: string | null;
  allowedBranchIds: string[];
  currentBranchId: string;
  sessionToken: string;
  issuedAt: string;
  expiresAt: string;
  cookieConfig: {
    httpOnly: boolean;
    sameSite: 'lax' | 'strict';
    secure: boolean;
    maxAgeSeconds: number;
  };
}

export interface AuthCredentials {
  email: string;
  password?: string;
  branchId?: string;
  rememberMe?: boolean;
}

export interface LoginResult {
  success: boolean;
  session?: UserSession;
  error?: string;
  attemptsLeft?: number;
  blockedUntilMinutes?: number;
}

export interface PasswordChangeResult {
  success: boolean;
  error?: string;
  message?: string;
}
