import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Award,
  Search,
  Building2,
  Phone,
  Mail,
  KeyRound,
  Power,
  Edit2,
  CheckCircle2,
  ShieldCheck,
  Filter,
  RefreshCw,
  LogOut,
  Unlock,
  AlertTriangle,
  Sliders,
  AtSign,
  Building,
  LayoutGrid,
  List,
  X,
  Lock,
  RotateCcw
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { BASE_ROLES } from '../../db/seeds/paraguay-catalogs.ts';
import { authService } from '../../auth/authService.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { canManageRole, isSuperAdminRole, hasPermission } from '../../security/rbacHierarchy.ts';
import { UserModal } from './UserModal.tsx';
import { RolePermissionsModal } from './RolePermissionsModal.tsx';
import { ManageRolesModal } from './ManageRolesModal.tsx';
import { ResetPasswordModal } from './ResetPasswordModal.tsx';
import { UserPermissionsModal } from './UserPermissionsModal.tsx';

export const UserManagementView: React.FC = () => {
  const { session } = useAuth();
  const [, setTick] = useState(0);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [orgFilter, setOrgFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modales
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isManageRolesModalOpen, setIsManageRolesModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [userToResetPassword, setUserToResetPassword] = useState<any | null>(null);
  const [isUserPermissionsModalOpen, setIsUserPermissionsModalOpen] = useState(false);
  const [userForPermissions, setUserForPermissions] = useState<any | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const actor = session
    ? {
        userId: session.userId,
        role: session.role,
        organizationId: session.organizationId,
        allowedBranchIds: session.allowedBranchIds,
      }
    : undefined;

  const handleRevokeSessions = (user: any) => {
    const confirm = window.confirm(
      `¿Está seguro de revocar inmediatamente todas las sesiones activas de ${user.firstName} ${user.lastName}? El usuario deberá volver a autenticarse.`
    );
    if (!confirm) return;

    try {
      dbStore.revokeUserSessions(user.id, session?.userId);
      setNotification(`Sesiones activas revocadas exitosamente para ${user.firstName} ${user.lastName}.`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al revocar sesiones activas.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleUnlockUser = (user: any) => {
    authService.resetFailedAttempts(user.email);
    if (user.username) {
      authService.resetFailedAttempts(user.username);
    }
    setNotification(`Bloqueo de seguridad eliminado para ${user.firstName} ${user.lastName}.`);
    setTimeout(() => setNotification(null), 5000);
  };

  const snapshot = dbStore.getSnapshot(actor);
  const users = dbStore.getUsers(undefined, actor);
  const organizations = dbStore.getOrganizations();
  const branches = dbStore.getBranches(actor);
  const userBranches = snapshot.userBranches;
  const allRoles = dbStore.getRoles();

  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  // Ocultar SUPER_ADMIN en opciones de filtro para no-SUPER_ADMIN
  const availableRoles = allRoles.filter((r) => {
    if (!session || isSuperAdmin) return true;
    return !isSuperAdminRole(r.id);
  });

  const canCreateUser =
    isSuperAdmin ||
    hasPermission(session?.role || '', 'users.create') ||
    hasPermission(session?.role || '', 'users.create_operational');

  const canManageRolesAuthority =
    isSuperAdmin ||
    hasPermission(session?.role || '', 'roles.manage');

  const canManageUserSecurity =
    isSuperAdmin ||
    hasPermission(session?.role || '', 'roles.manage') ||
    hasPermission(session?.role || '', 'users.update') ||
    hasPermission(session?.role || '', 'users.edit');

  const handleOpenAddUser = () => {
    if (!canCreateUser) {
      setErrorMessage('403 Prohibido: No tiene autorización suficiente para crear usuarios.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    setUserToEdit(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: any) => {
    setUserToEdit(user);
    setIsUserModalOpen(true);
  };

  const handleToggleStatus = (userId: string) => {
    try {
      dbStore.toggleUserStatus(userId, actor);
      setNotification('Estado de acceso actualizado exitosamente.');
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al modificar estado del usuario.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleOpenResetPassword = (user: any) => {
    setUserToResetPassword(user);
    setIsResetPasswordModalOpen(true);
  };

  const handleOpenUserPermissions = (user: any) => {
    setUserForPermissions(user);
    setIsUserPermissionsModalOpen(true);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setOrgFilter('ALL');
    setBranchFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters = searchTerm || roleFilter !== 'ALL' || orgFilter !== 'ALL' || branchFilter !== 'ALL' || statusFilter !== 'ALL';

  // Filtrado integral por Nombre, Correo, Username, Rol, Empresa, Sucursal y Estado
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      u.firstName.toLowerCase().includes(term) ||
      u.lastName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.specialty && u.specialty.toLowerCase().includes(term)) ||
      (u.professionalLicense && u.professionalLicense.toLowerCase().includes(term));

    const matchesRole = roleFilter === 'ALL' || u.roleId === roleFilter;
    const matchesOrg = orgFilter === 'ALL' || u.organizationId === orgFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    const userBranchIds = userBranches.filter((ub) => ub.userId === u.id).map((ub) => ub.branchId);
    const matchesBranch =
      branchFilter === 'ALL' || userBranchIds.includes(branchFilter);

    return matchesSearch && matchesRole && matchesOrg && matchesBranch && matchesStatus;
  });

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const inactiveCount = users.filter((u) => u.status === 'INACTIVE').length;
  const odontologistsCount = users.filter((u) => u.roleId === 'ODONTOLOGO').length;

  return (
    <div className="space-y-5">
      {/* Top Banner & Header Responsive */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  Equipo Clínico & Control de Acceso (RBAC)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Seguridad Criptográfica PBKDF2
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Administración de cuentas con correo institucional, nombre de usuario (@username), asignación de empresas y normativas del MSPBS.
              </p>
            </div>
          </div>

          {/* Action buttons (responsive stack on mobile) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            {canManageRolesAuthority && (
              <button
                onClick={() => setIsManageRolesModalOpen(true)}
                className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5 text-teal-700" />
                <span>Autoridad de Roles</span>
              </button>
            )}

            <button
              onClick={() => setIsPermissionsModalOpen(true)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Matriz de Permisos</span>
            </button>

            {canCreateUser && (
              <button
                onClick={handleOpenAddUser}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Crear Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI stats (2 cols mobile, 4 cols desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Personal Total</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{users.length} Colaboradores</div>
            <div className="text-[11px] text-emerald-600 font-semibold">{activeCount} Activos • {inactiveCount} Inactivos</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cuerpo Odontológico</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{odontologistsCount} Odontólogos</div>
            <div className="text-[11px] text-teal-700 font-semibold">Reg. MSPBS Obligatorio</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Empresas & Sedes</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">{organizations.length} Empresas</div>
            <div className="text-[11px] text-slate-500 font-medium">{branches.length} Sucursales vinculadas</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seguridad Institucional</div>
            <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">Control de Roles</div>
            <div className="text-[11px] text-emerald-700 font-semibold">Login Dual @user / correo</div>
          </div>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Error notification toast */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-700 hover:text-rose-900 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Comprehensive Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3 shadow-xs">
        {/* Input de Búsqueda y Selector de Vista */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, @usuario, especialidad o Registro MSPBS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-medium text-slate-900"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Toggle de Vista: Tarjetas vs Tabla */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Vista de Tarjetas Adaptable"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Tarjetas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Vista de Tabla Detallada"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Tabla</span>
              </button>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors inline-flex items-center gap-1"
                title="Limpiar todos los filtros"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns de Filtro: Rol, Empresa, Sucursal y Estado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rol</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">Todos los Roles ({availableRoles.length})</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Empresa</label>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">Todas las Empresas ({organizations.length})</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sucursal</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">Todas las Sedes ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Solo Activos ({activeCount})</option>
              <option value="INACTIVE">Solo Inactivos ({inactiveCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* User Content: Empty State, Cards View or Table View */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No se encontraron usuarios con los criterios seleccionados
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            {hasActiveFilters
              ? 'Prueba restableciendo los filtros de búsqueda, rol, empresa o estado para visualizar los funcionarios.'
              : 'Esta organización mantiene aislamiento de sus colaboradores. Puede dar de alta al administrador de sede, odontólogos y equipo asistencial.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          ) : canCreateUser ? (
            <button
              onClick={handleOpenAddUser}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-700/20 cursor-pointer min-h-[44px]"
            >
              <UserPlus className="h-4 w-4" />
              <span>Crear Primer Funcionario</span>
            </button>
          ) : null}
        </div>
      ) : viewMode === 'table' ? (
        /* VISTA DE TABLA RESPONSIVA */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Aviso responsivo en móvil */}
          <div className="md:hidden px-4 py-2 bg-teal-50/60 border-b border-teal-100 text-[11px] text-teal-800 flex items-center justify-between">
            <span>Desliza lateralmente para ver todas las columnas</span>
            <button
              onClick={() => setViewMode('cards')}
              className="font-bold underline text-teal-900"
            >
              Ver en Tarjetas
            </button>
          </div>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Usuario / Funcionario</th>
                  <th className="py-3 px-3">Rol & Especialidad</th>
                  <th className="py-3 px-3">Empresa & Sedes</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.map((u) => {
                  const userBranchRecords = userBranches.filter((ub) => ub.userId === u.id);
                  const assignedBranches = branches.filter((b) =>
                    userBranchRecords.some((ub) => ub.branchId === b.id)
                  );
                  const roleObj = BASE_ROLES.find((r) => r.id === u.roleId);
                  const userOrg = organizations.find((o) => o.id === u.organizationId);

                  const isSelf = session?.userId === u.id;
                  const canEditUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && (isSelf || canManageRole(session?.role || '', u.roleId)));
                  const canToggleUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && !isSelf && canManageRole(session?.role || '', u.roleId));
                  const canResetPwd = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));
                  const canRevokeSess = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Usuario */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {u.firstName?.[0] || 'U'}{u.lastName?.[0] || ''}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 leading-tight">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-[11px] text-teal-700 font-mono flex items-center gap-1">
                              <span>@{u.username || u.email?.split('@')[0]}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.roleId === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.roleId === 'ODONTOLOGO'
                              ? 'bg-teal-100 text-teal-800'
                              : u.roleId === 'CAJA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {roleObj?.name || u.roleId}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">{u.specialty || 'General'}</div>
                        {u.professionalLicense && (
                          <div className="text-[10px] font-mono text-amber-800 font-semibold mt-0.5">
                            {u.professionalLicense}
                          </div>
                        )}
                      </td>

                      {/* Empresa y Sedes */}
                      <td className="py-3.5 px-3">
                        {isSuperAdmin && userOrg && (
                          <div className="text-xs font-semibold text-slate-800 mb-0.5 truncate max-w-[160px]">
                            {userOrg.name}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {assignedBranches.slice(0, 2).map((b) => (
                            <span key={b.id} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {b.name.replace('Sucursal ', '')}
                            </span>
                          ))}
                          {assignedBranches.length > 2 && (
                            <span className="text-[10px] font-bold text-slate-400">+{assignedBranches.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                          {u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditUser && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              title="Editar usuario"
                              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {canToggleUser && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u.id)}
                              title={u.status === 'ACTIVE' ? 'Desactivar usuario' : 'Activar usuario'}
                              className={`p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                                u.status === 'ACTIVE'
                                  ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          )}

                          {canResetPwd && (
                            <button
                              type="button"
                              onClick={() => handleOpenResetPassword(u)}
                              title="Restablecer contraseña"
                              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          )}

                          {canManageUserSecurity && (
                            <button
                              type="button"
                              onClick={() => handleOpenUserPermissions(u)}
                              title="Gobernanza de permisos y restricciones MSPBS"
                              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors cursor-pointer"
                            >
                              <Sliders className="h-4 w-4" />
                            </button>
                          )}

                          {canRevokeSess && (
                            <button
                              type="button"
                              onClick={() => handleRevokeSessions(u)}
                              title="Revocar sesiones activas"
                              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <LogOut className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA DE TARJETAS RESPONSIVAS (Ideal para Móvil, Tablet y Desktop) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const userBranchRecords = userBranches.filter((ub) => ub.userId === u.id);
            const assignedBranches = branches.filter((b) =>
              userBranchRecords.some((ub) => ub.branchId === b.id)
            );
            const defaultBranch = assignedBranches.find(
              (b) => userBranchRecords.find((ub) => ub.branchId === b.id)?.isDefault
            );
            const roleObj = BASE_ROLES.find((r) => r.id === u.roleId);
            const userOrg = organizations.find((o) => o.id === u.organizationId);

            const isSelf = session?.userId === u.id;
            const canEditUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && (isSelf || canManageRole(session?.role || '', u.roleId)));
            const canToggleUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && !isSelf && canManageRole(session?.role || '', u.roleId));
            const canResetPwd = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));
            const canRevokeSess = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));

            return (
              <div
                key={u.id}
                className={`bg-white rounded-3xl border transition-all p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
                  u.status === 'ACTIVE'
                    ? 'border-slate-200 hover:border-slate-300'
                    : 'border-slate-200 bg-slate-50/70 opacity-80'
                }`}
              >
                <div>
                  {/* Card Header: Role & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.roleId === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : u.roleId === 'ODONTOLOGO'
                          ? 'bg-teal-100 text-teal-800'
                          : u.roleId === 'CAJA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {roleObj?.name || u.roleId}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      ></span>
                      {u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {/* Name and @username */}
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {u.firstName?.[0] || 'U'}{u.lastName?.[0] || ''}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 leading-tight truncate">
                        {u.firstName} {u.lastName}
                      </h3>
                      <div className="text-xs text-teal-700 font-mono font-semibold flex items-center gap-1 mt-0.5">
                        <AtSign className="h-3 w-3 text-teal-600 shrink-0" />
                        <span className="truncate">{u.username || u.email?.split('@')[0]}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {u.specialty || 'General'}
                      </div>
                    </div>
                  </div>

                  {/* Organization (Multi-tenant badge) */}
                  {isSuperAdmin && userOrg && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
                      <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{userOrg.name}</span>
                    </div>
                  )}

                  {/* MSPBS badge if Odontologist */}
                  {u.professionalLicense && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                      <Award className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">{u.professionalLicense}</span>
                    </div>
                  )}

                  {/* Contact info */}
                  <div className="mt-3 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Assigned branches tags */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      <span>Sucursales Asignadas ({assignedBranches.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {assignedBranches.map((b) => {
                        const isDefault = defaultBranch?.id === b.id;
                        return (
                          <span
                            key={b.id}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                              isDefault
                                ? 'bg-teal-50 border-teal-200 text-teal-800'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {b.name.replace('Sucursal ', '')} {isDefault && '★'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Action buttons (Touch-friendly 44px+ for mobile and tablet) */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {canToggleUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u.id)}
                        title={u.status === 'ACTIVE' ? 'Desactivar usuario' : 'Activar usuario'}
                        className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          u.status === 'ACTIVE'
                            ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50'
                        }`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    )}

                    {canResetPwd && (
                      <button
                        type="button"
                        onClick={() => handleOpenResetPassword(u)}
                        title="Restablecer o cambiar contraseña institucional"
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    )}

                    {canRevokeSess && (
                      <button
                        type="button"
                        onClick={() => handleRevokeSessions(u)}
                        title="Revocar inmediatamente todas las sesiones activas"
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    )}

                    {canManageUserSecurity && (
                      <button
                        type="button"
                        onClick={() => handleOpenUserPermissions(u)}
                        title="Gobernanza de permisos dinámicos y restricciones sanitarias MSPBS"
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer"
                      >
                        <Sliders className="h-4 w-4" />
                      </button>
                    )}

                    {authService.isLockedOut(u.email).locked && (
                      <button
                        type="button"
                        onClick={() => handleUnlockUser(u)}
                        title="Desbloquear cuenta bloqueada por intentos fallidos"
                        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer animate-pulse"
                      >
                        <Unlock className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {canEditUser && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditUser(u)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-teal-700" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userToEdit={userToEdit}
        actor={actor}
        onOpenPermissions={handleOpenUserPermissions}
        onOpenResetPassword={handleOpenResetPassword}
      />

      <RolePermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        actor={actor}
      />

      <ManageRolesModal
        isOpen={isManageRolesModalOpen}
        onClose={() => setIsManageRolesModalOpen(false)}
        actor={actor}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setUserToResetPassword(null);
        }}
        user={userToResetPassword}
        onSuccess={(msg) => {
          setNotification(msg);
          setTimeout(() => setNotification(null), 5000);
        }}
      />

      <UserPermissionsModal
        isOpen={isUserPermissionsModalOpen}
        onClose={() => {
          setIsUserPermissionsModalOpen(false);
          setUserForPermissions(null);
        }}
        targetUser={userForPermissions}
        actor={actor}
      />
    </div>
  );
};
