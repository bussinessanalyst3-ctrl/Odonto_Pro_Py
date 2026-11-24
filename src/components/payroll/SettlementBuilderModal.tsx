import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Plus, Trash2, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { getEmployeeDisplayName } from '../../db/payrollEngine.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import { getAsuncionYearMonth } from '../../utils/reportPeriod.ts';

interface SettlementBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
  onCreated?: () => void;
}

interface ConceptLine {
  concept: string;
  amount: string;
}

interface AdjustmentLine {
  concept: string;
  sign: 'CREDIT' | 'DEBIT';
  amount: string;
}

export const SettlementBuilderModal: React.FC<SettlementBuilderModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
  onCreated,
}) => {
  const employees = dbStore.getEmployees({ status: 'ACTIVE' });
  const todayYm = getAsuncionYearMonth(getTodayAsuncionISO());

  const [employeeId, setEmployeeId] = useState('');
  const [periodYear, setPeriodYear] = useState(todayYm.year);
  const [periodMonth, setPeriodMonth] = useState(todayYm.month);
  const [includeBaseSalary, setIncludeBaseSalary] = useState(true);
  const [baseSalaryOverride, setBaseSalaryOverride] = useState('');
  const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
  const [bonuses, setBonuses] = useState<ConceptLine[]>([]);
  const [advances, setAdvances] = useState<ConceptLine[]>([]);
  const [deductions, setDeductions] = useState<ConceptLine[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentLine[]>([]);
  const [notes, setNotes] = useState('');
  const [submitForApproval, setSubmitForApproval] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    const currentYm = getAsuncionYearMonth(getTodayAsuncionISO());
    const initialEmp = defaultEmployeeId || employees[0]?.id || '';
    setEmployeeId(initialEmp);
    setPeriodYear(currentYm.year);
    setPeriodMonth(currentYm.month);
    setBonuses([]);
    setAdvances([]);
    setDeductions([]);
    setAdjustments([]);
    setNotes('');
    setSubmitForApproval(true);
  }, [isOpen, defaultEmployeeId]);

  const selectedEmployee = employees.find((e: any) => e.id === employeeId) || null;
  const activeSalary = employeeId ? dbStore.getActiveSalary(employeeId) : null;

  const pendingCommissions = useMemo(() => {
    if (!employeeId) return [];
    return dbStore.getGeneratedCommissions({
      employeeId,
      status: 'PENDIENTE',
    });
  }, [employeeId, isOpen]);

  useEffect(() => {
    if (!employeeId) {
      setSelectedCommissionIds([]);
      return;
    }
    const emp = employees.find((e: any) => e.id === employeeId);
    setIncludeBaseSalary(emp ? emp.remunerationModality !== 'COMISION' : true);
    setBaseSalaryOverride(activeSalary ? String(activeSalary.baseSalary) : '0');
    setSelectedCommissionIds(
      pendingCommissions
        .filter((c: any) => c.periodYear === periodYear && c.periodMonth === periodMonth)
        .map((c: any) => c.id)
    );
  }, [employeeId, periodYear, periodMonth, pendingCommissions.length]);

  if (!isOpen) return null;

  const effectiveBaseSalary = includeBaseSalary ? Math.max(0, Math.round(Number(baseSalaryOverride || 0))) : 0;
  const selectedCommsTotal = pendingCommissions
    .filter((c: any) => selectedCommissionIds.includes(c.id))
    .reduce((sum: number, c: any) => sum + Number(c.commissionAmount || 0), 0);
  const bonusesTotal = bonuses.reduce((s, b) => s + Math.max(0, Math.round(Number(b.amount || 0))), 0);
  const advancesTotal = advances.reduce((s, a) => s + Math.max(0, Math.round(Number(a.amount || 0))), 0);
  const deductionsTotal = deductions.reduce((s, d) => s + Math.max(0, Math.round(Number(d.amount || 0))), 0);
  const adjCredit = adjustments
    .filter((a) => a.sign === 'CREDIT')
    .reduce((s, a) => s + Math.max(0, Math.round(Number(a.amount || 0))), 0);
  const adjDebit = adjustments
    .filter((a) => a.sign === 'DEBIT')
    .reduce((s, a) => s + Math.max(0, Math.round(Number(a.amount || 0))), 0);

  const grossTotal = effectiveBaseSalary + selectedCommsTotal + bonusesTotal + adjCredit;
  const debitsTotal = advancesTotal + deductionsTotal + adjDebit;
  const netPayable = Math.max(0, grossTotal - debitsTotal);

  const toggleCommission = (commId: string) => {
    setSelectedCommissionIds((prev) =>
      prev.includes(commId) ? prev.filter((id) => id !== commId) : [...prev, commId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!employeeId) {
      setFormError('Seleccione un colaborador.');
      return;
    }

    try {
      dbStore.createPayrollSettlement({
        employeeId,
        periodYear,
        periodMonth,
        includeBaseSalary,
        baseSalaryOverride: includeBaseSalary ? effectiveBaseSalary : 0,
        commissionIds: selectedCommissionIds,
        bonuses: bonuses
          .filter((b) => Number(b.amount) > 0)
          .map((b) => ({ concept: b.concept || 'Bono de desempeño', amount: Number(b.amount) })),
        advances: advances
          .filter((a) => Number(a.amount) > 0)
          .map((a) => ({ concept: a.concept || 'Anticipo salarial', amount: Number(a.amount) })),
        deductions: deductions
          .filter((d) => Number(d.amount) > 0)
          .map((d) => ({ concept: d.concept || 'Descuento administrativo', amount: Number(d.amount) })),
        manualAdjustments: adjustments
          .filter((a) => Number(a.amount) > 0)
          .map((a) => ({ concept: a.concept || 'Ajuste', sign: a.sign, amount: Number(a.amount) })),
        submitForApproval,
        notes: notes.trim() || null,
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al generar la liquidación.');
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Generar Liquidación de Haberes</h3>
              <p className="text-xs text-slate-500">
                Consolida salario base vigente, comisiones pendientes, bonos, anticipos y descuentos en PYG.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Selección de Empleado y Período */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Colaborador *</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-semibold focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Seleccionar colaborador...</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {getEmployeeDisplayName(emp)} — {emp.area} ({emp.remunerationModality})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mes</label>
              <select
                value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Año</label>
              <input
                type="number"
                min={2020}
                max={2035}
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Salario Base Snapshot */}
          {selectedEmployee && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBaseSalary}
                    onChange={(e) => setIncludeBaseSalary(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span>Incluir Salario Base en Liquidación ({activeSalary?.paymentFrequency || 'MENSUAL'})</span>
                </label>
                {activeSalary ? (
                  <span className="text-[11px] text-slate-500">
                    Vigente registrado: <strong className="font-mono">₲ {activeSalary.baseSalary.toLocaleString('es-PY')}</strong>
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700 font-medium">Sin salario fijo vigente</span>
                )}
              </div>
              {includeBaseSalary && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600">Monto a liquidar (PYG):</span>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={baseSalaryOverride}
                    onChange={(e) => setBaseSalaryOverride(e.target.value)}
                    className="w-48 text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold tabular-nums focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Comisiones Pendientes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Comisiones Pendientes de Liquidar ({pendingCommissions.length})
              </h4>
              {pendingCommissions.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCommissionIds(
                      selectedCommissionIds.length === pendingCommissions.length
                        ? []
                        : pendingCommissions.map((c: any) => c.id)
                    )
                  }
                  className="text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                >
                  {selectedCommissionIds.length === pendingCommissions.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              )}
            </div>

            {pendingCommissions.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                No existen comisiones en estado PENDIENTE para este colaborador.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
                {pendingCommissions.map((comm: any) => {
                  const checked = selectedCommissionIds.includes(comm.id);
                  return (
                    <label
                      key={comm.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs cursor-pointer ${
                        checked ? 'bg-teal-50/50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCommission(comm.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">{comm.concept}</div>
                          <div className="text-[11px] text-slate-500">
                            {comm.periodMonth}/{comm.periodYear} • {comm.area} ({comm.sourceType})
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold tabular-nums text-emerald-700 shrink-0">
                        + ₲ {Number(comm.commissionAmount).toLocaleString('es-PY')}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bonos, Anticipos, Descuentos y Ajustes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bonos */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Bonos / Incentivos (+)</span>
                <button
                  type="button"
                  onClick={() => setBonuses((prev) => [...prev, { concept: '', amount: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Agregar Bono
                </button>
              </div>
              {bonuses.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={b.concept}
                    onChange={(e) =>
                      setBonuses((prev) => prev.map((row, idx) => (idx === i ? { ...row, concept: e.target.value } : row)))
                    }
                    placeholder="Concepto bono"
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min={0}
                    value={b.amount}
                    onChange={(e) =>
                      setBonuses((prev) => prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row)))
                    }
                    placeholder="PYG"
                    className="w-24 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setBonuses((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Anticipos */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Anticipos Descontables (-)</span>
                <button
                  type="button"
                  onClick={() => setAdvances((prev) => [...prev, { concept: '', amount: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Agregar Anticipo
                </button>
              </div>
              {advances.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={a.concept}
                    onChange={(e) =>
                      setAdvances((prev) => prev.map((row, idx) => (idx === i ? { ...row, concept: e.target.value } : row)))
                    }
                    placeholder="Concepto anticipo"
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min={0}
                    value={a.amount}
                    onChange={(e) =>
                      setAdvances((prev) => prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row)))
                    }
                    placeholder="PYG"
                    className="w-24 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setAdvances((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Descuentos */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Descuentos / Retenciones (-)</span>
                <button
                  type="button"
                  onClick={() => setDeductions((prev) => [...prev, { concept: '', amount: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Agregar Descuento
                </button>
              </div>
              {deductions.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={d.concept}
                    onChange={(e) =>
                      setDeductions((prev) => prev.map((row, idx) => (idx === i ? { ...row, concept: e.target.value } : row)))
                    }
                    placeholder="Ej. IPS / Ausencia"
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min={0}
                    value={d.amount}
                    onChange={(e) =>
                      setDeductions((prev) => prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row)))
                    }
                    placeholder="PYG"
                    className="w-24 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setDeductions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Ajustes Manuales */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Ajustes (+/-)</span>
                <button
                  type="button"
                  onClick={() => setAdjustments((prev) => [...prev, { concept: '', sign: 'CREDIT', amount: '' }])}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Agregar Ajuste
                </button>
              </div>
              {adjustments.map((adj, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select
                    value={adj.sign}
                    onChange={(e) =>
                      setAdjustments((prev) =>
                        prev.map((row, idx) => (idx === i ? { ...row, sign: e.target.value as 'CREDIT' | 'DEBIT' } : row))
                      )
                    }
                    className="text-xs bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 font-bold"
                  >
                    <option value="CREDIT">+</option>
                    <option value="DEBIT">-</option>
                  </select>
                  <input
                    type="text"
                    value={adj.concept}
                    onChange={(e) =>
                      setAdjustments((prev) => prev.map((row, idx) => (idx === i ? { ...row, concept: e.target.value } : row)))
                    }
                    placeholder="Concepto ajuste"
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="number"
                    min={0}
                    value={adj.amount}
                    onChange={(e) =>
                      setAdjustments((prev) => prev.map((row, idx) => (idx === i ? { ...row, amount: e.target.value } : row)))
                    }
                    placeholder="PYG"
                    className="w-24 text-xs bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Resumen de Cálculo */}
          <div className="p-4 rounded-xl bg-slate-900 text-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-slate-400">Salario Base</div>
              <div className="font-mono font-bold tabular-nums text-sm">
                ₲ {effectiveBaseSalary.toLocaleString('es-PY')}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Comisiones + Bonos</div>
              <div className="font-mono font-bold tabular-nums text-sm text-emerald-400">
                + ₲ {(selectedCommsTotal + bonusesTotal + adjCredit).toLocaleString('es-PY')}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Anticipos y Descuentos</div>
              <div className="font-mono font-bold tabular-nums text-sm text-rose-400">
                - ₲ {debitsTotal.toLocaleString('es-PY')}
              </div>
            </div>
            <div>
              <div className="text-slate-400">Neto a Pagar</div>
              <div className="font-mono font-extrabold tabular-nums text-base text-teal-300">
                ₲ {netPayable.toLocaleString('es-PY')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones de la liquidación (opcional)..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={submitForApproval}
                onChange={(e) => setSubmitForApproval(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Enviar directamente a aprobación (PENDIENTE_APROBACION)</span>
            </label>
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
              {submitForApproval ? 'Crear y Enviar a Aprobación' : 'Guardar Borrador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
