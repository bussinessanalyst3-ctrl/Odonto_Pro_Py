import React, { useState } from 'react';
import {
  Calendar,
  HeartPulse,
  Stethoscope,
  FileText,
  Building2,
  Calculator,
  DollarSign,
  BarChart3,
  Users,
  Landmark,
  ShieldAlert,
  Rocket,
  ShieldCheck,
  CheckCheck,
  Lock,
  Database,
  MapPin,
  Shield,
  Sparkles,
  ChevronDown,
  ChevronRight,
  LogOut,
  Hospital,
  Activity,
  Layers,
  Settings,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../auth/authContext.tsx';
import { useBranding } from '../branding/BrandingContext.tsx';
import { UserRole } from '../auth/types.ts';
import { TabType, ALL_NAV_ITEMS } from './Header.tsx';
import { dbStore } from '../db/inMemoryStore.ts';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpen: boolean;
  onClose: () => void;
  showDevTools: boolean;
  onToggleDevTools: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  items: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    allowedRoles: UserRole[];
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  showDevTools,
  onToggleDevTools,
}) => {
  const { session, logout } = useAuth();
  const { branding } = useBranding();
  const org = dbStore.getActiveOrganization();
  const userRole: UserRole = session?.role || 'SUPER_ADMIN';

  // Obtener rol actual y permisos dinámicos
  const currentRoleObj = dbStore.getRoles().find((r) => r.id === userRole);

  // Secciones colapsables del Sidebar
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    engineering: true, // colapsado por defecto
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Definición estructurada de grupos según las especificaciones
  const navGroups: NavGroup[] = [
    {
      id: 'principal',
      label: 'PANEL PRINCIPAL',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard & Métricas',
          icon: BarChart3,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
        },
      ],
    },
    {
      id: 'operacion',
      label: 'OPERACIÓN CLÍNICA',
      items: [
        {
          id: 'agenda',
          label: 'Agenda de Citas',
          icon: Calendar,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'],
        },
        {
          id: 'patients',
          label: 'Fichas de Pacientes',
          icon: HeartPulse,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
        },
      ],
    },
    {
      id: 'clinica',
      label: 'ODONTOLOGÍA & TRATAMIENTOS',
      items: [
        {
          id: 'odontogram',
          label: 'Odontograma FDI',
          icon: Stethoscope,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
          badge: 'FDI',
        },
        {
          id: 'treatments',
          label: 'Planes & Tratamientos',
          icon: Building2,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
        },
        {
          id: 'clinical',
          label: 'Historias Clínicas MSPBS',
          icon: FileText,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO'],
        },
      ],
    },
    {
      id: 'administracion',
      label: 'ADMINISTRACIÓN & CAJA',
      items: [
        {
          id: 'quotes',
          label: 'Presupuestos & Planes',
          icon: Calculator,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'CAJA'],
        },
        {
          id: 'cash',
          label: 'Caja & Facturación',
          icon: DollarSign,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL', 'RECEPCION', 'CAJA'],
        },
      ],
    },
    {
      id: 'sistema',
      label: 'GESTIÓN & SEGURIDAD',
      items: [
        {
          id: 'branches',
          label: 'Sucursales & Sillones',
          icon: Landmark,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
        },
        {
          id: 'organization',
          label: 'Empresa & Branding',
          icon: Building2,
          allowedRoles: ['SUPER_ADMIN'], // Exclusivo Super Administrador
        },
        {
          id: 'users',
          label: 'Equipo, Roles & Accesos',
          icon: Users,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
        },
        {
          id: 'audit',
          label: 'Auditoría & Logs',
          icon: ShieldAlert,
          allowedRoles: ['SUPER_ADMIN', 'ADMIN_ORGANIZACION', 'ADMIN_SUCURSAL'],
        },
      ],
    },
  ];

  // Herramientas de Ingeniería (Solo visibles para SUPER_ADMIN)
  const devGroup: NavGroup = {
    id: 'engineering',
    label: 'DEV & HERRAMIENTAS (17 FASES)',
    items: [
      { id: 'production', label: 'Producción Vercel', icon: Rocket, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'security', label: 'Seguridad & ASVS', icon: ShieldCheck, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'testing', label: 'Testing Automatizado', icon: CheckCheck, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'auth-session', label: 'Tokens de Sesión', icon: Lock, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'database', label: 'Esquemas Drizzle', icon: Database, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'data-explorer', label: 'Multi-Tenant Explorer', icon: Layers, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'paraguay', label: 'Catálogos Paraguay', icon: MapPin, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'architecture', label: 'Arquitectura', icon: Shield, allowedRoles: ['SUPER_ADMIN'] },
      { id: 'roadmap', label: 'Roadmap (100%)', icon: Sparkles, allowedRoles: ['SUPER_ADMIN'] },
    ],
  };

  const handleItemClick = (tabId: TabType) => {
    onSelectTab(tabId);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay para móviles y tablets */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Barra lateral fija */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Encabezado del Sidebar / Branding Dinámico */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-sm font-bold overflow-hidden"
              style={branding.customHexColor ? { background: branding.customHexColor } : undefined}
            >
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.tradeName} className="h-full w-full object-contain p-1" />
              ) : branding.logoIcon === 'heart-pulse' ? (
                <HeartPulse className="h-5 w-5" />
              ) : branding.logoIcon === 'hospital' ? (
                <Hospital className="h-5 w-5" />
              ) : branding.logoIcon === 'building' ? (
                <Building2 className="h-5 w-5" />
              ) : branding.logoIcon === 'sparkles' ? (
                <Sparkles className="h-5 w-5" />
              ) : branding.logoIcon === 'shield' ? (
                <ShieldCheck className="h-5 w-5" />
              ) : branding.logoIcon === 'activity' ? (
                <Activity className="h-5 w-5" />
              ) : branding.logoIcon === 'landmark' ? (
                <Landmark className="h-5 w-5" />
              ) : (
                <Stethoscope className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="font-extrabold text-slate-900 text-base leading-tight tracking-tight flex items-center gap-1.5">
                <span className="truncate max-w-[130px]" title={branding.tradeName}>
                  {branding.tradeName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                  {branding.currency}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]" title={branding.legalName}>
                {branding.legalName}
              </p>
            </div>
          </div>
          {/* Botón cerrar para móvil con área táctil accesible (44px) */}
          <button
            onClick={onClose}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 lg:hidden cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de navegación con scroll táctil suave */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
          {navGroups.map((group) => {
            // Filtrar ítems permitidos para este usuario / rol
            const allowedItems = group.items.filter((item) => {
              if (userRole === 'SUPER_ADMIN') return true;
              if (session?.allowedNavTabs && Array.isArray(session.allowedNavTabs) && session.allowedNavTabs.length > 0) {
                return session.allowedNavTabs.includes(item.id);
              }
              if (currentRoleObj?.allowedNavTabs) {
                return currentRoleObj.allowedNavTabs.includes(item.id);
              }
              return item.allowedRoles.includes(userRole);
            });
            if (allowedItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase select-none">
                  {group.label}
                </div>
                {allowedItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold transition-all group cursor-pointer touch-manipulation ${
                        isActive
                          ? 'bg-teal-50 text-teal-800 border border-teal-200/80 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 transition-colors ${
                            isActive
                              ? 'text-teal-600'
                              : 'text-slate-400 group-hover:text-slate-600'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isActive
                              ? 'bg-teal-200/60 text-teal-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Grupo de Ingeniería / Modo Dev (Solo visible si es SUPER_ADMIN) */}
          {userRole === 'SUPER_ADMIN' && (
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => toggleGroup('engineering')}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-wider text-purple-600 uppercase hover:bg-purple-50 rounded-lg transition-colors"
              >
                <span>{devGroup.label}</span>
                {collapsedGroups.engineering ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {!collapsedGroups.engineering && (
                <div className="mt-1 space-y-0.5">
                  {devGroup.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-purple-50 text-purple-800 font-semibold border border-purple-200'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-purple-50/40'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Sidebar: Usuario actual y sesión */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                {session?.firstName?.[0] || 'U'}
                {session?.lastName?.[0] || ''}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {session?.firstName || 'Usuario'} {session?.lastName || ''}
                </p>
                <p className="text-[11px] text-teal-700 font-medium truncate">
                  {session?.roleName || userRole}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión segura"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
