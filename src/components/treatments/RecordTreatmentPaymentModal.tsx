import React, { useState, useEffect } from 'react';
import { X, Check, CreditCard, Receipt, AlertCircle, ShieldCheck, Calendar } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG, validatePygPrice } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';

interface RecordTreatmentPaymentModalProps {
  treatment: any;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordTreatmentPaymentModal: React.FC<RecordTreatmentPaymentModalProps> = ({
  treatment,
  isOpen,
  onClose,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const patient = treatment ? snapshot.patients.find((p) => p.id === treatment.patientId) : null;
  const balance = treatment ? treatment.balanceDue : 0;

  const todayIso = getTodayAsuncionISO();
  const [amountInput, setAmountInput] = useState<string>(balance > 0 ? String(Math.round(balance)) : '100000');
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFERENCIA_SIPAP');
  const [receiptNumber, setReceiptNumber] = useState<string>(() => dbStore.getNextReceiptNumber());
  const [paymentDate, setPaymentDate] = useState<string>(todayIso);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !treatment) return;
    const currentBalance = Math.round(Number(treatment.balanceDue) || 0);
    setAmountInput(currentBalance > 0 ? String(currentBalance) : '0');
    setReceiptNumber(dbStore.getNextReceiptNumber());
    setPaymentDate(getTodayAsuncionISO());
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, treatment?.id, treatment?.balanceDue]);

  if (!isOpen || !treatment) return null;

  const isHistoricalPayment = Boolean(paymentDate && paymentDate < todayIso);

  const parsedAmount = (() => {
    const num = Number(amountInput.trim());
    return Number.isFinite(num) && Number.isInteger(num) && num > 0 ? num : 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    let validatedAmount: number;
    try {
      validatedAmount = validatePygPrice(Number(amountInput.trim()), 'El monto a cobrar');
    } catch (validationErr: any) {
      setError(validationErr.message || 'El monto a abonar debe ser un entero mayor a ₲ 0.');
      return;
    }

    if (validatedAmount > treatment.balanceDue && treatment.balanceDue > 0) {
      setError(`El monto no puede superar el saldo pendiente de ${formatPYG(treatment.balanceDue)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (hasBackendSession()) {
        const result = await postAuthoritativeAction(`/api/treatments/${treatment.id}/payments`, {
          amount: validatedAmount,
          paymentMethod,
          receiptNumber,
          paymentDate,
          autoProgressIfPaid: validatedAmount >= treatment.balanceDue && treatment.status === 'PLANIFICADO',
        });
        dbStore.applyAuthoritativeSync(
          {
            treatments: [result.treatment],
            payments: [result.payment],
            ...(result.cashMovement ? { cashMovements: [result.cashMovement] } : {}),
            ...(result.generatedCommissions?.length ? { generatedCommissions: result.generatedCommissions } : {}),
            ...(result.auditLogs?.length ? { auditLogs: result.auditLogs } : {}),
          },
          result.stateVersion
        );
      } else {
        dbStore.recordTreatmentPayment(
          treatment.id,
          validatedAmount,
          paymentMethod,
          receiptNumber,
          session?.userId,
          paymentDate
        );

        if (validatedAmount >= treatment.balanceDue && treatment.status === 'PLANIFICADO') {
          dbStore.updateTreatmentStatus(treatment.id, 'EN_PROGRESO', undefined, session?.userId);
        }
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Registrar Cobro de Tratamiento
              </h3>
              <p className="text-xs text-slate-500">
                Emisión de Recibo en Guaraníes (PYG)
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

        {/* Treatment Info Summary */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900">{treatment.title}</div>
            {treatment.appliedModality === 'PLAN_SEGURO' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-indigo-600" />
                <span>{treatment.appliedPlanName || 'Seguro Dental'}</span>
              </span>
            )}
          </div>
          <div className="text-slate-600 flex items-center justify-between">
            <span>
              Paciente: <span className="font-semibold">{patient?.firstName} {patient?.lastName}</span>
            </span>
            {patient?.insuranceMemberNumber && (
              <span className="text-[11px] font-mono text-indigo-700 font-semibold">
                Carnet: {patient.insuranceMemberNumber}
              </span>
            )}
          </div>

          {treatment.appliedModality === 'PLAN_SEGURO' && treatment.originalListPrice && treatment.originalListPrice > treatment.totalAmount && (
            <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 flex items-center justify-between">
              <div>
                Arancel: <span className="line-through text-slate-400">{formatPYG(treatment.originalListPrice)}</span>
                {' • '}
                Cobertura: <span className="font-bold text-indigo-700">{formatPYG(treatment.originalListPrice - treatment.totalAmount)}</span>
              </div>
              <div className="font-bold">
                Copago: {formatPYG(treatment.totalAmount)}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
            <div>Total Tratamiento: <span className="font-bold text-slate-800">{formatPYG(treatment.totalAmount)}</span></div>
            <div>Pagado: <span className="font-bold text-emerald-700">{formatPYG(treatment.paidAmount)}</span></div>
            <div>Saldo Pendiente: <span className="font-bold text-red-600">{formatPYG(treatment.balanceDue)}</span></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Payment Amount */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Monto a Cobrar en Guaraníes (PYG):
            </label>
            <input
              type="number"
              step="1"
              min="1"
              inputMode="numeric"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              required
              className="w-full text-base font-extrabold text-slate-900 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
            <span className="text-xs text-teal-700 font-bold mt-1 block">
              {formatPYG(parsedAmount)}
            </span>
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Forma de Cobro:
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            >
              <option value="EFECTIVO">Efectivo en Caja</option>
              <option value="TRANSFERENCIA_SIPAP">Transferencia Bancaria SIPAP</option>
              <option value="QR_BANCARIO">Cobro QR Bancard / Bancario</option>
              <option value="TARJETA_DEBITO">Tarjeta de Débito (POS)</option>
              <option value="TARJETA_CREDITO">Tarjeta de Crédito (POS)</option>
            </select>
          </div>

          {/* Payment Date (permite carga histórica) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Fecha de Cobro:
            </label>
            <div className="relative">
              <input
                type="date"
                max={todayIso}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <Calendar className="h-4 w-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            {isHistoricalPayment && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5">
                Cobro con fecha histórica ({paymentDate}): actualizará el saldo del tratamiento sin alterar la caja abierta de hoy.
              </p>
            )}
          </div>

          {/* Receipt Number */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Número de Recibo Oficial:
            </label>
            <div className="relative">
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                required
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <Receipt className="h-4 w-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Procesando...' : 'Confirmar Cobro'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
