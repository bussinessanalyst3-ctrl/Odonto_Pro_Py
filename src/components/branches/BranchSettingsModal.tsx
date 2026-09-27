import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, Check, Armchair, Plus, Trash2 } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface BranchSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: any;
}

export const BranchSettingsModal: React.FC<BranchSettingsModalProps> = ({
  isOpen,
  onClose,
  branch,
}) => {
  const { session } = useAuth();
  const [durationDefault, setDurationDefault] = useState(30);
  const [slotInterval, setSlotInterval] = useState(15);
  const [allowDoubleBooking, setAllowDoubleBooking] = useState(false);
  const [requireDoc, setRequireDoc] = useState(true);
  const [receiptSeries, setReceiptSeries] = useState('001-001');
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dental chairs state (local to branch)
  const [chairs, setChairs] = useState<Array<{ id: string; name: string; type: string; status: 'ACTIVE' | 'MAINTENANCE' }>>([
    { id: 'c1', name: 'Sillón 1 - Odontología General & Diagnóstico', type: 'General', status: 'ACTIVE' },
    { id: 'c2', name: 'Sillón 2 - Ortodoncia & Estética Dental', type: 'Ortodoncia', status: 'ACTIVE' },
    { id: 'c3', name: 'Sillón 3 - Quirófano / Cirugía Menor', type: 'Cirugía', status: 'ACTIVE' },
  ]);
  const [newChairName, setNewChairName] = useState('');

  useEffect(() => {
    if (branch) {
      const settings = dbStore.getBranchSettings(branch.id);
      if (settings) {
        setDurationDefault(settings.appointmentDurationDefault);
        setSlotInterval(settings.slotIntervalMinutes);
        setAllowDoubleBooking(settings.allowDoubleBooking);
        setRequireDoc(settings.requireDocumentOnBooking);
        setReceiptSeries(settings.receiptSeries || '001-001');
        setMaxAdvanceDays(settings.maxAdvanceBookingDays || 60);
      }
    }
  }, [branch, isOpen]);

  if (!isOpen || !branch) return null;

  const handleAddChair = () => {
    if (!newChairName.trim()) return;
    setChairs([
      ...chairs,
      {
        id: `chair-${Date.now().toString().slice(-4)}`,
        name: newChairName.trim(),
        type: 'General',
        status: 'ACTIVE',
      },
    ]);
    setNewChairName('');
  };

  const handleRemoveChair = (id: string) => {
    setChairs(chairs.filter((c) => c.id !== id));
  };

  const handleToggleChairStatus = (id: string) => {
    setChairs(
      chairs.map((c) =>
        c.id === id ? { ...c, status: c.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE' } : c
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const actor = session ? {
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      allowedBranchIds: session.allowedBranchIds,
    } : undefined;

    try {
      dbStore.updateBranchSettings(branch.id, {
        appointmentDurationDefault: durationDefault,
        slotIntervalMinutes: slotInterval,
        allowDoubleBooking,
        requireDocumentOnBooking: requireDoc,
        receiptSeries,
        maxAdvanceBookingDays: maxAdvanceDays,
      }, actor);

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar configuraciones de sucursal');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Configuración Operativa: {branch.name}
              </h3>
              <p className="text-xs text-slate-500">
                Políticas de agendamiento, sillones dentales y serie legal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Scheduling Rules */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Reglas de Agendamiento de Turnos
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Duración Predeterminada
                </label>
                <select
                  value={durationDefault}
                  onChange={(e) => setDurationDefault(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  <option value={15}>15 minutos (Evaluación rápida)</option>
                  <option value={30}>30 minutos (Consulta estándar)</option>
                  <option value={45}>45 minutos (Procedimiento medio)</option>
                  <option value={60}>60 minutos (Tratamiento complejo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Intervalo de Grilla (Slots)
                </label>
                <select
                  value={slotInterval}
                  onChange={(e) => setSlotInterval(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  <option value={10}>Cada 10 minutos</option>
                  <option value={15}>Cada 15 minutos (Recomendado)</option>
                  <option value={30}>Cada 30 minutos</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Anticipación Máxima
                </label>
                <select
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(Number(e.target.value))}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
                >
                  <option value={30}>30 días (1 mes)</option>
                  <option value={60}>60 días (2 meses)</option>
                  <option value={90}>90 días (3 meses)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Serie de Comprobantes de Caja
                </label>
                <input
                  type="text"
                  value={receiptSeries}
                  onChange={(e) => setReceiptSeries(e.target.value)}
                  placeholder="001-001"
                  className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Checkbox settings */}
            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!allowDoubleBooking}
                  onChange={(e) => setAllowDoubleBooking(!e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>
                  <strong>Bloqueo Concurrente Estricto:</strong> Impedir reservas simultáneas en el mismo sillón odontológico.
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireDoc}
                  onChange={(e) => setRequireDoc(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>
                  <strong>Exigir Documento de Identidad (C.I. / RUC)</strong> para confirmar turno médico.
                </span>
              </label>
            </div>
          </div>

          {/* Dental Chairs Operatories */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Armchair className="h-4 w-4 text-teal-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sillones Odontológicos & Box Clínicos ({chairs.length})
                </h4>
              </div>
            </div>

            {/* Chairs list */}
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {chairs.map((chair) => (
                <div
                  key={chair.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        chair.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    ></span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{chair.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {chair.status === 'ACTIVE' ? 'Operativo' : 'En Mantenimiento'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleChairStatus(chair.id)}
                      className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {chair.status === 'ACTIVE' ? 'Pausar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveChair(chair.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add chair form */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Nombre del nuevo sillón (Ej. Sillón 4 - Implantes)"
                value={newChairName}
                onChange={(e) => setNewChairName(e.target.value)}
                className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={handleAddChair}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-teal-50/80 border border-teal-100 rounded-2xl text-xs text-teal-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Los cambios en los parámetros se aplicarán inmediatamente en la grilla de agendamiento
              y en la asignación de turnos concurrentes para esta sucursal.
            </span>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
