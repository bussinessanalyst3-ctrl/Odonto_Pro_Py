import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
const PERMISSIONS_POLL_INTERVAL_MS = 10000;

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

function mergeRefreshedSession(current: UserSession, fresh: UserSession): UserSession {
  const isSuperAdmin = fresh.role === 'SUPER_ADMIN';
  const preserveSwitchedOrg =
    isSuperAdmin && current.organizationId && current.organizationId !== fresh.organizationId;

  const allowedBranchIds = preserveSwitchedOrg ? current.allowedBranchIds : fresh.allowedBranchIds;
  const canKeepBranch =
    Boolean(current.currentBranchId) &&
    (isSuperAdmin || allowedBranchIds.includes(current.currentBranchId));

  return {
    ...fresh,
    organizationId: preserveSwitchedOrg ? current.organizationId : fresh.organizationId,
    organizationName: preserveSwitchedOrg ? current.organizationName : fresh.organizationName,
    organizationTaxId: preserveSwitchedOrg ? current.organizationTaxId : fresh.organizationTaxId,
    allowedBranchIds,
    currentBranchId: canKeepBranch ? current.currentBranchId : fresh.currentBranchId,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const sessionRef = useRef<UserSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

  // Mantener sincronizado el contexto del actor en dbStore
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
  }, [session]);

  // Sincronización reactiva de cambios de permisos (polling liviano cada 10s + foco + cambios locales)
  useEffect(() => {
    const activeUserId = session?.userId;
    if (!activeUserId) return;

    let cancelled = false;
    let isChecking = false;

    const handleUnauthorized = () => {
      const current = sessionRef.current;
      authService.logout(current);
      dbStore.setSessionToken(null);
      dbStore.setBackendActorContext(null);
      setSession(null);
      purgeLegacyBrowserSecrets();
    };

    const checkPermissionsVersion = async () => {
      if (cancelled || isChecking) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      const current = sessionRef.current;
      if (!current) return;

      if (!authService.isSessionValid(current)) {
        handleUnauthorized();
        return;
      }

      isChecking = true;
      try {
        const check = await authService.getPermissionsVersion(current.sessionToken);
        if (cancelled) return;

        if (check.status === 'unauthorized') {
          handleUnauthorized();
          return;
        }

        if (check.status !== 'ok') {
          return;
        }

        const currentVersion = current.permissionsVersion || 1;
        const versionChanged = check.permissionsVersion !== currentVersion;
        const roleChanged = Boolean(check.role) && check.role !== current.role;

        if (versionChanged || roleChanged) {
          const refreshed = await authService.getCurrentSession(current.sessionToken);
          if (cancelled || !refreshed) return;

          const latestCurrent = sessionRef.current || current;
          const merged = mergeRefreshedSession(latestCurrent, refreshed);

          dbStore.setSessionToken(merged.sessionToken || null);
          dbStore.setBackendActorContext({
            userId: merged.userId,
            role: merged.role,
            organizationId: merged.organizationId,
            allowedBranchIds: merged.allowedBranchIds,
            customPermissions: merged.customPermissions,
            revokedPermissions: merged.revokedPermissions,
            assignedRestrictions: merged.assignedRestrictions,
            allowedNavTabs: merged.allowedNavTabs,
            permissionsVersion: merged.permissionsVersion,
          });
          setSession(merged);
          void dbStore.syncFromServer();
        }
      } finally {
        isChecking = false;
      }
    };

    const interval = setInterval(() => {
      void checkPermissionsVersion();
    }, PERMISSIONS_POLL_INTERVAL_MS);

    const handleWindowFocus = () => {
      void checkPermissionsVersion();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        void checkPermissionsVersion();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Suscripción reactiva instantánea a cambios en base de datos local sincronizada
    const unsubscribe = dbStore.subscribe(() => {
      const current = sessionRef.current;
      if (!current) return;

      const userInDb = dbStore.findUserById(current.userId);
      if (!userInDb || userInDb.status === 'INACTIVE') {
        handleUnauthorized();
        return;
      }

      if (dbStore.isSessionRevoked(current.userId, current.issuedAt)) {
        handleUnauthorized();
        return;
      }

      const dbPermVersion = (userInDb as any).permissionsVersion || 1;
      const sessionPermVersion = current.permissionsVersion || 1;
      const roleChanged = userInDb.roleId !== current.role;
      const activeOrg = dbStore.getActiveOrganization();
      const orgMissing = !dbStore.getOrganizations().some((o) => o.id === current.organizationId);
      const orgNameChanged =
        activeOrg &&
        (orgMissing ||
          current.organizationName !== activeOrg.name ||
          current.organizationTaxId !== activeOrg.taxId);

      if (dbPermVersion !== sessionPermVersion || roleChanged || orgNameChanged) {
        const effective = dbStore.getUserEffectivePermissions(userInDb.id);
        const roleObj = dbStore.getRoles().find((r) => r.id === userInDb.roleId);

        const userHasCustomTabs =
          Array.isArray((userInDb as any).allowedNavTabs) && (userInDb as any).allowedNavTabs.length > 0;
        const roleHasCustomTabs =
          Array.isArray((roleObj as any)?.allowedNavTabs) && (roleObj as any).allowedNavTabs.length > 0;
        const resolvedNavTabs =
          userInDb.roleId === 'SUPER_ADMIN'
            ? effective.allowedNavTabs
            : userHasCustomTabs
            ? (userInDb as any).allowedNavTabs
            : roleHasCustomTabs
            ? (roleObj as any).allowedNavTabs
            : undefined;

        const updatedSession: UserSession = {
          ...current,
          role: userInDb.roleId as any,
          roleName: roleObj?.name || userInDb.roleId,
          organizationId: orgMissing && activeOrg ? activeOrg.id : current.organizationId,
          organizationName: activeOrg?.name || current.organizationName,
          organizationTaxId: activeOrg?.taxId || current.organizationTaxId,
          effectivePermissions: effective.effectivePermissions,
          customPermissions: effective.customPermissions,
          revokedPermissions: effective.revokedPermissions,
          assignedRestrictions: effective.activeRestrictions,
          allowedNavTabs: resolvedNavTabs,
          permissionsVersion: dbPermVersion,
        };

        setSession(updatedSession);
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      unsubscribe();
    };
  }, [session?.userId]);

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
    const currentSession = session;
    void (async () => {
      try {
        const updated = await authService.switchBranch(currentSession, branchId);
        setSession((prev) => (prev && prev.userId === updated.userId ? updated : prev));
      } catch (err: any) {
        console.error(err?.message || 'Error al cambiar de sucursal');
      }
    })();
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
