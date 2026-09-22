import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession, UserRole, AuthCredentials, LoginResult } from './types.ts';
import { authService, DEMO_CREDENTIALS } from './authService.ts';

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load active session from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserSession;
        // Check if expired
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSession(parsed);
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } else {
        // Auto-login con SuperAdmin para que la experiencia inicial sea inmediata
        // pero con opción de cerrar sesión y probar el formulario de login completo
        const superAdminDemo = DEMO_CREDENTIALS[0];
        authService
          .login({
            email: superAdminDemo.email,
            password: superAdminDemo.password,
          })
          .then((res) => {
            if (res.success && res.session) {
              setSession(res.session);
              localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(res.session));
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('Error loading session:', e);
    } finally {
      setIsLoading(false);
    }
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
    const creds = DEMO_CREDENTIALS.find((d) => d.role === role);
    if (!creds) return;
    await login({
      email: creds.email,
      password: creds.password,
    });
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
