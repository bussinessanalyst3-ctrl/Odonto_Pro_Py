import React, { useState, useEffect } from 'react';
import { X, Percent, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import {
  CommissionCalculationMode,
  CommissionRuleRecord,
  CommissionTriggerType,
  StaffArea,
} from '../../db/payrollEngine.ts';

interface CommissionRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleToEdit?: CommissionRuleRecord | null;
  onSaved?: () => void;
}

export const CommissionRuleModal: React.FC<CommissionRuleModalProps> = ({
  isOpen,
  onClose,
  ruleToEdit,
  onSaved,
}) => {
  const branches = dbStore.getBranches();
  const employees = dbStore.getEmployees({ status: 'ACTIVE' });
  const services = dbStore.getServices();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState<StaffArea>('COMERCIAL');
  const [branchId, setBranchId] = useState('');
  const [triggerType, setTriggerType] = useState<CommissionTriggerType>('ON_PAYMENT_COLLECTED');
  const [calculationMode, setCalculationMode] = useState<CommissionCalculationMode>('PERCENTAGE');
  const [ratePercentage, setRatePercentage] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [minThresholdAmount, setMinThresholdAmount] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [requiresCollectedPayment, setRequiresCollectedPayment] = useState(true);
  const [requiresCompletedTreatment, setRequiresCompletedTreatment] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (ruleToEdit) {
      setName(ruleToEdit.name || '');
      setDescription(ruleToEdit.description || '');
      setArea(ruleToEdit.area);
      setBranchId(ruleToEdit.branchId || '');
      setTriggerType(ruleToEdit.triggerType);
      setCalculationMode(ruleToEdit.calculationMode);
      setRatePercentage(ruleToEdit.ratePercentage != null ? String(ruleToEdit.ratePercentage) : '');
      setFixedAmount(ruleToEdit.fixedAmount != null ? String(ruleToEdit.fixedAmount) : '');
      setMinThresholdAmount(ruleToEdit.minThresholdAmount != null ? String(ruleToEdit.minThresholdAmount) : '');
      setServiceId(ruleToEdit.serviceId || '');
      setTargetEmployeeId(ruleToEdit.targetEmployeeId || '');
      setRequiresCollectedPayment(Boolean(ruleToEdit.requiresCollectedPayment));
      setRequiresCompletedTreatment(Boolean(ruleToEdit.requiresCompletedTreatment));
      setEffectiveFrom(ruleToEdit.effectiveFrom || '');
      setEffectiveTo(ruleToEdit.effectiveTo || '');
    } else {
      setName('');
      setDescription('');
      setArea('COMERCIAL');
      setBranchId('');
      setTriggerType('ON_PAYMENT_COLLECTED');
      setCalculationMode('PERCENTAGE');
      setRatePercentage('');
      setFixedAmount('');
      setMinThresholdAmount('');
      setServiceId('');
      setTargetEmployeeId('');
      setRequiresCollectedPayment(true);
      setRequiresCompletedTreatment(false);
      setEffectiveFrom('');
      setEffectiveTo('');
    }
  }, [isOpen, ruleToEdit]);

  if (!isOpen) return null;

  const filteredEmployees = employees.filter((e: any) => e.area === area);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Ingrese un nombre descriptivo para la regla.');
      return;
    }

    const rateVal = calculationMode === 'PERCENTAGE' ? Number(ratePercentage) : null;
    const fixedVal = calculationMode !== 'PERCENTAGE' ? Number(fixedAmount) : null;
    const minVal = minThresholdAmount.trim() ? Number(minThresholdAmount) : null;

    if (calculationMode === 'PERCENTAGE' && (rateVal === null || Number.isNaN(rateVal) || rateVal <= 0 || rateVal > 100)) {
      setFormError('Indique el porcentaje configurable entre 0.01% y 100%.');
      return;
    }
    if (calculationMode !== 'PERCENTAGE' && (fixedVal === null || Number.isNaN(fixedVal) || fixedVal < 0)) {
      setFormError('Indique un monto fijo válido en PYG.');
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        area,
        branchId: branchId || null,
        triggerType,
        calculationMode,
        ratePercentage: rateVal,
        fixedAmount: fixedVal,
        minThresholdAmount: minVal,
        serviceId: serviceId || null,
        targetEmployeeId: targetEmployeeId || null,
        requiresCollectedPayment,
        requiresCompletedTreatment,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
      };

      if (ruleToEdit) {
        dbStore.updateCommissionRule(ruleToEdit.id, payload);
      } else {
        dbStore.createCommissionRule(payload);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar la regla de comisión.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {ruleToEdit ? 'Editar Regla de Comisión' : 'Configurar Nueva Regla de Comisión'}
              </h3>
              <p className="text-xs text-slate-500">
                Parámetros 100% configurables por organización, sucursal, área y servicio (sin valores fijos en código).
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de la Regla *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Comisión Comercial por Cobro Efectivo"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Área Aplicable *</label>
              <select
                value={area}
                onChange={(e) => {
                  const next = e.target.value as StaffArea;
                  setArea(next);
                  setTargetEmployeeId('');
                  if (next === 'CLINICA') {
                    setTriggerType('ON_TREATMENT_COMPLETED');
                    setRequiresCompletedTreatment(true);
                    setRequiresCollectedPayment(false);
                  } else if (next === 'COMERCIAL') {
                    setTriggerType('ON_PAYMENT_COLLECTED');
                    setRequiresCollectedPayment(true);
                    setRequiresCompletedTreatment(false);
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold focus:ring-2 focus:ring-teal-500"
              >
                <option value="COMERCIAL">Área Comercial</option>
                <option value="CLINICA">Área Clínica</option>
                <option value="OPERATIVA">Área Operativa</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Evento Disparador *</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as CommissionTriggerType)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="ON_PAYMENT_COLLECTED">Al cobrar presupuesto / pago confirmado</option>
                <option value="ON_TREATMENT_COMPLETED">Al finalizar tratamiento clínico</option>
                <option value="ON_PATIENT_ACQUISITION">Al captar / asignar nuevo paciente</option>
                <option value="ON_GOAL_ACHIEVED">Por cumplimiento de meta / objetivo</option>
                <option value="MANUAL">Ajuste / Bono Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Modalidad de Cálculo *</label>
              <select
                value={calculationMode}
                onChange={(e) => setCalculationMode(e.target.value as CommissionCalculationMode)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="PERCENTAGE">Porcentaje (%) sobre base</option>
                <option value="FIXED_OPERATION">Monto fijo por operación (PYG)</option>
                <option value="FIXED_TREATMENT">Monto fijo por tratamiento (PYG)</option>
                <option value="GOAL_BONUS">Bono por cumplimiento de objetivo (PYG)</option>
                <option value="MANUAL_ADJUSTMENT">Ajuste manual configurable</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            {calculationMode === 'PERCENTAGE' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Porcentaje (%) *</label>
                <input
                  type="number"
                  required
                  min={0.01}
                  max={100}
                  step={0.5}
                  value={ratePercentage}
                  onChange={(e) => setRatePercentage(e.target.value)}
                  placeholder="Ej. 8"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold tabular-nums focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monto Fijo (PYG ₲) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  step={10000}
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  placeholder="Ej. 150000"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold tabular-nums focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Umbral Mínimo (PYG)</label>
              <input
                type="number"
                min={0}
                step={50000}
                value={minThresholdAmount}
                onChange={(e) => setMinThresholdAmount(e.target.value)}
                placeholder="Opcional"
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono tabular-nums focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sucursal Específica</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todas las sucursales</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Colaborador Específico (Opcional)
              </label>
              <select
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">
                  {area === 'COMERCIAL'
                    ? 'Asesor designado del paciente (Dinámico)'
                    : area === 'CLINICA'
                      ? 'Odontólogo ejecutor (Dinámico)'
                      : 'Seleccionar colaborador operativo...'}
                </option>
                {filteredEmployees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Servicio / Tratamiento Específico (Opcional)
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todos los tratamientos / procedimientos</option>
                {services.map((srv: any) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} (₲ {Number(srv.basePrice || 0).toLocaleString('es-PY')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCollectedPayment}
                onChange={(e) => setRequiresCollectedPayment(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">Exigir Cobro Confirmado</div>
                <div className="text-[11px] text-slate-500">
                  No genera comisión sobre presupuestos pendientes o sin pago efectivo.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCompletedTreatment}
                onChange={(e) => setRequiresCompletedTreatment(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">Exigir Tratamiento Finalizado</div>
                <div className="text-[11px] text-slate-500">
                  Requiere que el tratamiento esté en estado COMPLETADO.
                </div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vigencia Desde</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vigencia Hasta</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Criterio de cálculo, exclusiones o notas de gerencia..."
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
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer"
            >
              {ruleToEdit ? 'Actualizar Regla' : 'Guardar Regla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
