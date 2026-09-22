import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, Phone, Clock, ShieldCheck, Check } from 'lucide-react';
import { PARAGUAY_DEPARTMENTS } from '../../db/seeds/paraguay-catalogs.ts';
import { dbStore } from '../../db/inMemoryStore.ts';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchToEdit?: any | null;
}

export const BranchModal: React.FC<BranchModalProps> = ({
  isOpen,
  onClose,
  branchToEdit,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Central');
  const [city, setCity] = useState('San Lorenzo');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('+595 21 ');
  const [whatsapp, setWhatsapp] = useState('+595 981 ');
  const [email, setEmail] = useState('');
  const [openingTime, setOpeningTime] = useState('07:30');
  const [closingTime, setClosingTime] = useState('19:30');

  useEffect(() => {
    if (branchToEdit) {
      setCode(branchToEdit.code || '');
      setName(branchToEdit.name || '');
      setDepartment(branchToEdit.department || 'Central');
      setCity(branchToEdit.city || 'San Lorenzo');
      setNeighborhood(branchToEdit.neighborhood || 'Centro');
      setAddress(branchToEdit.address || '');
      setPhone(branchToEdit.phone || '+595 ');
      setWhatsapp(branchToEdit.whatsapp || '+595 ');
      setEmail(branchToEdit.email || '');
      setOpeningTime(branchToEdit.openingTime || '07:30');
      setClosingTime(branchToEdit.closingTime || '19:30');
    } else {
      setCode('');
      setName('');
      setDepartment('Central');
      setCity('San Lorenzo');
      setNeighborhood('Centro');
      setAddress('');
      setPhone('+595 21 ');
      setWhatsapp('+595 981 ');
      setEmail('');
      setOpeningTime('07:30');
      setClosingTime('19:30');
    }
  }, [branchToEdit, isOpen]);

  if (!isOpen) return null;

  const currentDeptObj =
    PARAGUAY_DEPARTMENTS.find((d) => d.name === department) || PARAGUAY_DEPARTMENTS[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || !name || !address || !phone) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    if (branchToEdit) {
      dbStore.updateBranch(branchToEdit.id, {
        code: code.toUpperCase(),
        name,
        department,
        city,
        neighborhood,
        address,
        phone,
        whatsapp,
        email: email || `sucursal.${code.toLowerCase()}@odontosol.com.py`,
        openingTime,
        closingTime,
      });
    } else {
      dbStore.addBranch({
        code,
        name,
        department,
        city,
        neighborhood,
        address,
        phone,
        whatsapp,
        email,
        openingTime,
        closingTime,
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
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {branchToEdit ? 'Editar Sucursal Clínica' : 'Nueva Sucursal Clínica (Paraguay)'}
              </h3>
              <p className="text-xs text-slate-500">Configuración operativa multi-sucursal</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código Sucursal *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. CDE-04"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 uppercase focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de Sucursal *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Sucursal Ciudad del Este - Boquerón"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Departamento (Paraguay) *
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
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {PARAGUAY_DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ciudad / Distrito *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {currentDeptObj.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Barrio
              </label>
              <input
                type="text"
                placeholder="Ej. Villa Morra, San Cristóbal..."
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección Física *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Avda. Mcal. López c/ San Martín"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono de Línea (+595) *
              </label>
              <input
                type="text"
                required
                placeholder="+595 21 600000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Oficial Clínico
              </label>
              <input
                type="text"
                placeholder="+595 981 123456"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horario Apertura
              </label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horario Cierre
              </label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="p-3 bg-teal-50/80 border border-teal-100 rounded-2xl text-xs text-teal-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              La sucursal se asociará automáticamente a la organización activa con aislamiento
              multi-tenant estricto y generará su correlativo de recibos (serie legal).
            </span>
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
              {branchToEdit ? 'Guardar Cambios' : 'Registrar Sucursal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
