import React, { useState } from 'react';
import { X, Check, CreditCard, Receipt, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

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

  const [amount, setAmount] = useState<number>(balance > 0 ? balance : 100000);
  const [paymentMethod, setPaymentMethod] = useState<string>('TRANSFERENCIA_SIPAP');
  const [receiptNumber, setReceiptNumber] = useState<string>(
    `REC-001-001-${Math.floor(1000000 + Math.random() * 9000000)}`
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !treatment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError('El monto a abonar debe ser mayor a ₲ 0.');
      return;
    }
    if (amount > treatment.balanceDue && treatment.balanceDue > 0) {
      setError(`El monto no puede superar el saldo pendiente de ${formatPYG(treatment.balanceDue)}.`);
      return;
    }

    try {
      dbStore.recordTreatmentPayment(
        treatment.id,
        amount,
        paymentMethod,
        receiptNumber,
        session?.userId
      );

      // If fully paid, optionally update status if was planificado
      if (amount >= treatment.balanceDue && treatment.status === 'PLANIFICADO') {
        dbStore.updateTreatmentStatus(treatment.id, 'EN_PROGRESO', undefined, session?.userId);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
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
        <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1 text-xs">
          <div className="font-bold text-slate-900">{treatment.title}</div>
          <div className="text-slate-600">
            Paciente: <span className="font-semibold">{patient?.firstName} {patient?.lastName}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
            <div>Total: <span className="font-bold text-slate-800">{formatPYG(treatment.totalAmount)}</span></div>
            <div>Pagado: <span className="font-bold text-emerald-700">{formatPYG(treatment.paidAmount)}</span></div>
            <div>Saldo: <span className="font-bold text-red-600">{formatPYG(treatment.balanceDue)}</span></div>
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
              step="1000"
              min="1000"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
              required
              className="w-full text-base font-extrabold text-slate-900 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
            <span className="text-xs text-teal-700 font-bold mt-1 block">
              {formatPYG(amount)}
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
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Confirmar Cobro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
