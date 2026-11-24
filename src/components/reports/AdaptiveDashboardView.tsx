import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Stethoscope,
  DollarSign,
  Users,
  Building2,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  ReportPeriodFilter,
  ReportPeriodPreset,
  getAsuncionYearMonth,
  getPeriodLabel,
} from '../../utils/reportPeriod.ts';
import { AdminFinancialReport } from './AdminFinancialReport.tsx';
import { DoctorCommissionsReport } from './DoctorCommissionsReport.tsx';
import { ReceptionOperationsReport } from './ReceptionOperationsReport.tsx';
import { ExecutiveDashboard } from './ExecutiveDashboard.tsx';

type DashboardPerspective = 'EXECUTIVE' | 'ADMIN' | 'DOCTOR' | 'RECEPTION';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface AdaptiveDashboardViewProps {
  onNavigateTab?: (tab: any, payload?: any) => void;
  selectedBranchId?: string;
}

export const AdaptiveDashboardView: React.FC<AdaptiveDashboardViewProps> = ({
  onNavigateTab,
  selectedBranchId: externalBranchId,
}) => {
  const { session } = useAuth();
  const userRole = session?.role || '';

  const [, setTick] = useState(0);
  useEffect(() => {
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const todayIso = getTodayAsuncionISO();
  const todayYm = getAsuncionYearMonth(todayIso);

  // Perspective inicial
  const [activePerspective, setActivePerspective] = useState<DashboardPerspective>('EXECUTIVE');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(externalBranchId || session?.currentBranchId || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    userRole === 'ODONTOLOGO' ? session?.userId || '' : ''
  );
  const [timePeriod, setTimePeriod] = useState<ReportPeriodPreset>('MONTH');
  const [customYear, setCustomYear] = useState<number>(todayYm.year);
  const [customMonth, setCustomMonth] = useState<number>(todayYm.month);

  useEffect(() => {
    if (externalBranchId !== undefined) {
      setSelectedBranchId(externalBranchId);
    }
  }, [externalBranchId]);

  const periodFilter: ReportPeriodFilter =
    timePeriod === 'CUSTOM_MONTH'
      ? { preset: 'CUSTOM_MONTH', customYear, customMonth }
      : { preset: timePeriod };

  const branches = dbStore.getBranches();
  const currentQuarter = Math.floor((todayYm.month - 1) / 3) + 1;
  const availableYears: number[] = [];
  for (let y = todayYm.year; y >= 2020; y -= 1) {
    availableYears.push(y);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Perspective Switcher */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4 sm:space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm shadow-teal-700/20 shrink-0">
              <BarChart3 className="h-5 sm:h-6 w-5 sm:w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Dashboard Dinámico & Reportes de Gestión
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {getPeriodLabel(periodFilter, todayIso)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Métricas adaptativas según rol, liquidación de comisiones, recaudación en PYG y control operacional
              </p>
            </div>
          </div>

          {/* Perspective Switcher Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto w-full lg:w-auto shrink-0 scrollbar-none">
            <button
              onClick={() => setActivePerspective('EXECUTIVE')}
              className={`flex-1 lg:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activePerspective === 'EXECUTIVE'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
              <span>Resumen & KPIs</span>
            </button>

            <button
              onClick={() => setActivePerspective('ADMIN')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activePerspective === 'ADMIN'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5 text-teal-600" />
              <span>Directiva & Finanzas</span>
            </button>

            <button
              onClick={() => setActivePerspective('DOCTOR')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activePerspective === 'DOCTOR'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
              <span>Odontólogos & Comisiones</span>
            </button>

            <button
              onClick={() => setActivePerspective('RECEPTION')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                activePerspective === 'RECEPTION'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-teal-600" />
              <span>Recepción & Turnos</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by branch */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <label className="font-semibold text-slate-600">Sucursal:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="">Todas las sucursales ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by period */}
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <label className="font-semibold text-slate-600">Período:</label>
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as ReportPeriodPreset)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="TODAY">Jornada de Hoy ({todayIso})</option>
                <option value="WEEK">Últimos 7 días</option>
                <option value="MONTH">Mes Actual ({MONTH_NAMES[todayYm.month - 1]} {todayYm.year})</option>
                <option value="QUARTER">Trimestre {currentQuarter} ({todayYm.year})</option>
                <option value="YEAR">Año {todayYm.year}</option>
                <option value="CUSTOM_MONTH">Mes / Año Histórico...</option>
                <option value="ALL">Todo el Historial</option>
              </select>

              {timePeriod === 'CUSTOM_MONTH' && (
                <>
                  <select
                    value={customMonth}
                    onChange={(e) => setCustomMonth(Number(e.target.value))}
                    className="px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl text-xs font-semibold text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={customYear}
                    onChange={(e) => setCustomYear(Number(e.target.value))}
                    className="px-2.5 py-1.5 bg-teal-50 border border-teal-200 rounded-xl text-xs font-semibold text-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Session role indicator */}
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px]">Usuario autenticado:</span>
            <span className="px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 font-bold text-teal-800 text-[11px]">
              {session ? `${session.firstName} ${session.lastName}` : 'Usuario'} ({userRole})
            </span>
          </div>
        </div>
      </div>

      {/* Perspective Content */}
      {activePerspective === 'EXECUTIVE' && (
        <ExecutiveDashboard
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
          onNavigateTab={onNavigateTab || (() => {})}
        />
      )}

      {activePerspective === 'ADMIN' && (
        <AdminFinancialReport
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
          onSelectBranch={setSelectedBranchId}
        />
      )}

      {activePerspective === 'DOCTOR' && (
        <DoctorCommissionsReport
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
          selectedDoctorId={selectedDoctorId}
          onDoctorChange={setSelectedDoctorId}
        />
      )}

      {activePerspective === 'RECEPTION' && (
        <ReceptionOperationsReport
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
        />
      )}
    </div>
  );
};

