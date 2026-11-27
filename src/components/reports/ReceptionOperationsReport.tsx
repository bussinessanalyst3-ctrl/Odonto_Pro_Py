import React, { useState, useEffect } from 'react';
import {
  Building2,
  Stethoscope,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  ReportPeriodFilter,
  getPeriodLabel,
  isDateInReportPeriod,
} from '../../utils/reportPeriod.ts';
import { formatProfessionalName } from '../../utils/healthProfessional.ts';
import { getAppointmentStatusMeta } from '../../utils/visualIdentity.ts';
import { PatientAvatar, StatusLabel } from '../ui/DesignPrimitives.tsx';

interface ReceptionOperationsReportProps {
  selectedBranchId: string;
  periodFilter?: ReportPeriodFilter;
}

export const ReceptionOperationsReport: React.FC<ReceptionOperationsReportProps> = ({
  selectedBranchId,
  periodFilter,
}) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const snapshot = dbStore.getSnapshot();
  const appointments = snapshot.appointments || [];
  const cashRegisters = snapshot.cashRegisters || [];
  const patients = snapshot.patients || [];
  const allUsers = snapshot.users || [];
  const branches = snapshot.branches || [];

  const todayIso = getTodayAsuncionISO();
  const activePeriod: ReportPeriodFilter = periodFilter || { preset: 'TODAY' };
  const periodLabel = getPeriodLabel(activePeriod, todayIso);

  const filteredAppointments = appointments
    .filter((a) => {
      if (selectedBranchId && a.branchId !== selectedBranchId) return false;
      return isDateInReportPeriod(a.appointmentDate, activePeriod, todayIso);
    })
    .sort((a, b) => {
      const dateCmp = String(b.appointmentDate || '').localeCompare(String(a.appointmentDate || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });

  const activeCashRegister = cashRegisters.find((cr) => {
    if (selectedBranchId && cr.branchId !== selectedBranchId) return false;
    return cr.status === 'ABIERTA';
  });

  // Tally appointment statuses using real Agenda states
  const statusCounts = {
    POR_LLEGAR: filteredAppointments.filter(
      (a) => a.status === 'CONFIRMADA' || a.status === 'PENDIENTE'
    ).length,
    EN_ATENCION_O_SALA: filteredAppointments.filter(
      (a) => a.status === 'EN_ATENCION' || a.status === 'EN_SALA'
    ).length,
    FINALIZADA: filteredAppointments.filter((a) => a.status === 'FINALIZADA').length,
    CANCELADA: filteredAppointments.filter(
      (a) => a.status === 'CANCELADA' || a.status === 'NO_ASISTIO'
    ).length,
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="bg-white rounded-lg px-5 py-4 border border-[#E6E2D9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1C1F1E]">
            Recepción y sala de espera · {periodLabel}
          </h3>
        </div>

        {activeCashRegister ? (
          <StatusLabel
            tone="paid"
            label={`Caja abierta · ${formatPYG(activeCashRegister.openingAmount)}`}
          />
        ) : (
          <StatusLabel tone="pending" label="Sin caja abierta en la sucursal" />
        )}
      </div>

      {/* Continuous Operational KPI Strip */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EFECE5]">
        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">
            {activePeriod.preset === 'TODAY' ? 'Citas de hoy' : 'Citas del período'}
          </div>
          <div className="text-2xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {filteredAppointments.length}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5 tabular-nums">
            {statusCounts.CANCELADA > 0
              ? `${statusCounts.CANCELADA} canceladas o ausentes`
              : 'Agendadas en período'}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">En sala o sillón</div>
          <div className="text-2xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {statusCounts.EN_ATENCION_O_SALA}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">En espera o atención</div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Finalizadas</div>
          <div className="text-2xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {statusCounts.FINALIZADA}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">Atenciones concluidas</div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Por llegar</div>
          <div className="text-2xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {statusCounts.POR_LLEGAR}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">Confirmadas y pendientes</div>
        </div>
      </div>

      {/* Appointment Timeline List */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#EFECE5] flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[#1C1F1E]">
            Flujo de pacientes · {periodLabel}
          </h4>
          <span className="text-xs text-[#6B706D] tabular-nums">
            {filteredAppointments.length} turnos
          </span>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="py-10 px-6 text-center text-xs text-[#6B706D]">
            No se registran turnos para la sucursal y el período seleccionado ({periodLabel}).
          </div>
        ) : (
          <div className="divide-y divide-[#EFECE5]">
            {filteredAppointments.map((app) => {
              const patient = patients.find((p) => p.id === app.patientId);
              const doctor = allUsers.find((u) => u.id === app.odontologistId);
              const branch = branches.find((b) => b.id === app.branchId);
              const statusMeta = getAppointmentStatusMeta(app.status);

              return (
                <div
                  key={app.id}
                  className="px-5 py-3.5 hover:bg-[#F8F7F4] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="text-left min-w-[76px] shrink-0">
                      <div className="text-xs font-semibold text-[#1C1F1E] tabular-nums">
                        {String(app.startTime || '').slice(0, 5)}
                      </div>
                      <div className="text-[11px] text-[#6B706D] tabular-nums">
                        {app.appointmentDate}
                      </div>
                    </div>

                    <PatientAvatar
                      firstName={patient?.firstName}
                      lastName={patient?.lastName}
                      seed={patient?.id || app.id}
                      size="sm"
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-[#1C1F1E]">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                        </span>
                        <span className="text-[11px] text-[#6B706D] tabular-nums">
                          C.I. {patient?.documentNumber || '—'}
                        </span>
                        {patient?.phone && (
                          <span className="text-[11px] text-[#6B706D] tabular-nums">· {patient.phone}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B706D] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Stethoscope className="h-3 w-3" />
                          {doctor ? formatProfessionalName(doctor) : ((app as any).historicalDoctorName || 'Odontólogo')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {branch?.name || 'Sucursal'}
                        </span>
                        <span>·</span>
                        <span>{app.reason || 'Consulta'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    <StatusLabel tone={statusMeta.tone} label={statusMeta.label} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

