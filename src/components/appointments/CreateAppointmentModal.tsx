import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building2,
  Armchair,
  AlertTriangle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';
import {
  NO_PROFESSIONALS_MESSAGE,
  formatProfessionalOptionLabel,
  getActiveHealthProfessionals,
} from '../../utils/healthProfessional.ts';

interface CreateAppointmentModalProps {
  initialDate?: string;
  onClose: () => void;
}

export const CreateAppointmentModal: React.FC<CreateAppointmentModalProps> = ({
  initialDate,
  onClose,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const branches = snapshot.branches;
  const activePatients = snapshot.patients.filter((p) => p.status !== 'INACTIVE');
  const patients = activePatients.length > 0 ? activePatients : snapshot.patients;
  const dentists = getActiveHealthProfessionals(snapshot.users);
  const services = snapshot.services.filter((s) => s.status !== 'INACTIVE');

  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [patientId, setPatientId] = useState<string>(patients[0]?.id || '');
  const [odontologistId, setOdontologistId] = useState<string>(dentists[0]?.id || '');
  const [dentalChairId, setDentalChairId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>(services[0]?.id || '');
  const [appointmentDate, setAppointmentDate] = useState<string>(initialDate || getTodayAsuncionISO());
  const [startTime, setStartTime] = useState<string>('09:00');
  const [durationMin, setDurationMin] = useState<number>(30);
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available chairs for chosen branch
  const availableChairs = (snapshot.dentalChairs || []).filter(
    (c) => c.branchId === branchId && c.status !== 'INACTIVE'
  );

  // Automatically update duration when service changes
  const handleServiceChange = (sId: string) => {
    setServiceId(sId);
    const svc = services.find((s) => s.id === sId);
    if (svc && svc.defaultDurationMin) {
      setDurationMin(svc.defaultDurationMin);
    }
  };

  // Compute end time based on start time + duration
  const computeEndTime = (startStr: string, dur: number): string | null => {
    const [h, m] = startStr.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const totalMin = h * 60 + m + dur;
    if (totalMin > 23 * 60 + 59) return null;
    const endH = Math.floor(totalMin / 60);
    const endM = totalMin % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!patientId || !odontologistId || !branchId || !serviceId) {
      setErrorMessage('Por favor complete todos los campos obligatorios del agendamiento.');
      return;
    }

    const calculatedEndTime = computeEndTime(startTime, durationMin);
    if (!calculatedEndTime) {
      setErrorMessage('El horario supera el cierre del día (23:59). Ajuste la hora de inicio o la duración.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        branchId,
        dentalChairId: dentalChairId || undefined,
        patientId,
        odontologistId,
        serviceId,
        appointmentDate,
        startTime: `${startTime}:00`,
        endTime: calculatedEndTime,
        durationMin,
        reason: reason.trim() || 'Consulta clínica dental programada',
        notes,
      };

      if (hasBackendSession()) {
        const result = await postAuthoritativeAction('/api/appointments', payload);
        dbStore.applyAuthoritativeSync(
          {
            appointments: [result.appointment],
            ...(result.patientBranch ? { patientBranches: [result.patientBranch] } : {}),
            ...(result.auditLogs?.length ? { auditLogs: result.auditLogs } : {}),
          },
          result.stateVersion
        );
      } else {
        // Offline mode: find first free chair automatically if not explicitly chosen
        let resolvedChairId = dentalChairId || undefined;
        if (!resolvedChairId && availableChairs.length > 0) {
          const freeChair = availableChairs.find((ch) => {
            const check = dbStore.checkDoubleBooking({
              branchId,
              appointmentDate,
              startTime: `${startTime}:00`,
              endTime: calculatedEndTime,
              dentalChairId: ch.id,
            });
            return !check.hasConflict;
          });
          resolvedChairId = freeChair ? freeChair.id : availableChairs[0].id;
        }
        dbStore.addAppointment({
          ...payload,
          dentalChairId: resolvedChairId,
          actorUserId: session?.userId,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al validar conflicto de reserva.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2.5 md:p-4">
      <div className="bg-white rounded-2xl md:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="p-3.5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            <div className="p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-700/20 shrink-0">
              <Calendar className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-bold text-slate-900 truncate">Agendar Cita Odontológica</h2>
              <p className="text-[11px] md:text-xs text-slate-500 truncate">
                Validación activa de horario con prevención de Double Booking
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 md:p-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-3.5 md:p-6 space-y-3 md:space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Conflicto de Reserva Detectado:</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Patient Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Paciente (Ficha Médica) *
            </label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
              required
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — C.I. {p.documentNumber} ({p.city})
                </option>
              ))}
            </select>
          </div>

          {/* Branch & Dental Chair */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sucursal *
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDentalChairId('');
                }}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sillón Dental (Box Clínico) *
              </label>
              <select
                value={dentalChairId}
                onChange={(e) => setDentalChairId(e.target.value)}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
              >
                <option value="">Automático (Primer sillón libre)</option>
                {availableChairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.room || 'Consultorio'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Odontologist & Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Odontólogo Tratante *
              </label>
              <select
                value={odontologistId}
                onChange={(e) => setOdontologistId(e.target.value)}
                disabled={dentists.length === 0}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0 disabled:opacity-60"
                required
              >
                {dentists.length === 0 ? (
                  <option value="">{NO_PROFESSIONALS_MESSAGE}</option>
                ) : (
                  dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatProfessionalOptionLabel(d)}
                    </option>
                  ))
                )}
              </select>
              {dentists.length === 0 && (
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  {NO_PROFESSIONALS_MESSAGE}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Servicio / Prestación *
              </label>
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.defaultDurationMin} min)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha de la Cita *
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hora de Inicio (24h) *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                step="900"
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Duración (Minutos) *
              </label>
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none min-h-[44px] md:min-h-0"
              >
                <option value={15}>15 minutos</option>
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos (1 hora)</option>
                <option value={90}>90 minutos (1.5 horas)</option>
                <option value={120}>120 minutos (2 horas)</option>
              </select>
            </div>
          </div>

          {/* Reason & Clinical Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo de la Cita / Observaciones
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Dolor agudo en molar superior derecho, requiere evaluación y radiografía periapical..."
              className="w-full text-base md:text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 md:pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 min-h-[44px] md:min-h-0"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 md:px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] md:min-h-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isSubmitting ? 'Validando...' : 'Confirmar y Agendar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
