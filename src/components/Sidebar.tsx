import React, { useState, useEffect } from 'react';
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
  LogOut,
  X,
  Briefcase,
  Terminal
} from 'lucide-react';
import { useAuth } from '../auth/authContext.tsx';
import { useBranding } from '../branding/BrandingContext.tsx';
import { UserRole } from '../auth/types.ts';
import { TabType } from './Header.tsx';
import { dbStore } from '../db/inMemoryStore.ts';
import { APP_NAME, resolveOrganizationLegalName } from '../config/appBrand.ts';
import {
  MODULE_GROUPS,
  SYSTEM_MODULES,
  SystemModuleId,
  hasModuleAccess,
} from '../security/moduleCatalog.ts';
import { OdontoProWordmark, PatientAvatar } from './ui/DesignPrimitives.tsx';

const SIDEBAR_MODULE_ICONS: Record<SystemModuleId, React.ComponentType<{ className?: string }>> = {
  dashboard: BarChart3,
  agenda: Calendar,
  patients: HeartPulse,
  odontogram: Stethoscope,
  treatments: Building2,
  clinical: FileText,
  quotes: Calculator,
  cash: DollarSign,
  'staff-payroll': Briefcase,
  branches: Landmark,
  organization: Building2,
  users: Users,
  audit: ShieldAlert,
};

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isOpen: boolean;
  onClose: () => void;
  canAccessOwnerConsole?: boolean;
  onOpenOwnerConsole?: () => void;
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
  canAccessOwnerConsole = false,
  onOpenOwnerConsole,
}) => {
  const { session, logout } = useAuth();
  const { branding } = useBranding();
  const [, setStoreTick] = useState(0);
  useEffect(() => {
    return dbStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);
  const org = dbStore.getActiveOrganization();
  const userRole: UserRole = session?.role || '';

  // Obtener rol actual y permisos dinámicos
  const currentRoleObj = dbStore.getRoles().find((r) => r.id === userRole);

  // Grupos construidos dinámicamente desde el catálogo único de módulos (moduleCatalog.ts)
  const navGroups: NavGroup[] = MODULE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: SYSTEM_MODULES.filter((mod) => mod.groupId === group.id).map((mod) => ({
      id: mod.id,
      label: mod.sidebarLabel,
      icon: SIDEBAR_MODULE_ICONS[mod.id] || BarChart3,
      allowedRoles: mod.defaultRoles,
      badge: mod.badge,
    })),
  }));

  const companyLegalName = resolveOrganizationLegalName({
    legalName: branding.legalName,
    name: org?.name,
  });

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

      {/* Barra lateral clara fija */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 max-w-[82vw] md:w-72 bg-white border-r border-[#E6E2D9] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        {/* Encabezado del Sidebar / Marca ODONTOPRO */}
        <div className="h-14 md:h-16 flex items-center justify-between px-4 md:px-5 border-b border-[#EFECE5] bg-white">
          <div className="min-w-0">
            <div title={APP_NAME}>
              <OdontoProWordmark size="md" />
            </div>
            {companyLegalName && (
              <p
                className="mt-1 text-[11px] text-[#6B706D] font-medium truncate max-w-[180px]"
                title={companyLegalName}
              >
                {companyLegalName}
              </p>
            )}
          </div>
          {/* Botón cerrar para móvil con área táctil accesible (44px) */}
          <button
            onClick={onClose}
            className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#6B706D] hover:text-[#1C1F1E] rounded-md hover:bg-[#F2F0EB] lg:hidden cursor-pointer"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Lista de navegación con scroll táctil suave */}
        <div
          className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {navGroups.map((group) => {
            // Filtrar ítems permitidos usando el catálogo único (con normalización de alias y herencia de rol)
            const allowedItems = group.items.filter((item) =>
              hasModuleAccess(session, item.id, currentRoleObj)
            );
            if (allowedItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-0.5">
                <div className="px-3 pb-1.5 text-[11px] font-medium text-[#6B706D] select-none">
                  {group.label}
                </div>
                {allowedItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] md:min-h-[40px] rounded-md text-[13px] transition-colors group cursor-pointer touch-manipulation ${
                        isActive
                          ? 'bg-[#ECF5F5] text-[#0F5C63] font-semibold'
                          : 'text-[#525755] font-medium hover:text-[#1C1F1E] hover:bg-[#F8F7F4]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-[#0F5C63]'
                              : 'text-[#6B706D] group-hover:text-[#1C1F1E]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[11px] font-medium tabular-nums shrink-0 ${
                            isActive ? 'text-[#0F5C63]' : 'text-[#6B706D]'
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
        </div>

        {/* Pie del Sidebar: Enlace exclusivo de propietario y usuario actual */}
        <div className="p-3 border-t border-[#EFECE5] bg-white space-y-2">
          {canAccessOwnerConsole && onOpenOwnerConsole && (
            <button
              type="button"
              onClick={() => {
                onOpenOwnerConsole();
                if (window.innerWidth < 1024) {
                  onClose();
                }
              }}
              className="w-full flex items-center justify-between px-3 py-2 min-h-[40px] rounded-md bg-[#F6F2EA] hover:bg-[#EFE8DB] border border-[#E2D7C5] text-[#5C4F3A] text-xs font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-[#7A684C]" />
                <span>Consola del propietario</span>
              </span>
            </button>
          )}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <PatientAvatar
                firstName={session?.firstName}
                lastName={session?.lastName}
                seed={session?.userId || session?.email}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#1C1F1E] truncate">
                  {session?.firstName || 'Usuario'} {session?.lastName || ''}
                </p>
                <p className="text-[11px] text-[#6B706D] truncate">
                  {session?.roleName || userRole}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="p-2.5 md:p-2 min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px] flex items-center justify-center text-[#6B706D] hover:text-[#991B1B] hover:bg-[#FEF2F2] rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
