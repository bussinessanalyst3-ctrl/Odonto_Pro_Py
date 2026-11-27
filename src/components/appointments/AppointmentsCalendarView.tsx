import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Building2,
  Armchair,
  MessageCircle,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useBranding } from '../../branding/BrandingContext.tsx';
import {
  NO_PROFESSIONALS_MESSAGE,
  formatProfessionalName,
  formatProfessionalOptionLabel,
  getActiveHealthProfessionals,
  isHealthProfessional,
} from '../../utils/healthProfessional.ts';
import { CreateAppointmentModal } from './CreateAppointmentModal.tsx';
import { AppointmentStatusModal } from './AppointmentStatusModal.tsx';
import { getTodayAsuncionISO, resolveOrganizationLegalName } from '../../config/appBrand.ts';
import { getAppointmentStatusMeta, getProfessionalColor } from '../../utils/visualIdentity.ts';
import {
  EmptyState,
  PatientAvatar,
  StatusLabel,
  UnderlineTabs,
} from '../ui/DesignPrimitives.tsx';

export const AppointmentsCalendarView: React.FC = () => {
  const { branding } = useBranding();
  const [, setTick] = useState(0);

  useEffect(() => {
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const snapshot = dbStore.getSnapshot();

  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedOdontologistId, setSelectedOdontologistId] = useState<string>('ALL');
  const [selectedChairId, setSelectedChairId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState<string>(() => getTodayAsuncionISO());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'list'>('day');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedAppointmentForStatus, setSelectedAppointmentForStatus] = useState<any>(null);

  // Available filters data
  const branches = snapshot.branches;
  const dentists = getActiveHealthProfessionals(snapshot.users);
  const chairs = selectedBranchId === 'ALL'
    ? snapshot.dentalChairs
    : (snapshot.dentalChairs || []).filter((c) => c.branchId === selectedBranchId);

  // Filtered appointments
  const appointments = snapshot.appointments.filter((a) => {
    if (selectedBranchId !== 'ALL' && a.branchId !== selectedBranchId) return false;
    if (selectedOdontologistId !== 'ALL' && a.odontologistId !== selectedOdontologistId) return false;
    if (selectedChairId !== 'ALL' && a.dentalChairId !== selectedChairId) return false;
    if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false;

    if (viewMode === 'day') {
      return a.appointmentDate === currentDate;
    }
    return true;
  });

  // Sort by date (desc in list mode) and start time (asc)
  const sortedAppointments = [...appointments].sort((a, b) => {
    if (viewMode !== 'day' && a.appointmentDate !== b.appointmentDate) {
      return String(b.appointmentDate || '').localeCompare(String(a.appointmentDate || ''));
    }
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });

  const dentistIds = dentists.map((d) => d.id);

  const getStatusBadge = (status: string) => {
    const meta = getAppointmentStatusMeta(status);
    return <StatusLabel tone={meta.tone} label={meta.label} />;
  };

  // Quick navigation for date (pure UTC calendar arithmetic — immune to local timezone/DST shifts)
  const changeDateBy = (days: number) => {
    const parts = currentDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      setCurrentDate(getTodayAsuncionISO());
      return;
    }
    const [y, m, day] = parts;
    const utcDate = new Date(Date.UTC(y, m - 1, day + days));
    const nextIso = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
      utcDate.getUTCDate()
    ).padStart(2, '0')}`;
    setCurrentDate(nextIso);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1C1F1E] tracking-tight">
            Agenda
          </h1>
          <p className="text-xs text-[#6B706D] mt-0.5">
            America/Asuncion · Control automático de solapamientos por profesional y sillón
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Agendar turno</span>
        </button>
      </div>

      {/* Filters & Date Bar */}
      <div className="bg-white rounded-lg border border-[#E6E2D9]">
        <div className="px-4 sm:px-5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EFECE5]">
          <UnderlineTabs
            items={[
              { id: 'day', label: 'Por día' },
              { id: 'list', label: 'Todas las citas', count: sortedAppointments.length },
            ]}
            activeId={viewMode === 'day' ? 'day' : 'list'}
            onChange={(id) => setViewMode(id as 'day' | 'list')}
            className="border-b-0"
          />

          <div className="flex flex-wrap items-center gap-2 pb-2.5 sm:pb-1">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md border border-[#E6E2D9] hover:bg-[#F2F0EB] text-[#525755] transition-colors cursor-pointer"
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="text-xs font-medium text-[#1C1F1E] bg-[#F8F7F4] border border-[#E6E2D9] rounded-md px-3 py-2 min-h-[40px] tabular-nums focus:bg-white focus:border-[#0F5C63] focus:outline-none"
            />

            <button
              onClick={() => changeDateBy(1)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md border border-[#E6E2D9] hover:bg-[#F2F0EB] text-[#525755] transition-colors cursor-pointer"
              title="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentDate(getTodayAsuncionISO())}
              className="px-3 py-2 min-h-[40px] text-xs font-medium text-[#0F5C63] bg-[#ECF5F5] hover:bg-[#D5EAEA] border border-[#B9D9DC] rounded-md transition-colors cursor-pointer"
            >
              Hoy
            </button>
          </div>
        </div>

        {/* Filter Selects */}
        <div className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#6B706D] mb-1">
              Sucursal
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedChairId('ALL');
              }}
              className="w-full text-xs bg-[#F8F7F4] border border-[#E6E2D9] rounded-md px-3 py-2 text-[#1C1F1E] font-medium focus:bg-white focus:border-[#0F5C63] focus:outline-none min-h-[40px]"
            >
              <option value="ALL">Todas las sucursales ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B706D] mb-1">
              Profesional
            </label>
            <select
              value={selectedOdontologistId}
              onChange={(e) => setSelectedOdontologistId(e.target.value)}
              className="w-full text-xs bg-[#F8F7F4] border border-[#E6E2D9] rounded-md px-3 py-2 text-[#1C1F1E] font-medium focus:bg-white focus:border-[#0F5C63] focus:outline-none min-h-[40px]"
            >
              <option value="ALL">Todos los profesionales ({dentists.length})</option>
              {dentists.length === 0 ? (
                <option value="" disabled>{NO_PROFESSIONALS_MESSAGE}</option>
              ) : (
                dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatProfessionalOptionLabel(d)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B706D] mb-1">
              Sillón
            </label>
            <select
              value={selectedChairId}
              onChange={(e) => setSelectedChairId(e.target.value)}
              className="w-full text-xs bg-[#F8F7F4] border border-[#E6E2D9] rounded-md px-3 py-2 text-[#1C1F1E] font-medium focus:bg-white focus:border-[#0F5C63] focus:outline-none min-h-[40px]"
            >
              <option value="ALL">Todos los sillones ({chairs.length})</option>
              {chairs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.room || 'Consultorio'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B706D] mb-1">
              Estado
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-[#F8F7F4] border border-[#E6E2D9] rounded-md px-3 py-2 text-[#1C1F1E] font-medium focus:bg-white focus:border-[#0F5C63] focus:outline-none min-h-[40px]"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="EN_SALA">En sala</option>
              <option value="EN_ATENCION">En atención</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="NO_ASISTIO">No asistió</option>
            </select>
          </div>
        </div>

        {/* Calm Professional Color Legend */}
        {dentists.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 border-t border-[#EFECE5] bg-[#FAF9F7] flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {dentists.map((d) => {
                const color = getProfessionalColor(d.id, dentistIds);
                const isActive = selectedOdontologistId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      setSelectedOdontologistId((prev) => (prev === d.id ? 'ALL' : d.id))
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer border ${
                      isActive
                        ? 'bg-white text-[#1C1F1E] border-[#0F5C63]'
                        : 'bg-white/70 text-[#525755] border-[#E6E2D9] hover:bg-white'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color.dot }}
                    />
                    <span className="truncate max-w-[180px]">{formatProfessionalName(d)}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-[#6B706D] tabular-nums">
              {sortedAppointments.length} {sortedAppointments.length === 1 ? 'turno' : 'turnos'}
            </span>
          </div>
        )}
      </div>

      {/* Appointments List / Grid */}
      {sortedAppointments.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E6E2D9]">
          <EmptyState
            icon={CalendarIcon}
            title="Sin turnos para esta fecha"
            description={`No hay citas registradas el ${currentDate} con los filtros seleccionados.`}
            action={
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Agendar turno</span>
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAppointments.map((app) => {
            const patient = snapshot.patients.find((p) => p.id === app.patientId);
            const dentist = snapshot.users.find((u) => u.id === app.odontologistId);
            const branch = snapshot.branches.find((b) => b.id === app.branchId);
            const chair = (snapshot.dentalChairs || []).find((c) => c.id === app.dentalChairId);
            const service = snapshot.services.find((s) => s.id === app.serviceId);
            const profColor = getProfessionalColor(app.odontologistId || 'default', dentistIds);

            // WhatsApp link
            const phone = patient?.whatsapp || patient?.phone || '';
            const cleanPhone = phone.replace(/\D/g, '');
            const hasPhone = cleanPhone.length >= 6;
            const waNumber = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;
            const orgLegalName = resolveOrganizationLegalName({
              legalName: branding.legalName,
              name: snapshot.organization?.name,
            });
            const placeLabel = branch?.name || orgLegalName;
            const isTodayAppointment = app.appointmentDate === getTodayAsuncionISO();
            const datePhrase = isTodayAppointment ? 'hoy' : `el ${app.appointmentDate}`;
            const waGreeting = encodeURIComponent(
              `Hola ${patient?.firstName || ''}, le recordamos su turno odontológico para ${datePhrase} a las ${String(app.startTime || '').slice(0, 5)}${placeLabel ? ` en ${placeLabel}` : ''}.`
            );
            const waUrl = `https://wa.me/${waNumber}?text=${waGreeting}`;

            return (
              <div
                key={app.id}
                className="bg-white rounded-lg p-4 sm:p-5 border border-[#E6E2D9] hover:border-[#D4CFC3] transition-colors flex flex-col justify-between"
                style={{ borderLeftWidth: '3px', borderLeftColor: profColor.dot }}
              >
                <div className="space-y-3">
                  {/* Card Header: Time & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#1C1F1E] tabular-nums">
                        {String(app.startTime || '').slice(0, 5)} – {String(app.endTime || '').slice(0, 5)}
                      </span>
                      <span className="text-[11px] text-[#6B706D] tabular-nums">
                        {app.durationMin} min
                      </span>
                      {viewMode !== 'day' && app.appointmentDate && (
                        <span className="text-[11px] text-[#525755] tabular-nums">
                          · {app.appointmentDate}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">{getStatusBadge(app.status)}</div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <PatientAvatar
                      firstName={patient?.firstName}
                      lastName={patient?.lastName}
                      seed={patient?.id || app.id}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-[#1C1F1E] text-sm truncate">
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente desconocido'}
                      </div>
                      {patient && (
                        <div className="text-[11px] text-[#6B706D] tabular-nums">
                          C.I. {patient.documentNumber}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clinical Reason / Service (flat divider, no card-in-card) */}
                  <div className="pt-2.5 border-t border-[#EFECE5] space-y-0.5">
                    <div className="text-xs font-semibold text-[#1C1F1E]">
                      {service?.name || 'Consulta general odontológica'}
                    </div>
                    <p className="text-xs text-[#6B706D] line-clamp-2">
                      {app.reason || 'Sin motivo detallado'}
                    </p>
                  </div>

                  {/* Operational Details */}
                  <div className="space-y-1.5 text-xs text-[#525755] pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: profColor.dot }}
                      />
                      <Stethoscope className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate font-medium text-[#1C1F1E]">
                        {dentist
                          ? formatProfessionalName(dentist)
                          : ((app as any).historicalDoctorName || 'Por asignar')}
                        {dentist && isHealthProfessional(dentist) && dentist.professionalLicense
                          ? ` (${dentist.professionalLicense})`
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate">{branch?.name || 'Sucursal principal'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Armchair className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate">
                        {chair ? `${chair.name} (${chair.room || 'Consultorio'})` : 'Sillón sin asignar'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[#EFECE5] flex items-center justify-between gap-2">
                  {hasPhone ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 min-h-[42px] min-w-[42px] flex items-center justify-center text-[#3F6212] bg-[#F4F8EA] hover:bg-[#E7F0D3] rounded-md transition-colors border border-[#D7E6B5]"
                      title="Enviar WhatsApp de confirmación"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  ) : (
                    <span
                      className="p-2.5 min-h-[42px] min-w-[42px] flex items-center justify-center text-[#A0A4A1] bg-[#F8F7F4] rounded-md border border-[#E6E2D9] cursor-not-allowed"
                      title="Paciente sin número de teléfono cargado"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </span>
                  )}

                  <button
                    onClick={() => setSelectedAppointmentForStatus(app)}
                    className="flex-1 py-2 px-3 min-h-[42px] text-xs font-medium text-[#1C1F1E] bg-[#F8F7F4] hover:bg-[#F2F0EB] border border-[#E6E2D9] rounded-md transition-colors text-center flex items-center justify-center cursor-pointer"
                  >
                    Gestionar estado
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <CreateAppointmentModal
          initialDate={currentDate}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Status Modal */}
      {selectedAppointmentForStatus && (
        <AppointmentStatusModal
          appointment={selectedAppointmentForStatus}
          onClose={() => setSelectedAppointmentForStatus(null)}
        />
      )}
    </div>
  );
};
