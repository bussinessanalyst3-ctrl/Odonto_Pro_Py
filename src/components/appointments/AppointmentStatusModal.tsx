import React, { useState } from 'react';
import {
  X,
  Clock,
  UserCheck,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Building2,
  Armchair
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface AppointmentStatusModalProps {
  appointment: any;
  onClose: () => void;
}

export const AppointmentStatusModal: React.FC<AppointmentStatusModalProps> = ({
  appointment,
  onClose,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const patient = snapshot.patients.find((p) => p.id === appointment.patientId);
  const dentist = snapshot.users.find((u) => u.id === appointment.odontologistId);
  const branch = snapshot.branches.find((b) => b.id === appointment.branchId);
  const chair = (snapshot.dentalChairs || []).find((c) => c.id === appointment.dentalChairId);

  const [status, setStatus] = useState<any>(appointment.status);
  const [cancellationReason, setCancellationReason] = useState<string>(
    appointment.cancellationReason || ''
  );

  const handleUpdate = () => {
    dbStore.updateAppointmentStatus(
      appointment.id,
      status,
      status === 'CANCELADA' ? cancellationReason : undefined,
      session?.userId
    );
    onClose();
  };

  const statusOptions = [
    {
      value: 'PENDIENTE',
      label: 'Pendiente de Confirmación',
      desc: 'Cita solicitada pendiente de confirmación con el paciente.',
      icon: Clock,
      color: 'amber',
    },
    {
      value: 'CONFIRMADA',
      label: 'Confirmada',
      desc: 'El paciente confirmó asistencia telefónicamente o vía WhatsApp.',
      icon: CheckCircle2,
      color: 'blue',
    },
    {
      value: 'EN_SALA',
      label: 'En Sala de Espera (Recepción)',
      desc: 'El paciente se presentó físicamente en recepción de la clínica.',
      icon: UserCheck,
      color: 'purple',
    },
    {
      value: 'EN_ATENCION',
      label: 'En Atención / Sillón Clínico',
      desc: 'El paciente ingresó al box y está siendo atendido por el profesional.',
      icon: Stethoscope,
      color: 'emerald',
    },
    {
      value: 'FINALIZADA',
      label: 'Finalizada / Completada',
      desc: 'Tratamiento de la sesión concluido. Pasa a caja o próxima cita.',
      icon: CheckCircle2,
      color: 'teal',
    },
    {
      value: 'CANCELADA',
      label: 'Cancelada',
      desc: 'Cita cancelada por el paciente o por la clínica.',
      icon: XCircle,
      color: 'rose',
    },
    {
      value: 'NO_ASISTIO',
      label: 'No Asistió (Ausente)',
      desc: 'El paciente no se presentó sin previo aviso.',
      icon: AlertCircle,
      color: 'slate',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Estado de Atención Clínica</h2>
            <p className="text-xs text-slate-500">
              {patient?.firstName} {patient?.lastName} • {appointment.appointmentDate} (
              {appointment.startTime.slice(0, 5)} hs)
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Quick info */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1 text-slate-600">
            <div>
              <strong>Profesional:</strong> Dr(a). {dentist?.firstName} {dentist?.lastName}
            </div>
            <div>
              <strong>Sucursal:</strong> {branch?.name} ({chair?.name || 'Sillón General'})
            </div>
            <div>
              <strong>Motivo:</strong> {appointment.reason || 'Sin motivo detallado'}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Seleccionar Nuevo Estado de Turno:
            </label>

            {statusOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = status === opt.value;

              return (
                <div
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cancellation reason input if CANCELADA */}
          {status === 'CANCELADA' && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Motivo de Cancelación *
              </label>
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ej. Paciente avisa por WhatsApp que tuvo inconveniente laboral..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleUpdate}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 transition-all"
            >
              Guardar Cambio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
