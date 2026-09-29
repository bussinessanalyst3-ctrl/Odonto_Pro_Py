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
  Filter,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { dbStore, BackendActorContext } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { SYSTEM_PERMISSION_MODULES, PermissionModuleGroup, canManageRole, isSuperAdminRole } from '../../security/rbacHierarchy.ts';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actor?: BackendActorContext;
}

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({ isOpen, onClose, actor }) => {
  const { session } = useAuth();
  const effectiveActor = actor || (session ? {
    userId: session.userId,
    role: session.role,
    organizationId: session.organizationId,
    allowedBranchIds: session.allowedBranchIds,
  } : undefined);

  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('ADMIN_SUCURSAL');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'by-role' | 'matrix'>('by-role');

  // Mapa local de permisos por rol: { [roleId]: string[] }
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({});
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado de roles y permisos
  useEffect(() => {
    if (!isOpen) return;
    const currentRoles = dbStore.getRoles();
    setRoles(currentRoles);

    const initialMap: Record<string, string[]> = {};
    currentRoles.forEach((r: any) => {
      initialMap[r.id] = dbStore.getRolePermissions(r.id);
    });
    setRolePermissionsMap(initialMap);
    setHasChanges(false);
    setNotification(null);
    setErrorMsg(null);

    // Si el rol seleccionado actual ya no existe o no es configurable, seleccionar por defecto el primer rol subordinado
    const defaultTarget = effectiveActor?.role && effectiveActor.role !== 'SUPER_ADMIN'
      ? currentRoles.find((r) => canManageRole(effectiveActor.role, r.id))
      : (currentRoles.find((r) => r.id !== 'SUPER_ADMIN') || currentRoles[0]);

    if (!selectedRoleId || (effectiveActor?.role && effectiveActor.role !== 'SUPER_ADMIN' && !canManageRole(effectiveActor.role, selectedRoleId))) {
      if (defaultTarget) setSelectedRoleId(defaultTarget.id);
    } else if (!currentRoles.find((r) => r.id === selectedRoleId)) {
      if (defaultTarget) setSelectedRoleId(defaultTarget.id);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRoleObj = roles.find((r) => r.id === selectedRoleId);
  const isSuperAdminSelected = selectedRoleId === 'SUPER_ADMIN';
  const isSuperAdminActor = effectiveActor?.role === 'SUPER_ADMIN';

  // Un rol es configurable si y solo si el actor tiene jerarquía estricta sobre él
  const isRoleConfigurable = (roleId: string): boolean => {
    if (roleId === 'SUPER_ADMIN') return false; // Super Admin siempre tiene acceso universal e inmutable
    if (isSuperAdminActor) return true;
    if (!effectiveActor) return false;
    return canManageRole(effectiveActor.role, roleId);
  };

  const isSelectedRoleConfigurable = isRoleConfigurable(selectedRoleId);

  // Toggle de un permiso específico para un rol
  const handleTogglePermission = (roleId: string, permissionCode: string) => {
    if (!isRoleConfigurable(roleId)) {
      setErrorMsg(`403 Prohibido: No tiene jerarquía para modificar permisos del rol ${roleId}. Solo puede configurar roles inferiores.`);
      return;
    }

    setRolePermissionsMap((prev) => {
      const currentList = prev[roleId] || [];
      const hasPerm = currentList.includes(permissionCode);
      const updated = hasPerm
        ? currentList.filter((p) => p !== permissionCode)
        : [...currentList, permissionCode];

      return {
        ...prev,
        [roleId]: updated,
      };
    });
    setHasChanges(true);
  };

  // Habilitar o deshabilitar todos los permisos de un módulo
  const handleToggleModuleGroup = (roleId: string, group: PermissionModuleGroup, enable: boolean) => {
    if (!isRoleConfigurable(roleId)) {
      setErrorMsg(`403 Prohibido: No tiene jerarquía para modificar permisos del rol ${roleId}.`);
      return;
    }

    setRolePermissionsMap((prev) => {
      const currentList = prev[roleId] || [];
      const groupCodes = group.permissions.map((p) => p.code);

      let updated: string[];
      if (enable) {
        const toAdd = groupCodes.filter((c) => !currentList.includes(c));
        updated = [...currentList, ...toAdd];
      } else {
        updated = currentList.filter((c) => !groupCodes.includes(c));
      }

      return {
        ...prev,
        [roleId]: updated,
      };
    });
    setHasChanges(true);
  };

  // Habilitar o deshabilitar todos los permisos para el rol seleccionado
  const handleToggleAllRolePermissions = (roleId: string, enable: boolean) => {
    if (!isRoleConfigurable(roleId)) {
      setErrorMsg(`403 Prohibido: No tiene jerarquía para modificar permisos del rol ${roleId}.`);
      return;
    }

    if (enable) {
      // Recopilar todos los permisos existentes en todos los módulos (excluyendo exclusivos de Super Admin si no es Super Admin)
      const allCodes: string[] = [];
      const superAdminExclusives = new Set([
        'system.all',
        'organization.create',
        'organization.manage',
        'organization.branding',
        'super_admin.manage',
        'security.manage',
        'database.seed',
        'data.export_sensitive',
      ]);

      SYSTEM_PERMISSION_MODULES.forEach((mod) => {
        mod.permissions.forEach((p) => {
          if (isSuperAdminActor || !superAdminExclusives.has(p.code)) {
            allCodes.push(p.code);
          }
        });
      });
      setRolePermissionsMap((prev) => ({
        ...prev,
        [roleId]: Array.from(new Set(allCodes)),
      }));
    } else {
      setRolePermissionsMap((prev) => ({
        ...prev,
        [roleId]: [],
      }));
    }
    setHasChanges(true);
  };

  // Guardar matriz de permisos en dbStore
  const handleSaveChanges = () => {
    setErrorMsg(null);
    try {
      // Guardar únicamente los roles modificados sobre los que el usuario tiene jerarquía
      const allowedRolesToSave = Object.keys(rolePermissionsMap).filter(isRoleConfigurable);
      allowedRolesToSave.forEach((roleId) => {
        dbStore.updateRolePermissions(roleId, rolePermissionsMap[roleId], effectiveActor);
      });

      setHasChanges(false);
      setNotification('¡Matriz de permisos y autoridad operacional guardada y sincronizada exitosamente!');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al persistir la matriz de permisos.');
    }
  };

  // Restablecer valores recomendados MSPBS para el rol activo
  const handleResetRoleDefaults = () => {
    if (!isSelectedRoleConfigurable) {
      setErrorMsg('No tiene jerarquía suficiente para restablecer este rol.');
      return;
    }
    try {
      const restored = dbStore.resetRolePermissionsToDefault(selectedRoleId, effectiveActor);
      setRolePermissionsMap((prev) => ({
        ...prev,
        [selectedRoleId]: restored,
      }));
      setHasChanges(false);
      setNotification(`Permisos del rol "${currentRoleObj?.name}" restablecidos a las normativas del MSPBS.`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al restablecer permisos.');
    }
  };

  // Filtrado de módulos y permisos
  const filteredGroups = SYSTEM_PERMISSION_MODULES.filter((group) => {
    if (activeCategory !== 'ALL' && group.id !== activeCategory) {
      return false;
    }
    return true;
  }).map((group) => {
    const q = searchQuery.toLowerCase().trim();
    const rolePerms = rolePermissionsMap[selectedRoleId] || [];

    const matchedPerms = group.permissions.filter((p) => {
      // Filtro por texto
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      )) {
        return false;
      }

      // Filtro por estado habilitado/deshabilitado
      const isEnabled = isSuperAdminSelected || rolePerms.includes(p.code);
      if (statusFilter === 'ENABLED' && !isEnabled) return false;
      if (statusFilter === 'DISABLED' && isEnabled) return false;

      return true;
    });

    return {
      ...group,
      permissions: matchedPerms,
    };
  }).filter((group) => group.permissions.length > 0);

  const categories = [
    { id: 'ALL', label: 'Todos los Módulos' },
    { id: 'clinical', label: 'Clínica & Odontograma' },
    { id: 'appointments', label: 'Agenda & Citas' },
    { id: 'patients', label: 'Pacientes' },
    { id: 'treatments', label: 'Tratamientos & Aranceles' },
    { id: 'quotes', label: 'Presupuestos' },
    { id: 'cash', label: 'Caja & Facturación' },
    { id: 'reports', label: 'Dashboard & Reportes' },
    { id: 'branches', label: 'Sucursales & Sillones' },
    { id: 'users', label: 'Equipo & Roles' },
    { id: 'organization', label: 'Multiempresa & Auditoría' },
    { id: 'security', label: 'Seguridad & Respaldos' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Matriz de Autoridad & Permisos de Operación (RBAC)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Granular & Dinámico
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Habilite o deshabilite acciones y accesos por rol conforme a la Ley N° 1682/01 y normativas del MSPBS de Paraguay.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('by-role')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'by-role'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Rol
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Matriz Comparativa
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 rounded-xl p-1.5 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notifications & Error banner */}
        {notification && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-900 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Controls Toolbar: Role Selector + Search + Category Filter */}
        <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
          {viewMode === 'by-role' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-teal-600" />
                Rol a Configurar:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {roles.map((r: any) => {
                  const isSelected = r.id === selectedRoleId;
                  const isSuper = r.id === 'SUPER_ADMIN';
                  const permsCount = rolePermissionsMap[r.id]?.length || 0;
                  const isConfigurable = isRoleConfigurable(r.id);

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoleId(r.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 border cursor-pointer ${
                        isSelected
                          ? isConfigurable
                            ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-700 text-white border-slate-800 shadow-xs'
                          : isConfigurable
                          ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-slate-100/90 text-slate-500 border-dashed border-slate-300 hover:bg-slate-200/60'
                      }`}
                    >
                      {!isConfigurable && <Lock className="h-3 w-3 shrink-0 text-amber-500" />}
                      <span>{r.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : isConfigurable ? 'bg-slate-200 text-slate-700' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isSuper ? 'Total' : permsCount}
                      </span>
                      {!isConfigurable && (
                        <span className="text-[9px] uppercase px-1 rounded bg-amber-100 text-amber-900 font-bold">
                          Fijo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search, Categories & Status Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar permisos por acción, código o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ENABLED')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                    statusFilter === 'ENABLED'
                      ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  ✓ Habilitados
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('DISABLED')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] transition-all ${
                    statusFilter === 'DISABLED'
                      ? 'bg-slate-700 text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ✕ Inactivos
                </button>
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <select
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 font-medium text-slate-700"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body: Permissions List (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin bg-slate-50/40">
          {viewMode === 'by-role' ? (
            /* VIEW MODE: BY SINGLE ROLE WITH DIRECT TOGGLE SWITCHES */
            <div className="space-y-5">
              {/* Selected Role Banner with Bulk Actions */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      {currentRoleObj?.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-teal-800 border border-slate-200">
                      {currentRoleObj?.id}
                    </span>
                    {isSuperAdminSelected ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Acceso Universal Inmutable
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                        {rolePermissionsMap[selectedRoleId]?.length || 0} permisos activos
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentRoleObj?.description || 'Rol operativo institucional de OdontoPro.'}
                  </p>
                </div>

                {!isSelectedRoleConfigurable ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold shrink-0">
                    <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>
                      {isSuperAdminSelected
                        ? 'Acceso universal inmutable'
                        : 'Rol protegido: solo administrable por jerarquía superior'}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAllRolePermissions(selectedRoleId, true)}
                      title="Habilitar todos los permisos del sistema para este rol"
                      className="px-2.5 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Habilitar Todo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllRolePermissions(selectedRoleId, false)}
                      title="Deshabilitar todos los permisos para este rol"
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Deshabilitar Todo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetRoleDefaults}
                      title="Restablecer los permisos por defecto sugeridos para este rol"
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <RotateCcw className="h-3 w-3 text-slate-500" />
                      <span>Restablecer MSPBS</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Warning banner when viewing a protected role */}
              {!isSelectedRoleConfigurable && !isSuperAdminSelected && (
                <div className="p-4 bg-amber-50/95 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-950 shadow-2xs animate-in fade-in">
                  <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold text-amber-950 block">
                      Aislamiento de Autoridad & Prevención de Auto-Escalamiento de Privilegios:
                    </span>
                    <p className="text-amber-900 leading-relaxed">
                      Como {effectiveActor?.role === 'ADMIN_ORGANIZACION' ? 'Administrador de Organización (Nivel 80)' : effectiveActor?.role || 'Administrador'}, su perfil <strong>ya dispone por defecto de todas las atribuciones de agendamiento de turnos, gestión de pacientes, clínica y soporte operacional</strong> para las demás áreas de la clínica (exceptuando las exclusivas del Super Administrador).
                    </p>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      Para garantizar la gobernanza del sistema y prevenir la elevación de privilegios no autorizada, su propio rol es institucional y fijo. <strong>Solo tiene autorización para asignar o retirar permisos a los roles subordinados a su jerarquía (Nivel &lt; 80).</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Modules Loop */}
              {filteredGroups.map((group) => {
                const rolePerms = rolePermissionsMap[selectedRoleId] || [];
                const allGroupEnabled =
                  isSuperAdminSelected ||
                  group.permissions.every((p) => rolePerms.includes(p.code));
                const noneGroupEnabled =
                  !isSuperAdminSelected &&
                  group.permissions.every((p) => !rolePerms.includes(p.code));

                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs"
                  >
                    {/* Group Header with Bulk Actions */}
                    <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            {group.name}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            ({group.permissions.length} acciones)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {group.description}
                        </p>
                      </div>

                      {!isSelectedRoleConfigurable ? (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0">
                          <Lock className="h-3 w-3" /> Solo Lectura
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleModuleGroup(selectedRoleId, group, true)}
                            disabled={allGroupEnabled}
                            className="px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 disabled:opacity-40 rounded-lg transition-colors border border-teal-200"
                          >
                            Habilitar todos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleModuleGroup(selectedRoleId, group, false)}
                            disabled={noneGroupEnabled}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-200/80 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
                          >
                            Deshabilitar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Permissions rows */}
                    <div className="divide-y divide-slate-100">
                      {group.permissions.map((p) => {
                        const isChecked = isSuperAdminSelected || rolePerms.includes(p.code);

                        return (
                          <div
                            key={p.code}
                            className={`p-3.5 sm:px-5 flex items-start justify-between gap-4 transition-colors ${
                              isChecked ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <div className="space-y-0.5 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                                  {p.name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  {p.code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                {p.description}
                              </p>
                            </div>

                            {/* Toggle Button */}
                            <div className="shrink-0 pt-0.5">
                              {!isSelectedRoleConfigurable ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  isSuperAdminSelected
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : isChecked
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}>
                                  <Lock className="h-3 w-3" />
                                  <span>{isSuperAdminSelected ? 'Siempre Activo' : isChecked ? 'Habilitado' : 'Inactivo'}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePermission(selectedRoleId, p.code)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-hidden ${
                                    isChecked ? 'bg-teal-600' : 'bg-slate-300'
                                  }`}
                                  aria-pressed={isChecked}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      isChecked ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VIEW MODE: FULL COMPARATIVE MATRIX TABLE */
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                      <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] sticky left-0 bg-slate-100/95 z-10 w-72">
                        Acción Operativa / Permiso
                      </th>
                      {roles.map((r: any) => (
                        <th
                          key={r.id}
                          className="p-3.5 font-bold text-center border-l border-slate-200 min-w-[120px]"
                        >
                          <div className="font-extrabold text-slate-900">{r.name}</div>
                          <div className="text-[10px] font-mono text-teal-700 font-semibold">{r.id}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredGroups.map((group) => (
                      <React.Fragment key={group.id}>
                        <tr className="bg-slate-50/90 font-bold text-slate-700 border-t border-b border-slate-200">
                          <td
                            colSpan={roles.length + 1}
                            className="p-2.5 px-3.5 text-[11px] uppercase tracking-wider text-teal-900 bg-teal-50/60"
                          >
                            {group.name}
                          </td>
                        </tr>
                        {group.permissions.map((p) => (
                          <tr key={p.code} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 text-slate-800 font-medium sticky left-0 bg-white shadow-xs z-1">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{p.code}</div>
                            </td>
                            {roles.map((r: any) => {
                              const isSuper = r.id === 'SUPER_ADMIN';
                              const currentRolePerms = rolePermissionsMap[r.id] || [];
                              const isEnabled = isSuper || currentRolePerms.includes(p.code);
                              const isConfigurable = isRoleConfigurable(r.id);

                              return (
                                <td
                                  key={r.id}
                                  className="p-3 text-center border-l border-slate-100 align-middle"
                                >
                                  {!isConfigurable ? (
                                    <span
                                      className={`inline-flex p-1 rounded-md ${
                                        isSuper
                                          ? 'bg-purple-100 text-purple-800'
                                          : isEnabled
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-slate-100 text-slate-400'
                                      }`}
                                      title={
                                        isSuper
                                          ? 'Acceso universal inmutable'
                                          : `Rol ${r.name} protegido por jerarquía (no modificable)`
                                      }
                                    >
                                      <Lock className="h-3.5 w-3.5" />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isEnabled}
                                      onChange={() => handleTogglePermission(r.id, p.code)}
                                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legal Footnote */}
          <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl text-xs text-teal-950 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Principio de Mínimo Privilegio (Ley N° 1682/01 y MSPBS Paraguay):</span>
              <p className="text-[11px] text-teal-900 leading-relaxed">
                El acceso a diagnósticos confidenciales, notas de evolución y odontogramas debe reservarse exclusivamente a odontólogos titulados y directores médicos. El personal administrativo y de recepción opera con visibilidad de anamnesis preventiva para bioseguridad, sin alterar prescripciones.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
          <div className="text-xs text-slate-500">
            {hasChanges ? (
              <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Tiene modificaciones pendientes de guardar en la matriz.
              </span>
            ) : (
              <span className="text-slate-400">
                Todos los cambios están sincronizados con la base de datos de seguridad.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!hasChanges}
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-teal-700/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Guardar Matriz de Permisos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
