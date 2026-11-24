import React, { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Plus,
  Calculator,
  Sparkles,
  CreditCard,
  ChevronRight,
  Armchair,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { TabType } from '../Header.tsx';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  ReportPeriodFilter,
  collectUniqueRevenueEntries,
  getPeriodLabel,
  isDateInReportPeriod,
  toAsuncionDateISO,
} from '../../utils/reportPeriod.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasModuleAccess } from '../../security/moduleCatalog.ts';

interface ExecutiveDashboardProps {
  onNavigateTab: (tab: TabType, payload?: any) => void;
  selectedBranchId: string;
  periodFilter?: ReportPeriodFilter;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  onNavigateTab,
  selectedBranchId,
  periodFilter,
}) => {
  const { session } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const roleObj = dbStore.getRoles().find((r) => r.id === session?.role);
  const canPatients = hasModuleAccess(session, 'patients', roleObj);
  const canAgenda = hasModuleAccess(session, 'agenda', roleObj);
  const canQuotes = hasModuleAccess(session, 'quotes', roleObj);
  const canCash = hasModuleAccess(session, 'cash', roleObj);
  const canTreatments = hasModuleAccess(session, 'treatments', roleObj);
  const hasAnyQuickAction = canPatients || canAgenda || canQuotes;

  const snapshot = dbStore.getSnapshot();
  const todayStr = getTodayAsuncionISO();
  const activePeriod: ReportPeriodFilter = periodFilter || { preset: 'TODAY' };
  const isTodayMode = activePeriod.preset === 'TODAY';
  const periodLabel = getPeriodLabel(activePeriod, todayStr);

  // Filtrado por sucursal si está seleccionada
  const appointments = (snapshot.appointments || []).filter((a) =>
    selectedBranchId ? a.branchId === selectedBranchId : true
  );
  const periodAppointments = appointments
    .filter((a) => isDateInReportPeriod(a.appointmentDate, activePeriod, todayStr))
    .sort((a, b) => {
      const dateCmp = String(b.appointmentDate || '').localeCompare(String(a.appointmentDate || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(a.startTime || '').localeCompare(String(b.startTime || ''));
    });

  const validPayments = (snapshot.payments || []).filter((p) => {
    if (p.status === 'ANULADO') return false;
    if (selectedBranchId && p.branchId !== selectedBranchId) return false;
    return true;
  });

  const periodPayments = validPayments
    .filter((p) => isDateInReportPeriod(p.createdAt || p.paymentDate, activePeriod, todayStr))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const revenueEntries = collectUniqueRevenueEntries({
    payments: snapshot.payments || [],
    cashMovements: snapshot.cashMovements || [],
    cashRegisters: snapshot.cashRegisters || [],
    branchId: selectedBranchId || undefined,
    period: activePeriod,
    todayIso: todayStr,
  });

  const treatments = (snapshot.treatments || []).filter((t) =>
    selectedBranchId ? t.branchId === selectedBranchId : true
  );

  // Cálculos de KPIs Clave (sin doble contabilización ni anulados)
  const totalCollectedPeriod = revenueEntries.reduce((acc, e) => acc + e.amount, 0);

  // Saldo pendiente real: suma de balanceDue de tratamientos activos (no cancelados)
  const treatmentsWithDebt = treatments.filter(
    (t) => t.status !== 'CANCELADO' && Math.round(Number(t.balanceDue || 0)) > 0
  );
  const totalPendingBalance = treatmentsWithDebt.reduce(
    (acc, t) => acc + Math.max(0, Math.round(Number(t.balanceDue || 0))),
    0
  );

  const completedPeriodCount = periodAppointments.filter((a) => a.status === 'FINALIZADA').length;
  const inAttentionCount = periodAppointments.filter((a) => a.status === 'EN_ATENCION').length;
  const inWaitingRoomCount = periodAppointments.filter((a) => a.status === 'EN_SALA').length;
  const pendingOrConfirmedCount = periodAppointments.filter(
    (a) => a.status === 'CONFIRMADA' || a.status === 'PENDIENTE'
  ).length;

  const activeTreatments = treatments.filter((t) => t.status === 'EN_PROGRESO');
  const activeTreatmentsCount = activeTreatments.length;

  return (
    <div className="space-y-6">
      {/* Nivel 1: KPIs Críticos en Guaraníes (PYG) filtrados por módulos habilitados */}
      {(canCash || canAgenda || canTreatments) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recaudación */}
          {canCash && (
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {isTodayMode ? 'Recaudación de Hoy' : 'Recaudación del Período'}
                </span>
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {formatPYG(totalCollectedPeriod)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{revenueEntries.length} cobros efectivos • {periodLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Turnos */}
          {canAgenda && (
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {isTodayMode ? 'Agenda de Hoy' : 'Citas del Período'}
                </span>
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Calendar className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {periodAppointments.length} <span className="text-sm font-normal text-slate-400">citas</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                  <span className="text-purple-700 font-bold">{inWaitingRoomCount} en espera</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold">{inAttentionCount} en sillón</span>
                </div>
              </div>
            </div>
          )}

          {/* Pacientes Atendidos */}
          {canAgenda && (
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Atenciones Concluidas
                </span>
                <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {completedPeriodCount} <span className="text-sm font-normal text-slate-400">finalizadas</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {pendingOrConfirmedCount} pacientes pendientes de atención
                </p>
              </div>
            </div>
          )}

          {/* Saldo Pendiente por Cobrar */}
          {(canCash || canTreatments) && (
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Cobros Pendientes
                </span>
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-amber-800 tracking-tight">
                  {formatPYG(totalPendingBalance)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {treatmentsWithDebt.length} tratamientos activos con saldo
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nivel 2: Acciones Rápidas (Banner Integrado solo para módulos habilitados) */}
      {hasAnyQuickAction && (
        <div className="p-5 bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 rounded-3xl text-white shadow-lg shadow-teal-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-300" />
              <h3 className="text-base font-extrabold tracking-tight">Acciones Rápidas de la Clínica</h3>
            </div>
            <p className="text-xs text-teal-100 mt-0.5">
              Accesos directos a los módulos habilitados para tu perfil
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {canPatients && (
              <button
                onClick={() => onNavigateTab('patients')}
                className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 min-h-[42px] bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo Paciente</span>
              </button>
            )}

            {canAgenda && (
              <button
                onClick={() => onNavigateTab('agenda')}
                className="flex-1 sm:flex-none justify-center px-3.5 py-2.5 min-h-[42px] bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 backdrop-blur-xs cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Agendar Cita</span>
              </button>
            )}

            {canQuotes && (
              <button
                onClick={() => onNavigateTab('quotes')}
                className="w-full sm:w-auto justify-center px-3.5 py-2.5 min-h-[42px] bg-white text-teal-900 hover:bg-teal-50 rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Calculator className="h-3.5 w-3.5 text-teal-700" />
                <span>Crear Presupuesto</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nivel 3: Flujo de Citas y Tratamientos Activos (filtrados por módulos habilitados) */}
      {(canAgenda || canCash || canTreatments) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda (2/3): Línea de tiempo de la Agenda */}
          {canAgenda && (
            <div className={`${canCash || canTreatments ? 'lg:col-span-2' : 'lg:col-span-3'} p-6 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Flujo Clínico — {periodLabel}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estado de pacientes en sala de espera, sillones y atenciones
                  </p>
                </div>
                <button
                  onClick={() => onNavigateTab('agenda')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver Agenda Completa</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {periodAppointments.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">
                    No hay turnos programados para el período seleccionado.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {periodAppointments.slice(0, 12).map((app) => {
                    const patient = snapshot.patients.find((p) => p.id === app.patientId);
                    const dentist = snapshot.users.find((u) => u.id === app.odontologistId);
                    const chair = (snapshot.dentalChairs || []).find((c) => c.id === app.dentalChairId);

                    return (
                      <div
                        key={app.id}
                        className="p-4 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-xs text-teal-800 text-center shrink-0">
                            {!isTodayMode && (
                              <div className="text-[10px] font-semibold text-slate-400">
                                {app.appointmentDate}
                              </div>
                            )}
                            <div>{String(app.startTime || '').slice(0, 5)}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                C.I. {patient?.documentNumber || '—'}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Dr(a). {dentist ? `${dentist.firstName} ${dentist.lastName}` : 'Odontólogo'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Armchair className="h-3 w-3 text-slate-400" />
                                {chair?.name || 'Sillón asignado'}
                              </span>
                              <span>•</span>
                              <span>{app.reason || 'Consulta'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              app.status === 'EN_ATENCION'
                                ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                                : app.status === 'EN_SALA'
                                ? 'bg-purple-100 text-purple-800'
                                : app.status === 'FINALIZADA'
                                ? 'bg-teal-100 text-teal-800'
                                : app.status === 'CANCELADA' || app.status === 'NO_ASISTIO'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Columna Derecha (1/3): Tratamientos en Curso y Cobros Recientes */}
          {(canCash || canTreatments) && (
            <div className={`${canAgenda ? '' : 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6'} space-y-6`}>
              {/* Cobros Recientes en Caja */}
              {canCash && (
                <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Cobros Recientes en Caja
                    </h3>
                    <button
                      onClick={() => onNavigateTab('cash')}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      Ir a Caja
                    </button>
                  </div>

                  {periodPayments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Sin cobros registrados en este período.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {periodPayments.slice(0, 4).map((p) => {
                        const pat = snapshot.patients.find((pt) => pt.id === p.patientId);
                        return (
                          <div
                            key={p.id}
                            className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-800">
                                {pat ? `${pat.firstName} ${pat.lastName}` : 'Paciente'}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {toAsuncionDateISO(p.createdAt || p.paymentDate)} • {p.receiptNumber} • {p.paymentMethod}
                              </span>
                            </div>
                            <span className="font-black text-emerald-700 shrink-0">
                              {formatPYG(p.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Planes de Tratamiento Activos */}
              {canTreatments && (
                <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Tratamientos Activos ({activeTreatmentsCount})
                    </h3>
                    <button
                      onClick={() => onNavigateTab('treatments')}
                      className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>

                  {activeTreatments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Sin tratamientos en progreso actualmente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeTreatments.slice(0, 3).map((t) => {
                        const pat = snapshot.patients.find((pt) => pt.id === t.patientId);
                        return (
                          <div
                            key={t.id}
                            className="p-3 bg-teal-50/50 rounded-2xl border border-teal-200/70 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-teal-950 truncate">{t.title}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 shrink-0">
                                En Progreso
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between">
                              <span>{pat ? `${pat.firstName} ${pat.lastName}` : 'Paciente'}</span>
                              <span className="font-bold text-slate-700">{formatPYG(t.totalAmount)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

