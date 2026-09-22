import React, { useState } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { X, DollarSign, Building2, User, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OpenCashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  onOpened?: () => void;
}

export const OpenCashRegisterModal: React.FC<OpenCashRegisterModalProps> = ({
  isOpen,
  onClose,
  branchId: initialBranchId,
  onOpened,
}) => {
  const { session } = useAuth();
  const branches = dbStore.getBranches();

  const [branchId, setBranchId] = useState<string>(
    initialBranchId || session?.currentBranchId || branches[0]?.id || ''
  );
  const [openingAmount, setOpeningAmount] = useState<number>(500000); // ₲ 500.000 default
  const [observations, setObservations] = useState<string>(
    'Fondo fijo para cambio inicial: 10x 20.000, 6x 50.000'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      dbStore.openCashRegister({
        branchId,
        openingAmount,
        observations,
        actorUserId: session?.userId || dbStore.getUsers()[0]?.id,
      });

      if (onOpened) onOpened();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al abrir la caja.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <DollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">Apertura de Caja Diaria</h2>
              <p className="text-xs text-slate-400">Inicio de turno de cobranzas y caja chica</p>
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sucursal de Operación <span className="text-red-500">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fondo de Cambio Inicial en Guaraníes (PYG) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                ₲
              </span>
              <input
                type="number"
                step="10000"
                min="0"
                required
                value={openingAmount}
                onChange={(e) => setOpeningAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full pl-8 pr-3 py-2.5 text-base font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Monto físico en efectivo disponible para vueltos al abrir el turno.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones de Apertura
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Detalle de billetes o notas de entrega de turno..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Abrir Turno de Caja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
