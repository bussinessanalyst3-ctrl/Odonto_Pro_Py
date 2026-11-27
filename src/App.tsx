import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './auth/authContext.tsx';
import { BrandingProvider, useBranding } from './branding/BrandingContext.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { AppHeader } from './components/AppHeader.tsx';
import { TabType } from './components/Header.tsx';
import { dbStore } from './db/inMemoryStore.ts';
import { formatDocumentTitle } from './config/appBrand.ts';
import { getApiBaseUrl } from './config/apiConfig.ts';
import {
  getFirstAllowedModule,
  getModuleById,
  hasModuleAccess,
} from './security/moduleCatalog.ts';
import { ModuleErrorBoundary } from './components/common/ModuleErrorBoundary.tsx';

const OwnerConsole = lazy(() =>
  import('./components/owner/OwnerConsole.tsx').then((m) => ({ default: m.OwnerConsole }))
);
const BranchManagementView = lazy(() =>
  import('./components/branches/BranchManagementView.tsx').then((m) => ({ default: m.BranchManagementView }))
);
const OrganizationManagementView = lazy(() =>
  import('./components/organization/OrganizationManagementView.tsx').then((m) => ({
    default: m.OrganizationManagementView,
  }))
);
const UserManagementView = lazy(() =>
  import('./components/users/UserManagementView.tsx').then((m) => ({ default: m.UserManagementView }))
);
const PatientManagementView = lazy(() =>
  import('./components/patients/PatientManagementView.tsx').then((m) => ({ default: m.PatientManagementView }))
);
const AppointmentsCalendarView = lazy(() =>
  import('./components/appointments/AppointmentsCalendarView.tsx').then((m) => ({
    default: m.AppointmentsCalendarView,
  }))
);
const ClinicalRecordsView = lazy(() =>
  import('./components/clinical/ClinicalRecordsView.tsx').then((m) => ({ default: m.ClinicalRecordsView }))
);
const OdontogramView = lazy(() =>
  import('./components/odontogram/OdontogramView.tsx').then((m) => ({ default: m.OdontogramView }))
);
const TreatmentsManagementView = lazy(() =>
  import('./components/treatments/TreatmentsManagementView.tsx').then((m) => ({
    default: m.TreatmentsManagementView,
  }))
);
const QuotesManagementView = lazy(() =>
  import('./components/quotes/QuotesManagementView.tsx').then((m) => ({ default: m.QuotesManagementView }))
);
const CashRegisterManagementView = lazy(() =>
  import('./components/cash/CashRegisterManagementView.tsx').then((m) => ({
    default: m.CashRegisterManagementView,
  }))
);
const StaffPayrollManagementView = lazy(() =>
  import('./components/payroll/StaffPayrollManagementView.tsx').then((m) => ({
    default: m.StaffPayrollManagementView,
  }))
);
const AdaptiveDashboardView = lazy(() =>
  import('./components/reports/AdaptiveDashboardView.tsx').then((m) => ({ default: m.AdaptiveDashboardView }))
);
const AuditLogsView = lazy(() =>
  import('./components/audit/AuditLogsView.tsx').then((m) => ({ default: m.AuditLogsView }))
);
import {
  ShieldAlert,
  ArrowRight,
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Menu,
  WalletCards,
  Stethoscope,
  Info,
  X
} from 'lucide-react';

