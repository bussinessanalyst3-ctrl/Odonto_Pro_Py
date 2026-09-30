import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Building2,
  Armchair,
  ShieldAlert,
  MessageCircle,
  FileCheck,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { CreateAppointmentModal } from './CreateAppointmentModal.tsx';
import { AppointmentStatusModal } from './AppointmentStatusModal.tsx';

export const AppointmentsCalendarView: React.FC = () => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedOdontologistId, setSelectedOdontologistId] = useState<string>('ALL');
  const [selectedChairId, setSelectedChairId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentDate, setCurrentDate] = useState<string>('2026-09-21');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'list'>('day');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedAppointmentForStatus, setSelectedAppointmentForStatus] = useState<any>(null);

  // Available filters data
  const branches = snapshot.branches;
  const dentists = snapshot.users.filter((u) => u.roleId === 'ODONTOLOGO');
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

  // Sort by start time
  const sortedAppointments = [...appointments].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="h-3 w-3" />
            Pendiente
          </span>
        );
      case 'CONFIRMADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <CheckCircle2 className="h-3 w-3" />
            Confirmada
          </span>
        );
      case 'EN_SALA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <UserCheck className="h-3 w-3" />
            En Sala de Espera
          </span>
        );
      case 'EN_ATENCION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
            <Stethoscope className="h-3 w-3" />
            En Sillón / Atención
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <CheckCircle2 className="h-3 w-3" />
            Finalizada
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="h-3 w-3" />
            Cancelada
          </span>
        );
      case 'NO_ASISTIO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertCircle className="h-3 w-3" />
            No Asistió
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Quick navigation for date
  const changeDateBy = (days: number) => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                Fase 7: Agenda & Citas Concurrente
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Zona: America/Asuncion (UTC-4 / UTC-3)
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Agenda Odontológica & Control de Sillones
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Programación de consultas clínicas, prevención activa de doble reserva y seguimiento de estados de atención.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-semibold text-sm shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Agendar Turno</span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Branch filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Sucursal Clínica
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedChairId('ALL');
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todas las Sucursales ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Odontologist filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Odontólogo Tratante
            </label>
            <select
              value={selectedOdontologistId}
              onChange={(e) => setSelectedOdontologistId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todos los Odontólogos ({dentists.length})</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr(a). {d.firstName} {d.lastName} ({d.professionalLicense || 'MSPBS'})
                </option>
              ))}
            </select>
          </div>

          {/* Dental Chair filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Sillón Dental
            </label>
            <select
              value={selectedChairId}
              onChange={(e) => setSelectedChairId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todos los Sillones ({chairs.length})</option>
              {chairs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.room || 'Consultorio'})
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Estado de la Cita
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="EN_SALA">En Sala de Espera</option>
              <option value="EN_ATENCION">En Atención / Sillón</option>
              <option value="FINALIZADA">Finalizadas</option>
              <option value="CANCELADA">Canceladas</option>
              <option value="NO_ASISTIO">No Asistió</option>
            </select>
          </div>

          {/* View mode buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Visualización
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('day')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Día
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas
              </button>
            </div>
          </div>
        </div>

        {/* Date Selector Navigation */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => changeDateBy(-1)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            <button
              onClick={() => changeDateBy(1)}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => setCurrentDate('2026-09-21')}
              className="px-3 py-2 min-h-[40px] text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
            >
              Hoy (Fecha Simulación)
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Total citas listadas: <strong className="text-slate-800">{sortedAppointments.length}</strong>
          </div>
        </div>
      </div>

      {/* Double Booking Guarantee Alert */}
      <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-start gap-3 text-xs text-teal-900">
        <ShieldAlert className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Algoritmo de Validación Concurrente de Agenda Activo:</span> El sistema
          verifica y rechaza solapamientos de horario (Double Booking) a nivel de odontólogo tratante y a nivel de
          sillón dental en la misma sucursal, previniendo citaciones simultáneas en el mismo box clínico.
        </div>
      </div>

      {/* Appointments List / Grid */}
      {sortedAppointments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <CalendarIcon className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No hay turnos registrados</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No se encontraron citas para la fecha seleccionada ({currentDate}) con los filtros aplicados.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Agendar Cita en esta fecha</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAppointments.map((app) => {
            const patient = snapshot.patients.find((p) => p.id === app.patientId);
            const dentist = snapshot.users.find((u) => u.id === app.odontologistId);
            const branch = snapshot.branches.find((b) => b.id === app.branchId);
            const chair = (snapshot.dentalChairs || []).find((c) => c.id === app.dentalChairId);
            const service = snapshot.services.find((s) => s.id === app.serviceId);

            // WhatsApp link
            const phone = patient?.whatsapp || patient?.phone || '';
            const cleanPhone = phone.replace(/\D/g, '');
            const waNumber = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;
            const waGreeting = encodeURIComponent(
              `Hola ${patient?.firstName || ''}, le recordamos su turno odontológico para hoy a las ${app.startTime.slice(0, 5)} en ${branch?.name || 'OdontoSol'}.`
            );
            const waUrl = `https://wa.me/${waNumber}?text=${waGreeting}`;

            return (
              <div
                key={app.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: Time & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                        {app.startTime.slice(0, 5)} - {app.endTime.slice(0, 5)}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({app.durationMin} min)
                      </span>
                    </div>

                    <div>{getStatusBadge(app.status)}</div>
                  </div>

                  {/* Patient Info */}
                  <div className="pt-1">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                      Paciente
                    </div>
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <span>
                        {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente Desconocido'}
                      </span>
                      {patient && (
                        <span className="text-xs text-slate-500 font-mono">
                          C.I. {patient.documentNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clinical Reason / Service */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="text-[11px] font-bold text-teal-800">
                      {service?.name || 'Consulta General Odontológica'}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {app.reason || 'Sin motivo detallado'}
                    </p>
                  </div>

                  {/* Operational Details: Branch, Odontologist & Chair */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        Dr(a). <strong>{dentist ? `${dentist.firstName} ${dentist.lastName}` : ((app as any).historicalDoctorName || 'Por Asignar')}</strong>
                        {dentist?.professionalLicense && ` (${dentist.professionalLicense})`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{branch?.name || 'Sucursal Principal'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Armchair className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="truncate font-medium text-teal-900">
                        {chair ? `${chair.name} (${chair.room || 'Consultorio'})` : 'Sillón pendiente de asignación'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200"
                    title="Enviar WhatsApp de confirmación"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>

                  <button
                    onClick={() => setSelectedAppointmentForStatus(app)}
                    className="flex-1 py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-center"
                  >
                    Gestionar Estado
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
