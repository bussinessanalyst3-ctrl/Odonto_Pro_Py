import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  ShieldCheck,
  Map as MapIcon,
  Database,
  FlaskConical,
  Rocket,
  Lock,
  ArrowLeft,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { getApiBaseUrl } from '../../config/apiConfig.ts';

const RoadmapViewer = lazy(() =>
  import('../RoadmapViewer.tsx').then((m) => ({ default: m.RoadmapViewer }))
);
const SchemaViewer = lazy(() =>
  import('../SchemaViewer.tsx').then((m) => ({ default: m.SchemaViewer }))
);
const AutomatedTestingView = lazy(() =>
  import('../testing/AutomatedTestingView.tsx').then((m) => ({ default: m.AutomatedTestingView }))
);
const ProductionDeploymentView = lazy(() =>
  import('../production/ProductionDeploymentView.tsx').then((m) => ({
    default: m.ProductionDeploymentView,
  }))
);
const SecurityHardeningView = lazy(() =>
  import('../security/SecurityHardeningView.tsx').then((m) => ({
    default: m.SecurityHardeningView,
  }))
);

type OwnerModuleTab = 'roadmap' | 'schema' | 'testing' | 'production' | 'security';

interface OwnerConsoleProps {
  onBackToApp: () => void;
}

const OWNER_TABS: Array<{
  id: OwnerModuleTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'roadmap', label: 'Fases y Roadmap', shortLabel: 'Roadmap', icon: MapIcon },
  { id: 'schema', label: 'Esquema SQL', shortLabel: 'Esquema', icon: Database },
  { id: 'testing', label: 'Pruebas Automatizadas', shortLabel: 'Pruebas', icon: FlaskConical },
  { id: 'production', label: 'Despliegue y Producción', shortLabel: 'Producción', icon: Rocket },
  { id: 'security', label: 'Seguridad y Hardening', shortLabel: 'Seguridad', icon: Lock },
];

export const OwnerConsole: React.FC<OwnerConsoleProps> = ({ onBackToApp }) => {
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<OwnerModuleTab>('roadmap');

  // Registrar acceso y cambio de módulo en la auditoría existente (sin cambios en BD)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
          headers.Authorization = `Bearer ${session.sessionToken}`;
        }
        if (!cancelled) {
          await fetch(`${baseUrl}/api/owner/audit`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({
              action: 'OWNER_CONSOLE_VIEW',
              module: activeTab,
            }),
          });
        }
      } catch {
        // Error de red silencioso para no interrumpir la vista interna
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, session?.sessionToken]);

  const handleLogout = () => {
    onBackToApp();
    logout();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Cabecera Exclusiva del Propietario */}
      <header className="sticky top-0 z-30 bg-slate-950 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
                ODONTOPRO · Consola del Propietario
              </h1>
              <p className="text-[11px] text-slate-400 truncate">
                Herramientas técnicas de plataforma · {session?.email || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onBackToApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Volver a la clínica</span>
              <span className="sm:hidden">Clínica</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-800/70 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navegación interna de vistas técnicas */}
        <div className="border-t border-slate-800/80 bg-slate-900/90">
          <nav
            aria-label="Módulos de la Consola del Propietario"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto scrollbar-none py-2"
          >
            {OWNER_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Contenido de la vista técnica seleccionada (sin datos clínicos de pacientes) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        <Suspense
          fallback={
            <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center min-h-[260px]">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <div className="h-7 w-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold">Cargando módulo técnico...</span>
              </div>
            </div>
          }
        >
          {activeTab === 'roadmap' && <RoadmapViewer />}
          {activeTab === 'schema' && <SchemaViewer />}
          {activeTab === 'testing' && <AutomatedTestingView />}
          {activeTab === 'production' && <ProductionDeploymentView />}
          {activeTab === 'security' && <SecurityHardeningView />}
        </Suspense>
      </main>
    </div>
  );
};
