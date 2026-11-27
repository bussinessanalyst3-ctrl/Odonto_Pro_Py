import React, { useState, useEffect } from 'react';
import { Building2, Calendar } from 'lucide-react';
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
import { ReceptionOperationsReport } from './ReceptionOperationsReport.tsx';
import { ExecutiveDashboard } from './ExecutiveDashboard.tsx';
import { hasModuleAccess } from '../../security/moduleCatalog.ts';
import { UnderlineTabItem, UnderlineTabs } from '../ui/DesignPrimitives.tsx';

type DashboardPerspective = 'EXECUTIVE' | 'ADMIN' | 'RECEPTION';

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
  const [timePeriod, setTimePeriod] = useState<ReportPeriodPreset>('MONTH');
  const [customYear, setCustomYear] = useState<number>(todayYm.year);
  const [customMonth, setCustomMonth] = useState<number>(todayYm.month);

  const roleObj = dbStore.getRoles().find((r) => r.id === userRole);
  const canViewAdminPerspective =
    hasModuleAccess(session, 'cash', roleObj) ||
    hasModuleAccess(session, 'quotes', roleObj) ||
    hasModuleAccess(session, 'staff-payroll', roleObj);
  const canViewReceptionPerspective =
    hasModuleAccess(session, 'agenda', roleObj) || hasModuleAccess(session, 'patients', roleObj);

  useEffect(() => {
    if (
      (activePerspective === 'ADMIN' && !canViewAdminPerspective) ||
      (activePerspective === 'RECEPTION' && !canViewReceptionPerspective)
    ) {
      setActivePerspective('EXECUTIVE');
    }
  }, [activePerspective, canViewAdminPerspective, canViewReceptionPerspective]);

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

  const tabs: UnderlineTabItem<DashboardPerspective>[] = [
    { id: 'EXECUTIVE', label: 'Resumen' },
    ...(canViewAdminPerspective ? [{ id: 'ADMIN' as const, label: 'Finanzas' }] : []),
    ...(canViewReceptionPerspective ? [{ id: 'RECEPTION' as const, label: 'Recepción' }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Cabecera limpia y pestañas subrayadas */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1C1F1E] tracking-tight">
              Resumen
            </h1>
            <p className="text-xs text-[#6B706D] mt-0.5">
              {getPeriodLabel(periodFilter, todayIso)}
            </p>
          </div>

          {/* Filtros discretos de sucursal y período */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-[#6B706D] shrink-0" aria-hidden="true" />
              <select
                aria-label="Filtrar por sucursal"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="min-h-[40px] px-2.5 py-1.5 bg-white border border-[#E6E2D9] rounded-md text-xs font-medium text-[#1C1F1E] focus:outline-none focus:border-[#0F5C63] cursor-pointer"
              >
                <option value="">Todas las sucursales ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#6B706D] shrink-0" aria-hidden="true" />
              <select
                aria-label="Filtrar por período"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value as ReportPeriodPreset)}
                className="min-h-[40px] px-2.5 py-1.5 bg-white border border-[#E6E2D9] rounded-md text-xs font-medium text-[#1C1F1E] focus:outline-none focus:border-[#0F5C63] cursor-pointer"
              >
                <option value="TODAY">Hoy ({todayIso})</option>
                <option value="WEEK">Últimos 7 días</option>
                <option value="MONTH">Mes actual ({MONTH_NAMES[todayYm.month - 1]} {todayYm.year})</option>
                <option value="QUARTER">Trimestre {currentQuarter} ({todayYm.year})</option>
                <option value="YEAR">Año {todayYm.year}</option>
                <option value="CUSTOM_MONTH">Mes histórico...</option>
                <option value="ALL">Todo el historial</option>
              </select>

              {timePeriod === 'CUSTOM_MONTH' && (
                <>
                  <select
                    aria-label="Mes histórico"
                    value={customMonth}
                    onChange={(e) => setCustomMonth(Number(e.target.value))}
                    className="min-h-[40px] px-2.5 py-1.5 bg-[#ECF5F5] border border-[#B9D9DC] rounded-md text-xs font-semibold text-[#0F5C63] focus:outline-none cursor-pointer"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Año histórico"
                    value={customYear}
                    onChange={(e) => setCustomYear(Number(e.target.value))}
                    className="min-h-[40px] px-2.5 py-1.5 bg-[#ECF5F5] border border-[#B9D9DC] rounded-md text-xs font-semibold text-[#0F5C63] focus:outline-none cursor-pointer"
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
        </div>

        {/* Pestañas subrayadas */}
        {tabs.length > 1 && (
          <UnderlineTabs
            items={tabs}
            activeId={activePerspective}
            onChange={setActivePerspective}
            ariaLabel="Vistas del resumen"
          />
        )}
      </div>

      {/* Perspective Content */}
      {activePerspective === 'EXECUTIVE' && (
        <ExecutiveDashboard
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
          onNavigateTab={onNavigateTab || (() => {})}
        />
      )}

      {activePerspective === 'ADMIN' && canViewAdminPerspective && (
        <AdminFinancialReport
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
          onSelectBranch={setSelectedBranchId}
        />
      )}

      {activePerspective === 'RECEPTION' && canViewReceptionPerspective && (
        <ReceptionOperationsReport
          selectedBranchId={selectedBranchId}
          periodFilter={periodFilter}
        />
      )}
    </div>
  );
};

