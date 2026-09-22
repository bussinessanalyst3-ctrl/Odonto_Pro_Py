import React from 'react';
import {
  Stethoscope,
  Building2,
  MapPin,
  RefreshCw,
  Database,
  Shield,
  Lock,
  Landmark,
  Users,
  HeartPulse,
  Calendar,
  FileText,
  Calculator,
  DollarSign,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  CheckCheck,
  Rocket,
} from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { UserSessionMenu } from './auth/UserSessionMenu.tsx';
import { useAuth } from '../auth/authContext.tsx';

interface HeaderProps {
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  activeTab: string;
  onSelectTab: (tab: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedBranchId,
  onSelectBranch,
  activeTab,
  onSelectTab,
}) => {
  const branches = dbStore.getBranches();
  const org = dbStore.getActiveOrganization();
  const { session } = useAuth();

  const handleResetData = () => {
    if (window.confirm('¿Desea restaurar los datos iniciales de prueba de Paraguay?')) {
      dbStore.resetToSeed();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar with Org and Branch selector and User Session */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between py-3 gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-700/20">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  OdontoPro Paraguay
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Fase 17: Producción en Vercel & Go-Live (100% Roadmap Completo)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{org?.name}</span>
                <span>•</span>
                <span>RUC: {org?.taxId}</span>
                <span>•</span>
                <span className="text-teal-700 font-medium">Moneda: Guaraníes (PYG ₲)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Branch Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
              <MapPin className="h-3.5 w-3.5 text-teal-600" />
              <label htmlFor="branch-select" className="text-slate-600 font-medium">
                Filtro:
              </label>
              <select
                id="branch-select"
                value={selectedBranchId}
                onChange={(e) => onSelectBranch(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">Todas las sucursales (3)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={handleResetData}
              title="Restaurar datos semilla iniciales"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Seed</span>
            </button>

            {/* User Session Menu */}
            <UserSessionMenu />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          <button
            onClick={() => onSelectTab('production')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'production'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Rocket className="h-4 w-4" />
            <span>Producción Vercel (Fase 17)</span>
          </button>

          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Dashboard & Reportes (Fase 13)</span>
          </button>

          <button
            onClick={() => onSelectTab('security')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Seguridad & Hardening (Fase 15)</span>
          </button>

          <button
            onClick={() => onSelectTab('testing')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'testing'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckCheck className="h-4 w-4" />
            <span>Testing Automatizado (Fase 16)</span>
          </button>

          <button
            onClick={() => onSelectTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Auditoría MSPBS (Fase 14)</span>
          </button>

          <button
            onClick={() => onSelectTab('quotes')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'quotes'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>Presupuestos (Fase 11)</span>
          </button>

          <button
            onClick={() => onSelectTab('cash')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'cash'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>Caja Diaria (Fase 12)</span>
          </button>

          <button
            onClick={() => onSelectTab('odontogram')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'odontogram'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            <span>Odontograma FDI (Fase 9)</span>
          </button>

          <button
            onClick={() => onSelectTab('treatments')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'treatments'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Tratamientos (Fase 10)</span>
          </button>

          <button
            onClick={() => onSelectTab('agenda')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'agenda'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Agenda & Citas (Fase 7)</span>
          </button>

          <button
            onClick={() => onSelectTab('clinical')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'clinical'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Historias Clínicas (Fase 8)</span>
          </button>

          <button
            onClick={() => onSelectTab('patients')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'patients'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HeartPulse className="h-4 w-4" />
            <span>Ficha Pacientes (Fase 6)</span>
          </button>

          <button
            onClick={() => onSelectTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Equipo & Roles MSPBS (Fase 5)</span>
          </button>

          <button
            onClick={() => onSelectTab('branches')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'branches'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Landmark className="h-4 w-4" />
            <span>Sucursales & Clínica (Fase 4)</span>
          </button>

          <button
            onClick={() => onSelectTab('auth-session')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'auth-session'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>Sesión & Seguridad (Fase 3)</span>
          </button>

          <button
            onClick={() => onSelectTab('database')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'database'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Esquemas Drizzle & DDL</span>
          </button>

          <button
            onClick={() => onSelectTab('data-explorer')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'data-explorer'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Datos & Multi-Tenant</span>
          </button>

          <button
            onClick={() => onSelectTab('paraguay')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'paraguay'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Catálogos de Paraguay</span>
          </button>

          <button
            onClick={() => onSelectTab('architecture')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Arquitectura & Reglas</span>
          </button>

          <button
            onClick={() => onSelectTab('roadmap')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Roadmap Completo (17/17 Fases - 100%)</span>
          </button>
        </div>
      </div>
    </header>
  );
};

