import React, { useState, useEffect } from 'react';
import { X, CreditCard, ShieldAlert, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { PayrollSettlementRecord, getEmployeeDisplayName } from '../../db/payrollEngine.ts';
import { hasPermission } from '../../security/rbacHierarchy.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';

interface StaffPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlement: PayrollSettlementRecord | null;
  onPaid?: () => void;
}

export const StaffPaymentModal: React.FC<StaffPaymentModalProps> = ({
  isOpen,
  onClose,
  settlement,
  onPaid,
}) => {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayAsuncionISO());
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA_SIPAP');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [overpaymentOverride, setOverpaymentOverride] = useState(false);
  const [overpaymentOverrideReason, setOverpaymentOverrideReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const actor = dbStore.getBackendActorContext();
  const canOverrideBalance = actor ? hasPermission(actor, 'payroll.override_balance') : true;

  useEffect(() => {
    if (!isOpen || !settlement) return;
    setFormError(null);
    setAmount(String(settlement.balanceDue || 0));
    setPaymentDate(getTodayAsuncionISO());
    setPaymentMethod('TRANSFERENCIA_SIPAP');
    setReferenceNumber('');
    setNotes('');
    setOverpaymentOverride(false);
    setOverpaymentOverrideReason('');
  }, [isOpen, settlement]);

  if (!isOpen || !settlement) return null;

  const employee = dbStore.getEmployees({ status: 'ALL' }).find((e: any) => e.id === settlement.employeeId);
  const numericAmount = Math.round(Number(amount || 0));
  const isExceedingBalance = numericAmount > settlement.balanceDue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!numericAmount || numericAmount <= 0) {
      setFormError('El monto del pago debe ser mayor a ₲ 0.');
      return;
    }

    if (isExceedingBalance && (!canOverrideBalance || !overpaymentOverride)) {
      setFormError(
        `El monto (₲ ${numericAmount.toLocaleString('es-PY')}) supera el saldo pendiente (₲ ${settlement.balanceDue.toLocaleString('es-PY')}).`
      );
      return;
    }

    if (isExceedingBalance && overpaymentOverrideReason.trim().length < 10) {
      setFormError('La justificación de excedente auditado requiere al menos 10 caracteres.');
      return;
    }

    try {
      dbStore.recordStaffPayment({
        settlementId: settlement.id,
        amount: numericAmount,
        paymentMethod,
        paymentDate,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        overpaymentOverride: isExceedingBalance && overpaymentOverride,
        overpaymentOverrideReason: isExceedingBalance ? overpaymentOverrideReason.trim() : null,
      });
      if (onPaid) onPaid();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al registrar el pago al personal.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registrar Pago al Personal</h3>
              <p className="text-xs text-slate-500">
                {settlement.settlementNumber} • {getEmployeeDisplayName(employee)}
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

          <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs">
            <div>
              <div className="text-slate-400">Neto Liquidación</div>
              <div className="font-mono font-bold tabular-nums">
                ₲ {settlement.netPayable.toLocaleString('es-PY')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-400">Abonado</div>
              <div className="font-mono font-bold tabular-nums text-emerald-400">
                ₲ {settlement.paidAmount.toLocaleString('es-PY')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-slate-400">Saldo Pendiente</div>
              <div className="font-mono font-extrabold tabular-nums text-amber-300 text-sm">
                ₲ {settlement.balanceDue.toLocaleString('es-PY')}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Monto a Pagar (PYG ₲) *</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmount(String(Math.round(settlement.balanceDue / 2)))}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(String(settlement.balanceDue))}
                  className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 rounded cursor-pointer"
                >
                  100% Saldo
                </button>
              </div>
            </div>
            <input
              type="number"
              required
              min={1}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-mono font-bold tabular-nums focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {isExceedingBalance && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <span>El monto supera el saldo pendiente (₲ {settlement.balanceDue.toLocaleString('es-PY')})</span>
              </div>
              {canOverrideBalance ? (
                <>
                  <label className="flex items-center gap-2 text-amber-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overpaymentOverride}
                      onChange={(e) => setOverpaymentOverride(e.target.checked)}
                      className="rounded border-amber-400 text-amber-700 focus:ring-amber-500"
                    />
                    <span>Autorizar excedente de saldo (bajo auditoría)</span>
                  </label>
                  {overpaymentOverride && (
                    <input
                      type="text"
                      value={overpaymentOverrideReason}
                      onChange={(e) => setOverpaymentOverrideReason(e.target.value)}
                      placeholder="Justificación obligatoria (mín. 10 caracteres)..."
                      className="w-full text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-2"
                    />
                  )}
                </>
              ) : (
                <p className="text-[11px] text-amber-800">
                  Su rol no posee el permiso excepcional para pagar montos mayores al saldo aprobado.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500"
              >
                <option value="TRANSFERENCIA_SIPAP">Transferencia SIPAP</option>
                <option value="EFECTIVO">Efectivo (Guaraníes)</option>
                <option value="QR_BANCARIO">QR Bancario</option>
                <option value="TARJETA_DEBITO">Tarjeta Débito</option>
                <option value="TARJETA_CREDITO">Tarjeta Crédito</option>
                <option value="BILLETERA_DIGITAL">Billetera Digital</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Pago *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nro. Comprobante / Referencia</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Ej. SIPAP-884920 o Recibo Nro."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Nota interna o banco destino..."
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
              Confirmar Pago
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
