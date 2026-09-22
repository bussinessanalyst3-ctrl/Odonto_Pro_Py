import React, { useState } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import {
  X,
  Lock,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Send,
  QrCode,
  CreditCard,
} from 'lucide-react';

interface CloseCashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashRegisterId: string;
  onClosed?: () => void;
}

export const CloseCashRegisterModal: React.FC<CloseCashRegisterModalProps> = ({
  isOpen,
  onClose,
  cashRegisterId,
  onClosed,
}) => {
  const { session } = useAuth();
  const register = dbStore.getCashRegisters().find((cr) => cr.id === cashRegisterId);
  const movements = dbStore.getCashMovements(cashRegisterId);

  if (!isOpen || !register) return null;

  // Physical Cash calculations
  const openingAmount = register.openingAmount;
  const cashIngresos = movements
    .filter((m) => m.movementType === 'INGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const cashEgresos = movements
    .filter((m) => m.movementType === 'EGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const expectedCash = openingAmount + cashIngresos - cashEgresos;

  // Electronic & Non-cash movements
  const sipapTotal = movements
    .filter((m) => m.paymentMethod === 'TRANSFERENCIA_SIPAP' && m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const qrTotal = movements
    .filter((m) => m.paymentMethod === 'QR_BANCARIO' && m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const posTotal = movements
    .filter((m) => (m.paymentMethod === 'TARJETA_DEBITO' || m.paymentMethod === 'TARJETA_CREDITO') && m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const [realCashCount, setRealCashCount] = useState<number>(expectedCash);
  const [closingNotes, setClosingNotes] = useState<string>(
    'Arqueo conforme. Dinero en efectivo guardado en caja fuerte de sucursal.'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const difference = realCashCount - expectedCash;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      dbStore.closeCashRegister({
        cashRegisterId,
        closingAmountReal: realCashCount,
        observations: closingNotes,
        actorUserId: session?.userId || dbStore.getUsers()[0]?.id,
      });

      if (onClosed) onClosed();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cerrar la caja.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Arqueo y Cierre de Caja</h2>
              <p className="text-xs text-slate-400">Verificación física y balance contable</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="m-6 mb-0 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Breakdown cards */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Fondo Inicial de Apertura:</span>
              <span className="font-semibold text-slate-800">
                ₲ {openingAmount.toLocaleString('es-PY')}
              </span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>(+) Ingresos en Efectivo:</span>
              <span className="font-semibold">
                +₲ {cashIngresos.toLocaleString('es-PY')}
              </span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>(-) Egresos / Gastos en Efectivo:</span>
              <span className="font-semibold">
                -₲ {cashEgresos.toLocaleString('es-PY')}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-900 text-sm">
                Efectivo Teórico Esperado en Cajón:
              </span>
              <span className="font-black text-slate-900 text-base">
                ₲ {expectedCash.toLocaleString('es-PY')}
              </span>
            </div>
          </div>

          {/* Electronic Totals Box for banking reconciliation */}
          <div className="bg-slate-100/70 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1">
            <span className="font-bold text-slate-700 block mb-1">
              Cobros Electrónicos / Bancarios (Acreditan en cuenta):
            </span>
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <Send className="h-3 w-3 text-blue-600" /> Transferencias SIPAP:
              </span>
              <span className="font-semibold text-slate-800">₲ {sipapTotal.toLocaleString('es-PY')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <QrCode className="h-3 w-3 text-teal-600" /> QR Bancard / Pagopar:
              </span>
              <span className="font-semibold text-slate-800">₲ {qrTotal.toLocaleString('es-PY')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span className="flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-purple-600" /> POS Tarjetas:
              </span>
              <span className="font-semibold text-slate-800">₲ {posTotal.toLocaleString('es-PY')}</span>
            </div>
          </div>

          {/* Real Counted Cash Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Efectivo Físico Contado en Caja (PYG) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                ₲
              </span>
              <input
                type="number"
                step="1000"
                min="0"
                required
                value={realCashCount}
                onChange={(e) => setRealCashCount(parseInt(e.target.value, 10) || 0)}
                className="w-full pl-9 pr-3 py-2.5 text-lg font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Difference Indicator */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
              difference === 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : difference > 0
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'bg-red-50 border-red-300 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {difference === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <div>
                <span className="font-bold">
                  {difference === 0
                    ? 'Caja Cuadrada Perfecta'
                    : difference > 0
                    ? 'Sobrante de Caja'
                    : 'Faltante de Caja'}
                </span>
                <p className="text-[10px] opacity-80">
                  {difference === 0
                    ? 'El conteo físico coincide exactamente con los registros del sistema.'
                    : difference > 0
                    ? 'Hay más efectivo físico que el registrado en movimientos.'
                    : 'Falta dinero en efectivo físico respecto al esperado.'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-black">
                {difference > 0 ? '+' : ''}₲ {difference.toLocaleString('es-PY')}
              </span>
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones del Cierre de Caja
            </label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Justificación de diferencias si las hubiere..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm"
            >
              <Lock className="h-4 w-4" />
              Confirmar Cierre de Turno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
