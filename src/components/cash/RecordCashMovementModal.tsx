import React, { useState } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  QrCode,
  Banknote,
  Send,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface RecordCashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashRegisterId: string;
  onMovementAdded?: (movementId: string) => void;
}

export const RecordCashMovementModal: React.FC<RecordCashMovementModalProps> = ({
  isOpen,
  onClose,
  cashRegisterId,
  onMovementAdded,
}) => {
  const { session } = useAuth();
  const patients = dbStore.getPatients();

  const [movementType, setMovementType] = useState<'INGRESO' | 'EGRESO'>('INGRESO');
  const [amount, setAmount] = useState<number>(200000);
  const [paymentMethod, setPaymentMethod] = useState<string>('EFECTIVO');
  const [concept, setConcept] = useState<string>('Cobro de consulta odontológica');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [patientId, setPatientId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg('El monto debe ser superior a ₲ 0.');
      return;
    }

    try {
      const receiptNum =
        movementType === 'INGRESO'
          ? `REC-001-001-${String(Math.floor(1000000 + Math.random() * 9000000))}`
          : undefined;

      const mov = dbStore.addCashMovement({
        cashRegisterId,
        movementType,
        amount,
        paymentMethod,
        concept,
        referenceNumber: referenceNumber || undefined,
        receiptNumber: receiptNum,
        patientId: patientId || undefined,
        actorUserId: session?.userId || dbStore.getUsers()[0]?.id,
      });

      if (onMovementAdded) onMovementAdded(mov.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al asentar movimiento.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`p-2 rounded-xl ${
                movementType === 'INGRESO'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {movementType === 'INGRESO' ? (
                <ArrowDownLeft className="h-5 w-5" />
              ) : (
                <ArrowUpRight className="h-5 w-5" />
              )}
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                {movementType === 'INGRESO' ? 'Registrar Cobro / Ingreso' : 'Registrar Gasto / Egreso'}
              </h2>
              <p className="text-xs text-slate-400">Asiento contable de caja diaria</p>
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
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Movement Type Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo de Movimiento
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMovementType('INGRESO');
                  setConcept('Cobro de tratamiento odontológico');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  movementType === 'INGRESO'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Ingreso / Cobro
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementType('EGRESO');
                  setConcept('Compra insumos urgentes / Caja chica');
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  movementType === 'EGRESO'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Egreso / Gasto
              </button>
            </div>
          </div>

          {/* Amount in PYG */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Monto en Guaraníes (PYG) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                ₲
              </span>
              <input
                type="number"
                step="5000"
                min="1000"
                required
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full pl-9 pr-3 py-2.5 text-base font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Medio de Cobro / Pago
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                { id: 'TRANSFERENCIA_SIPAP', label: 'SIPAP', icon: Send },
                { id: 'QR_BANCARIO', label: 'QR Bancario', icon: QrCode },
                { id: 'TARJETA_DEBITO', label: 'Débito POS', icon: CreditCard },
                { id: 'TARJETA_CREDITO', label: 'Crédito POS', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50 text-teal-800 ring-1 ring-teal-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
            {paymentMethod === 'EFECTIVO' ? (
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                * Afecta directamente el saldo físico de billetes en el cajón de dinero.
              </p>
            ) : (
              <p className="text-[11px] text-blue-700 font-medium mt-1">
                * Pago bancario/electrónico. No altera el conteo físico de billetes en arqueo.
              </p>
            )}
          </div>

          {/* Concept description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Concepto / Motivo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Pago de cuota de ortodoncia, Insumos de limpieza..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Patient link (optional) */}
          {movementType === 'INGRESO' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paciente Vinculado (Opcional)
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="">-- Sin vincular a paciente específico --</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (C.I. {p.documentNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reference / Voucher number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nro de Referencia / Comprobante / Voucher
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Ej: SIPAP-948301, POS-VOUCHER-5542..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors shadow-sm ${
                movementType === 'INGRESO'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Guardar {movementType === 'INGRESO' ? 'Ingreso' : 'Egreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
