import React, { useState, useEffect } from 'react';
import { X, Check, Shield, AlertCircle, FileText, Info } from 'lucide-react';

interface InsurancePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planToEdit?: any | null;
  onSave: (data: {
    code: string;
    name: string;
    description: string;
    coverageTerms: string;
    status: 'ACTIVO' | 'INACTIVO';
  }) => void;
}

export const InsurancePlanModal: React.FC<InsurancePlanModalProps> = ({
  isOpen,
  onClose,
  planToEdit,
  onSave,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverageTerms, setCoverageTerms] = useState('');
  const [status, setStatus] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (planToEdit) {
      setCode(planToEdit.code || '');
      setName(planToEdit.name || '');
      setDescription(planToEdit.description || '');
      setCoverageTerms(planToEdit.coverageTerms || '');
      setStatus(planToEdit.status || 'ACTIVO');
    } else {
      setCode('');
      setName('');
      setDescription('');
      setCoverageTerms('');
      setStatus('ACTIVO');
    }
    setError(null);
  }, [planToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('El código del plan o seguro es obligatorio (ej: SEG-BASICO).');
      return;
    }
    if (!name.trim()) {
      setError('El nombre comercial del plan es obligatorio.');
      return;
    }

    onSave({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      coverageTerms: coverageTerms.trim(),
      status,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {planToEdit ? 'Editar Plan o Seguro Odontológico' : 'Nuevo Plan / Seguro Odontológico'}
              </h3>
              <p className="text-xs text-slate-500">
                Modalidad comercial de cobertura con tarifario preferencial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Código del Plan: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SEG-BASICO"
                required
                className="w-full text-xs font-mono uppercase p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Nombre del Plan / Convenio: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Seguro Dental Básico Familiar"
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Descripción General:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Cobertura preventiva total con copagos accesibles en operatoria y cirugía para toda la familia."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Condiciones y Términos de Cobertura:
            </label>
            <textarea
              rows={2}
              value={coverageTerms}
              onChange={(e) => setCoverageTerms(e.target.value)}
              placeholder="Ej: Consultas y limpiezas 100% bonificadas (₲ 0). Restauraciones con copago preferencial de ₲ 80.000."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Estado Operativo del Plan:
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVO' | 'INACTIVO')}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            >
              <option value="ACTIVO">ACTIVO — Disponible para asociar a nuevos pacientes</option>
              <option value="INACTIVO">INACTIVO — Suspendido (Conserva historial de pacientes anteriores)</option>
            </select>
          </div>

          <div className="p-3 bg-teal-50 border border-teal-100 rounded-2xl flex items-start gap-2.5 text-xs text-teal-900">
            <Info className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Una vez guardado el plan, podrás seleccionar y configurar los aranceles específicos para cada procedimiento del catálogo dental (₲ 0 para coberturas al 100% o copagos bonificados).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{planToEdit ? 'Guardar Cambios' : 'Crear Plan Odontológico'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