function MainApplication() {
  const { isAuthenticated, session } = useAuth();
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [treatmentNavTarget, setTreatmentNavTarget] = useState<{ patientId: string; toothNumber?: number } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [isVerifiedOwner, setIsVerifiedOwner] = useState<boolean>(false);
  const [permissionRedirectNotice, setPermissionRedirectNotice] = useState<string | null>(null);
  const activePermUserRef = useRef<{ userId: string; initialized: boolean } | null>(null);
  const [storeTick, setStoreTick] = useState<number>(0);

  useEffect(() => {
    return dbStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Confirmación silenciosa en backend (/api/owner/me responde 404 para cualquier usuario que no sea OWNER_EMAIL)
  useEffect(() => {
    if (!isAuthenticated || !session) {
      setIsVerifiedOwner(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const headers: Record<string, string> = {};
        if (session.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
          headers.Authorization = `Bearer ${session.sessionToken}`;
        }
        const res = await fetch(`${baseUrl}/api/owner/me`, {
          method: 'GET',
          credentials: 'include',
          headers,
        });
        if (!cancelled && res.ok) {
          const data = await res.json().catch(() => null);
          setIsVerifiedOwner(Boolean(data?.isOwner));
        } else if (!cancelled) {
          setIsVerifiedOwner(false);
        }
      } catch {
        if (!cancelled) setIsVerifiedOwner(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, session?.userId, session?.email, session?.sessionToken]);

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isOwnerPath = normalizedPath === '/owner';
  const showOwnerConsole = isVerifiedOwner && isOwnerPath;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = showOwnerConsole
        ? 'ODONTOPRO · Consola del Propietario'
        : formatDocumentTitle(branding.legalName);
    }
  }, [branding.legalName, showOwnerConsole]);

  // Redireccionar automáticamente cuando el usuario cambia de rol o sus pestañas permitidas
  useEffect(() => {
    if (!session) {
      activePermUserRef.current = null;
      setPermissionRedirectNotice(null);
      return;
    }

    const roleObj = dbStore.getRoles().find((r) => r.id === session.role);
    const currentMod = getModuleById(activeTab);
    const isAllowed = Boolean(currentMod) && hasModuleAccess(session, activeTab, roleObj);

    const prevTracker = activePermUserRef.current;
    const isSameUserLiveUpdate = Boolean(
      prevTracker && prevTracker.userId === session.userId && prevTracker.initialized
    );
    activePermUserRef.current = { userId: session.userId, initialized: true };

    if (!isAllowed) {
      const nextTab = getFirstAllowedModule(session, roleObj);
      if (nextTab && nextTab !== activeTab) {
        if (isSameUserLiveUpdate) {
          const removedLabel = currentMod?.label || activeTab;
          const nextLabel = getModuleById(nextTab)?.label || nextTab;
          setPermissionRedirectNotice(
            `Tus permisos fueron actualizados por el administrador y ya no tenés acceso a "${removedLabel}". Te redirigimos a "${nextLabel}" sin cerrar tu sesión.`
          );
        }
        setActiveTab(nextTab);
      }
    }
  }, [session?.userId, session?.role, session?.permissionsVersion, session?.allowedNavTabs, activeTab, storeTick]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleOpenOwnerConsole = () => {
    if (!isVerifiedOwner) return;
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/owner');
      setPathname('/owner');
    }
  };

  const handleBackToApp = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
      setPathname('/');
    }
  };

  if (showOwnerConsole) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-xs font-semibold">
            Cargando Consola del Propietario...
          </div>
        }
      >
        <OwnerConsole onBackToApp={handleBackToApp} />
      </Suspense>
    );
  }

  // Verificar si la pestaña actual está autorizada para este usuario
  const roleObj = dbStore.getRoles().find((r) => r.id === session?.role);
  const isAuthorized = Boolean(getModuleById(activeTab)) && hasModuleAccess(session, activeTab, roleObj);

  const handleNavigateToTreatments = (patientId: string, toothNumber?: number) => {
    if (!hasModuleAccess(session, 'treatments', roleObj)) return;
    setTreatmentNavTarget({ patientId, toothNumber });
    setActiveTab('treatments');
  };

  const handleGlobalNavigate = (tab: any, extraPayload?: any) => {
    const targetMod = getModuleById(String(tab || ''));
    if (!targetMod || !hasModuleAccess(session, targetMod.id, roleObj)) return;
    if (targetMod.id === 'treatments' && extraPayload?.patientId) {
      setTreatmentNavTarget({ patientId: extraPayload.patientId, toothNumber: extraPayload.toothNumber });
    }
    setActiveTab(targetMod.id as TabType);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex overflow-x-hidden">
      {/* Sidebar Lateral Profesional (Fijo en desktop, drawer en móvil) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        canAccessOwnerConsole={isVerifiedOwner}
        onOpenOwnerConsole={handleOpenOwnerConsole}
      />

      {/* Contenedor Principal (Con margen izquierdo para el sidebar en desktop) */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Header Superior Limpio con Buscador Global y Selector de Sede */}
        <AppHeader
          selectedBranchId={selectedBranchId}
          onSelectBranch={setSelectedBranchId}
          onNavigateTab={handleGlobalNavigate}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Área de Contenido de los Módulos */}
        <main className="flex-1 p-2.5 md:p-5 lg:p-7 max-w-7xl w-full mx-auto pb-20 md:pb-24 lg:pb-8 transition-all">
          {permissionRedirectNotice && (
            <div
              role="status"
              className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs sm:text-sm font-medium flex items-start justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{permissionRedirectNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setPermissionRedirectNotice(null)}
                aria-label="Cerrar aviso"
                className="p-1 text-amber-700 hover:bg-amber-100 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!isAuthorized ? (
            <div className="max-w-lg mx-auto my-12 p-8 bg-white border border-amber-200 rounded-2xl shadow-sm text-center">
              <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Módulo Restringido</h3>
              <p className="text-sm text-slate-600 mb-6">
                Tu perfil actual (<span className="font-semibold text-teal-800">{session?.roleName}</span>) no tiene permisos de acceso para este módulo según las políticas RBAC y el Ministerio de Salud (MSPBS).
              </p>
              <button
                onClick={() => setActiveTab(getFirstAllowedModule(session, roleObj))}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-xs"
              >
                <span>Ir a mis módulos asignados</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <ModuleErrorBoundary
              key={activeTab}
              moduleId={activeTab}
              sessionToken={session?.sessionToken}
            >
              <Suspense
                fallback={
                  <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs flex items-center justify-center min-h-[260px]">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <div className="h-8 w-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                      <span className="text-xs font-semibold">Cargando módulo...</span>
                    </div>
                  </div>
                }
              >
                {activeTab === 'dashboard' && (
                  <AdaptiveDashboardView
                    onNavigateTab={handleGlobalNavigate}
                    selectedBranchId={selectedBranchId}
                  />
                )}
                {activeTab === 'audit' && <AuditLogsView />}
                {activeTab === 'quotes' && (
                  <QuotesManagementView onNavigateToTreatments={handleNavigateToTreatments} />
                )}
                {activeTab === 'cash' && <CashRegisterManagementView />}
                {activeTab === 'staff-payroll' && <StaffPayrollManagementView />}
                {activeTab === 'odontogram' && (
                  <OdontogramView
                    onNavigateToTreatments={handleNavigateToTreatments}
                    onNavigateToQuotes={(_patientId) => {
                      setActiveTab('quotes');
                    }}
                  />
                )}
                {activeTab === 'treatments' && (
                  <TreatmentsManagementView
                    initialPatientId={treatmentNavTarget?.patientId}
                    initialToothNumber={treatmentNavTarget?.toothNumber}
                  />
                )}
                {activeTab === 'agenda' && <AppointmentsCalendarView />}
                {activeTab === 'clinical' && <ClinicalRecordsView />}
                {activeTab === 'patients' && (
                  <PatientManagementView onNavigateToTab={handleGlobalNavigate} />
                )}
                {activeTab === 'users' && <UserManagementView />}
                {activeTab === 'branches' && <BranchManagementView />}
                {activeTab === 'organization' && <OrganizationManagementView />}
              </Suspense>
            </ModuleErrorBoundary>
          )}
        </main>
      </div>

      {/* Barra de Navegación Inferior Nativa para Móviles (filtrada por módulos efectivos del usuario) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E6E2D9] px-1 md:px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none">
        {hasModuleAccess(session, 'dashboard', roleObj) && (
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'dashboard'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <LayoutDashboard className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'dashboard' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Inicio</span>
          </button>
        )}

        {hasModuleAccess(session, 'agenda', roleObj) && (
          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'agenda'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <Calendar className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'agenda' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Agenda</span>
          </button>
        )}

        {hasModuleAccess(session, 'patients', roleObj) && (
          <button
            type="button"
            onClick={() => setActiveTab('patients')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'patients'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <Users className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'patients' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Pacientes</span>
          </button>
        )}

        {/* 4to acceso rápido móvil: estrictamente sujeto a hasModuleAccess */}
        {(session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN_ORGANIZACION' || session?.role === 'ADMIN_SUCURSAL') &&
        hasModuleAccess(session, 'users', roleObj) ? (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'users'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <UserCheck className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'users' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Usuarios</span>
          </button>
        ) : (session?.role === 'ODONTOLOGO' || session?.role === 'ASISTENTE') &&
          hasModuleAccess(session, 'treatments', roleObj) ? (
          <button
            type="button"
            onClick={() => setActiveTab('treatments')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'treatments'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <Stethoscope className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'treatments' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Clínica</span>
          </button>
        ) : hasModuleAccess(session, 'cash', roleObj) ? (
          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'cash'
                ? 'text-[#0F5C63] font-semibold'
                : 'text-[#6B706D] hover:text-[#1C1F1E]'
            }`}
          >
            <WalletCards className={`h-4 w-4 md:h-5 md:w-5 mb-0.5 ${activeTab === 'cash' ? 'text-[#0F5C63]' : 'text-[#6B706D]'}`} />
            <span>Caja</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-1.5 md:px-2 rounded-md text-[10px] font-medium text-[#6B706D] hover:text-[#1C1F1E] transition-colors min-h-[44px] min-w-[48px] md:min-w-[52px] cursor-pointer touch-manipulation"
        >
          <Menu className="h-4 w-4 md:h-5 md:w-5 mb-0.5 text-[#6B706D]" />
          <span>Más</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <MainApplication />
      </AuthProvider>
    </BrandingProvider>
  );
}
