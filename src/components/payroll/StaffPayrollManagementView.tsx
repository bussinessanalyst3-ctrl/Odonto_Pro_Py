import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  DollarSign,
  Percent,
  Calculator,
  CreditCard,
  TrendingUp,
  UserPlus,
  Plus,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Printer,
  Eye,
  Edit2,
  Power,
  Ban,
  Send,
  ShieldCheck,
  Award,
  Link2,
  AlertCircle,
  History,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import { getAsuncionYearMonth } from '../../utils/reportPeriod.ts';
import {
  EmployeeRecord,
  PayrollSettlementRecord,
  StaffArea,
  StaffPaymentRecord,
  CommissionRuleRecord,
  getEmployeeDisplayName,
} from '../../db/payrollEngine.ts';
import { hasPermission } from '../../security/rbacHierarchy.ts';
import { EmployeeFormModal } from './EmployeeFormModal.tsx';
import { SalaryUpdateModal } from './SalaryUpdateModal.tsx';
import { CommissionRuleModal } from './CommissionRuleModal.tsx';
import { SettlementBuilderModal } from './SettlementBuilderModal.tsx';
import { StaffPaymentModal } from './StaffPaymentModal.tsx';
import {
  AnnulReasonModal,
  ManualCommissionModal,
  PayrollPrintReportModal,
} from './PayrollActionModals.tsx';
import { EmployeeRemunerationDrawer } from './EmployeeRemunerationDrawer.tsx';
import {
  buildDoctorCommissionsCsv,
  computeDoctorCommissionsData,
} from '../reports/DoctorCommissionsReport.tsx';
import {
  NO_PROFESSIONALS_MESSAGE,
  formatProfessionalOptionLabel,
  getActiveHealthProfessionals,
} from '../../utils/healthProfessional.ts';

type SubTab = 'panel' | 'personal' | 'salarios' | 'comisiones' | 'liquidaciones' | 'cartera';

const AREA_LABELS: Record<StaffArea, string> = {
  COMERCIAL: 'Área Comercial',
  CLINICA: 'Área Clínica',
  OPERATIVA: 'Área Operativa',
};

const SETTLEMENT_BADGE: Record<string, string> = {
  BORRADOR: 'bg-slate-100 text-slate-700 border-slate-200',
  PENDIENTE_APROBACION: 'bg-amber-50 text-amber-800 border-amber-200',
  APROBADA: 'bg-teal-50 text-teal-800 border-teal-200',
  PAGADA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ANULADA: 'bg-rose-50 text-rose-700 border-rose-200',
};

