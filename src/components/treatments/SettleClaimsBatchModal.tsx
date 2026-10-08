import React, { useState } from 'react';
import { X, Check, Landmark, DollarSign, ShieldCheck, AlertCircle, FileText } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface SettleClaimsBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  claimsToSettle: any[];
  plan?: any;
  onSuccess?: () => void;
}

export const SettleClaimsBatchModal: React.FC<SettleClaimsBatchModalProps> = ({
  isOpen,
  onClose,
  claimsToSettle,
  plan,
  onSuccess,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();
  const openCashRegister = (snapshot.cashRegisters || []).find((c) => c.status === 'ABIERTA');

  const [settlementReference, setSettlementReference] = useState(() => {
    const code = plan?.code ? plan.code.replace(/[^A-Z0-9]/gi, '').slice(0, 4) : 'SEG';
    return `SIPAP-${code}-${Math.floor(100000 + Math.random() * 900000)}`;
  });
  const [paymentMethod, setPaymentMethod] = useState('TRANSFERENCIA_SIPAP');
  const [depositInCash, setDepositInCash] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || claimsToSettle.length === 0) return null;

  const totalCoveredAmount = claimsToSettle.reduce((sum, c) => sum + (c.coveredAmount || 0), 0);
  const totalListPrice = claimsToSettle.reduce((sum, c) => sum + (c.originalListPrice || 0), 0);
  const totalCopay = claimsToSettle.reduce((sum, c) => sum + (c.copayAmount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!settlementReference.trim()) {
      setError('Debe ingresar el número de comprobante o referencia de liquidación de la aseguradora.');
      return;
    }

    setIsSubmitting(true);
    try {
      const claimIds = claimsToSettle.map((c) => c.id);
      dbStore.batchSettleInsuranceClaims({
        claimIds,
        paymentMethod,
        settlementReference: settlementReference.trim().toUpperCase(),
        targetCashRegisterId: depositInCash && openCashRegister ? openCashRegister.id : undefined,
        actorUserId: session?.userId,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al procesar la liquidación del lote.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Liquidar y Cobrar Lote de Aseguradora
              </h3>
              <p className="text-xs text-slate-500">
                Cancelación de coberturas y asiento financiero en Paraguay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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

        {/* Plan & Batch Summary */}
        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900">
                {plan?.name || 'Aseguradora / Plan Odontológico'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              {claimsToSettle.length} prestaciones seleccionadas
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Arancel Total</span>
              <span className="font-bold text-slate-700">{formatPYG(totalListPrice)}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Copago Pacientes</span>
              <span className="font-bold text-slate-600">{formatPYG(totalCopay)}</span>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-700 font-bold uppercase block">Monto a Liquidar</span>
              <span className="font-extrabold text-emerald-800">{formatPYG(totalCoveredAmount)}</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Comprobante SIPAP / Nro. de Liquidación de la Aseguradora: <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={settlementReference}
                onChange={(e) => setSettlementReference(e.target.value)}
                placeholder="Ej: SIPAP-ITAU-948201 o REF-ASISMED-881"
                required
                className="w-full text-xs font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              <FileText className="h-4 w-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Medio de Cobro Bancario:
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="TRANSFERENCIA_SIPAP">Transferencia Interbancaria SIPAP (Bancos Paraguay)</option>
              <option value="CHEQUE">Cheque Administrativo Bancario</option>
              <option value="EFECTIVO">Efectivo en Caja</option>
              <option value="QR_BANCARIO">Cobro QR / Transferencia Inmediata</option>
            </select>
          </div>

          {openCashRegister ? (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="depositCheck"
                checked={depositInCash}
                onChange={(e) => setDepositInCash(e.target.checked)}
                className="mt-0.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="depositCheck" className="text-xs text-emerald-900 cursor-pointer">
                <span className="font-bold">Asentar automáticamente como Ingreso en la Caja Diaria Abierta</span>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Registrará un movimiento de ingreso por {formatPYG(totalCoveredAmount)} con concepto "Liquidación Aseguradora".
                </p>
              </label>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              <span className="font-bold">Nota de caja:</span> No hay ninguna caja diaria abierta actualmente. La liquidación se asentará en el historial financiero pero no impactará en caja física.
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Liquidando...' : `Confirmar Cobro de ${formatPYG(totalCoveredAmount)}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
