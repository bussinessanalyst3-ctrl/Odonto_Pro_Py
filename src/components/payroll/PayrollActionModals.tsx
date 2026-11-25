import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Printer, Award, Ban } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import {
  PayrollSettlementRecord,
  StaffPaymentRecord,
  getEmployeeDisplayName,
} from '../../db/payrollEngine.ts';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { resolveOrganizationLegalName } from '../../config/appBrand.ts';

interface ManualCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmployeeId?: string;
  onCreated?: () => void;
}

export const ManualCommissionModal: React.FC<ManualCommissionModalProps> = ({
  isOpen,
  onClose,
  defaultEmployeeId,
  onCreated,
}) => {
  const employees = dbStore.getEmployees({ status: 'ACTIVE' });
  const now = new Date();
  const [employeeId, setEmployeeId] = useState('');
  const [concept, setConcept] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [periodYear, setPeriodYear] = useState(now.getUTCFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getUTCMonth() + 1);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setEmployeeId(defaultEmployeeId || employees[0]?.id || '');
    setConcept('');
    setCommissionAmount('');
    setPeriodYear(now.getUTCFullYear());
    setPeriodMonth(now.getUTCMonth() + 1);
    setNotes('');
  }, [isOpen, defaultEmployeeId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amountNum = Number(commissionAmount);
    if (!employeeId || !concept.trim() || !amountNum || amountNum <= 0) {
      setFormError('Seleccione un colaborador, concepto y un monto válido en PYG mayor a 0.');
      return;
    }

    try {
      dbStore.createManualCommission({
        employeeId,
        concept: concept.trim(),
        commissionAmount: amountNum,
        periodYear,
        periodMonth,
        notes: notes.trim() || null,
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al registrar comisión o bono manual.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bono o Comisión Manual</h3>
              <p className="text-xs text-slate-500">Se registrará en estado PENDIENTE para liquidación.</p>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Colaborador *</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-semibold"
            >
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {getEmployeeDisplayName(emp)} — {emp.area}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto *</label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej. Bono cumplimiento meta mensual"
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Monto (PYG) *</label>
              <input
                type="number"
                required
                min={1}
                step={10000}
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 font-mono font-bold tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mes</label>
              <input
                type="number"
                min={1}
                max={12}
                value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Año</label>
              <input
                type="number"
                min={2024}
                max={2035}
                value={periodYear}
                onChange={(e) => setPeriodYear(Number(e.target.value))}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2.5 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Autorizado por gerencia..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
            >
              Registrar Bono
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AnnulReasonModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const AnnulReasonModal: React.FC<AnnulReasonModalProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setFormError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (reason.trim().length < 5) {
      setFormError('Indique un motivo válido de anulación (mínimo 5 caracteres).');
      return;
    }
    try {
      onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo completar la anulación.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-rose-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-600">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo de Anulación Lógica (Auditado) *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Error en monto transferido o corrección de período..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              El registro permanecerá en el historial como ANULADO para trazabilidad financiera.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
            >
              Confirmar Anulación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PayrollPrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  settlement?: PayrollSettlementRecord | null;
  payment?: StaffPaymentRecord | null;
  settlementsSummary?: PayrollSettlementRecord[];
}

export const PayrollPrintReportModal: React.FC<PayrollPrintReportModalProps> = ({
  isOpen,
  onClose,
  title,
  settlement,
  payment,
  settlementsSummary,
}) => {
  const { branding } = useBranding();
  if (!isOpen) return null;

  const employees = dbStore.getEmployees({ status: 'ALL' });
  const org = dbStore.getActiveOrganization();
  const items = settlement ? dbStore.getPayrollSettlementItems(settlement.id) : [];
  const emp = settlement
    ? employees.find((e: any) => e.id === settlement.employeeId)
    : payment
      ? employees.find((e: any) => e.id === payment.employeeId)
      : null;
  const orgLegalName = resolveOrganizationLegalName({
    legalName: branding.legalName,
    name: org?.name,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden my-6 print:shadow-none print:border-none print:my-0">
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 print:hidden">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 text-slate-900 text-xs">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              {orgLegalName && (
                <div className="text-base font-extrabold text-slate-900">
                  {orgLegalName}
                </div>
              )}
              <div className="text-slate-500">
                {org?.taxId ? `RUC: ${org.taxId} • ` : ''}Paraguay
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold uppercase tracking-wide text-teal-800">{title}</div>
              <div className="text-slate-500">
                Emitido: {new Date().toLocaleDateString('es-PY')}
              </div>
            </div>
          </div>

          {emp && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-500">Colaborador</div>
                <div className="font-bold">{getEmployeeDisplayName(emp)}</div>
              </div>
              <div>
                <div className="text-slate-500">Documento</div>
                <div className="font-mono font-semibold">{emp.documentType} {emp.documentNumber}</div>
              </div>
              <div>
                <div className="text-slate-500">Área / Cargo</div>
                <div className="font-semibold">{emp.area} • {emp.position}</div>
              </div>
              <div>
                <div className="text-slate-500">Código</div>
                <div className="font-mono font-semibold">{emp.employeeCode}</div>
              </div>
            </div>
          )}

          {settlement && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm">Liquidación {settlement.settlementNumber}</span>
                  <span className="ml-2 text-slate-500">Período: {settlement.periodLabel}</span>
                </div>
                <span className="font-bold px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                  Estado: {settlement.status}
                </span>
              </div>

              <table className="w-full border-collapse border border-slate-200">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="border border-slate-200 px-3 py-2 text-left">Tipo</th>
                    <th className="border border-slate-200 px-3 py-2 text-left">Concepto</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Crédito (PYG)</th>
                    <th className="border border-slate-200 px-3 py-2 text-right">Débito (PYG)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => {
                    const isIrpLine = String(item.concept || '').startsWith('Retención IRP');
                    return (
                      <tr key={item.id} className={isIrpLine ? 'bg-amber-50/60' : undefined}>
                        <td className={`border border-slate-200 px-3 py-2 font-semibold ${isIrpLine ? 'text-amber-900' : ''}`}>
                          {isIrpLine ? 'RETENCIÓN IRP' : item.itemType}
                        </td>
                        <td className="border border-slate-200 px-3 py-2">{item.concept}</td>
                        <td className="border border-slate-200 px-3 py-2 text-right font-mono tabular-nums">
                          {item.sign === 'CREDIT' ? `₲ ${Number(item.amount).toLocaleString('es-PY')}` : '—'}
                        </td>
                        <td className="border border-slate-200 px-3 py-2 text-right font-mono tabular-nums text-rose-700">
                          {item.sign === 'DEBIT' ? `₲ ${Number(item.amount).toLocaleString('es-PY')}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 font-bold">
                <div>
                  <div className="text-slate-500 font-normal">Neto Liquidado</div>
                  <div className="font-mono text-sm tabular-nums">₲ {settlement.netPayable.toLocaleString('es-PY')}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-normal">Total Pagado</div>
                  <div className="font-mono text-sm tabular-nums text-emerald-700">₲ {settlement.paidAmount.toLocaleString('es-PY')}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-normal">Saldo Pendiente</div>
                  <div className="font-mono text-sm tabular-nums text-amber-700">₲ {settlement.balanceDue.toLocaleString('es-PY')}</div>
                </div>
              </div>
            </>
          )}

          {payment && (
            <div className="p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between font-bold text-sm">
                <span>Comprobante de Pago {payment.operationNumber}</span>
                <span className="font-mono tabular-nums">₲ {payment.amount.toLocaleString('es-PY')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>Fecha: {payment.paymentDate}</div>
                <div>Método: {payment.paymentMethod}</div>
                <div>Referencia: {payment.referenceNumber || 'N/A'}</div>
                <div>Responsable: {payment.responsibleUserName || 'Sistema'}</div>
              </div>
            </div>
          )}

          {settlementsSummary && settlementsSummary.length > 0 && (
            <table className="w-full border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px]">
                <tr>
                  <th className="border border-slate-200 px-2.5 py-2 text-left">Liquidación</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-left">Colaborador</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-left">Período</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-right">Neto</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-right">Pagado</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-right">Saldo</th>
                  <th className="border border-slate-200 px-2.5 py-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {settlementsSummary.map((s) => {
                  const rowEmp = employees.find((e: any) => e.id === s.employeeId);
                  return (
                    <tr key={s.id}>
                      <td className="border border-slate-200 px-2.5 py-2 font-mono">{s.settlementNumber}</td>
                      <td className="border border-slate-200 px-2.5 py-2 font-semibold">{getEmployeeDisplayName(rowEmp)}</td>
                      <td className="border border-slate-200 px-2.5 py-2">{s.periodLabel}</td>
                      <td className="border border-slate-200 px-2.5 py-2 text-right font-mono tabular-nums">
                        ₲ {s.netPayable.toLocaleString('es-PY')}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-2 text-right font-mono tabular-nums">
                        ₲ {s.paidAmount.toLocaleString('es-PY')}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-2 text-right font-mono tabular-nums">
                        ₲ {s.balanceDue.toLocaleString('es-PY')}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-2 text-center">{s.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="pt-8 grid grid-cols-2 gap-12 text-center text-[11px] text-slate-500">
            <div className="border-t border-slate-300 pt-2">Firma del Colaborador / Receptor</div>
            <div className="border-t border-slate-300 pt-2">Autorización Administración / RR.HH.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
