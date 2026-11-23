import React, { useEffect } from 'react';
import {
  Stethoscope,
  Building2,
  MapPin,
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
  Briefcase,
} from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { UserSessionMenu } from './auth/UserSessionMenu.tsx';
import { useAuth } from '../auth/authContext.tsx';
import { UserRole } from '../auth/types.ts';
import { APP_NAME, resolveOrganizationLegalName } from '../config/appBrand.ts';

export type TabType =
  | 'dashboard'
  | 'audit'
  | 'quotes'
  | 'cash'
  | 'staff-payroll'
  | 'odontogram'
  | 'treatments'
  | 'agenda'
  | 'clinical'
  | 'patients'
  | 'users'
  | 'branches'
  | 'organization';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'clinical' | 'management';
  allowedRoles: UserRole[];
  color: string;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  // Módulos Clínicos
  {
    id: 'agenda',
    label: 'Agenda & Citas',
    icon: Calendar,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
    color: 'bg-teal-600',
  },
  {
    id: 'patients',
    label: 'Pacientes',
    icon: HeartPulse,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
    color: 'bg-teal-600',
  },
  {
    id: 'odontogram',
    label: 'Odontograma FDI',
    icon: Stethoscope,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'clinical',
    label: 'Historias Clínicas',
    icon: FileText,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'treatments',
    label: 'Tratamientos & Tarifas',
    icon: Building2,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
    color: 'bg-teal-600',
  },
  {
    id: 'quotes',
    label: 'Presupuestos & Planes',
    icon: Calculator,
    category: 'clinical',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
    color: 'bg-teal-600',
  },

  // Módulos de Caja y Gestión
  {
    id: 'cash',
    label: 'Caja & Facturación',
    icon: DollarSign,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION', 'CAJA'],
    color: 'bg-emerald-600',
  },
  {
    id: 'staff-payroll',
    label: 'Finanzas Personal',
    icon: Briefcase,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'SUPERVISOR', 'VENDEDOR', 'ODONTOLOGO', 'CAJA'],
    color: 'bg-teal-600',
  },
  {
    id: 'dashboard',
    label: 'Dashboard & Reportes',
    icon: BarChart3,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'users',
    label: 'Equipo & Roles MSPBS',
    icon: Users,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'branches',
    label: 'Sucursales & Sillones',
    icon: Landmark,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-teal-600',
  },
  {
    id: 'organization',
    label: 'Empresa & Branding',
    icon: Building2,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN'], // Exclusivo Super Administrador
    color: 'bg-teal-600',
  },
  {
    id: 'audit',
    label: 'Auditoría MSPBS',
    icon: ShieldAlert,
    category: 'management',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
    color: 'bg-purple-600',
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

  const orgLegalName = resolveOrganizationLegalName(org);

  const userRole: UserRole | null = session?.role || null;

  // Filtrado de pestañas según el ROL del usuario
  const visibleTabs = ALL_NAV_ITEMS.filter((item) => {
    if (!userRole) return false;
    return item.allowedRoles.includes(userRole);
  });

  // Si la pestaña actual no está en las pestañas visibles para este rol, redirigir a la primera permitida
  useEffect(() => {
    const isCurrentTabAllowed = visibleTabs.some((t) => t.id === activeTab);
    if (!isCurrentTabAllowed && visibleTabs.length > 0) {
      onSelectTab(visibleTabs[0].id);
    }
  }, [userRole]);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-cyan-100/70 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar with Org and Branch selector and User Session */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between py-3 gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-600/25 ring-2 ring-teal-100">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                  {APP_NAME}
                </span>
                {orgLegalName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 max-w-[200px] truncate" title={orgLegalName}>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                    <span className="truncate">{orgLegalName}</span>
                  </span>
                )}
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
                {orgLegalName && (
                  <>
                    <span className="font-medium text-slate-700 truncate max-w-[220px]" title={orgLegalName}>{orgLegalName}</span>
                    <span>•</span>
                  </>
                )}
                {org?.taxId && (
                  <>
                    <span>RUC: {org.taxId}</span>
                    <span>•</span>
                  </>
                )}
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

            {/* User Session Menu */}
            <UserSessionMenu />
          </div>
        </div>

        {/* Navigation Tabs - Dinámicamente filtradas por Rol */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-thin">
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

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
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