const COMMISSION_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-800 border-amber-200',
  EN_LIQUIDACION: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  APROBADA: 'bg-teal-50 text-teal-800 border-teal-200',
  PAGADA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ANULADA: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const StaffPayrollManagementView: React.FC = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const actor = dbStore.getBackendActorContext();
  const canViewAllStaff = !actor || hasPermission(actor, 'staff.view') || hasPermission(actor, 'commissions.view_all') || hasPermission(actor, 'payroll.create');
  const canManageStaff = !actor || hasPermission(actor, 'staff.manage');
  const canManageSalaries = !actor || hasPermission(actor, 'salaries.manage');
  const canManageRules = !actor || hasPermission(actor, 'commissions.rules_manage');
  const canCreatePayroll = !actor || hasPermission(actor, 'payroll.create');
  const canApprovePayroll = !actor || hasPermission(actor, 'payroll.approve');
  const canPayPayroll = !actor || hasPermission(actor, 'payroll.pay');
  const canExportPayroll = !actor || hasPermission(actor, 'payroll.export');

  const linkedEmployee = actor?.userId ? dbStore.getEmployeeLinkedToUser(actor.userId) : null;
  const isOwnOnlyMode = !canViewAllStaff;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('panel');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<StaffArea | 'ALL'>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [periodYearFilter, setPeriodYearFilter] = useState<number | 'ALL'>('ALL');
  const [periodMonthFilter, setPeriodMonthFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modales y Drawers
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empToEdit, setEmpToEdit] = useState<EmployeeRecord | null>(null);
  const [salaryEmp, setSalaryEmp] = useState<EmployeeRecord | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<CommissionRuleRecord | null>(null);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [paymentSettlement, setPaymentSettlement] = useState<PayrollSettlementRecord | null>(null);
  const [isManualCommOpen, setIsManualCommOpen] = useState(false);
  const [drawerEmployee, setDrawerEmployee] = useState<EmployeeRecord | null>(null);
  const [annulTarget, setAnnulTarget] = useState<{
    kind: 'PAYMENT' | 'SETTLEMENT';
    id: string;
    label: string;
  } | null>(null);
  const [printTarget, setPrintTarget] = useState<{
    title: string;
    settlement?: PayrollSettlementRecord | null;
    payment?: StaffPaymentRecord | null;
    settlementsSummary?: PayrollSettlementRecord[];
  } | null>(null);
  const [exportDoctorId, setExportDoctorId] = useState<string>('');
  const [exportDoctorRate, setExportDoctorRate] = useState<number>(40);

  const notify = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const snapshot = dbStore.getSnapshot();
  const branches = dbStore.getBranches();
  const allEmployees = dbStore.getEmployees({ status: 'ALL' });
  const users = snapshot.users || [];
  const patients = snapshot.patients || [];
  const quotes = snapshot.quotes || [];
  const payments = snapshot.payments || [];

  const availableYears = useMemo(() => {
    const currentYear = getAsuncionYearMonth(getTodayAsuncionISO()).year;
    const yearSet = new Set<number>([currentYear, currentYear - 1, currentYear - 2]);
    for (const c of snapshot.generatedCommissions || []) {
      if (Number(c.periodYear) > 2000) yearSet.add(Number(c.periodYear));
    }
    for (const s of snapshot.payrollSettlements || []) {
      if (Number(s.periodYear) > 2000) yearSet.add(Number(s.periodYear));
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [snapshot.generatedCommissions, snapshot.payrollSettlements]);

  const effectiveEmployeeIdFilter = isOwnOnlyMode
    ? linkedEmployee?.id || '__NO_LINKED_EMPLOYEE__'
    : employeeFilter === 'ALL'
      ? null
      : employeeFilter;

  const employees = useMemo(() => {
    if (isOwnOnlyMode) {
      return linkedEmployee ? [linkedEmployee] : [];
    }
    return dbStore.getEmployees({
      branchId: branchFilter === 'ALL' ? null : branchFilter,
      area: areaFilter,
      status: 'ALL',
    }).filter((e: any) => (effectiveEmployeeIdFilter ? e.id === effectiveEmployeeIdFilter : true));
  }, [allEmployees, branchFilter, areaFilter, effectiveEmployeeIdFilter, isOwnOnlyMode, linkedEmployee]);

  const salaries = useMemo(() => {
    const allowedIds = new Set(employees.map((e: any) => e.id));
    return dbStore
      .getEmployeeSalaries()
      .filter((s: any) => allowedIds.has(s.employeeId));
  }, [snapshot.employeeSalaries, employees]);

  const commissionRules = dbStore.getCommissionRules({
    area: areaFilter,
    status: 'ALL',
  });

  const generatedCommissions = useMemo(() => {
    const allowedIds = new Set(employees.map((e: any) => e.id));
    return dbStore
      .getGeneratedCommissions({
        employeeId: effectiveEmployeeIdFilter,
        area: areaFilter,
        periodYear: periodYearFilter,
        periodMonth: periodMonthFilter,
        status: statusFilter,
      })
      .filter((c: any) => allowedIds.has(c.employeeId));
  }, [
    snapshot.generatedCommissions,
    employees,
    effectiveEmployeeIdFilter,
    areaFilter,
    periodYearFilter,
    periodMonthFilter,
    statusFilter,
  ]);

  const settlements = useMemo(() => {
    const allowedIds = new Set(employees.map((e: any) => e.id));
    return dbStore
      .getPayrollSettlements({
        employeeId: effectiveEmployeeIdFilter,
        branchId: branchFilter === 'ALL' ? null : branchFilter,
        area: areaFilter,
        periodYear: periodYearFilter,
        periodMonth: periodMonthFilter,
        status: statusFilter,
      })
      .filter((s: any) => allowedIds.has(s.employeeId));
  }, [
    snapshot.payrollSettlements,
    employees,
    effectiveEmployeeIdFilter,
    branchFilter,
    areaFilter,
    periodYearFilter,
    periodMonthFilter,
    statusFilter,
  ]);

  const staffPayments = useMemo(() => {
    const allowedIds = new Set(employees.map((e: any) => e.id));
    return dbStore
      .getStaffPayments({
        employeeId: effectiveEmployeeIdFilter,
      })
      .filter((p: any) => allowedIds.has(p.employeeId));
  }, [snapshot.staffPayments, employees, effectiveEmployeeIdFilter]);

  const metrics = dbStore.getPayrollDashboardMetrics({
    branchId: branchFilter === 'ALL' ? null : branchFilter,
    area: areaFilter,
    employeeId: effectiveEmployeeIdFilter,
    periodYear: periodYearFilter,
    periodMonth: periodMonthFilter,
    status: statusFilter,
  });

  const handleExportExcel = () => {
    if (!canExportPayroll) {
      notify('error', 'No tiene permiso para exportar planillas financieras.');
      return;
    }
    const headers = [
      'Liquidación',
      'Colaborador',
      'Área',
      'Período',
      'Salario Base (PYG)',
      'Comisiones (PYG)',
      'Bonos (PYG)',
      'Anticipos (PYG)',
      'Descuentos (PYG)',
      'Neto a Pagar (PYG)',
      'Pagado (PYG)',
      'Saldo Pendiente (PYG)',
      'Estado',
    ];
    const rows = settlements.map((s: PayrollSettlementRecord) => {
      const emp = allEmployees.find((e: any) => e.id === s.employeeId);
      const safe = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      return [
        safe(s.settlementNumber),
        safe(getEmployeeDisplayName(emp)),
        safe(emp?.area || ''),
        safe(s.periodLabel),
        s.baseSalarySnapshot,
        s.commissionsTotal,
        s.bonusesTotal,
        s.advancesTotal,
        s.deductionsTotal,
        s.netPayable,
        s.paidAmount,
        s.balanceDue,
        safe(s.status),
      ].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla_personal_odontopro_${getTodayAsuncionISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('success', 'Planilla exportada en formato compatible con Excel (UTF-8).');
  };

  const healthProfessionals = useMemo(
    () => getActiveHealthProfessionals(users),
    [users]
  );

  const selectedExportDoctor =
    healthProfessionals.find((d: any) => d.id === exportDoctorId) ||
    healthProfessionals[0] ||
    null;

  const handleExportDoctorDetailCsv = () => {
    if (!canExportPayroll) {
      notify('error', 'No tiene permiso para exportar planillas financieras.');
      return;
    }
    if (!selectedExportDoctor) {
      notify('error', NO_PROFESSIONALS_MESSAGE);
      return;
    }
    const todayIso = getTodayAsuncionISO();
    const periodFilter =
      periodYearFilter !== 'ALL' && periodMonthFilter !== 'ALL'
        ? {
            preset: 'CUSTOM_MONTH' as const,
            customYear: Number(periodYearFilter),
            customMonth: Number(periodMonthFilter),
          }
        : { preset: 'ALL' as const };

    const { finalItems } = computeDoctorCommissionsData({
      snapshot,
      doctorId: selectedExportDoctor.id,
      selectedBranchId: branchFilter === 'ALL' ? '' : branchFilter,
      periodFilter,
      todayIso,
      commissionRate: exportDoctorRate,
      irpRetentionRate: 0,
    });

    const csvContent = buildDoctorCommissionsCsv({
      doctor: selectedExportDoctor,
      items: finalItems,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Liquidacion_Honorarios_${selectedExportDoctor.lastName || 'Odontologo'}_${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(
      'success',
      `CSV detallado de honorarios exportado (${finalItems.length} cobros).`
    );
  };

  if (isOwnOnlyMode && !linkedEmployee) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-8">
        <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <Briefcase className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Sin Ficha Laboral Vinculada</h3>
        <p className="text-xs text-slate-500 mt-1">
          Su usuario tiene acceso únicamente a su cartera y remuneraciones personales, pero aún no está vinculado a una ficha de empleado. Solicite a Administración vincular su usuario en Gestión Financiera del Personal.
        </p>
      </div>
    );
  }

  const advisorEmployees = allEmployees.filter((e: any) => e.isAdvisor);
  const payrollAuditLogs = (snapshot.auditLogs || []).filter((log: any) =>
    [
      'EMPLOYEE',
      'EMPLOYEE_SALARY',
      'COMMISSION_RULE',
      'GENERATED_COMMISSION',
      'PAYROLL_SETTLEMENT',
      'STAFF_PAYMENT',
      'PATIENT',
    ].includes(log.entity)
  );

  const subTabs: Array<{ id: SubTab; label: string; icon: React.ComponentType<{ className?: string }>; hidden?: boolean }> = [
    { id: 'panel', label: 'Resumen', icon: TrendingUp },
    { id: 'personal', label: isOwnOnlyMode ? 'Mi ficha' : 'Personal', icon: Users },
    { id: 'salarios', label: 'Salarios', icon: DollarSign },
    { id: 'comisiones', label: isOwnOnlyMode ? 'Mis comisiones' : 'Comisiones', icon: Percent },
    { id: 'liquidaciones', label: isOwnOnlyMode ? 'Mis liquidaciones' : 'Liquidaciones', icon: Calculator },
    { id: 'cartera', label: 'Cartera', icon: Briefcase, hidden: isOwnOnlyMode },
  ];

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#1C1F1E]">
              {isOwnOnlyMode ? 'Mi remuneración' : 'Finanzas del personal'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canExportPayroll && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Excel (.csv)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPrintTarget({
                      title: 'Reporte Consolidado de Liquidaciones y Haberes',
                      settlementsSummary: settlements,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-teal-600" />
                  <span>Reporte PDF</span>
                </button>
              </>
            )}

            {canManageStaff && !isOwnOnlyMode && (
              <button
                type="button"
                onClick={() => {
                  setEmpToEdit(null);
                  setIsEmpModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Nuevo Colaborador</span>
              </button>
            )}

            {canCreatePayroll && !isOwnOnlyMode && (
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nueva Liquidación</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-navegación */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-5 border-t border-slate-100">
          {subTabs
            .filter((t) => !t.hidden)
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          disabled={isOwnOnlyMode}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="ALL">Todas las Sucursales</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value as StaffArea | 'ALL')}
          disabled={isOwnOnlyMode}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="ALL">Todas las Áreas</option>
          <option value="COMERCIAL">Área Comercial</option>
          <option value="CLINICA">Área Clínica</option>
          <option value="OPERATIVA">Área Operativa</option>
        </select>

        <select
          value={isOwnOnlyMode ? linkedEmployee?.id || '' : employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          disabled={isOwnOnlyMode}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          {!isOwnOnlyMode && <option value="ALL">Todo el Personal</option>}
          {(isOwnOnlyMode ? employees : allEmployees).map((emp: any) => (
            <option key={emp.id} value={emp.id}>
              {getEmployeeDisplayName(emp)}
            </option>
          ))}
        </select>

        <select
          value={periodYearFilter}
          onChange={(e) =>
            setPeriodYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
          }
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="ALL">Todos los Años</option>
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>
              Año {yr}
            </option>
          ))}
        </select>

        <select
          value={periodMonthFilter}
          onChange={(e) =>
            setPeriodMonthFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
          }
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="ALL">Todos los Meses</option>
          {[
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
          ].map((m, idx) => (
            <option key={idx + 1} value={idx + 1}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700"
        >
          <option value="ALL">Todos los Estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PENDIENTE_APROBACION">Pendiente Aprobación</option>
          <option value="APROBADA">Aprobada</option>
          <option value="PAGADA">Pagada</option>
          <option value="ANULADA">Anulada</option>
        </select>
      </div>

      {/* SUBTAB: PANEL & RESUMEN */}
      {activeSubTab === 'panel' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Personal Activo</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
                {metrics.activeEmployeesCount}
              </div>
              <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                Comercial • Clínica • Operativa
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Comisiones Generadas</div>
              <div className="text-2xl font-extrabold text-indigo-700 font-mono tabular-nums mt-1">
                ₲ {metrics.totalCommissionsEarned.toLocaleString('es-PY')}
              </div>
              <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                Pendiente de liquidar: ₲ {metrics.pendingUnsettledCommissions.toLocaleString('es-PY')}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Pendiente de Pago</div>
              <div className="text-2xl font-extrabold text-amber-700 font-mono tabular-nums mt-1">
                ₲ {metrics.totalPendingToPay.toLocaleString('es-PY')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {metrics.pendingApprovalCount} liquidaciones por aprobar
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Pagado (PYG)</div>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums mt-1">
                ₲ {metrics.totalPaid.toLocaleString('es-PY')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Salarios liquidados: ₲ {metrics.totalSalaries.toLocaleString('es-PY')}
              </div>
            </div>
          </div>

          {/* Comparativo por Área */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Comparativo Financiero por Área</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics.byArea.map((row) => (
                <div key={row.area} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{AREA_LABELS[row.area]}</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-semibold text-slate-600">
                      {row.staffCount} colab.
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div>
                      <div className="text-slate-500">Liquidado</div>
                      <div className="font-mono font-bold tabular-nums text-slate-900">
                        ₲ {row.netPayable.toLocaleString('es-PY')}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Pagado</div>
                      <div className="font-mono font-bold tabular-nums text-emerald-700">
                        ₲ {row.paidAmount.toLocaleString('es-PY')}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Saldo</div>
                      <div className="font-mono font-bold tabular-nums text-amber-700">
                        ₲ {row.balanceDue.toLocaleString('es-PY')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: PERSONAL (3 ÁREAS) */}
      {activeSubTab === 'personal' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Colaborador / Doc.</th>
                  <th className="px-4 py-3">Área &amp; Cargo</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3">Usuario Sistema</th>
                  <th className="px-4 py-3">Modalidad &amp; Salario Vigente</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp: EmployeeRecord) => {
                  const branch = branches.find((b: any) => b.id === emp.branchId);
                  const linkedUser = emp.userId ? users.find((u: any) => u.id === emp.userId) : null;
                  const activeSalary = dbStore.getActiveSalary(emp.id);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{getEmployeeDisplayName(emp)}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {emp.employeeCode} • {emp.documentType} {emp.documentNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{AREA_LABELS[emp.area]}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span>{emp.position}</span>
                          {emp.isAdvisor && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[9px] font-bold">
                              Asesor Comercial
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{branch?.name || 'Corporativo'}</td>
                      <td className="px-4 py-3">
                        {linkedUser ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                            <Link2 className="h-3 w-3" />
                            <span>{linkedUser.username || linkedUser.email} ({linkedUser.roleId})</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sin acceso al sistema</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">{emp.remunerationModality}</div>
                        <div className="font-mono font-bold tabular-nums text-emerald-700">
                          {activeSalary
                            ? `₲ ${activeSalary.baseSalary.toLocaleString('es-PY')} / ${activeSalary.paymentFrequency}`
                            : 'Sin salario fijo'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            emp.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {emp.status === 'ACTIVE' ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDrawerEmployee(emp)}
                            title="Ver Historial de Remuneraciones"
                            className="p-1.5 rounded-lg border border-slate-200 text-teal-700 hover:bg-teal-50 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canManageSalaries && !isOwnOnlyMode && (
                            <button
                              type="button"
                              onClick={() => setSalaryEmp(emp)}
                              title="Registrar / Actualizar Salario"
                              className="p-1.5 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canManageStaff && !isOwnOnlyMode && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEmpToEdit(emp);
                                  setIsEmpModalOpen(true);
                                }}
                                title="Editar Colaborador"
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    dbStore.toggleEmployeeStatus(emp.id);
                                    notify('success', `Estado laboral actualizado para ${getEmployeeDisplayName(emp)}.`);
                                  } catch (err: any) {
                                    notify('error', err?.message || 'Error al cambiar estado.');
                                  }
                                }}
                                title={emp.status === 'ACTIVE' ? 'Inactivar colaborador' : 'Reactivar colaborador'}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: SALARIOS & HISTORIAL */}
      {activeSubTab === 'salarios' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Historial Inmutable de Salarios Base (PYG)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Las actualizaciones crean un nuevo período vigente sin alterar períodos anteriores.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3 text-right">Salario Base (PYG)</th>
                  <th className="px-4 py-3">Frecuencia</th>
                  <th className="px-4 py-3">Vigencia</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaries.map((sal: any) => {
                  const emp = allEmployees.find((e: any) => e.id === sal.employeeId);
                  return (
                    <tr key={sal.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {getEmployeeDisplayName(emp)}
                      </td>
                      <td className="px-4 py-3">{AREA_LABELS[sal.area as StaffArea] || sal.area}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        ₲ {Number(sal.baseSalary).toLocaleString('es-PY')}
                      </td>
                      <td className="px-4 py-3 font-semibold">{sal.paymentFrequency}</td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {sal.effectiveDate} {sal.endDate ? `→ ${sal.endDate}` : '→ Actualidad'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            sal.status === 'VIGENTE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {sal.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{sal.observations || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: REGLAS & COMISIONES */}
      {activeSubTab === 'comisiones' && (
        <div className="space-y-5">
          {/* Reglas Configurables */}
          {!isOwnOnlyMode && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reglas Configurables de Comisiones</h3>
                  <p className="text-[11px] text-slate-500">
                    Porcentajes y montos configurados por administración para Comercial, Clínica y Operativa.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(canCreatePayroll || canManageRules) && (
                    <button
                      type="button"
                      onClick={() => setIsManualCommOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl cursor-pointer"
                    >
                      <Award className="h-3.5 w-3.5" />
                      <span>Bono / Comisión Manual</span>
                    </button>
                  )}
                  {canManageRules && (
                    <button
                      type="button"
                      onClick={() => {
                        setRuleToEdit(null);
                        setIsRuleModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Nueva Regla</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Regla</th>
                      <th className="px-4 py-3">Área &amp; Disparador</th>
                      <th className="px-4 py-3">Valor Configurado</th>
                      <th className="px-4 py-3">Validaciones</th>
                      <th className="px-4 py-3">Estado</th>
                      {canManageRules && <th className="px-4 py-3 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {commissionRules.map((rule: CommissionRuleRecord) => (
                      <tr key={rule.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{rule.name}</div>
                          {rule.description && (
                            <div className="text-[11px] text-slate-500">{rule.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{AREA_LABELS[rule.area]}</div>
                          <div className="text-[11px] font-mono text-slate-500">{rule.triggerType}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold tabular-nums text-teal-800">
                          {rule.calculationMode === 'PERCENTAGE'
                            ? `${rule.ratePercentage}%`
                            : `₲ ${Number(rule.fixedAmount || 0).toLocaleString('es-PY')}`}
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {rule.requiresCollectedPayment && <div>• Exige cobro confirmado</div>}
                          {rule.requiresCompletedTreatment && <div>• Exige tratamiento finalizado</div>}
                          {!rule.requiresCollectedPayment && !rule.requiresCompletedTreatment && 'Sin bloqueo'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              rule.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {rule.status}
                          </span>
                        </td>
                        {canManageRules && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setRuleToEdit(rule);
                                  setIsRuleModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    dbStore.updateCommissionRule(rule.id, {
                                      status: rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                    });
                                    notify('success', `Regla "${rule.name}" actualizada.`);
                                  } catch (err: any) {
                                    notify('error', err?.message || 'Error al actualizar regla.');
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comisiones Generadas */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Registro de Comisiones Generadas ({generatedCommissions.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Snapshot histórico de asesor preservado al instante del cobro/tratamiento.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Colaborador / Asesor</th>
                    <th className="px-4 py-3">Concepto &amp; Trazabilidad</th>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3 text-right">Base (PYG)</th>
                    <th className="px-4 py-3 text-right">Comisión (PYG)</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {generatedCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No hay comisiones registradas para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    generatedCommissions.map((comm: any) => {
                      const emp = allEmployees.find((e: any) => e.id === comm.employeeId);
                      const pat = comm.patientId
                        ? patients.find((p: any) => p.id === comm.patientId)
                        : null;
                      return (
                        <tr key={comm.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{getEmployeeDisplayName(emp)}</div>
                            <div className="text-[11px] text-slate-500">
                              {AREA_LABELS[comm.area as StaffArea] || comm.area}
                              {comm.advisorSnapshotName ? ` • Snap: ${comm.advisorSnapshotName}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{comm.concept}</div>
                            <div className="text-[11px] text-slate-500">
                              {pat ? `Paciente: ${pat.firstName} ${pat.lastName}` : comm.sourceType}
                              {comm.appliedRate ? ` • Tasa ${comm.appliedRate}%` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {String(comm.periodMonth).padStart(2, '0')}/{comm.periodYear}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            ₲ {Number(comm.baseAmount || 0).toLocaleString('es-PY')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                            ₲ {Number(comm.commissionAmount).toLocaleString('es-PY')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                COMMISSION_BADGE[comm.status] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {comm.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: LIQUIDACIONES & PAGOS */}
      {activeSubTab === 'liquidaciones' && (
        <div className="space-y-5">
          {/* Liquidaciones */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Liquidaciones de Haberes ({settlements.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Flujo estricto: Borrador → Pendiente Aprobación → Aprobada → Pagada. Pagos bloqueados antes de aprobar.
                </p>
              </div>
              {canCreatePayroll && !isOwnOnlyMode && (
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Generar Liquidación</span>
                </button>
              )}
            </div>

            {canExportPayroll && !isOwnOnlyMode && (
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="font-semibold text-slate-700">
                  Exportar CSV detallado por odontólogo (cobro / paciente / procedimiento):
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedExportDoctor?.id || ''}
                    onChange={(e) => setExportDoctorId(e.target.value)}
                    disabled={healthProfessionals.length === 0}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 disabled:opacity-60"
                  >
                    {healthProfessionals.length === 0 ? (
                      <option value="">{NO_PROFESSIONALS_MESSAGE}</option>
                    ) : (
                      healthProfessionals.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {formatProfessionalOptionLabel(d)}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    value={exportDoctorRate}
                    onChange={(e) => setExportDoctorRate(Number(e.target.value))}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-teal-800"
                  >
                    <option value={30}>30%</option>
                    <option value={35}>35%</option>
                    <option value={40}>40%</option>
                    <option value={45}>45%</option>
                    <option value={50}>50%</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleExportDoctorDetailCsv}
                    disabled={!selectedExportDoctor}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                    <span>CSV Honorarios</span>
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Liquidación</th>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3 text-right">Salario Base</th>
                    <th className="px-4 py-3 text-right">Comis. / Bonos</th>
                    <th className="px-4 py-3 text-right">Desc. / Antic.</th>
                    <th className="px-4 py-3 text-right">Neto / Pagado / Saldo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settlements.map((s: PayrollSettlementRecord) => {
                    const emp = allEmployees.find((e: any) => e.id === s.employeeId);
                    const settlementItems = dbStore.getPayrollSettlementItems(s.id);
                    const irpItem = settlementItems.find((it: any) =>
                      String(it.concept || '').startsWith('Retención IRP')
                    );
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-900">{s.settlementNumber}</div>
                          <div className="text-[11px] text-slate-500">{s.periodLabel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{getEmployeeDisplayName(emp)}</div>
                          <div className="text-[11px] text-slate-500">{emp?.area}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          ₲ {s.baseSalarySnapshot.toLocaleString('es-PY')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                          + ₲ {(s.commissionsTotal + s.bonusesTotal).toLocaleString('es-PY')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-700">
                          <div>- ₲ {(s.advancesTotal + s.deductionsTotal).toLocaleString('es-PY')}</div>
                          {irpItem && (
                            <div className="text-[10px] text-amber-700 font-semibold">
                              {irpItem.concept}: - ₲ {Number(irpItem.amount).toLocaleString('es-PY')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <div className="font-bold text-slate-900">₲ {s.netPayable.toLocaleString('es-PY')}</div>
                          <div className="text-[10px] text-slate-500">
                            Pagado: ₲ {s.paidAmount.toLocaleString('es-PY')} • Saldo: ₲ {s.balanceDue.toLocaleString('es-PY')}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              SETTLEMENT_BADGE[s.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canCreatePayroll && !isOwnOnlyMode && s.status === 'BORRADOR' && (
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    dbStore.submitPayrollSettlement(s.id);
                                    notify('success', `Liquidación ${s.settlementNumber} enviada a aprobación.`);
                                  } catch (err: any) {
                                    notify('error', err?.message || 'Error al enviar.');
                                  }
                                }}
                                title="Enviar a Aprobación"
                                className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Send className="h-3 w-3" /> Enviar
                              </button>
                            )}
                            {canApprovePayroll && !isOwnOnlyMode && (s.status === 'BORRADOR' || s.status === 'PENDIENTE_APROBACION') && (
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    dbStore.approvePayrollSettlement(s.id);
                                    notify('success', `Liquidación ${s.settlementNumber} aprobada para pago.`);
                                  } catch (err: any) {
                                    notify('error', err?.message || 'Error al aprobar.');
                                  }
                                }}
                                title="Aprobar Liquidación"
                                className="px-2 py-1 rounded-lg bg-teal-600 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck className="h-3 w-3" /> Aprobar
                              </button>
                            )}
                            {canPayPayroll && !isOwnOnlyMode && s.status === 'APROBADA' && (
                              <button
                                type="button"
                                onClick={() => setPaymentSettlement(s)}
                                title="Registrar Pago Parcial o Total"
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard className="h-3 w-3" /> Pagar
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPrintTarget({
                                  title: `Liquidación de Haberes ${s.settlementNumber}`,
                                  settlement: s,
                                })
                              }
                              title="Imprimir / PDF"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {canApprovePayroll && !isOwnOnlyMode && s.status !== 'ANULADA' && s.paidAmount === 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAnnulTarget({
                                    kind: 'SETTLEMENT',
                                    id: s.id,
                                    label: s.settlementNumber,
                                  })
                                }
                                title="Anular Liquidación sin Pagos"
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de Pagos al Personal */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Historial de Pagos Emitidos al Personal ({staffPayments.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Operación</th>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Fecha &amp; Método</th>
                    <th className="px-4 py-3 text-right">Monto (PYG)</th>
                    <th className="px-4 py-3">Responsable</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffPayments.map((p: StaffPaymentRecord) => {
                    const emp = allEmployees.find((e: any) => e.id === p.employeeId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {p.operationNumber}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {getEmployeeDisplayName(emp)}
                        </td>
                        <td className="px-4 py-3">
                          <div>{p.paymentDate}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.paymentMethod} {p.referenceNumber ? `• ${p.referenceNumber}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-emerald-700">
                          ₲ {p.amount.toLocaleString('es-PY')}
                        </td>
                        <td className="px-4 py-3 text-[11px]">{p.responsibleUserName || 'Sistema'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              p.status === 'COMPLETADO'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setPrintTarget({
                                  title: `Recibo de Pago ${p.operationNumber}`,
                                  payment: p,
                                })
                              }
                              title="Imprimir Comprobante"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                            {canPayPayroll && !isOwnOnlyMode && p.status === 'COMPLETADO' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAnnulTarget({
                                    kind: 'PAYMENT',
                                    id: p.id,
                                    label: p.operationNumber,
                                  })
                                }
                                title="Anular Pago"
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: CARTERA & TRAZABILIDAD COMERCIAL */}
      {activeSubTab === 'cartera' && !isOwnOnlyMode && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Cartera de Pacientes por Asesor Comercial
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Rendimiento comercial calculado estrictamente por <strong>Asesor designado</strong> (separado del usuario que registró la ficha).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {advisorEmployees.map((adv: EmployeeRecord) => {
                const advPatients = patients.filter((p: any) => p.assignedAdvisorId === adv.id);
                const advPatIds = new Set(advPatients.map((p: any) => p.id));
                const advQuotes = quotes.filter((q: any) => advPatIds.has(q.patientId));
                const advPaymentsSum = payments
                  .filter((p: any) => p.status === 'COMPLETADO' && advPatIds.has(p.patientId))
                  .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
                const advCommsSum = (snapshot.generatedCommissions || [])
                  .filter((c: any) => c.employeeId === adv.id && c.status !== 'ANULADA')
                  .reduce((sum: number, c: any) => sum + Number(c.commissionAmount || 0), 0);

                return (
                  <div key={adv.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{getEmployeeDisplayName(adv)}</div>
                        <div className="text-[11px] text-slate-500">{adv.position}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                        {advPatients.length} pacientes
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                      <div>
                        <div className="text-slate-500">Presupuestos</div>
                        <div className="font-mono font-bold text-slate-900">{advQuotes.length}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Cobrado</div>
                        <div className="font-mono font-bold tabular-nums text-emerald-700">
                          ₲ {advPaymentsSum.toLocaleString('es-PY')}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Comisiones</div>
                        <div className="font-mono font-bold tabular-nums text-indigo-700">
                          ₲ {advCommsSum.toLocaleString('es-PY')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Auditoría de Movimientos Financieros &amp; Cambios de Asesor
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {payrollAuditLogs.slice(0, 25).map((log: any) => (
                <div key={log.id} className="px-5 py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{log.description}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {log.action} • {log.entity}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString('es-PY')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALES Y DRAWER */}
      <EmployeeFormModal
        isOpen={isEmpModalOpen}
        onClose={() => setIsEmpModalOpen(false)}
        employeeToEdit={empToEdit}
        onSaved={(emp) => notify('success', `Ficha guardada para ${getEmployeeDisplayName(emp)}.`)}
      />

      <SalaryUpdateModal
        isOpen={!!salaryEmp}
        onClose={() => setSalaryEmp(null)}
        employee={salaryEmp}
        onSaved={() => notify('success', 'Salario base actualizado preservando el historial anterior.')}
      />

      <CommissionRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        ruleToEdit={ruleToEdit}
        onSaved={() => notify('success', 'Regla de comisión guardada correctamente.')}
      />

      <SettlementBuilderModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        onCreated={() => notify('success', 'Liquidación de haberes generada exitosamente.')}
      />

      <StaffPaymentModal
        isOpen={!!paymentSettlement}
        onClose={() => setPaymentSettlement(null)}
        settlement={paymentSettlement}
        onPaid={() => notify('success', 'Pago al personal registrado y contabilizado.')}
      />

      <ManualCommissionModal
        isOpen={isManualCommOpen}
        onClose={() => setIsManualCommOpen(false)}
        onCreated={() => notify('success', 'Comisión o bono manual registrado en estado PENDIENTE.')}
      />

      <AnnulReasonModal
        isOpen={!!annulTarget}
        title={annulTarget?.kind === 'PAYMENT' ? `Anular Pago ${annulTarget.label}` : `Anular Liquidación ${annulTarget?.label || ''}`}
        subtitle="Esta operación aplica anulación lógica sin eliminar registros históricos."
        onClose={() => setAnnulTarget(null)}
        onConfirm={(reason) => {
          if (!annulTarget) return;
          if (annulTarget.kind === 'PAYMENT') {
            dbStore.annulStaffPayment(annulTarget.id, reason);
            notify('success', `Pago ${annulTarget.label} anulado y saldo restaurado.`);
          } else {
            dbStore.annulPayrollSettlement(annulTarget.id, reason);
            notify('success', `Liquidación ${annulTarget.label} anulada y comisiones liberadas.`);
          }
        }}
      />

      <PayrollPrintReportModal
        isOpen={!!printTarget}
        onClose={() => setPrintTarget(null)}
        title={printTarget?.title || 'Reporte de Personal'}
        settlement={printTarget?.settlement}
        payment={printTarget?.payment}
        settlementsSummary={printTarget?.settlementsSummary}
      />

      <EmployeeRemunerationDrawer
        isOpen={!!drawerEmployee}
        onClose={() => setDrawerEmployee(null)}
        employee={drawerEmployee}
        onOpenSalaryModal={
          canManageSalaries && !isOwnOnlyMode ? (emp) => setSalaryEmp(emp) : undefined
        }
      />
    </div>
  );
};
