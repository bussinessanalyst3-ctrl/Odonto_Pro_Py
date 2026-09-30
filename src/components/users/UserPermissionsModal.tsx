import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Check,
  Lock,
  AlertTriangle,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Info,
  ShieldAlert,
  Ban,
  CheckCircle2,
  FileCheck,
  Layers,
  ArrowRight,
  User as UserIcon,
  Award,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { dbStore, BackendActorContext } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import {
  SYSTEM_PERMISSION_MODULES,
  REGULATORY_RESTRICTIONS_CATALOG,
  RegulatoryRestrictionItem,
  canManageRole,
  isSuperAdminRole,
  getUserEffectivePermissions,
} from '../../security/rbacHierarchy.ts';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: any | null;
  actor?: BackendActorContext;
}

const ALL_SYSTEM_NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard & Métricas', category: 'General' },
  { id: 'agenda', label: 'Agenda de Citas & Turnos', category: 'Clínica' },
  { id: 'patients', label: 'Fichas de Pacientes', category: 'Clínica' },
  { id: 'odontogram', label: 'Odontograma FDI Interactivo', category: 'Clínica' },
  { id: 'treatments', label: 'Planes & Tratamientos Odontológicos', category: 'Clínica' },
  { id: 'clinical', label: 'Historias Clínicas MSPBS & Evolución', category: 'Clínica' },
  { id: 'quotes', label: 'Presupuestos & Cotizaciones', category: 'Administración' },
  { id: 'cash', label: 'Caja Chica, Cobros & Facturación', category: 'Administración' },
  { id: 'branches', label: 'Sucursales & Sillones Dentales', category: 'Configuración' },
  { id: 'users', label: 'Equipo, Roles & Accesos', category: 'Seguridad' },
  { id: 'organization', label: 'Empresa & Identidad Corporativa', category: 'Configuración' },
  { id: 'audit', label: 'Auditoría & Trazabilidad MSPBS', category: 'Seguridad' },
];

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  actor,
}) => {
  const { session } = useAuth();
  const effectiveActor =
    actor ||
    (session
      ? {
          userId: session.userId,
          role: session.role,
          organizationId: session.organizationId,
          allowedBranchIds: session.allowedBranchIds,
        }
      : undefined);

  const [activeTab, setActiveTab] = useState<'permissions' | 'modules' | 'restrictions' | 'summary'>('permissions');
  const [selectedModuleCategory, setSelectedModuleCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOWED' | 'REVOKED' | 'CUSTOM'>('ALL');

  // Overrides locales en edición
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [revokedPermissions, setRevokedPermissions] = useState<string[]>([]);
  const [assignedRestrictions, setAssignedRestrictions] = useState<string[]>([]);
  const [allowedNavTabs, setAllowedNavTabs] = useState<string[]>([]);

  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado del usuario objetivo
  useEffect(() => {
    if (!isOpen || !targetUser) return;

    // Obtener la instancia más fresca del usuario desde la base de datos
    const freshUser = dbStore.findUserById(targetUser.id) || targetUser;

    setCustomPermissions(Array.isArray(freshUser.customPermissions) ? [...freshUser.customPermissions] : []);
    setRevokedPermissions(Array.isArray(freshUser.revokedPermissions) ? [...freshUser.revokedPermissions] : []);
    setAssignedRestrictions(Array.isArray(freshUser.assignedRestrictions) ? [...freshUser.assignedRestrictions] : []);

    const roleObj = dbStore.getRoles().find((r) => r.id === freshUser.roleId);
    const defaultNavTabs = roleObj?.allowedNavTabs || ['dashboard'];
    setAllowedNavTabs(
      Array.isArray(freshUser.allowedNavTabs) && freshUser.allowedNavTabs.length > 0
        ? [...freshUser.allowedNavTabs]
        : [...defaultNavTabs]
    );

    setHasChanges(false);
    setNotification(null);
    setErrorMsg(null);
    setActiveTab('permissions');
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const freshUser = dbStore.findUserById(targetUser.id) || targetUser;
  const isTargetSuperAdmin = isSuperAdminRole(freshUser.roleId);
  const isActorSuperAdmin = effectiveActor?.role === 'SUPER_ADMIN';

  // Validación de gobernanza: ¿Puede el actor administrar a este usuario?
  const canEditUserSecurity = (): boolean => {
    if (!effectiveActor) return false;
    if (isActorSuperAdmin) return true;
    if (isTargetSuperAdmin) return false; // Solo Super Admin puede modificar a otro Super Admin
    return canManageRole(effectiveActor.role, freshUser.roleId);
  };

  const isEditable = canEditUserSecurity();

  // Calcular permisos efectivos en tiempo real con los cambios temporales locales
  const mockUserForEffective = {
    ...freshUser,
    customPermissions,
    revokedPermissions,
    assignedRestrictions,
    allowedNavTabs,
  };
  const effectiveResult = getUserEffectivePermissions(mockUserForEffective, dbStore.getRoles());
  const effectivePermSet = new Set(effectiveResult.effectivePermissions);

  // Permisos base del rol
  const roleObj = dbStore.getRoles().find((r) => r.id === freshUser.roleId);
  const baseRolePermissions: string[] = Array.isArray((roleObj as any)?.permissions)
    ? (roleObj as any).permissions
    : dbStore.getRolePermissions(freshUser.roleId);
  const baseRolePermSet = new Set(baseRolePermissions);

  // Exclusivos de Super Admin que un admin común no puede conceder
  const superAdminExclusivePermissions = new Set([
    'system.all',
    'organization.create',
    'organization.manage',
    'organization.branding',
    'super_admin.manage',
    'security.manage',
    'database.seed',
    'data.export_sensitive',
  ]);

  // Manejador: Conceder permiso explícito (Custom Grant)
  const handleGrantPermission = (permCode: string) => {
    if (!isEditable) {
      setErrorMsg('403 Prohibido: No tiene jerarquía para alterar los permisos de este usuario.');
      return;
    }
    if (!isActorSuperAdmin && superAdminExclusivePermissions.has(permCode)) {
      setErrorMsg('403 Prohibido: Solo el Super Administrador puede otorgar este permiso sensible.');
      return;
    }

    setRevokedPermissions((prev) => prev.filter((p) => p !== permCode));
    if (!customPermissions.includes(permCode) && !baseRolePermSet.has(permCode)) {
      setCustomPermissions((prev) => [...prev, permCode]);
    }
    setHasChanges(true);
  };

  // Manejador: Revocar permiso explícito (Deny overrides Allow)
  const handleRevokePermission = (permCode: string) => {
    if (!isEditable) {
      setErrorMsg('403 Prohibido: No tiene jerarquía para alterar los permisos de este usuario.');
      return;
    }

    setCustomPermissions((prev) => prev.filter((p) => p !== permCode));
    if (!revokedPermissions.includes(permCode)) {
      setRevokedPermissions((prev) => [...prev, permCode]);
    }
    setHasChanges(true);
  };

  // Manejador: Restablecer a estándar del rol
  const handleResetToRoleDefault = (permCode: string) => {
    if (!isEditable) return;
    setCustomPermissions((prev) => prev.filter((p) => p !== permCode));
    setRevokedPermissions((prev) => prev.filter((p) => p !== permCode));
    setHasChanges(true);
  };

  // Manejador: Toggle de módulo de navegación
  const handleToggleNavTab = (tabId: string) => {
    if (!isEditable) return;
    setAllowedNavTabs((prev) => {
      const exists = prev.includes(tabId);
      if (exists) {
        if (prev.length <= 1) {
          setErrorMsg('El usuario debe tener como mínimo un módulo del sistema visible.');
          return prev;
        }
        return prev.filter((t) => t !== tabId);
      } else {
        return [...prev, tabId];
      }
    });
    setHasChanges(true);
  };

  // Manejador: Toggle de Restricción Sanitaria MSPBS
  const handleToggleRestriction = (restId: string) => {
    if (!isEditable) return;
    setAssignedRestrictions((prev) => {
      const exists = prev.includes(restId);
      if (exists) {
        return prev.filter((id) => id !== restId);
      } else {
        return [...prev, restId];
      }
    });
    setHasChanges(true);
  };

  // Guardar cambios permanentemente
  const handleSave = () => {
    setErrorMsg(null);
    try {
      dbStore.updateUserPermissions(
        freshUser.id,
        {
          customPermissions,
          revokedPermissions,
          assignedRestrictions,
          allowedNavTabs,
        },
        effectiveActor
      );

      setHasChanges(false);
      setNotification(
        `¡Políticas de seguridad, permisos y restricciones actualizadas inmediatamente para ${freshUser.firstName} ${freshUser.lastName}! Nueva versión: v${(freshUser.permissionsVersion || 1) + 1}.`
      );
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al persistir cambios de permisos.');
    }
  };

  // Restablecer absolutamente todos los overrides a valores por defecto del rol
  const handleResetAllOverrides = () => {
    if (!isEditable) return;
    const confirmReset = window.confirm(
      `¿Está seguro de eliminar todas las personalizaciones, concesiones y revocaciones de ${freshUser.firstName} ${freshUser.lastName} y restablecerlo estrictamente a las directivas base de su rol (${freshUser.roleId})?`
    );
    if (!confirmReset) return;

    setCustomPermissions([]);
    setRevokedPermissions([]);
    setAssignedRestrictions([]);
    const defaultNav = roleObj?.allowedNavTabs || ['dashboard'];
    setAllowedNavTabs([...defaultNav]);
    setHasChanges(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0">
              <Sliders className="h-4 sm:h-5 w-4 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  Gobernanza de Permisos
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/30 text-teal-200 border border-teal-400/30 font-bold">
                  v{freshUser.permissionsVersion || 1}
                </span>
                {isTargetSuperAdmin && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/40 text-purple-200 border border-purple-400/30">
                    SUPER ADMIN
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
                <span className="font-semibold text-white truncate">
                  {freshUser.firstName} {freshUser.lastName}
                </span>
                <span>•</span>
                <span className="text-teal-300 font-medium truncate">Rol: {roleObj?.name || freshUser.roleId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
            {hasChanges && (
              <span className="text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-950/80 px-2 sm:px-2.5 py-1 rounded-xl border border-amber-500/50 hidden xs:flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cambios sin guardar</span>
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notificaciones & Errores */}
        {notification && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
        )}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shrink-0 animate-in fade-in">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tabs de Navegación del Modal */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'permissions'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Acciones & Permisos Granulares</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono">
                {effectivePermSet.size}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('modules')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'modules'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              <span>Módulos Visibles (allowedNavTabs)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-mono">
                {allowedNavTabs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('restrictions')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'restrictions'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Ban className="h-3.5 w-3.5 text-rose-600" />
              <span>Restricciones Sanitarias MSPBS</span>
              {assignedRestrictions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
                  {assignedRestrictions.length} activas
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'summary'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Resumen & Auditoría</span>
              {(customPermissions.length > 0 || revokedPermissions.length > 0) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                  Overrides
                </span>
              )}
            </button>
          </div>

          {isEditable && (
            <button
              type="button"
              onClick={handleResetAllOverrides}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5 pb-2 transition-colors shrink-0"
              title="Restablecer usuario estrictamente a la configuración de su rol base"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Restablecer al Rol Base</span>
            </button>
          )}
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ACCIONES Y PERMISOS GRANULARES */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              {/* Filtros de Búsqueda */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar permiso por nombre, código o módulo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                  />
                </div>

                <select
                  value={selectedModuleCategory}
                  onChange={(e) => setSelectedModuleCategory(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                >
                  <option value="ALL">Todos los módulos</option>
                  {SYSTEM_PERMISSION_MODULES.map((m) => (
                    <option key={m.category} value={m.category}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="ALLOWED">Autorizados Efectivos</option>
                  <option value="REVOKED">Revocados Explícitamente</option>
                  <option value="CUSTOM">Concedidos Específicos</option>
                </select>
              </div>

              {/* Lista de Módulos y Permisos */}
              <div className="space-y-4">
                {SYSTEM_PERMISSION_MODULES.filter(
                  (m) => selectedModuleCategory === 'ALL' || m.category === selectedModuleCategory
                ).map((mod) => {
                  const filteredPerms = mod.permissions.filter((p) => {
                    const matchesSearch =
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.description.toLowerCase().includes(searchQuery.toLowerCase());

                    if (!matchesSearch) return false;

                    const isAllowed = effectivePermSet.has(p.code);
                    const isRevoked = revokedPermissions.includes(p.code);
                    const isCustom = customPermissions.includes(p.code);

                    if (statusFilter === 'ALLOWED') return isAllowed;
                    if (statusFilter === 'REVOKED') return isRevoked;
                    if (statusFilter === 'CUSTOM') return isCustom;
                    return true;
                  });

                  if (filteredPerms.length === 0) return null;

                  return (
                    <div
                      key={mod.category}
                      className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <span>{mod.name}</span>
                            <span className="text-[10px] font-normal text-slate-500 lowercase">
                              ({filteredPerms.length} acciones)
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">{mod.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {filteredPerms.map((perm) => {
                          const isFromRole = baseRolePermSet.has(perm.code);
                          const isCustomGrant = customPermissions.includes(perm.code);
                          const isExplicitlyRevoked = revokedPermissions.includes(perm.code);
                          const isEffective = effectivePermSet.has(perm.code);

                          // Revisar si está bloqueado por restricción sanitaria
                          const blockingRestriction = assignedRestrictions.find((restId) => {
                            const rDef = REGULATORY_RESTRICTIONS_CATALOG.find((r) => r.id === restId || r.code === restId);
                            return rDef?.targetPermissions.includes(perm.code);
                          });

                          return (
                            <div
                              key={perm.code}
                              className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                                isExplicitlyRevoked
                                  ? 'bg-rose-50/60 border-rose-200'
                                  : isEffective
                                  ? isCustomGrant
                                    ? 'bg-emerald-50/70 border-emerald-300'
                                    : 'bg-white border-slate-200 shadow-2xs'
                                  : 'bg-slate-100/60 border-slate-200/60 opacity-75'
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-xs font-bold text-slate-900 leading-tight">
                                    {perm.name}
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1">
                                    {isExplicitlyRevoked ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                                        <Ban className="h-3 w-3" />
                                        <span>REVOCADO</span>
                                      </span>
                                    ) : blockingRestriction ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1" title="Bloqueado por directiva regulatoria sanitaria activa">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>RESTRINGIDO MSPBS</span>
                                      </span>
                                    ) : isEffective ? (
                                      isCustomGrant ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                          <Check className="h-3 w-3" />
                                          <span>CONCEDIDO</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
                                          ROL BASE
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-600">
                                        NO AUTORIZADO
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                  {perm.code}
                                </div>
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                  {perm.description}
                                </p>
                              </div>

                              {/* Botones de acción del permiso */}
                              {isEditable && !isTargetSuperAdmin && (
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                                  {isExplicitlyRevoked ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResetToRoleDefault(perm.code)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                                    >
                                      <RotateCcw className="h-3 w-3 text-slate-500" />
                                      <span>Quitar revocación</span>
                                    </button>
                                  ) : isCustomGrant ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResetToRoleDefault(perm.code)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                                    >
                                      <RotateCcw className="h-3 w-3 text-slate-500" />
                                      <span>Quitar concesión</span>
                                    </button>
                                  ) : (
                                    <>
                                      {isEffective ? (
                                        <button
                                          type="button"
                                          onClick={() => handleRevokePermission(perm.code)}
                                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                          <Ban className="h-3 w-3 text-rose-600" />
                                          <span>Revocar</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleGrantPermission(perm.code)}
                                          className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                          <Check className="h-3 w-3 text-teal-600" />
                                          <span>Conceder</span>
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MÓDULOS DE NAVEGACIÓN VISIBLES (allowedNavTabs) */}
          {activeTab === 'modules' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-900 leading-relaxed flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-indigo-950 mb-1">
                    Control de Visualización de Módulos (allowedNavTabs)
                  </h4>
                  <p>
                    Como Super Administrador puede elegir exactamente qué pestañas y módulos visualiza este usuario en su menú lateral y barra de navegación. Al desmarcar un módulo, el sistema ocultará el acceso del menú lateral y bloqueará el renderizado en pantalla con validación de seguridad.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ALL_SYSTEM_NAV_TABS.map((tab) => {
                  const isChecked = allowedNavTabs.includes(tab.id);
                  const isRoleDefault = (roleObj?.allowedNavTabs || []).includes(tab.id);

                  return (
                    <div
                      key={tab.id}
                      onClick={() => isEditable && handleToggleNavTab(tab.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                        isChecked
                          ? 'bg-teal-50/50 border-teal-300 shadow-2xs'
                          : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-4 w-4 rounded-md flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'bg-white border-slate-300'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{tab.label}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-1 pl-6">
                          ID: {tab.id}
                        </div>
                        <div className="text-[10px] text-slate-500 pl-6 mt-0.5">
                          {isRoleDefault ? 'Predeterminado en el rol' : 'Asignado manualmente'}
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold uppercase">
                        {tab.category}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RESTRICCIONES REGULATORIAS DEL MSPBS */}
          {activeTab === 'restrictions' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950 mb-1">
                    Directivas Sanitarias & Políticas Legales del MSPBS
                  </h4>
                  <p>
                    Las restricciones regulatorias actúan como barreras normativas obligatorias. Cuando una restricción se encuentra activa para este usuario, <b>anula y bloquea incondicionalmente cualquier permiso</b> que permita la acción (Regla: <i>Restriction Denies All</i>), garantizando cumplimiento con el Código Sanitario paraguayo.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {REGULATORY_RESTRICTIONS_CATALOG.map((rest) => {
                  const isActive = assignedRestrictions.includes(rest.id) || assignedRestrictions.includes(rest.code);

                  return (
                    <div
                      key={rest.id}
                      className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                        isActive
                          ? 'bg-rose-50/70 border-rose-300 shadow-2xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              rest.category === 'CLINICA'
                                ? 'bg-teal-100 text-teal-800'
                                : rest.category === 'EXPEDIENTE'
                                ? 'bg-purple-100 text-purple-800'
                                : rest.category === 'FINANCIERA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rest.category === 'EXPORTACION'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {rest.category}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{rest.name}</h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{rest.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                          <span className="font-medium text-slate-700">
                            Base Legal: <span className="font-mono">{rest.regulatoryStandard}</span>
                          </span>
                          <span>•</span>
                          <span>
                            Acciones bloqueadas:{' '}
                            <span className="font-mono text-rose-700 font-semibold">
                              {rest.targetPermissions.join(', ')}
                            </span>
                          </span>
                        </div>
                      </div>

                      {isEditable && (
                        <div className="shrink-0 flex items-center pt-1">
                          <button
                            type="button"
                            onClick={() => handleToggleRestriction(rest.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                              isActive ? 'bg-rose-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: RESUMEN Y AUDITORÍA */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Estadísticas de Permisos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-teal-700 font-mono">
                    {effectivePermSet.size}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mt-1">
                    Permisos Efectivos
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700 font-mono">
                    +{customPermissions.length}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mt-1">
                    Concesiones Custom
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-rose-700 font-mono">
                    -{revokedPermissions.length}
                  </div>
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mt-1">
                    Revocaciones Activas
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700 font-mono">
                    {assignedRestrictions.length}
                  </div>
                  <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider mt-1">
                    Restricciones MSPBS
                  </div>
                </div>
              </div>

              {/* Registro de Auditoría Preparado */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-teal-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      Trazabilidad de Seguridad Médica & Auditoría
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Actor: {session?.email} ({session?.role})
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 font-mono leading-relaxed">
                  <div>
                    <span className="text-slate-500">Usuario Objetivo:</span>{' '}
                    <span className="text-white font-bold">{freshUser.firstName} {freshUser.lastName} ({freshUser.email})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Empresa / Inquilino:</span>{' '}
                    <span className="text-teal-300">{session?.organizationName || 'OdontoSol'}</span> (ID: {freshUser.organizationId})
                  </div>
                  <div>
                    <span className="text-slate-500">Versión de Políticas:</span>{' '}
                    <span className="text-amber-300">v{freshUser.permissionsVersion || 1} → v{(freshUser.permissionsVersion || 1) + (hasChanges ? 1 : 0)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Módulos Asignados:</span>{' '}
                    <span className="text-slate-200">{allowedNavTabs.join(', ')}</span>
                  </div>
                  {revokedPermissions.length > 0 && (
                    <div>
                      <span className="text-rose-400">Permisos Revocados (Deny):</span>{' '}
                      <span className="text-rose-300">{revokedPermissions.join(', ')}</span>
                    </div>
                  )}
                  {customPermissions.length > 0 && (
                    <div>
                      <span className="text-emerald-400">Permisos Concedidos:</span>{' '}
                      <span className="text-emerald-300">{customPermissions.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-slate-500">
            {hasChanges ? (
              <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Modificaciones pendientes de persistir.</span>
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Directivas de seguridad sincronizadas.</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 min-h-[42px] sm:min-h-[44px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            >
              Cerrar
            </button>

            {isEditable && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges}
                className={`flex-1 sm:flex-none px-5 py-2.5 min-h-[42px] sm:min-h-[44px] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs ${
                  hasChanges
                    ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer hover:shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Save className="h-4 w-4 shrink-0" />
                <span>Guardar Cambios</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
