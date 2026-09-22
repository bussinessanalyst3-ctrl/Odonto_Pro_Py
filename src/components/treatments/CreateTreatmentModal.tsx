import React, { useState } from 'react';
import { X, Check, Stethoscope, AlertCircle, Plus } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface CreateTreatmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string;
  initialToothNumber?: number;
}

export const CreateTreatmentModal: React.FC<CreateTreatmentModalProps> = ({
  isOpen,
  onClose,
  initialPatientId,
  initialToothNumber,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const [patientId, setPatientId] = useState<string>(initialPatientId || snapshot.patients[0]?.id || '');
  const [branchId, setBranchId] = useState<string>(snapshot.branches[0]?.id || '');
  const [serviceId, setServiceId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [odontologistId, setOdontologistId] = useState<string>(
    session?.role === 'ODONTOLOGO'
      ? session.userId
      : snapshot.users.find((u) => u.roleId === 'ODONTOLOGO')?.id || snapshot.users[0]?.id || ''
  );
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [status, setStatus] = useState<'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO'>('PLANIFICADO');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toothInput, setToothInput] = useState<string>(initialToothNumber ? String(initialToothNumber) : '');
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // When service is selected, auto-fill title and base price
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setServiceId(sId);
    if (!sId) return;

    const s = snapshot.services.find((serv) => serv.id === sId);
    if (s) {
      if (!title || title === '') {
        setTitle(s.name);
      }
      setTotalAmount(s.basePrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patientId) {
      setError('Debe seleccionar un paciente.');
      return;
    }
    if (!title.trim()) {
      setError('El título del tratamiento es obligatorio.');
      return;
    }
    if (totalAmount <= 0) {
      setError('El monto total debe ser mayor a ₲ 0.');
      return;
    }

    // Parse tooth numbers
    const toothNumbers: number[] = toothInput
      .split(/[\s,]+/)
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n) && n > 10 && n < 90);

    try {
      dbStore.addTreatment({
        patientId,
        branchId,
        title,
        totalAmount,
        paidAmount,
        toothNumbers,
        odontologistId,
        status,
        startDate,
        notes,
        actorUserId: session?.userId,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el tratamiento.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nuevo Plan de Tratamiento Odontológico
              </h3>
              <p className="text-xs text-slate-500">
                Fase 10 • Vinculación a catálogo de servicios y piezas dentales FDI
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Patient */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Paciente:
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {snapshot.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (C.I. {p.nationalId})
                  </option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Sucursal de Atención:
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {snapshot.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Service (optional helper) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Cargar desde Catálogo de Servicios (Autocompleta precio base):
            </label>
            <select
              value={serviceId}
              onChange={handleServiceChange}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            >
              <option value="">-- Seleccionar servicio del catálogo --</option>
              {snapshot.services.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.category}] {s.name} — {formatPYG(s.basePrice)}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Título / Procedimiento del Tratamiento:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Restauración con resina compuesta estética pieza 16"
              required
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tooth Numbers */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Piezas FDI Vinculadas:
              </label>
              <input
                type="text"
                value={toothInput}
                onChange={(e) => setToothInput(e.target.value)}
                placeholder="Ej: 16, 26, 48"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Separar por comas</span>
            </div>

            {/* Total Amount */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Monto Total (PYG):
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(parseInt(e.target.value, 10) || 0)}
                required
                className="w-full text-xs font-bold text-slate-900 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-teal-700 font-semibold mt-0.5 block">
                {formatPYG(totalAmount)}
              </span>
            </div>

            {/* Initial Paid Amount */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Seña / Pago Inicial (PYG):
              </label>
              <input
                type="number"
                step="1000"
                min="0"
                max={totalAmount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Saldo: {formatPYG(Math.max(0, totalAmount - paidAmount))}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Odontologist */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Odontólogo Tratante:
              </label>
              <select
                value={odontologistId}
                onChange={(e) => setOdontologistId(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {snapshot.users
                  .filter((u) => u.roleId === 'ODONTOLOGO' || u.roleId === 'SUPER_ADMIN')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      Dr(a). {u.firstName} {u.lastName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Estado Inicial:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="PLANIFICADO">PLANIFICADO</option>
                <option value="EN_PROGRESO">EN PROGRESO</option>
                <option value="COMPLETADO">COMPLETADO</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Fecha de Inicio:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Observaciones Clínicas / Presupuestarias:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instrucciones clínicas, sesiones estimadas, condiciones acordadas..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
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
              <span>Crear Tratamiento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
