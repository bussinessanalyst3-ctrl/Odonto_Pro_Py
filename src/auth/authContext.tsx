import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, UserRole, AuthCredentials, LoginResult, PasswordChangeResult } from './types.ts';
import { authService } from './authService.ts';
import { dbStore } from '../db/inMemoryStore.ts';

interface AuthContextType {
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthCredentials) => Promise<LoginResult>;
  logout: () => void;
  switchBranch: (branchId: string) => void;
  switchOrganization: (orgId: string) => void;
  hasRole: (requiredRoles: UserRole | UserRole[]) => boolean;
  quickLoginAs: (role: UserRole) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<PasswordChangeResult>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'odontopro_auth_session';

const getInitialSession = (): UserSession | null => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserSession;
      if (authService.isSessionValid(parsed)) {
        return parsed;
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error cargando sesión previa:', e);
  }

  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(getInitialSession);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sincronización reactiva inmediata de cambios de permisos, revocación y versionado
  useEffect(() => {
    if (!session) return;

    // Verificación periódica de expiración y revocación
    const interval = setInterval(() => {
      if (!authService.isSessionValid(session)) {
        console.warn('Sesión caducada o revocada por el Administrador. Cerrando sesión...');
        logout();
      }
    }, 10000);

    // Suscripción reactiva instantánea a cambios en base de datos
    const unsubscribe = dbStore.subscribe(() => {
      const userInDb = dbStore.findUserById(session.userId);
      if (!userInDb || userInDb.status === 'INACTIVE') {
        logout();
        return;
      }

      if (dbStore.isSessionRevoked(session.userId, session.issuedAt)) {
        console.warn('Sesión revocada explícitamente por el Super Administrador.');
        logout();
        return;
      }

      const dbPermVersion = (userInDb as any).permissionsVersion || 1;
      const sessionPermVersion = session.permissionsVersion || 1;
      const roleChanged = userInDb.roleId !== session.role;

      if (dbPermVersion !== sessionPermVersion || roleChanged) {
        const effective = dbStore.getUserEffectivePermissions(userInDb.id);
        const roleObj = dbStore.getRoles().find((r) => r.id === userInDb.roleId);

        const updatedSession: UserSession = {
          ...session,
          role: userInDb.roleId as any,
          roleName: roleObj?.name || userInDb.roleId,
          effectivePermissions: effective.effectivePermissions,
          customPermissions: effective.customPermissions,
          revokedPermissions: effective.revokedPermissions,
          assignedRestrictions: effective.activeRestrictions,
          allowedNavTabs: effective.allowedNavTabs,
          permissionsVersion: dbPermVersion,
        };

        setSession(updatedSession);
        try {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
        } catch (e) {}
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session]);

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
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
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

  const switchOrganization = (orgId: string) => {
    if (!session) return;
    const target = dbStore.getOrganizations().find((o) => o.id === orgId);
    if (!target) return;

    dbStore.switchOrganization(orgId, {
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      allowedBranchIds: session.allowedBranchIds,
    });

    const orgBranches = dbStore.getBranches();
    const updated: UserSession = {
      ...session,
      organizationId: target.id,
      organizationName: target.name,
      organizationTaxId: target.taxId,
      allowedBranchIds: session.role === 'SUPER_ADMIN' ? orgBranches.map((b) => b.id) : session.allowedBranchIds,
      currentBranchId: orgBranches[0]?.id || '',
    };
    setSession(updated);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
  };

  const hasRole = (requiredRoles: UserRole | UserRole[]): boolean => {
    if (!session) return false;
    if (session.role === 'SUPER_ADMIN') return true;
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return rolesArray.includes(session.role);
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<PasswordChangeResult> => {
    if (!session) {
      return { success: false, error: 'No hay una sesión activa.' };
    }
    const result = await authService.changePassword(session.userId, currentPassword, newPassword);
    return result;
  };

  const requestPasswordReset = async (email: string) => {
    return authService.requestPasswordReset(email);
  };

  const quickLoginAs = async (role: UserRole) => {
    const snapshot = dbStore.getSnapshot();
    const userWithRole = snapshot.users.find((u) => u.roleId === role);
    const roleObj = dbStore.getRoles().find((r) => r.id === role);

    const targetUser = userWithRole || snapshot.users[0];
    const org = snapshot.organization;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const userEffective = dbStore.getUserEffectivePermissions(targetUser.id);

    const customSession: UserSession = {
      userId: targetUser.id,
      organizationId: org.id,
      organizationName: org.name,
      organizationTaxId: org.taxId,
      role: (targetUser.roleId || role) as any,
      roleName: roleObj ? roleObj.name : role,
      firstName: userWithRole ? userWithRole.firstName : targetUser.firstName,
      lastName: userWithRole ? userWithRole.lastName : targetUser.lastName,
      email: userWithRole ? userWithRole.email : targetUser.email,
      phone: targetUser.phone,
      professionalLicense: role === 'ODONTOLOGO' ? targetUser.professionalLicense : null,
      specialty: roleObj ? roleObj.name : 'Personal Asignado',
      allowedBranchIds: snapshot.branches.map((b) => b.id),
      currentBranchId: snapshot.branches[0]?.id || '',
      sessionToken: `sess_${crypto.randomUUID().replace(/-/g, '')}`,
      effectivePermissions: userEffective.effectivePermissions,
      customPermissions: userEffective.customPermissions,
      revokedPermissions: userEffective.revokedPermissions,
      assignedRestrictions: userEffective.activeRestrictions,
      allowedNavTabs: userEffective.allowedNavTabs,
      permissionsVersion: (targetUser as any).permissionsVersion || 1,
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
        switchOrganization,
        hasRole,
        quickLoginAs,
        changePassword,
        requestPasswordReset,
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
