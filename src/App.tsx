import React, { useState } from 'react';
import { AuthProvider, useAuth } from './auth/authContext.tsx';
import { LoginScreen } from './components/auth/LoginScreen.tsx';
import { Header } from './components/Header.tsx';
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

type TabType =
  | 'dashboard'
  | 'production'
  | 'security'
  | 'testing'
  | 'audit'
  | 'quotes'
  | 'cash'
  | 'odontogram'
  | 'treatments'
  | 'agenda'
  | 'clinical'
  | 'patients'
  | 'users'
  | 'branches'
  | 'auth-session'
  | 'database'
  | 'data-explorer'
  | 'paraguay'
  | 'architecture'
  | 'roadmap';

function MainApplication() {
  const { isAuthenticated, session } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [treatmentNavTarget, setTreatmentNavTarget] = useState<{ patientId: string; toothNumber?: number } | null>(null);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const handleNavigateToTreatments = (patientId: string, toothNumber?: number) => {
    setTreatmentNavTarget({ patientId, toothNumber });
    setActiveTab('treatments');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Header with Organization, Branch Switcher and User Session */}
      <Header
        selectedBranchId={selectedBranchId}
        onSelectBranch={setSelectedBranchId}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
