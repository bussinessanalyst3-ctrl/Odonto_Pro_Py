import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/authContext.tsx';
import { BrandingProvider } from './branding/BrandingContext.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { AppHeader } from './components/AppHeader.tsx';
import { ALL_NAV_ITEMS, TabType } from './components/Header.tsx';
import { SessionInspector } from './components/auth/SessionInspector.tsx';
import { SchemaViewer } from './components/SchemaViewer.tsx';
import { DataExplorer } from './components/DataExplorer.tsx';
import { ParaguayCatalogsViewer } from './components/ParaguayCatalogsViewer.tsx';
import { ArchitectureViewer } from './components/ArchitectureViewer.tsx';
import { RoadmapViewer } from './components/RoadmapViewer.tsx';
import { BranchManagementView } from './components/branches/BranchManagementView.tsx';
import { OrganizationManagementView } from './components/organization/OrganizationManagementView.tsx';
import { UserManagementView } from './components/users/UserManagementView.tsx';
import { PatientManagementView } from './components/patients/PatientManagementView.tsx';
import { AppointmentsCalendarView } from './components/appointments/AppointmentsCalendarView.tsx';
import { ClinicalRecordsView } from './components/clinical/ClinicalRecordsView.tsx';
import { OdontogramView } from './components/odontogram/OdontogramView.tsx';
import { TreatmentsManagementView } from './components/treatments/TreatmentsManagementView.tsx';
import { QuotesManagementView } from './components/quotes/QuotesManagementView.tsx';
import { CashRegisterManagementView } from './components/cash/CashRegisterManagementView.tsx';
import { AdaptiveDashboardView } from './components/reports/AdaptiveDashboardView.tsx';
import { AuditLogsView } from './components/audit/AuditLogsView.tsx';
import { SecurityHardeningView } from './components/security/SecurityHardeningView.tsx';
import { AutomatedTestingView } from './components/testing/AutomatedTestingView.tsx';
import { ProductionDeploymentView } from './components/production/ProductionDeploymentView.tsx';
import { dbStore } from './db/inMemoryStore.ts';
import {
  ShieldAlert,
  ArrowRight,
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Menu,
  WalletCards,
  Stethoscope
} from 'lucide-react';

