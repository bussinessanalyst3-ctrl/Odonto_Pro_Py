import React, { useState, useEffect } from 'react';
import { X, DollarSign, History, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { EmployeeRecord, PaymentFrequency, getEmployeeDisplayName } from '../../db/payrollEngine.ts';

interface SalaryUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeRecord | null;
  onSaved?: () => void;
}

export const SalaryUpdateModal: React.FC<SalaryUpdateModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSaved,
}) => {
  const [baseSalary, setBaseSalary] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MENSUAL');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const currentSalary = employee ? dbStore.getActiveSalary(employee.id) : null;

  useEffect(() => {
    if (!isOpen || !employee) return;
    setFormError(null);
    const active = dbStore.getActiveSalary(employee.id);
    setBaseSalary(active ? String(active.baseSalary) : '');
    setPaymentFrequency(active?.paymentFrequency || 'MENSUAL');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setObservations('');
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsed = Number(baseSalary);
    if (baseSalary.trim() === '' || Number.isNaN(parsed) || parsed < 0) {
      setFormError('Ingrese un monto válido en Guaraníes (PYG >= 0).');
      return;
    }

    try {
      dbStore.registerEmployeeSalary({
        employeeId: employee.id,
        baseSalary: parsed,
        paymentFrequency,
        effectiveDate,
        observations: observations.trim() || null,
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al registrar el salario.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {currentSalary ? 'Actualizar Salario Base' : 'Registrar Salario Base'}
              </h3>
              <p className="text-xs text-slate-500">
                {getEmployeeDisplayName(employee)} • Área {employee.area}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {currentSalary && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <div className="text-slate-500">Salario Vigente Actual</div>
                <div className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                  ₲ {currentSalary.baseSalary.toLocaleString('es-PY')} / {currentSalary.paymentFrequency}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                Desde {currentSalary.effectiveDate}
              </div>
            </div>
          )}

          <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 text-[11px] text-teal-900 flex items-start gap-2">
            <History className="h-4 w-4 shrink-0 text-teal-700 mt-0.5" />
            <span>
              El registro anterior pasará automáticamente a estado <strong>HISTORICO</strong> sin alterar períodos pasados ni liquidaciones ya emitidas.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nuevo Salario Base (PYG ₲) *
            </label>
            <input
              type="number"
              required
              min={0}
              step={10000}
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="Ej. 4500000"
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-mono font-bold tabular-nums focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frecuencia *</label>
              <select
                value={paymentFrequency}
                onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500"
              >
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="SEMANAL">Semanal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Vigencia *</label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo / Observaciones</label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ej. Ajuste por desempeño o actualización contractual..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
            >
              Guardar Salario PYG
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
