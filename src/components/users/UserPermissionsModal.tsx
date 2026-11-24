import React, { useState, useEffect, useMemo } from 'react';
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
  Copy,
  CheckSquare,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { dbStore, BackendActorContext } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { getApiBaseUrl } from '../../config/apiConfig.ts';
import {
  SYSTEM_PERMISSION_MODULES,
  REGULATORY_RESTRICTIONS_CATALOG,
  isSuperAdminRole,
  getUserEffectivePermissions,
} from '../../security/rbacHierarchy.ts';
import {
  ALL_SYSTEM_MODULE_IDS,
  MODULE_GROUPS,
  SYSTEM_MODULES,
  SystemModuleId,
  buildCopyPermissionsDraft,
  getModuleById,
  getRoleDefaultModules,
  moduleSetsEqual,
  normalizeModuleList,
  resolveUserEffectiveModules,
} from '../../security/moduleCatalog.ts';
import { ConfirmDialog } from '../common/ConfirmDialog.tsx';

interface UserPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: any | null;
  actor?: BackendActorContext;
}

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

  const [activeTab, setActiveTab] = useState<'modules' | 'permissions' | 'restrictions' | 'summary'>('modules');
  const [moduleSearch, setModuleSearch] = useState<string>('');
  const [selectedModuleCategory, setSelectedModuleCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOWED' | 'REVOKED' | 'CUSTOM'>('ALL');

  // Panel inline para copiar permisos desde otro usuario
  const [isCopyPickerOpen, setIsCopyPickerOpen] = useState<boolean>(false);
  const [copySearch, setCopySearch] = useState<string>('');

  // Estado editable del borrador
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [revokedPermissions, setRevokedPermissions] = useState<string[]>([]);
  const [assignedRestrictions, setAssignedRestrictions] = useState<string[]>([]);
  const [allowedNavTabs, setAllowedNavTabs] = useState<SystemModuleId[]>([]);

  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allRoles = dbStore.getRoles();
  const allOrganizations = dbStore.getOrganizations();

  // Inicializar borrador al abrir el modal o cambiar usuario objetivo
  useEffect(() => {
    if (!isOpen || !targetUser) return;

    const fresh = dbStore.findUserById(targetUser.id) || targetUser;
    const rolesNow = dbStore.getRoles();
    const resolvedMods = resolveUserEffectiveModules(fresh, rolesNow);

    setCustomPermissions(Array.isArray(fresh.customPermissions) ? [...fresh.customPermissions] : []);
    setRevokedPermissions(Array.isArray(fresh.revokedPermissions) ? [...fresh.revokedPermissions] : []);
    setAssignedRestrictions(Array.isArray(fresh.assignedRestrictions) ? [...fresh.assignedRestrictions] : []);
    setAllowedNavTabs([...resolvedMods.effectiveModules]);

    setHasChanges(false);
    setSaveStatus('idle');
    setNotification(null);
    setInfoNotice(null);
    setErrorMsg(null);
    setModuleSearch('');
    setSearchQuery('');
    setIsCopyPickerOpen(false);
    setCopySearch('');
    setActiveTab('modules');
  }, [isOpen, targetUser]);

  const freshUser = targetUser ? dbStore.findUserById(targetUser.id) || targetUser : null;

  // Módulos y permisos que posee el actor actual (regla: no asignar lo que no se posee)
  const actorUserRecord = effectiveActor?.userId ? dbStore.findUserById(effectiveActor.userId) : null;
  const isActorSuperAdmin = effectiveActor?.role === 'SUPER_ADMIN';

  const actorAllowedModuleSet = useMemo(() => {
    if (isActorSuperAdmin) return new Set<SystemModuleId>(ALL_SYSTEM_MODULE_IDS);
    const resolved = resolveUserEffectiveModules(
      actorUserRecord || { roleId: effectiveActor?.role || '' },
      allRoles
    );
    return new Set<SystemModuleId>(resolved.effectiveModules);
  }, [isActorSuperAdmin, actorUserRecord, effectiveActor?.role, allRoles]);

  const actorEffectivePermData = useMemo(() => {
    const eff = getUserEffectivePermissions(
      actorUserRecord || { roleId: effectiveActor?.role || '' },
      allRoles
    );
    const set = new Set<string>(eff.effectivePermissions || []);
    return {
      set,
      hasAll: isActorSuperAdmin || set.has('system.all'),
    };
  }, [actorUserRecord, effectiveActor?.role, allRoles, isActorSuperAdmin]);

  // Lista de otros usuarios disponibles para copiar permisos
  const copyCandidateUsers = useMemo(() => {
    if (!freshUser) return [];
    const allUsers = dbStore.getUsers(undefined, effectiveActor) || [];
    const term = copySearch.trim().toLowerCase();
    return allUsers
      .filter((u) => u.id !== freshUser.id && u.status !== 'INACTIVE')
      .filter((u) => {
        if (!term) return true;
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const roleName = (allRoles.find((r) => r.id === u.roleId)?.name || u.roleId || '').toLowerCase();
        const orgName = (allOrganizations.find((o) => o.id === u.organizationId)?.name || '').toLowerCase();
        return (
          fullName.includes(term) ||
          String(u.email || '').toLowerCase().includes(term) ||
          roleName.includes(term) ||
          orgName.includes(term)
        );
      })
      .sort((a, b) =>
        `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`)
      );
  }, [freshUser, effectiveActor, copySearch, allRoles, allOrganizations]);

  if (!isOpen || !freshUser) return null;

  const isTargetSuperAdmin = isSuperAdminRole(freshUser.roleId);
  const isSelf = Boolean(effectiveActor?.userId && freshUser.id === effectiveActor.userId);
  const isEditable = Boolean(effectiveActor && isActorSuperAdmin && !isSelf && !isTargetSuperAdmin);

  const roleObj = allRoles.find((r) => r.id === freshUser.roleId);
  const targetOrg = allOrganizations.find((o) => o.id === freshUser.organizationId);
  const roleDefaultModules = getRoleDefaultModules(roleObj, freshUser.roleId);
  const roleDefaultSet = new Set<SystemModuleId>(roleDefaultModules);
  const activeModuleSet = new Set<SystemModuleId>(allowedNavTabs);

  // Diferencias de módulos respecto al rol base
  const addedModules = allowedNavTabs.filter((id) => !roleDefaultSet.has(id));
  const removedModules = roleDefaultModules.filter((id) => !activeModuleSet.has(id));
  const individualModuleChangesCount = addedModules.length + removedModules.length;

  // Permisos granulares efectivos con el borrador actual
  const draftUserForEffective = {
    ...freshUser,
    customPermissions,
    revokedPermissions,
    assignedRestrictions,
    allowedNavTabs,
  };
  const effectiveResult = getUserEffectivePermissions(draftUserForEffective, allRoles);
  const effectivePermSet = new Set(effectiveResult.effectivePermissions);

  const baseRolePermissions: string[] = Array.isArray((roleObj as any)?.permissions)
    ? (roleObj as any).permissions
    : dbStore.getRolePermissions(freshUser.roleId);
  const baseRolePermSet = new Set(baseRolePermissions);

  const markDirty = (extraInfo?: string) => {
    setHasChanges(true);
    setSaveStatus('idle');
    setNotification(null);
    setErrorMsg(null);
    setInfoNotice(extraInfo || null);
  };

  // Toggle de módulo en la pantalla principal
  const handleToggleModule = (modId: SystemModuleId) => {
    if (!isEditable) return;
    if (!actorAllowedModuleSet.has(modId)) {
      setErrorMsg('No podés habilitar un módulo que tu propia cuenta no posee.');
      return;
    }

    const exists = allowedNavTabs.includes(modId);
    if (exists) {
      if (allowedNavTabs.length <= 1) {
        setErrorMsg('El usuario debe tener al menos un módulo habilitado.');
        return;
      }
      setAllowedNavTabs((prev) => prev.filter((id) => id !== modId));
      markDirty();
    } else {
      setAllowedNavTabs((prev) => normalizeModuleList([...prev, modId]));
      markDirty();
    }
  };

  // Acción rápida: Habilitar todos los módulos disponibles para el actor
  const handleEnableAllModules = () => {
    if (!isEditable) return;
    const allAllowed = ALL_SYSTEM_MODULE_IDS.filter((id) => actorAllowedModuleSet.has(id));
    if (moduleSetsEqual(allowedNavTabs, allAllowed)) {
      setInfoNotice('Este usuario ya tiene todos los módulos habilitados.');
      return;
    }
    setAllowedNavTabs(allAllowed);
    markDirty('Se habilitaron todos los módulos del sistema. Presioná "Guardar Cambios" para confirmar.');
  };

  // Acción rápida: Restablecer a los permisos predeterminados del rol
  const handleResetAllOverrides = () => {
    if (!isEditable) return;
    setIsResetConfirmOpen(true);
  };

  const confirmResetAllOverrides = () => {
    setIsResetConfirmOpen(false);
    setCustomPermissions([]);
    setRevokedPermissions([]);
    setAssignedRestrictions([]);
    setAllowedNavTabs([...roleDefaultModules]);
    setIsCopyPickerOpen(false);
    markDirty(
      `Se restableció la configuración a los valores predeterminados del rol "${roleObj?.name || freshUser.roleId}". Presioná "Guardar Cambios" para confirmar.`
    );
  };

  // Acción rápida: Copiar permisos de otro usuario
  const handleCopyFromUser = (sourceUser: any) => {
    if (!isEditable) return;
    const draft = buildCopyPermissionsDraft({
      sourceUser,
      roles: allRoles,
      actorAllowedModules: actorAllowedModuleSet,
      actorEffectivePermissions: actorEffectivePermData.set,
      actorHasAllPermissions: actorEffectivePermData.hasAll,
    });

    setAllowedNavTabs(draft.allowedNavTabs);
    setCustomPermissions(draft.customPermissions);
    setRevokedPermissions(draft.revokedPermissions);
    setAssignedRestrictions(draft.assignedRestrictions);
    setIsCopyPickerOpen(false);
    setCopySearch('');

    const sourceName = `${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`.trim() || sourceUser.email;
    markDirty(
      `Se copiaron ${draft.allowedNavTabs.length} módulos y ajustes de ${sourceName}. Revisá y presioná "Guardar Cambios" para aplicar.`
    );
  };

  // Permisos granulares avanzados (reutilizados sin crear un sistema paralelo)
  const handleGrantPermission = (permCode: string) => {
    if (!isEditable) {
      setErrorMsg('Solo el Super Administrador puede modificar los permisos de otros usuarios.');
      return;
    }
    if (!actorEffectivePermData.hasAll && !actorEffectivePermData.set.has(permCode)) {
      setErrorMsg('No podés asignar un permiso que tu propia cuenta no posee.');
      return;
    }
    setRevokedPermissions((prev) => prev.filter((p) => p !== permCode));
    if (!customPermissions.includes(permCode) && !baseRolePermSet.has(permCode)) {
      setCustomPermissions((prev) => [...prev, permCode]);
    }
    markDirty();
  };

  const handleRevokePermission = (permCode: string) => {
    if (!isEditable) {
      setErrorMsg('Solo el Super Administrador puede modificar los permisos de otros usuarios.');
      return;
    }
    setCustomPermissions((prev) => prev.filter((p) => p !== permCode));
    if (!revokedPermissions.includes(permCode)) {
      setRevokedPermissions((prev) => [...prev, permCode]);
    }
    markDirty();
  };

  const handleResetToRoleDefault = (permCode: string) => {
    if (!isEditable) return;
    setCustomPermissions((prev) => prev.filter((p) => p !== permCode));
    setRevokedPermissions((prev) => prev.filter((p) => p !== permCode));
    markDirty();
  };

  const handleToggleRestriction = (restId: string) => {
    if (!isEditable) return;
    setAssignedRestrictions((prev) =>
      prev.includes(restId) ? prev.filter((id) => id !== restId) : [...prev, restId]
    );
    markDirty();
  };

  // Guardar permanentemente vía PUT /api/users/:id/permissions
  const handleSave = async () => {
    if (!isEditable || saveStatus === 'saving') return;

    setErrorMsg(null);
    setNotification(null);
    setInfoNotice(null);
    setSaveStatus('saving');

    // Si los módulos seleccionados coinciden exactamente con el rol base, guardar [] ("heredar del rol")
    const navTabsToPersist: string[] = moduleSetsEqual(allowedNavTabs, roleDefaultModules)
      ? []
      : normalizeModuleList(allowedNavTabs);

    try {
      const baseUrl = getApiBaseUrl();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${session.sessionToken}`;
      }

      const response = await fetch(
        `${baseUrl}/api/users/${encodeURIComponent(freshUser.id)}/permissions`,
        {
          method: 'PUT',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            overrides: {
              customPermissions,
              revokedPermissions,
              assignedRestrictions,
              allowedNavTabs: navTabsToPersist,
            },
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success || !data?.user) {
        setSaveStatus('error');
        setErrorMsg(
          data?.error ||
            'No se pudieron guardar los permisos en el servidor. Ningún cambio fue aplicado.'
        );
        return;
      }

      const upserts: Record<string, any[]> = { users: [data.user] };
      if (data.auditLog) {
        upserts.auditLogs = [data.auditLog];
      }
      dbStore.applyAuthoritativeSync(upserts, data.stateVersion);

      const savedUser = data.user;
      const savedResolution = resolveUserEffectiveModules(savedUser, dbStore.getRoles());
      setCustomPermissions(Array.isArray(savedUser.customPermissions) ? [...savedUser.customPermissions] : []);
      setRevokedPermissions(Array.isArray(savedUser.revokedPermissions) ? [...savedUser.revokedPermissions] : []);
      setAssignedRestrictions(Array.isArray(savedUser.assignedRestrictions) ? [...savedUser.assignedRestrictions] : []);
      setAllowedNavTabs([...savedResolution.effectiveModules]);

      const newVersion =
        data.permissionsVersion || savedUser.permissionsVersion || (freshUser.permissionsVersion || 1) + 1;
      setHasChanges(false);
      setSaveStatus('saved');
      setNotification(
        `Guardado correctamente. Los permisos de ${freshUser.firstName} ${freshUser.lastName} se actualizaron (v${newVersion}) y se aplicarán en su sesión en pocos segundos.`
      );
    } catch {
      setSaveStatus('error');
      setErrorMsg(
        'No se pudo conectar con el servidor para guardar los permisos. Verificá tu conexión e intentá nuevamente.'
      );
    }
  };

  const normalizedModuleSearch = moduleSearch.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 md:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[94dvh] md:h-[92vh] max-h-[860px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Encabezado */}
        <div className="px-3.5 md:px-6 py-3 md:py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl md:rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0">
              <Sliders className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  Permisos del Usuario
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
              <p className="text-[11px] sm:text-xs text-slate-300 flex flex-wrap items-center gap-1.5 mt-0.5 truncate">
                <span className="font-semibold text-white">
                  {freshUser.firstName} {freshUser.lastName}
                </span>
                <span className="text-slate-400">({freshUser.email})</span>
                <span>•</span>
                <span className="text-teal-300 font-medium">
                  Rol: {roleObj?.name || freshUser.roleId}
                </span>
                {targetOrg?.name && (
                  <>
                    <span>•</span>
                    <span className="text-slate-300">{targetOrg.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-2">
            {hasChanges && (
              <span className="text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-xl border border-amber-500/50 hidden sm:flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Cambios sin guardar</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saveStatus === 'saving'}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Cerrar ventana de permisos"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Avisos de estado y solo lectura */}
        {!isEditable && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2 shrink-0">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {isSelf
                ? 'Modo solo lectura: por seguridad no podés modificar tus propios permisos.'
                : isTargetSuperAdmin
                ? 'Este usuario tiene rol Super Administrador y posee acceso completo a todos los módulos del sistema.'
                : 'Modo solo lectura: solo el Super Administrador puede modificar los permisos de los usuarios.'}
            </span>
          </div>
        )}
        {saveStatus === 'saving' && (
          <div className="px-6 py-2.5 bg-teal-50 border-b border-teal-200 text-teal-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <Loader2 className="h-4 w-4 text-teal-600 animate-spin shrink-0" />
            <span>Guardando…</span>
          </div>
        )}
        {notification && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
        )}
        {infoNotice && !notification && !errorMsg && (
          <div className="px-6 py-2.5 bg-sky-50 border-b border-sky-200 text-sky-900 text-xs font-medium flex items-center gap-2 shrink-0">
            <Info className="h-4 w-4 text-sky-600 shrink-0" />
            <span>{infoNotice}</span>
          </div>
        )}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Pestañas de navegación (Módulos primero, opciones avanzadas después) */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('modules')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'modules'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-teal-600" />
              <span>Módulos del Sistema</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-800 font-mono font-bold">
                {allowedNavTabs.length}/{SYSTEM_MODULES.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'permissions'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Permisos Avanzados</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {effectivePermSet.size}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('restrictions')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'restrictions'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Ban className="h-3.5 w-3.5 text-rose-600" />
              <span>Restricciones Sanitarias</span>
              {assignedRestrictions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-mono font-bold">
                  {assignedRestrictions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>Resumen</span>
              {(individualModuleChangesCount > 0 || customPermissions.length > 0 || revokedPermissions.length > 0) && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  Ajustes
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1 (PRINCIPAL): MÓDULOS DEL SISTEMA */}
          {activeTab === 'modules' && (
            <div className="space-y-4">
              {/* Resumen de origen y acciones rápidas */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Activá o desactivá los módulos que puede ver {freshUser.firstName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {individualModuleChangesCount === 0 ? (
                        <>
                          Actualmente usa la configuración estándar de su rol{' '}
                          <span className="font-semibold text-slate-800">
                            {roleObj?.name || freshUser.roleId}
                          </span>{' '}
                          ({allowedNavTabs.length} módulos habilitados).
                        </>
                      ) : (
                        <>
                          Tiene{' '}
                          <span className="font-semibold text-teal-800">
                            {individualModuleChangesCount} ajuste(s) individual(es)
                          </span>{' '}
                          respecto al rol {roleObj?.name || freshUser.roleId}
                          {addedModules.length > 0 && ` (+${addedModules.length} agregado/s)`}
                          {removedModules.length > 0 && ` (−${removedModules.length} quitado/s)`}.
                        </>
                      )}
                    </p>
                  </div>

                  {isEditable && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleEnableAllModules}
                        className="px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckSquare className="h-3.5 w-3.5" />
                        <span>Habilitar todos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCopyPickerOpen((prev) => !prev)}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isCopyPickerOpen
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
                        }`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar de otro usuario</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetAllOverrides}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restablecer al rol</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel inline: Copiar permisos de otro usuario */}
                {isEditable && isCopyPickerOpen && (
                  <div className="pt-3 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4 text-indigo-600" />
                        <span>Elegí el usuario del cual querés copiar los módulos y permisos:</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCopyPickerOpen(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={copySearch}
                        onChange={(e) => setCopySearch(e.target.value)}
                        placeholder="Buscar usuario por nombre, correo, rol o empresa..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
                      {copyCandidateUsers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          No hay otros usuarios activos que coincidan con la búsqueda.
                        </div>
                      ) : (
                        copyCandidateUsers.map((candidate) => {
                          const candRole = allRoles.find((r) => r.id === candidate.roleId)?.name || candidate.roleId;
                          const candOrg = allOrganizations.find((o) => o.id === candidate.organizationId)?.name;
                          const candMods = resolveUserEffectiveModules(candidate, allRoles);

                          return (
                            <div
                              key={candidate.id}
                              className="px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-indigo-50/40 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {candidate.firstName} {candidate.lastName}{' '}
                                  <span className="font-normal text-slate-500">({candidate.email})</span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  Rol: <span className="font-medium text-slate-700">{candRole}</span>
                                  {candOrg ? ` • ${candOrg}` : ''} •{' '}
                                  <span className="font-semibold text-teal-700">
                                    {candMods.effectiveModules.length} módulos
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyFromUser(candidate)}
                                className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shrink-0 cursor-pointer"
                              >
                                Copiar
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Buscador rápido de módulos + leyenda de etiquetas */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={moduleSearch}
                      onChange={(e) => setModuleSearch(e.target.value)}
                      placeholder="Filtrar módulos..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                      Del rol
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                      + Agregado individual
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                      − Quitado individual
                    </span>
                  </div>
                </div>
              </div>

              {/* Grupos de Módulos con interruptores claros */}
              <div className="space-y-4">
                {MODULE_GROUPS.map((group) => {
                  const groupModules = SYSTEM_MODULES.filter((mod) => {
                    if (mod.groupId !== group.id) return false;
                    if (!normalizedModuleSearch) return true;
                    return (
                      mod.label.toLowerCase().includes(normalizedModuleSearch) ||
                      mod.description.toLowerCase().includes(normalizedModuleSearch) ||
                      mod.id.toLowerCase().includes(normalizedModuleSearch)
                    );
                  });

                  if (groupModules.length === 0) return null;

                  return (
                    <div key={group.id} className="space-y-2">
                      <div className="px-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                        {group.label}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {groupModules.map((mod) => {
                          const isEnabled = activeModuleSet.has(mod.id);
                          const isRoleDefault = roleDefaultSet.has(mod.id);
                          const isAddedOverride = isEnabled && !isRoleDefault;
                          const isRemovedOverride = !isEnabled && isRoleDefault;
                          const actorOwnsModule = actorAllowedModuleSet.has(mod.id);
                          const canToggle = isEditable && actorOwnsModule;

                          return (
                            <div
                              key={mod.id}
                              onClick={() => canToggle && handleToggleModule(mod.id)}
                              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                                canToggle ? 'cursor-pointer' : 'cursor-default'
                              } ${
                                isAddedOverride
                                  ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                                  : isRemovedOverride
                                  ? 'bg-amber-50/50 border-amber-300'
                                  : isEnabled
                                  ? 'bg-white border-teal-200 shadow-2xs hover:border-teal-300'
                                  : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`text-xs font-bold ${
                                      isEnabled ? 'text-slate-900' : 'text-slate-500'
                                    }`}
                                  >
                                    {mod.label}
                                  </span>

                                  {isAddedOverride ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      + Agregado individual
                                    </span>
                                  ) : isRemovedOverride ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                      − Quitado individual
                                    </span>
                                  ) : isEnabled ? (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                      Del rol
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">
                                      No incluido en el rol
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-slate-500 leading-snug">
                                  {mod.description}
                                </p>
                              </div>

                              {/* Interruptor ON / OFF */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isEnabled}
                                aria-label={`${isEnabled ? 'Deshabilitar' : 'Habilitar'} ${mod.label}`}
                                disabled={!canToggle}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canToggle) handleToggleModule(mod.id);
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                  isEnabled ? 'bg-teal-600' : 'bg-slate-300'
                                } ${canToggle ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
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

          {/* TAB 2 (AVANZADO): ACCIONES Y PERMISOS GRANULARES EXISTENTES */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  Ajuste fino opcional por acción (ver, crear, editar, eliminar). Para la gestión diaria de qué pantallas ve el usuario, utilizá la pestaña{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('modules')}
                    className="font-bold text-teal-700 underline cursor-pointer"
                  >
                    Módulos del Sistema
                  </button>
                  .
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className="relative flex-1 min-w-0 w-full md:w-auto md:min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar acción por nombre, código o área..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none min-h-[44px] md:min-h-0"
                  />
                </div>

                <select
                  value={selectedModuleCategory}
                  onChange={(e) => setSelectedModuleCategory(e.target.value)}
                  className="w-full md:w-auto px-3 py-2 text-base md:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none min-h-[44px] md:min-h-0"
                >
                  <option value="ALL">Todas las áreas</option>
                  {SYSTEM_PERMISSION_MODULES.map((m) => (
                    <option key={m.category} value={m.category}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full md:w-auto px-3 py-2 text-base md:text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 outline-none min-h-[44px] md:min-h-0"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="ALLOWED">Autorizados</option>
                  <option value="REVOKED">Revocados individualmente</option>
                  <option value="CUSTOM">Concedidos individualmente</option>
                </select>
              </div>

              <div className="space-y-4">
                {SYSTEM_PERMISSION_MODULES.filter(
                  (m) => selectedModuleCategory === 'ALL' || m.category === selectedModuleCategory
                ).map((mod) => {
                  const filteredPerms = mod.permissions.filter((p) => {
                    const q = searchQuery.toLowerCase();
                    const matchesSearch =
                      !q ||
                      p.name.toLowerCase().includes(q) ||
                      p.code.toLowerCase().includes(q) ||
                      p.description.toLowerCase().includes(q);
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
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <span>{mod.name}</span>
                          <span className="text-[10px] font-normal text-slate-500 lowercase">
                            ({filteredPerms.length} acciones)
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{mod.description}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {filteredPerms.map((perm) => {
                          const isCustomGrant = customPermissions.includes(perm.code);
                          const isExplicitlyRevoked = revokedPermissions.includes(perm.code);
                          const isEffective = effectivePermSet.has(perm.code);

                          const blockingRestriction = assignedRestrictions.find((restId) => {
                            const rDef = REGULATORY_RESTRICTIONS_CATALOG.find(
                              (r) => r.id === restId || r.code === restId
                            );
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
                                  <div className="shrink-0">
                                    {isExplicitlyRevoked ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                        Revocado
                                      </span>
                                    ) : blockingRestriction ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                        Restringido
                                      </span>
                                    ) : isEffective ? (
                                      isCustomGrant ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          Individual
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                          Del rol
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-200 text-slate-500">
                                        No autorizado
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {perm.code}
                                </div>
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                  {perm.description}
                                </p>
                              </div>

                              {isEditable && (
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                                  {isExplicitlyRevoked || isCustomGrant ? (
                                    <button
                                      type="button"
                                      onClick={() => handleResetToRoleDefault(perm.code)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="h-3 w-3 text-slate-500" />
                                      <span>Volver al rol</span>
                                    </button>
                                  ) : isEffective ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokePermission(perm.code)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <Ban className="h-3 w-3 text-rose-600" />
                                      <span>Quitar</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleGrantPermission(perm.code)}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="h-3 w-3 text-teal-600" />
                                      <span>Habilitar</span>
                                    </button>
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

          {/* TAB 3: RESTRICCIONES SANITARIAS MSPBS */}
          {activeTab === 'restrictions' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950 mb-1">
                    Restricciones Sanitarias y Legales (MSPBS)
                  </h4>
                  <p>
                    Cuando activás una restricción para este usuario, bloquea automáticamente las acciones indicadas incluso si su rol las incluye.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {REGULATORY_RESTRICTIONS_CATALOG.map((rest) => {
                  const isActive =
                    assignedRestrictions.includes(rest.id) || assignedRestrictions.includes(rest.code);

                  return (
                    <div
                      key={rest.id}
                      className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                        isActive ? 'bg-rose-50/70 border-rose-300 shadow-2xs' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {rest.category}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900">{rest.name}</h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{rest.description}</p>
                        <div className="text-[11px] text-slate-500 pt-0.5">
                          Base legal: <span className="font-mono text-slate-700">{rest.regulatoryStandard}</span>
                        </div>
                      </div>

                      {isEditable && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isActive}
                          onClick={() => handleToggleRestriction(rest.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                            isActive ? 'bg-rose-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: RESUMEN DE CAMBIOS Y AUDITORÍA */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-teal-700 font-mono">
                    {allowedNavTabs.length}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mt-1">
                    Módulos activos
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700 font-mono">
                    +{addedModules.length}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mt-1">
                    Módulos extra
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700 font-mono">
                    −{removedModules.length}
                  </div>
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mt-1">
                    Módulos quitados
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700 font-mono">
                    {assignedRestrictions.length}
                  </div>
                  <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider mt-1">
                    Restricciones
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-teal-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-300">
                      Detalle de configuración que se guardará
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    v{freshUser.permissionsVersion || 1} → v{(freshUser.permissionsVersion || 1) + (hasChanges ? 1 : 0)}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <div>
                    <span className="text-slate-400">Usuario:</span>{' '}
                    <span className="text-white font-semibold">
                      {freshUser.firstName} {freshUser.lastName} ({freshUser.email})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Rol base:</span>{' '}
                    <span className="text-teal-300 font-semibold">{roleObj?.name || freshUser.roleId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Módulos visibles ({allowedNavTabs.length}):</span>{' '}
                    <span className="text-slate-100">
                      {allowedNavTabs.map((id) => getModuleById(id)?.label || id).join(', ')}
                    </span>
                  </div>
                  {addedModules.length > 0 && (
                    <div>
                      <span className="text-emerald-400">Agregados respecto al rol:</span>{' '}
                      <span className="text-emerald-200">
                        {addedModules.map((id) => getModuleById(id)?.label || id).join(', ')}
                      </span>
                    </div>
                  )}
                  {removedModules.length > 0 && (
                    <div>
                      <span className="text-amber-400">Quitados respecto al rol:</span>{' '}
                      <span className="text-amber-200">
                        {removedModules.map((id) => getModuleById(id)?.label || id).join(', ')}
                      </span>
                    </div>
                  )}
                  {customPermissions.length > 0 && (
                    <div>
                      <span className="text-emerald-400">Permisos avanzados concedidos:</span>{' '}
                      <span className="font-mono text-emerald-200">{customPermissions.join(', ')}</span>
                    </div>
                  )}
                  {revokedPermissions.length > 0 && (
                    <div>
                      <span className="text-rose-400">Permisos avanzados revocados:</span>{' '}
                      <span className="font-mono text-rose-200">{revokedPermissions.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie con estado claro y botón Guardar */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-slate-500">
            {saveStatus === 'saving' ? (
              <span className="font-semibold text-teal-700 flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Guardando…</span>
              </span>
            ) : saveStatus === 'error' ? (
              <span className="font-semibold text-rose-700 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Error al guardar. Los cambios no se aplicaron.</span>
              </span>
            ) : saveStatus === 'saved' && !hasChanges ? (
              <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Guardado correctamente.</span>
              </span>
            ) : hasChanges ? (
              <span className="font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Tenés cambios pendientes de guardar.</span>
              </span>
            ) : (
              <span className="text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Permisos al día ({allowedNavTabs.length} módulos activos).</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saveStatus === 'saving'}
              className="flex-1 sm:flex-none px-4 py-2.5 min-h-[42px] text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              Cerrar
            </button>

            {isEditable && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || saveStatus === 'saving'}
                className={`flex-1 sm:flex-none px-5 py-2.5 min-h-[42px] text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs ${
                  hasChanges && saveStatus !== 'saving'
                    ? 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer hover:shadow-md'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Guardando…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 shrink-0" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Restablecer a los permisos del rol"
        message={`¿Querés quitar los ajustes individuales de ${freshUser.firstName} ${freshUser.lastName} y dejarlo exactamente con los módulos y permisos del rol "${roleObj?.name || freshUser.roleId}"?`}
        confirmLabel="Sí, restablecer"
        variant="warning"
        onConfirm={confirmResetAllOverrides}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