function MainApplication() {
  const { isAuthenticated, session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [treatmentNavTarget, setTreatmentNavTarget] = useState<{ patientId: string; toothNumber?: number } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [showDevTools, setShowDevTools] = useState<boolean>(() => {
    return localStorage.getItem('odontopro_dev_tools') === 'true';
  });

  const handleToggleDevTools = () => {
    const nextVal = !showDevTools;
    setShowDevTools(nextVal);
    localStorage.setItem('odontopro_dev_tools', String(nextVal));
  };

  // Redireccionar automáticamente cuando el usuario cambia de rol
  useEffect(() => {
    if (!session) return;
    const roleObj = dbStore.getRoles().find((r) => r.id === session.role);
    const currentNavItem = ALL_NAV_ITEMS.find((item) => item.id === activeTab);

    let isAllowed = false;
    if (session.role === 'SUPER_ADMIN') {
      isAllowed = true;
    } else if (session.allowedNavTabs && Array.isArray(session.allowedNavTabs) && session.allowedNavTabs.length > 0) {
      isAllowed = session.allowedNavTabs.includes(activeTab);
    } else if (roleObj?.allowedNavTabs) {
      isAllowed = roleObj.allowedNavTabs.includes(activeTab);
    } else if (currentNavItem) {
      isAllowed = currentNavItem.allowedRoles.includes(session.role);
    }

    if (!isAllowed) {
      // Buscar la primera pestaña permitida para su usuario o rol
      if (session.allowedNavTabs && Array.isArray(session.allowedNavTabs) && session.allowedNavTabs.length > 0) {
        setActiveTab(session.allowedNavTabs[0] as TabType);
      } else if (roleObj?.allowedNavTabs && roleObj.allowedNavTabs.length > 0) {
        setActiveTab(roleObj.allowedNavTabs[0] as TabType);
      } else {
        const firstAllowed = ALL_NAV_ITEMS.find((item) => item.allowedRoles.includes(session.role));
        if (firstAllowed) {
          setActiveTab(firstAllowed.id);
        }
      }
    }
  }, [session?.role, session?.permissionsVersion, session?.allowedNavTabs]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleNavigateToTreatments = (patientId: string, toothNumber?: number) => {
    setTreatmentNavTarget({ patientId, toothNumber });
    setActiveTab('treatments');
  };

  const handleGlobalNavigate = (tab: any, extraPayload?: any) => {
    if (tab === 'treatments' && extraPayload?.patientId) {
      setTreatmentNavTarget({ patientId: extraPayload.patientId, toothNumber: extraPayload.toothNumber });
    }
    setActiveTab(tab as TabType);
  };

  // Verificar si la pestaña actual está autorizada para este rol
  const roleObj = dbStore.getRoles().find((r) => r.id === session?.role);
  const currentItem = ALL_NAV_ITEMS.find((item) => item.id === activeTab);
  const isAuthorized =
    session?.role === 'SUPER_ADMIN' ||
    (session?.allowedNavTabs && Array.isArray(session.allowedNavTabs) && session.allowedNavTabs.length > 0
      ? session.allowedNavTabs.includes(activeTab)
      : roleObj?.allowedNavTabs
      ? roleObj.allowedNavTabs.includes(activeTab)
      : currentItem
      ? currentItem.allowedRoles.includes(session?.role || 'SUPER_ADMIN')
      : true);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex">
      {/* Sidebar Lateral Profesional (Fijo en desktop, drawer en móvil) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        showDevTools={showDevTools}
        onToggleDevTools={handleToggleDevTools}
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
        <main className="flex-1 p-3 sm:p-5 lg:p-7 max-w-7xl w-full mx-auto pb-28 lg:pb-8 transition-all">
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
                onClick={() => {
                  const firstAllowed = ALL_NAV_ITEMS.find((item) => item.allowedRoles.includes(session?.role || 'SUPER_ADMIN'));
                  if (firstAllowed) setActiveTab(firstAllowed.id);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-xs"
              >
                <span>Ir a mis módulos asignados</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <AdaptiveDashboardView
                  onNavigateTab={handleGlobalNavigate}
                  selectedBranchId={selectedBranchId}
                />
              )}
              {activeTab === 'production' && <ProductionDeploymentView />}
              {activeTab === 'security' && <SecurityHardeningView />}
              {activeTab === 'testing' && <AutomatedTestingView />}
              {activeTab === 'audit' && <AuditLogsView />}
              {activeTab === 'quotes' && (
                <QuotesManagementView onNavigateToTreatments={handleNavigateToTreatments} />
              )}
              {activeTab === 'cash' && <CashRegisterManagementView />}
              {activeTab === 'odontogram' && (
                <OdontogramView
                  onNavigateToTreatments={handleNavigateToTreatments}
                  onNavigateToQuotes={(patientId) => {
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
              {activeTab === 'auth-session' && <SessionInspector />}
              {activeTab === 'database' && <SchemaViewer />}
              {activeTab === 'data-explorer' && (
                <DataExplorer selectedBranchId={selectedBranchId || session?.currentBranchId || ''} />
              )}
              {activeTab === 'paraguay' && <ParaguayCatalogsViewer />}
              {activeTab === 'architecture' && <ArchitectureViewer />}
              {activeTab === 'roadmap' && <RoadmapViewer />}
            </>
          )}
        </main>
      </div>

      {/* Barra de Navegación Inferior Nativa para Móviles (Thumb Navigation con Safe Area) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-xl px-2 pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
            activeTab === 'dashboard'
              ? 'text-teal-700 font-bold bg-teal-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className={`h-5 w-5 mb-0.5 ${activeTab === 'dashboard' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span>Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agenda')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
            activeTab === 'agenda'
              ? 'text-teal-700 font-bold bg-teal-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className={`h-5 w-5 mb-0.5 ${activeTab === 'agenda' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span>Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('patients')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
            activeTab === 'patients'
              ? 'text-teal-700 font-bold bg-teal-50/80'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className={`h-5 w-5 mb-0.5 ${activeTab === 'patients' ? 'text-teal-600' : 'text-slate-400'}`} />
          <span>Pacientes</span>
        </button>

        {/* Módulo dinámico según rol: Usuarios para Administradores, Tratamientos para Odontólogos, Caja para otros */}
        {session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN_ORGANIZACION' || session?.role === 'ADMIN_SUCURSAL' ? (
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'users'
                ? 'text-teal-700 font-bold bg-teal-50/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className={`h-5 w-5 mb-0.5 ${activeTab === 'users' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>Usuarios</span>
          </button>
        ) : session?.role === 'ODONTOLOGO' || session?.role === 'ASISTENTE' ? (
          <button
            type="button"
            onClick={() => setActiveTab('treatments')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'treatments'
                ? 'text-teal-700 font-bold bg-teal-50/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className={`h-5 w-5 mb-0.5 ${activeTab === 'treatments' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>Clínica</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActiveTab('cash')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation ${
              activeTab === 'cash'
                ? 'text-teal-700 font-bold bg-teal-50/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <WalletCards className={`h-5 w-5 mb-0.5 ${activeTab === 'cash' ? 'text-teal-600' : 'text-slate-400'}`} />
            <span>Caja</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition-all min-h-[44px] min-w-[52px] cursor-pointer touch-manipulation"
        >
          <Menu className="h-5 w-5 mb-0.5 text-slate-500" />
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
