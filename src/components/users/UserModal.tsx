import React, { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Award, Building2, Phone, Mail, Check, AlertCircle } from 'lucide-react';
import { BASE_ROLES } from '../../db/seeds/paraguay-catalogs.ts';
import { dbStore } from '../../db/inMemoryStore.ts';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: any | null;
}

export const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userToEdit }) => {
  const snapshot = dbStore.getSnapshot();
  const branches = snapshot.branches;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('ODONTOLOGO');
  const [phone, setPhone] = useState('+595 981 ');
  const [specialty, setSpecialty] = useState('Odontología General');
  const [license, setLicense] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState('');

  useEffect(() => {
    if (userToEdit) {
      setFirstName(userToEdit.firstName || '');
      setLastName(userToEdit.lastName || '');
      setEmail(userToEdit.email || '');
      setRoleId(userToEdit.roleId || 'ODONTOLOGO');
      setPhone(userToEdit.phone || '+595 ');
      setSpecialty(userToEdit.specialty || 'Odontología General');
      setLicense(userToEdit.professionalLicense || '');

      const userBranchRecords = snapshot.userBranches.filter((ub) => ub.userId === userToEdit.id);
      const bIds = userBranchRecords.map((ub) => ub.branchId);
      setSelectedBranches(bIds.length > 0 ? bIds : [branches[0]?.id || '']);
      const def = userBranchRecords.find((ub) => ub.isDefault)?.branchId || bIds[0] || branches[0]?.id;
      setDefaultBranchId(def || '');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setRoleId('ODONTOLOGO');
      setPhone('+595 981 ');
      setSpecialty('Odontología General');
      setLicense('MSPBS N° ');
      setSelectedBranches(branches.slice(0, 1).map((b) => b.id));
      setDefaultBranchId(branches[0]?.id || '');
    }
  }, [userToEdit, isOpen]);

  if (!isOpen) return null;

  const isOdonto = roleId === 'ODONTOLOGO';

  const handleToggleBranch = (bId: string) => {
    if (selectedBranches.includes(bId)) {
      if (selectedBranches.length === 1) {
        alert('El usuario debe estar asignado como mínimo a una sucursal.');
        return;
      }
      const updated = selectedBranches.filter((id) => id !== bId);
      setSelectedBranches(updated);
      if (defaultBranchId === bId) {
        setDefaultBranchId(updated[0]);
      }
    } else {
      setSelectedBranches([...selectedBranches, bId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !phone) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    if (isOdonto && !license.trim()) {
      alert('Para profesionales odontólogos es obligatorio ingresar el Registro Profesional del MSPBS.');
      return;
    }

    if (userToEdit) {
      dbStore.updateUser(userToEdit.id, {
        firstName,
        lastName,
        email,
        roleId,
        phone,
        specialty,
        professionalLicense: isOdonto ? license : null,
        branchIds: selectedBranches,
        defaultBranchId,
      });
    } else {
      dbStore.addUser({
        firstName,
        lastName,
        email,
        roleId,
        phone,
        specialty,
        professionalLicense: isOdonto ? license : undefined,
        branchIds: selectedBranches,
        defaultBranchId,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {userToEdit ? 'Editar Usuario / Personal Clínico' : 'Nuevo Usuario Institucional'}
              </h3>
              <p className="text-xs text-slate-500">Gestión de roles, licencias MSPBS y asignación de sucursales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
              <input
                type="text"
                required
                placeholder="Ej. María Belén"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
              <input
                type="text"
                required
                placeholder="Ej. González Cardozo"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Institucional *</label>
              <input
                type="email"
                required
                placeholder="nombre.apellido@odontosol.com.py"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Móvil (+595) *</label>
              <input
                type="text"
                required
                placeholder="+595 981 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Role selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rol en el Sistema *</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {BASE_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Especialidad / Cargo</label>
              <input
                type="text"
                placeholder="Ej. Ortodoncia, Periodoncia, Recepción..."
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* License MSPBS for Odontologists */}
          {isOdonto && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                <Award className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Habilitación Sanitaria MSPBS (Paraguay)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                El Ministerio de Salud Pública y Bienestar Social exige registrar el número de registro
                profesional para la firma de odontogramas, recetas médicas y evolución clínica.
              </p>
              <div>
                <label className="block text-xs font-semibold text-amber-950 mb-1">
                  Registro Profesional Odontológico *
                </label>
                <input
                  type="text"
                  required={isOdonto}
                  placeholder="Ej. MSPBS N° 7.842"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Branch Assignments */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">
              Sucursales Habilitadas (Aislamiento Multi-Sucursal) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {branches.map((b) => {
                const isChecked = selectedBranches.includes(b.id);
                const isDefault = defaultBranchId === b.id;

                return (
                  <div
                    key={b.id}
                    className={`p-2.5 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'bg-teal-50/60 border-teal-200 text-teal-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleBranch(b.id)}
                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{b.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{b.code}</div>
                      </div>
                    </label>

                    {isChecked && (
                      <button
                        type="button"
                        onClick={() => setDefaultBranchId(b.id)}
                        title="Marcar como sucursal predeterminada al iniciar sesión"
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          isDefault
                            ? 'bg-teal-700 text-white'
                            : 'bg-white border border-teal-300 text-teal-800 hover:bg-teal-100'
                        }`}
                      >
                        {isDefault ? 'Principal' : 'Predeterminar'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
            >
              {userToEdit ? 'Guardar Cambios' : 'Registrar Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
