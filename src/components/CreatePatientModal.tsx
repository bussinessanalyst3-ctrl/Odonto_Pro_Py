import React, { useState } from 'react';
import { X, UserPlus, ShieldCheck } from 'lucide-react';
import { dbStore } from '../db/inMemoryStore.ts';
import { PARAGUAY_DEPARTMENTS, DOCUMENT_TYPES } from '../db/seeds/paraguay-catalogs.ts';

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBranchId?: string;
}

export const CreatePatientModal: React.FC<CreatePatientModalProps> = ({
  isOpen,
  onClose,
  defaultBranchId,
}) => {
  const branches = dbStore.getBranches();

  const [documentType, setDocumentType] = useState('CI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+595 ');
  const [department, setDepartment] = useState('Central');
  const [city, setCity] = useState('San Lorenzo');
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '');
  const [allergies, setAllergies] = useState('');

  if (!isOpen) return null;

  const currentDept = PARAGUAY_DEPARTMENTS.find((d) => d.name === department) || PARAGUAY_DEPARTMENTS[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentNumber || !firstName || !lastName || !branchId) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    dbStore.addPatient({
      documentType,
      documentNumber,
      firstName,
      lastName,
      phone,
      primaryBranchId: branchId,
      department,
      city,
      allergies,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nuevo Paciente (Paraguay)</h3>
              <p className="text-xs text-slate-500">Añadir registro a la base de datos multi-tenant</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo Documento *
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.code} value={dt.code}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Cédula / RUC *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 4.250.312"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombres *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Carlos Ramón"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Apellidos *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Duarte Benítez"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono (+595) *
              </label>
              <input
                type="text"
                required
                placeholder="+595 981 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sucursal de Registro *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Departamento (Paraguay)
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  const d = PARAGUAY_DEPARTMENTS.find((dept) => dept.name === e.target.value);
                  if (d && d.cities.length > 0) {
                    setCity(d.cities[0]);
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              >
                {PARAGUAY_DEPARTMENTS.map((dept) => (
                  <option key={dept.code} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ciudad
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
              >
                {currentDept.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alergias Médicas / Observaciones
            </label>
            <input
              type="text"
              placeholder="Ej. Alergia a Penicilina, anestesia local, ninguna..."
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl text-xs text-teal-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Este registro se guardará asignado a la organización activa con UUID v4 único y
              generará automáticamente un evento en la tabla inmutable <strong>audit_logs</strong>.
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
            >
              Guardar Paciente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
