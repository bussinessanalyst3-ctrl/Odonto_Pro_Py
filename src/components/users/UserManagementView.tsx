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
import { Sliders } from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { session } = useAuth();
  const [, setTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');

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
    setNotification(`Bloqueo de seguridad eliminado para ${user.firstName} ${user.lastName} (${user.email}).`);
    setTimeout(() => setNotification(null), 5000);
  };

  const snapshot = dbStore.getSnapshot(actor);
  const users = dbStore.getUsers(undefined, actor);
  const branches = dbStore.getBranches(actor);
  const userBranches = snapshot.userBranches;
  const allRoles = dbStore.getRoles();

  // Ocultar SUPER_ADMIN en opciones de filtro para no-SUPER_ADMIN
  const availableRoles = allRoles.filter((r) => {
    if (!session || session.role === 'SUPER_ADMIN') return true;
    return !isSuperAdminRole(r.id);
  });

  const canCreateUser =
    session?.role === 'SUPER_ADMIN' ||
    hasPermission(session?.role || '', 'users.create') ||
    hasPermission(session?.role || '', 'users.create_operational');

  const canManageRolesAuthority =
    session?.role === 'SUPER_ADMIN' ||
    hasPermission(session?.role || '', 'roles.manage');

  const canManageUserSecurity =
    session?.role === 'SUPER_ADMIN' ||
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

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.specialty && u.specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.professionalLicense && u.professionalLicense.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || u.roleId === roleFilter;

    const userBranchIds = userBranches.filter((ub) => ub.userId === u.id).map((ub) => ub.branchId);
    const matchesBranch =
      branchFilter === 'ALL' || userBranchIds.includes(branchFilter);

    return matchesSearch && matchesRole && matchesBranch;
  });

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const odontologistsCount = users.filter((u) => u.roleId === 'ODONTOLOGO').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Equipo Clínico & Control de Acceso (RBAC)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Seguridad Criptográfica PBKDF2
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Administración de cuentas de odontólogos, recepcionistas, cajeros y habilitación
                sanitaria según normativas del MSPBS de Paraguay.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManageRolesAuthority && (
              <button
                onClick={() => setIsManageRolesModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Shield className="h-3.5 w-3.5 text-teal-700" />
                <span>Autoridad de Roles</span>
              </button>
            )}

            <button
              onClick={() => setIsPermissionsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Matriz de Permisos</span>
            </button>

            {canCreateUser && (
              <button
                onClick={handleOpenAddUser}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <UserPlus className="h-4 w-4" />
                <span>Nuevo Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Personal Total</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{users.length} Colaboradores</div>
            <div className="text-[11px] text-emerald-600 font-semibold">{activeCount} Activos</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Cuerpo Odontológico</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{odontologistsCount} Odontólogos</div>
            <div className="text-[11px] text-teal-700 font-semibold">Reg. MSPBS Verificados</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Sucursales Vinculadas</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{branches.length} Sucursales</div>
            <div className="text-[11px] text-slate-500">Asignación Granular</div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase">Seguridad & Ley 1682/01</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">RBAC Estricto</div>
            <div className="text-[11px] text-emerald-700">Protección de Datos Médicos</div>
          </div>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Error notification toast */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, especialidad o Registro MSPBS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Todos los Roles</option>
            {availableRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
          >
            <option value="ALL">Todas las Sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* User Cards / Table */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center shadow-xs">
          <div className="h-16 w-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No se encontraron funcionarios registrados en esta empresa
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            Esta organización mantiene aislamiento estricto de sus colaboradores y no comparte funcionarios con otras entidades. Puede dar de alta al administrador de sede, odontólogos y equipo asistencial.
          </p>
          {canCreateUser && (
            <button
              onClick={handleOpenAddUser}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-700/20"
            >
              <UserPlus className="h-4 w-4" />
              <span>Crear Primer Funcionario</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredUsers.map((u) => {
          const userBranchRecords = userBranches.filter((ub) => ub.userId === u.id);
          const assignedBranches = branches.filter((b) =>
            userBranchRecords.some((ub) => ub.branchId === b.id)
          );
          const defaultBranch = assignedBranches.find(
            (b) => userBranchRecords.find((ub) => ub.branchId === b.id)?.isDefault
          );
          const roleObj = BASE_ROLES.find((r) => r.id === u.roleId);

          const isSelf = session?.userId === u.id;
          const isSuperAdmin = session?.role === 'SUPER_ADMIN';
          const canEditUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && (isSelf || canManageRole(session?.role || '', u.roleId)));
          const canToggleUser = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && !isSelf && canManageRole(session?.role || '', u.roleId));
          const canResetPwd = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));
          const canRevokeSess = isSuperAdmin || (u.roleId !== 'SUPER_ADMIN' && canManageRole(session?.role || '', u.roleId));

          return (
            <div
              key={u.id}
              className={`bg-white rounded-3xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                u.status === 'ACTIVE'
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200 bg-slate-50/60 opacity-75'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
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
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                    {u.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {u.firstName} {u.lastName}
                </h3>

                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  {u.specialty || 'General'}
                </div>

                {/* MSPBS badge if Odontologist */}
                {u.professionalLicense && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                    <Award className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    <span>{u.professionalLicense}</span>
                  </div>
                )}

                {/* Contact info */}
                <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{u.phone}</span>
                  </div>
                </div>

                {/* Assigned branches tags */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <span>Sucursales Autorizadas ({assignedBranches.length})</span>
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

              {/* Action buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  {canToggleUser && (
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u.id)}
                      title={u.status === 'ACTIVE' ? 'Desactivar usuario' : 'Activar usuario'}
                      className={`p-2 rounded-xl border transition-colors ${
                        u.status === 'ACTIVE'
                          ? 'border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canResetPwd && (
                    <button
                      type="button"
                      onClick={() => handleOpenResetPassword(u)}
                      title="Restablecer o cambiar contraseña institucional"
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canRevokeSess && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSessions(u)}
                      title="Revocar inmediatamente todas las sesiones activas de este usuario"
                      className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canManageUserSecurity && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserForPermissions(u);
                        setIsUserPermissionsModalOpen(true);
                      }}
                      title="Gobernanza de permisos dinámicos, módulos visibles y restricciones sanitarias MSPBS"
                      className="p-2 rounded-xl border border-teal-200 text-teal-700 bg-teal-50/80 hover:bg-teal-100 transition-colors"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {authService.isLockedOut(u.email).locked && (
                    <button
                      type="button"
                      onClick={() => handleUnlockUser(u)}
                      title="Desbloquear intentos de acceso fallidos"
                      className="p-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors animate-pulse"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {canEditUser && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditUser(u)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs flex items-center gap-1"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Modals */}
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        userToEdit={userToEdit}
        actor={actor}
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
          setTimeout(() => setNotification(null), 6000);
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
