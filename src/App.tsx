import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/authContext.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { Header, ALL_NAV_ITEMS, TabType } from './components/Header.tsx';
import { SessionInspector } from './components/auth/SessionInspector.tsx';
import { SchemaViewer } from './components/SchemaViewer.tsx';
import { DataExplorer } from './components/DataExplorer.tsx';
import { ParaguayCatalogsViewer } from './components/ParaguayCatalogsViewer.tsx';
import { ArchitectureViewer } from './components/ArchitectureViewer.tsx';
import { RoadmapViewer } from './components/RoadmapViewer.tsx';
import { BranchManagementView } from './components/branches/BranchManagementView.tsx';
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
import { ShieldAlert, ArrowRight } from 'lucide-react';

function MainApplication() {
  const { isAuthenticated, session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [treatmentNavTarget, setTreatmentNavTarget] = useState<{ patientId: string; toothNumber?: number } | null>(null);

  // Redireccionar automáticamente cuando el usuario cambia de rol
  useEffect(() => {
    if (!session) return;
    const currentNavItem = ALL_NAV_ITEMS.find((item) => item.id === activeTab);
    const isAllowed = currentNavItem ? currentNavItem.allowedRoles.includes(session.role) : false;

    if (!isAllowed) {
      // Buscar la primera pestaña permitida para su rol
      const firstAllowed = ALL_NAV_ITEMS.find((item) => item.allowedRoles.includes(session.role));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [session?.role]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleNavigateToTreatments = (patientId: string, toothNumber?: number) => {
    setTreatmentNavTarget({ patientId, toothNumber });
    setActiveTab('treatments');
  };

  // Verificar si la pestaña actual está autorizada para este rol
  const currentItem = ALL_NAV_ITEMS.find((item) => item.id === activeTab);
  const isAuthorized = session?.role === 'SUPER_ADMIN' || (currentItem ? currentItem.allowedRoles.includes(session?.role || 'SUPER_ADMIN') : true);

  return (
    <div className="min-h-screen nordic-mesh-bg text-slate-800 font-sans">
      {/* Header with Organization, Branch Switcher and User Session */}
      <Header
        selectedBranchId={selectedBranchId}
        onSelectBranch={setSelectedBranchId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {activeTab === 'dashboard' && <AdaptiveDashboardView />}
            {activeTab === 'production' && <ProductionDeploymentView />}
            {activeTab === 'security' && <SecurityHardeningView />}
            {activeTab === 'testing' && <AutomatedTestingView />}
            {activeTab === 'audit' && <AuditLogsView />}
            {activeTab === 'quotes' && (
              <QuotesManagementView onNavigateToTreatments={handleNavigateToTreatments} />
            )}
            {activeTab === 'cash' && <CashRegisterManagementView />}
            {activeTab === 'odontogram' && (
              <OdontogramView onNavigateToTreatments={handleNavigateToTreatments} />
            )}
            {activeTab === 'treatments' && (
              <TreatmentsManagementView
                initialPatientId={treatmentNavTarget?.patientId}
                initialToothNumber={treatmentNavTarget?.toothNumber}
              />
            )}
            {activeTab === 'agenda' && <AppointmentsCalendarView />}
            {activeTab === 'clinical' && <ClinicalRecordsView />}
            {activeTab === 'patients' && <PatientManagementView />}
            {activeTab === 'users' && <UserManagementView />}
            {activeTab === 'branches' && <BranchManagementView />}
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
}
