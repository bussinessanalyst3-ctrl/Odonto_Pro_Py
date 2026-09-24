import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldPlus,
  Shield,
  Check,
  AlertCircle,
  Trash2,
  Edit2,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';

interface ManageRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_MODULES = [
  { id: 'dashboard', name: 'Dashboard & Métricas', category: 'General' },
  { id: 'appointments', name: 'Agenda de Citas & Turnos', category: 'Operación' },
  { id: 'patients', name: 'Fichas de Pacientes & Anamnesis', category: 'Operación' },
  { id: 'odontogram', name: 'Odontograma FDI & Patologías', category: 'Clínica' },
  { id: 'treatments', name: 'Planes & Evolución Clínica', category: 'Clínica' },
  { id: 'clinical', name: 'Historias Clínicas & Ley 1682/01', category: 'Clínica' },
  { id: 'quotes', name: 'Presupuestos & Ventas de Servicios', category: 'Administración' },
  { id: 'cash', name: 'Caja, Facturación & Cobros (PYG)', category: 'Administración' },
  { id: 'branches', name: 'Sucursales & Sillones Dentales', category: 'Sistema' },
  { id: 'users', name: 'Equipo Médico & Gestión de Roles', category: 'Sistema' },
  { id: 'audit', name: 'Auditoría Forense & Logs', category: 'Sistema' },
];

export const ManageRolesModal: React.FC<ManageRolesModalProps> = ({ isOpen, onClose }) => {
  const [, setTick] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // Form states
  const [roleCode, setRoleCode] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>(['dashboard', 'quotes', 'patients']);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  if (!isOpen) return null;

  const roles = dbStore.getRoles();

  const handleStartCreate = () => {
    setEditingRoleId(null);
    setRoleCode('');
    setRoleName('');
    setRoleDescription('');
    setSelectedModules(['dashboard', 'quotes', 'patients']);
    setError(null);
    setIsCreating(true);
  };

  const handleStartEdit = (role: any) => {
    setEditingRoleId(role.id);
    setRoleCode(role.id);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedModules(role.allowedNavTabs || []);
    setError(null);
    setIsCreating(true);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingRoleId(null);
    setError(null);
  };

  const handleToggleModule = (modId: string) => {
    if (selectedModules.includes(modId)) {
      if (selectedModules.length === 1) return; // al menos 1
      setSelectedModules(selectedModules.filter((m) => m !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!roleName.trim()) {
      setError('El nombre del rol es obligatorio.');
      return;
    }

    try {
      if (editingRoleId) {
        // Actualizar rol
        dbStore.updateRole(editingRoleId, {
          name: roleName,
          description: roleDescription,
          allowedNavTabs: selectedModules,
        });
        setSuccessMsg(`Rol "${roleName}" actualizado con éxito`);
      } else {
        // Crear nuevo rol
        if (!roleCode.trim()) {
          setError('El código único del rol es obligatorio (ej. VENDEDOR_SENIOR).');
          return;
        }
        dbStore.addRole({
          id: roleCode,
          name: roleName,
          description: roleDescription,
          allowedNavTabs: selectedModules,
        });
        setSuccessMsg(`Rol "${roleName}" creado y habilitado en el sistema`);
      }

      setTimeout(() => setSuccessMsg(null), 3500);
      setIsCreating(false);
      setEditingRoleId(null);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el rol');
    }
  };

  const handleDeleteRole = (roleId: string, roleTitle: string) => {
    if (confirm(`¿Estás seguro de eliminar el rol "${roleTitle}"? Esta acción no se puede deshacer.`)) {
      try {
        dbStore.deleteRole(roleId);
        setSuccessMsg(`Rol "${roleTitle}" eliminado del sistema`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } catch (err: any) {
        setError(err?.message || 'No se pudo eliminar el rol');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
              <ShieldPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Autoridad de Roles y Permisos (RBAC Dinámico)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  {roles.length} Roles Activos
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Crea roles a medida (ej. Vendedor de Servicios, Supervisor) y define a qué módulos tienen acceso.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notificaciones */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Formulario de Creación / Edición */}
          {isCreating ? (
            <form onSubmit={handleSaveRole} className="p-5 rounded-2xl border border-teal-200 bg-teal-50/40 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-teal-100">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
                  <Sparkles className="h-4 w-4 text-teal-600" />
                  <span>{editingRoleId ? `Editar Rol: ${roleName}` : 'Crear Nuevo Rol Personalizado'}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded-md"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código de Identificador (Mayúsculas sin espacios) *
                  </label>
                  <input
                    type="text"
                    disabled={!!editingRoleId}
                    required
                    placeholder="Ej. VENDEDOR_SERVICIOS, SUPERVISOR_ZONAL"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Identificador único para base de datos y auditoría.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Visible del Rol *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Asesor de Ventas & Planes"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Nombre comercial que verá el usuario en su perfil.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción de Responsabilidades
                </label>
                <input
                  type="text"
                  placeholder="Ej. Encargado de cotizar tratamientos, seguimiento de pacientes y presupuestos."
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Selector de Módulos Permitidos */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Módulos de la Clínica Habilitados para este Rol ({selectedModules.length} seleccionados):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {AVAILABLE_MODULES.map((mod) => {
                    const isChecked = selectedModules.includes(mod.id);
                    return (
                      <button
                        type="button"
                        key={mod.id}
                        onClick={() => handleToggleModule(mod.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                          isChecked
                            ? 'bg-white border-teal-500 shadow-2xs text-teal-950 ring-1 ring-teal-500'
                            : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-md mt-0.5 flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{mod.name}</p>
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            {mod.category}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-teal-100">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs shadow-teal-600/30 transition-colors"
                >
                  {editingRoleId ? 'Guardar Cambios del Rol' : 'Crear & Habilitar Rol'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-50/70 border border-teal-100">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldPlus className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-teal-950">¿Necesitas un nuevo perfil de trabajo?</h4>
                  <p className="text-[11px] text-teal-800">
                    Crea roles para Vendedores, Supervisores Regionales, Especialistas o Auditores con permisos exactos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartCreate}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <ShieldPlus className="h-4 w-4" />
                <span>+ Crear Nuevo Rol</span>
              </button>
            </div>
          )}

          {/* Listado de roles existentes */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Catálogo de Roles en la Organización
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((r: any) => {
                const assignedCount = dbStore.getSnapshot().users.filter((u) => u.roleId === r.id).length;
                const isSystem = !!r.isSystem;

                return (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {r.name}
                          </span>
                          {isSystem ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 shrink-0">
                              <Lock className="h-2.5 w-2.5" /> Base
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                              Personalizado
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                          {assignedCount} {assignedCount === 1 ? 'usuario' : 'usuarios'}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-teal-700 font-semibold mb-2">
                        {r.id}
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {r.description || 'Sin descripción detallada.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        {r.allowedNavTabs?.length || 0} módulos permitidos
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(r)}
                          title="Editar permisos o descripción"
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {!isSystem && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(r.id, r.name)}
                            title="Eliminar rol personalizado"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="h-4 w-4 text-teal-600" />
            <span>Los cambios de permisos aplican de inmediato en los menús y vistas de los usuarios.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
