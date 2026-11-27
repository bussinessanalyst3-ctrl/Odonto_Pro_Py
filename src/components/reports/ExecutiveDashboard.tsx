import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  Calculator,
  ChevronRight,
  CreditCard,
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
import { formatProfessionalName } from '../../utils/healthProfessional.ts';
import { hasModuleAccess } from '../../security/moduleCatalog.ts';
import {
  getAppointmentStatusMeta,
  getProfessionalColor,
} from '../../utils/visualIdentity.ts';
import {
  EmptyState,
  PatientAvatar,
  StatusLabel,
} from '../ui/DesignPrimitives.tsx';

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

  const orderedDoctorIds = Array.from(
    new Set(periodAppointments.map((a) => a.odontologistId).filter(Boolean))
  );

  const kpiItems: Array<{ id: string; label: string; value: string; note: string }> = [];
  if (canCash) {
    kpiItems.push({
      id: 'revenue',
      label: isTodayMode ? 'Recaudación hoy' : 'Recaudación',
      value: formatPYG(totalCollectedPeriod),
      note:
        revenueEntries.length === 1
          ? '1 cobro registrado'
          : `${revenueEntries.length} cobros registrados`,
    });
  }
  if (canAgenda) {
    kpiItems.push({
      id: 'appointments',
      label: isTodayMode ? 'Citas hoy' : 'Citas',
      value: String(periodAppointments.length),
      note: `${inWaitingRoomCount} en sala · ${inAttentionCount} en sillón`,
    });
    kpiItems.push({
      id: 'completed',
      label: 'Atenciones concluidas',
      value: String(completedPeriodCount),
      note: `${pendingOrConfirmedCount} pendientes`,
    });
  }
  if (canCash || canTreatments) {
    kpiItems.push({
      id: 'pending',
      label: 'Saldo pendiente',
      value: formatPYG(totalPendingBalance),
      note: `${treatmentsWithDebt.length} tratamientos con saldo`,
    });
  }

  return (
    <div className="space-y-5">
      {/* Nivel 1: Franja continua de KPIs con divisores finos y cifras neutras tabular-nums */}
      {kpiItems.length > 0 && (
        <section
          aria-label="Indicadores principales"
          className="bg-white rounded-lg border border-[#E6E2D9] grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-[#EFECE5] lg:divide-x"
        >
          {kpiItems.map((item, idx) => (
            <div
              key={item.id}
              className={`p-4 sm:p-5 ${idx % 2 === 1 ? 'border-l border-[#EFECE5] lg:border-l-0' : ''}`}
            >
              <p className="text-xs font-medium text-[#525755]">{item.label}</p>
              <p className="mt-1.5 text-xl sm:text-2xl font-bold text-[#1C1F1E] tabular-nums tracking-tight">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-[#6B706D] tabular-nums">{item.note}</p>
            </div>
          ))}
        </section>
      )}

      {/* Nivel 2: Accesos rápidos discretos */}
      {hasAnyQuickAction && (
        <div className="flex flex-wrap items-center gap-2">
          {canAgenda && (
            <button
              type="button"
              onClick={() => onNavigateTab('agenda')}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Nueva cita</span>
            </button>
          )}

          {canPatients && (
            <button
              type="button"
              onClick={() => onNavigateTab('patients')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-white hover:bg-[#F2F0EB] text-[#1C1F1E] border border-[#E6E2D9] rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#0F5C63]" aria-hidden="true" />
              <span>Nuevo paciente</span>
            </button>
          )}

          {canQuotes && (
            <button
              type="button"
              onClick={() => onNavigateTab('quotes')}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-white hover:bg-[#F2F0EB] text-[#1C1F1E] border border-[#E6E2D9] rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              <Calculator className="h-4 w-4 text-[#0F5C63]" aria-hidden="true" />
              <span>Nuevo presupuesto</span>
            </button>
          )}
        </div>
      )}

      {/* Nivel 3: Próximas citas + Últimos cobros y tratamientos activos */}
      {(canAgenda || canCash || canTreatments) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Columna Izquierda (2/3): Próximas citas */}
          {canAgenda && (
            <section
              className={`${
                canCash || canTreatments ? 'lg:col-span-2' : 'lg:col-span-3'
              } bg-white rounded-lg border border-[#E6E2D9] overflow-hidden`}
            >
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#EFECE5] flex items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-[#1C1F1E]">
                  Próximas citas · <span className="font-normal text-[#6B706D]">{periodLabel}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateTab('agenda')}
                  className="text-xs font-semibold text-[#0F5C63] hover:text-[#0B474D] inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                >
                  <span>Ver agenda</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {periodAppointments.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<Calendar className="h-6 w-6" aria-hidden="true" />}
                    message="No hay citas registradas en este período."
                    actionLabel="Ir a agenda"
                    onAction={() => onNavigateTab('agenda')}
                  />
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE5]">
                  {periodAppointments.slice(0, 12).map((app) => {
                    const patient = snapshot.patients.find((p) => p.id === app.patientId);
                    const dentist = snapshot.users.find((u) => u.id === app.odontologistId);
                    const chair = (snapshot.dentalChairs || []).find((c) => c.id === app.dentalChairId);
                    const docColor = getProfessionalColor(app.odontologistId, orderedDoctorIds);
                    const statusMeta = getAppointmentStatusMeta(app.status);

                    return (
                      <div
                        key={app.id}
                        className="px-4 sm:px-5 py-3 hover:bg-[#F8F7F4] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 shrink-0 text-left tabular-nums">
                            <div className="text-sm font-semibold text-[#1C1F1E]">
                              {String(app.startTime || '').slice(0, 5)}
                            </div>
                            {!isTodayMode && (
                              <div className="text-[11px] text-[#6B706D]">{app.appointmentDate}</div>
                            )}
                          </div>

                          <PatientAvatar
                            firstName={patient?.firstName}
                            lastName={patient?.lastName}
                            seed={patient?.id || app.patientId}
                            size="sm"
                          />

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1C1F1E] truncate">
                              {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#525755]">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={docColor.dotClass}
                                  style={{ backgroundColor: docColor.hex }}
                                  aria-hidden="true"
                                />
                                <span>
                                  {dentist
                                    ? formatProfessionalName(dentist)
                                    : ((app as any).historicalDoctorName || 'Odontólogo')}
                                </span>
                              </span>
                              <span className="text-[#D5D0C5]" aria-hidden="true">·</span>
                              <span className="truncate">{app.reason || 'Consulta'}</span>
                              {chair?.name && (
                                <>
                                  <span className="text-[#D5D0C5]" aria-hidden="true">·</span>
                                  <span className="text-[#6B706D]">{chair.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end sm:justify-start shrink-0 pl-16 sm:pl-0">
                          <StatusLabel tone={statusMeta.tone} label={statusMeta.label} compact />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Columna Derecha (1/3): Últimos cobros y tratamientos activos */}
          {(canCash || canTreatments) && (
            <div
              className={`${
                canAgenda ? 'space-y-5' : 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5'
              }`}
            >
              {/* Últimos cobros */}
              {canCash && (
                <section className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
                  <div className="px-4 sm:px-5 py-3.5 border-b border-[#EFECE5] flex items-center justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-semibold text-[#1C1F1E]">
                      Últimos cobros
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('cash')}
                      className="text-xs font-semibold text-[#0F5C63] hover:text-[#0B474D] cursor-pointer min-h-[36px]"
                    >
                      Ir a caja
                    </button>
                  </div>

                  {periodPayments.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
                        message="Aún no hay cobros en este período."
                        actionLabel="Abrir caja"
                        onAction={() => onNavigateTab('cash')}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EFECE5]">
                      {periodPayments.slice(0, 5).map((p) => {
                        const pat = snapshot.patients.find((pt) => pt.id === p.patientId);
                        return (
                          <div
                            key={p.id}
                            className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1C1F1E] truncate">
                                {pat ? `${pat.firstName} ${pat.lastName}` : 'Paciente'}
                              </p>
                              <p className="text-[11px] text-[#6B706D] tabular-nums truncate">
                                {toAsuncionDateISO(p.createdAt || p.paymentDate)} · {p.paymentMethod}
                              </p>
                            </div>
                            <span className="font-semibold text-[#1C1F1E] tabular-nums shrink-0">
                              {formatPYG(p.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Tratamientos activos */}
              {canTreatments && (
                <section className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
                  <div className="px-4 sm:px-5 py-3.5 border-b border-[#EFECE5] flex items-center justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-semibold text-[#1C1F1E]">
                      Tratamientos activos{' '}
                      <span className="font-normal text-[#6B706D] tabular-nums">
                        ({activeTreatmentsCount})
                      </span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('treatments')}
                      className="text-xs font-semibold text-[#0F5C63] hover:text-[#0B474D] cursor-pointer min-h-[36px]"
                    >
                      Ver todos
                    </button>
                  </div>

                  {activeTreatments.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        message="No hay tratamientos en progreso."
                        actionLabel="Ver tratamientos"
                        onAction={() => onNavigateTab('treatments')}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[#EFECE5]">
                      {activeTreatments.slice(0, 4).map((t) => {
                        const pat = snapshot.patients.find((pt) => pt.id === t.patientId);
                        return (
                          <div
                            key={t.id}
                            className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1C1F1E] truncate">{t.title}</p>
                              <p className="text-[11px] text-[#6B706D] truncate">
                                {pat ? `${pat.firstName} ${pat.lastName}` : 'Paciente'}
                              </p>
                            </div>
                            <span className="font-semibold text-[#1C1F1E] tabular-nums shrink-0">
                              {formatPYG(t.totalAmount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

