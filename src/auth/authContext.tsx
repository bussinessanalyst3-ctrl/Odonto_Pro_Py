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
  changePassword: (currentPassword: string, newPassword: string) => Promise<PasswordChangeResult>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordWithToken: (resetToken: string, newPassword: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LEGACY_SESSION_STORAGE_KEY = 'odontopro_auth_session';
const LEGACY_DB_STORAGE_KEY = 'odontopro_db_state_v3';

function purgeLegacyBrowserSecrets() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
      localStorage.removeItem(LEGACY_DB_STORAGE_KEY);
    }
  } catch {
    // Ignorar errores de acceso a storage
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hidratar sesión segura desde cookie HttpOnly en el backend y purgar residuos inseguros de localStorage
  useEffect(() => {
    purgeLegacyBrowserSecrets();
    let mounted = true;
    (async () => {
      try {
        const serverSession = await authService.getCurrentSession();
        if (mounted && serverSession && authService.isSessionValid(serverSession)) {
          dbStore.setSessionToken(serverSession.sessionToken || null);
          dbStore.setBackendActorContext({
            userId: serverSession.userId,
            role: serverSession.role,
            organizationId: serverSession.organizationId,
            allowedBranchIds: serverSession.allowedBranchIds,
            customPermissions: serverSession.customPermissions,
            revokedPermissions: serverSession.revokedPermissions,
            assignedRestrictions: serverSession.assignedRestrictions,
            allowedNavTabs: serverSession.allowedNavTabs,
            permissionsVersion: serverSession.permissionsVersion,
          });
          setSession(serverSession);
          await dbStore.syncFromServer();
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sincronización reactiva inmediata de cambios de permisos, revocación y versionado
  useEffect(() => {
    if (!session) {
      dbStore.setSessionToken(null);
      dbStore.setBackendActorContext(null);
      return;
    }

    dbStore.setSessionToken(session.sessionToken || null);
    dbStore.setBackendActorContext({
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      allowedBranchIds: session.allowedBranchIds,
      customPermissions: session.customPermissions,
      revokedPermissions: session.revokedPermissions,
      assignedRestrictions: session.assignedRestrictions,
      allowedNavTabs: session.allowedNavTabs,
      permissionsVersion: session.permissionsVersion,
    });

    // Verificación periódica de expiración y revocación contra el servidor
    const interval = setInterval(async () => {
      if (!authService.isSessionValid(session)) {
        logout();
        return;
      }
      const checked = await authService.getCurrentSession();
      if (!checked) {
        logout();
      }
    }, 30000);

    // Suscripción reactiva instantánea a cambios en base de datos
    const unsubscribe = dbStore.subscribe(() => {
      const userInDb = dbStore.findUserById(session.userId);
      if (!userInDb || userInDb.status === 'INACTIVE') {
        logout();
        return;
      }

      if (dbStore.isSessionRevoked(session.userId, session.issuedAt)) {
        logout();
        return;
      }

      const dbPermVersion = (userInDb as any).permissionsVersion || 1;
      const sessionPermVersion = session.permissionsVersion || 1;
      const roleChanged = userInDb.roleId !== session.role;
      const activeOrg = dbStore.getActiveOrganization();
      const orgMissing = !dbStore.getOrganizations().some((o) => o.id === session.organizationId);
      const orgNameChanged =
        activeOrg &&
        (orgMissing ||
          session.organizationName !== activeOrg.name ||
          session.organizationTaxId !== activeOrg.taxId);

      if (dbPermVersion !== sessionPermVersion || roleChanged || orgNameChanged) {
        const effective = dbStore.getUserEffectivePermissions(userInDb.id);
        const roleObj = dbStore.getRoles().find((r) => r.id === userInDb.roleId);

        const updatedSession: UserSession = {
          ...session,
          role: userInDb.roleId as any,
          roleName: roleObj?.name || userInDb.roleId,
          organizationId: orgMissing && activeOrg ? activeOrg.id : session.organizationId,
          organizationName: activeOrg?.name || session.organizationName,
          organizationTaxId: activeOrg?.taxId || session.organizationTaxId,
          effectivePermissions: effective.effectivePermissions,
          customPermissions: effective.customPermissions,
          revokedPermissions: effective.revokedPermissions,
          assignedRestrictions: effective.activeRestrictions,
          allowedNavTabs: effective.allowedNavTabs,
          permissionsVersion: dbPermVersion,
        };

        setSession(updatedSession);
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
        dbStore.setSessionToken(result.session.sessionToken || null);
        dbStore.setBackendActorContext({
          userId: result.session.userId,
          role: result.session.role,
          organizationId: result.session.organizationId,
          allowedBranchIds: result.session.allowedBranchIds,
          customPermissions: result.session.customPermissions,
          revokedPermissions: result.session.revokedPermissions,
          assignedRestrictions: result.session.assignedRestrictions,
          allowedNavTabs: result.session.allowedNavTabs,
          permissionsVersion: result.session.permissionsVersion,
        });
        setSession(result.session);
        purgeLegacyBrowserSecrets();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout(session);
    dbStore.setSessionToken(null);
    dbStore.setBackendActorContext(null);
    setSession(null);
    purgeLegacyBrowserSecrets();
  };

  const switchBranch = (branchId: string) => {
    if (!session) return;
    try {
      const updated = authService.switchBranch(session, branchId);
      setSession(updated);
    } catch (err: any) {
      console.error(err.message || 'Error al cambiar de sucursal');
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

  const resetPasswordWithToken = async (resetToken: string, newPassword: string) => {
    return authService.resetPasswordWithToken(resetToken, newPassword);
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
        changePassword,
        requestPasswordReset,
        resetPasswordWithToken,
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
