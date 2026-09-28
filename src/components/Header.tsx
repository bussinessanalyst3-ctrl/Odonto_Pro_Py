import React, { useState, useEffect } from 'react';
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
  Code2,
  Sparkles,
} from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { UserSessionMenu } from './auth/UserSessionMenu.tsx';
import { useAuth } from '../auth/authContext.tsx';
import { UserRole } from '../auth/types.ts';

export type TabType =
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
  | 'organization'
  | 'auth-session'
  | 'database'
  | 'data-explorer'
  | 'paraguay'
  | 'architecture'
  | 'roadmap';

interface NavItem {
  id: TabType;
  label: string;
  devLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'clinical' | 'management' | 'engineering';
  allowedRoles: UserRole[];
  color: string;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  // Módulos Clínicos
  {
    id: 'agenda',
    label: 'Agenda & Citas',
    devLabel: 'Agenda & Citas (Fase 7)',
    icon: Calendar,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
    color: 'bg-teal-600',
  },
  {
    id: 'patients',
    label: 'Pacientes',
    devLabel: 'Ficha Pacientes (Fase 6)',
    icon: HeartPulse,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
    color: 'bg-teal-600',
  },
  {
    id: 'odontogram',
    label: 'Odontograma FDI',
    devLabel: 'Odontograma FDI (Fase 9)',
    icon: Stethoscope,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'clinical',
    label: 'Historias Clínicas',
    devLabel: 'Historias Clínicas (Fase 8)',
    icon: FileText,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'treatments',
    label: 'Tratamientos & Tarifas',
    devLabel: 'Tratamientos (Fase 10)',
    icon: Building2,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'quotes',
    label: 'Presupuestos & Planes',
    devLabel: 'Presupuestos (Fase 11)',
    icon: Calculator,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
    color: 'bg-teal-600',
  },

  // Módulos de Caja y Gestión
  {
    id: 'cash',
    label: 'Caja & Facturación',
    devLabel: 'Caja Diaria (Fase 12)',
    icon: DollarSign,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION', 'CAJA'],
    color: 'bg-emerald-600',
  },
  {
    id: 'dashboard',
    label: 'Dashboard & Reportes',
    devLabel: 'Dashboard & Reportes (Fase 13)',
    icon: BarChart3,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'users',
    label: 'Equipo & Roles MSPBS',
    devLabel: 'Equipo & Roles (Fase 5)',
    icon: Users,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'branches',
    label: 'Sucursales & Sillones',
    devLabel: 'Sucursales (Fase 4)',
    icon: Landmark,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'organization',
    label: 'Empresa & Branding',
    devLabel: 'Multiempresa & Marca (Fase 18)',
    icon: Building2,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN'], // Exclusivo Super Administrador
    color: 'bg-teal-600',
  },
  {
    id: 'audit',
    label: 'Auditoría MSPBS',
    devLabel: 'Auditoría MSPBS (Fase 14)',
    icon: ShieldAlert,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-purple-600',
  },

