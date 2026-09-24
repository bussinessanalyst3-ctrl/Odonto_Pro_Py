import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, UserRole, AuthCredentials, LoginResult } from './types.ts';
import { authService, DEMO_CREDENTIALS } from './authService.ts';
import { dbStore } from '../db/inMemoryStore.ts';

interface AuthContextType {
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<LoginResult>;
  logout: () => void;
  switchBranch: (branchId: string) => void;
  hasRole: (requiredRoles: UserRole | UserRole[]) => boolean;
  quickLoginAs: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'odontopro_auth_session';

const getInitialSession = (): UserSession | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserSession;
      if (new Date(parsed.expiresAt).getTime() > Date.now()) {
        return parsed;
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error loading session from localStorage:', e);
  }

  // Por defecto, no iniciar sesión automáticamente para exigir autenticación y respetar RBAC
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(getInitialSession);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync session on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const login = async (credentials: AuthCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const result = await authService.login(credentials);
      if (result.success && result.session) {
        setSession(result.session);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result.session));
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout(session);
    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const switchBranch = (branchId: string) => {
    if (!session) return;
    try {
      const updated = authService.switchBranch(session, branchId);
      setSession(updated);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (err: any) {
      alert(err.message || 'Error al cambiar de sucursal');
    }
  };

  const hasRole = (requiredRoles: UserRole | UserRole[]): boolean => {
    if (!session) return false;
    if (session.role === 'SUPER_ADMIN') return true;
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return rolesArray.includes(session.role);
  };

  const quickLoginAs = async (role: UserRole) => {
    // Buscar usuario con dicho rol o crear sesión directa autorizada
    const snapshot = dbStore.getSnapshot();
    const userWithRole = snapshot.users.find((u) => u.roleId === role);
    const roleObj = dbStore.getRoles().find((r) => r.id === role);

    const targetUser = userWithRole || snapshot.users[0];
    const org = snapshot.organization;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const customSession: UserSession = {
      userId: targetUser.id,
      organizationId: org.id,
      organizationName: org.name,
      organizationTaxId: org.taxId,
      role: role as any,
      roleName: roleObj ? roleObj.name : role,
      firstName: userWithRole ? userWithRole.firstName : (role === 'VENDEDOR' ? 'Marcos' : role === 'SUPERVISOR' ? 'Lic. Valeria' : targetUser.firstName),
      lastName: userWithRole ? userWithRole.lastName : (role === 'VENDEDOR' ? 'Giménez' : role === 'SUPERVISOR' ? 'Villalba' : targetUser.lastName),
      email: userWithRole ? userWithRole.email : `${role.toLowerCase()}@odontosol.com.py`,
      phone: targetUser.phone,
      professionalLicense: role === 'ODONTOLOGO' ? targetUser.professionalLicense : null,
      specialty: roleObj ? roleObj.name : 'Personal Especializado',
      allowedBranchIds: snapshot.branches.map((b) => b.id),
      currentBranchId: snapshot.branches[0]?.id || '',
      sessionToken: `sess_${crypto.randomUUID().replace(/-/g, '')}`,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      cookieConfig: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAgeSeconds: 8 * 3600,
      },
    };

    setSession(customSession);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(customSession));
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        isLoading,
        login,
        logout,
        switchBranch,
        hasRole,
        quickLoginAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
};
