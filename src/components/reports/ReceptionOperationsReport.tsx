import React from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Building2,
  Users,
  Stethoscope,
  Phone,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';

interface ReceptionOperationsReportProps {
  selectedBranchId: string;
}

export const ReceptionOperationsReport: React.FC<ReceptionOperationsReportProps> = ({
  selectedBranchId,
}) => {
  const snapshot = dbStore.getSnapshot();
  const appointments = snapshot.appointments || [];
  const cashRegisters = snapshot.cashRegisters || [];
  const patients = snapshot.patients || [];
  const doctors = snapshot.users.filter((u) => u.roleId === 'ODONTOLOGO');
  const branches = snapshot.branches;

  const filteredAppointments = selectedBranchId
    ? appointments.filter((a) => a.branchId === selectedBranchId)
    : appointments;

  const activeCashRegister = cashRegisters.find((cr) => {
    if (selectedBranchId && cr.branchId !== selectedBranchId) return false;
    return cr.status === 'ABIERTA';
  });

  // Tally appointment statuses
  const statusCounts = {
    CONFIRMADA: filteredAppointments.filter((a) => a.status === 'CONFIRMADA').length,
    EN_ATENCION: filteredAppointments.filter((a) => a.status === 'EN_ATENCION').length,
    COMPLETADA: filteredAppointments.filter((a) => a.status === 'COMPLETADA').length,
    CANCELADA: filteredAppointments.filter((a) => a.status === 'CANCELADA').length,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Control Operativo de Recepción & Sala de Espera
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              Operaciones de Turno
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión en tiempo real de pacientes citados, tiempos de espera, asignación de sillones y estado de caja
          </p>
        </div>

        {activeCashRegister ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Caja de Turno Activa: {formatPYG(activeCashRegister.openingAmount)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>Sin caja activa en la sucursal seleccionada</span>
          </div>
        )}
      </div>

      {/* Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Citas Agendadas Hoy</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{filteredAppointments.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pacientes citados en agenda</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">En Sillón / Atención</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">{statusCounts.EN_ATENCION}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">Tratamiento en curso</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Completadas con Éxito</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{statusCounts.COMPLETADA}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Altas y cobros efectuados</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Confirmadas / Por Llegar</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-teal-700">{statusCounts.CONFIRMADA}</div>
          <div className="text-[11px] text-teal-600 font-medium mt-1">Recordatorio enviado vía WhatsApp</div>
        </div>
      </div>

      {/* Appointment Timeline List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Flujo de Pacientes de la Jornada
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Horarios, profesional asignado y estado en tiempo real
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {filteredAppointments.length} turnos registrados
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredAppointments.map((app) => {
            const patient = patients.find((p) => p.id === app.patientId);
            const doctor = doctors.find((d) => d.id === app.odontologistId);
            const branch = branches.find((b) => b.id === app.branchId);

            return (
              <div key={app.id} className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                      </span>
                      <span className="text-[11px] text-slate-500">CI: {patient?.documentNumber}</span>
                      <span className="text-[11px] text-slate-400">• Cel: {patient?.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3 text-teal-600" />
                        Dr(a). {doctor ? `${doctor.firstName} ${doctor.lastName}` : 'Odontólogo'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {branch?.name}
                      </span>
                      <span>•</span>
                      <span>Motivo: {app.reason || 'Consulta'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      app.status === 'EN_ATENCION'
                        ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                        : app.status === 'COMPLETADA'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