  // Herramientas de Ingeniería / DevOps (Visibles para SUPER_ADMIN)
  {
    id: 'production',
    label: 'Producción Vercel',
    devLabel: 'Producción Vercel (Fase 17)',
    icon: Rocket,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-emerald-600',
  },
  {
    id: 'security',
    label: 'Seguridad & ASVS',
    devLabel: 'Seguridad & Hardening (Fase 15)',
    icon: ShieldCheck,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-rose-600',
  },
  {
    id: 'testing',
    label: 'Testing Automatizado',
    devLabel: 'Testing Automatizado (Fase 16)',
    icon: CheckCheck,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-emerald-600',
  },
  {
    id: 'auth-session',
    label: 'Tokens de Sesión',
    devLabel: 'Sesión & Seguridad (Fase 3)',
    icon: Lock,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
  {
    id: 'database',
    label: 'Esquemas Drizzle',
    devLabel: 'Esquemas Drizzle & DDL (Fase 1)',
    icon: Database,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
  {
    id: 'data-explorer',
    label: 'Multi-Tenant',
    devLabel: 'Datos & Multi-Tenant (Fase 2)',
    icon: Building2,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
  {
    id: 'paraguay',
    label: 'Catálogos Paraguay',
    devLabel: 'Catálogos de Paraguay',
    icon: MapPin,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
  {
    id: 'architecture',
    label: 'Arquitectura',
    devLabel: 'Arquitectura & Reglas',
    icon: Shield,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
  {
    id: 'roadmap',
    label: 'Roadmap (100%)',
    devLabel: 'Roadmap (17/17 Fases - 100%)',
    icon: Sparkles,
    category: 'engineering',
    allowedRoles: ['SUPER_ADMIN'],
    color: 'bg-teal-600',
  },
];

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

  // Estado para alternar entre "Vista Clínica Limpia" (lo que ve el personal)
  // y "Modo Desarrollador" (con las 17 fases y herramientas técnicas)
  const [showDevTools, setShowDevTools] = useState<boolean>(() => {
    return localStorage.getItem('odontopro_dev_tools') === 'true';
  });

  const handleToggleDevTools = () => {
    const nextVal = !showDevTools;
    setShowDevTools(nextVal);
    localStorage.setItem('odontopro_dev_tools', String(nextVal));
  };

  const handleResetData = () => {
    if (window.confirm('¿Desea restaurar los datos iniciales de prueba de Paraguay?')) {
      dbStore.resetToSeed();
    }
  };

  const userRole: UserRole = session?.role || 'SUPER_ADMIN';

  // Filtrado de pestañas según el ROL del usuario y la preferencia de herramientas
  const visibleTabs = ALL_NAV_ITEMS.filter((item) => {
    // 1. Verificar si el rol del usuario tiene permiso para este módulo
    const hasRolePermission = item.allowedRoles.includes(userRole);
    if (!hasRolePermission) return false;

    // 2. Si es una herramienta de ingeniería, solo mostrar si showDevTools está activo
    if (item.category === 'engineering' && !showDevTools) {
      return false;
    }

    return true;
  });

  // Si la pestaña actual no está en las pestañas visibles para este rol, redirigir a la primera permitida
  useEffect(() => {
    const isCurrentTabAllowed = visibleTabs.some((t) => t.id === activeTab);
    if (!isCurrentTabAllowed && visibleTabs.length > 0) {
      onSelectTab(visibleTabs[0].id);
    }
  }, [userRole, showDevTools]);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-cyan-100/70 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar with Org and Branch selector and User Session */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between py-3 gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-600/25 ring-2 ring-teal-100">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                  OdontoPro <span className="text-teal-600 font-semibold text-sm">Dental Suite</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                  {org?.tradeName || org?.name || 'Clínica Odontológica'}
                </span>
                {userRole === 'SUPER_ADMIN' ? (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Sillones: 2 Operativos
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Rol: {session?.roleName || userRole}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{org?.name}</span>
                <span>•</span>
                <span>RUC: {org?.taxId}</span>
                <span>•</span>
                <span className="text-teal-700 font-medium">Guaraníes (PYG ₲)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Branch Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <MapPin className="h-3.5 w-3.5 text-teal-600" />
              <label htmlFor="branch-select" className="text-slate-600 font-medium">
                Sede:
              </label>
              <select
                id="branch-select"
                value={selectedBranchId}
                onChange={(e) => onSelectBranch(e.target.value)}
                className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="">Todas las sucursales ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Herramientas de Desarrollo (solo para SUPER_ADMIN) */}
            {userRole === 'SUPER_ADMIN' && (
              <button
                onClick={handleToggleDevTools}
                title={
                  showDevTools
                    ? 'Cambiar a Vista Clínica Limpia (como lo ve el personal)'
                    : 'Ver todas las 17 Fases y Herramientas Técnicas'
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-all shadow-xs ${
                  showDevTools
                    ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100'
                    : 'bg-teal-50/70 text-teal-700 border-teal-200/80 hover:bg-teal-100'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>{showDevTools ? 'Vista Dev (17 Fases)' : 'Vista Clínica'}</span>
              </button>
            )}

            {/* Reset Button */}
            <button
              onClick={handleResetData}
              title="Restaurar datos iniciales de prueba"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Seed</span>
            </button>

            {/* User Session Menu */}
            <UserSessionMenu />
          </div>
        </div>

        {/* Navigation Tabs - Dinámicamente filtradas por Rol con estilo Nórdico */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-thin">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const displayTitle = showDevTools ? item.devLabel : item.label;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm shadow-teal-700/20 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-teal-50/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{displayTitle}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

