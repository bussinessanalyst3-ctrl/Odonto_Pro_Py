import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Building2,
  CreditCard,
  QrCode,
  Landmark,
  Wallet,
  Users,
  Calendar,
  FileSpreadsheet,
  Printer,
  Download,
  ArrowUpRight,
  ShieldCheck,
  Shield,
  Clock,
  Percent
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';

interface AdminFinancialReportProps {
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
}

export const AdminFinancialReport: React.FC<AdminFinancialReportProps> = ({
  selectedBranchId,
  onSelectBranch,
}) => {
  const snapshot = dbStore.getSnapshot();
  const branches = snapshot.branches;
  const payments = snapshot.payments || [];
  const cashMovements = snapshot.cashMovements || [];
  const patients = snapshot.patients || [];
  const quotes = snapshot.quotes || [];
  const insurancePlans = snapshot.insurancePlans || [];
  const insuranceClaims = snapshot.insuranceClaims || [];

  // Filter payments by branch if branch selected
  const filteredPayments = selectedBranchId
    ? payments.filter((p) => p.branchId === selectedBranchId)
    : payments;

  // Payments total
  const directPaymentsTotal = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  // Cash movements ingresos
  const filteredMovements = selectedBranchId
    ? cashMovements.filter((m) => {
        const reg = (snapshot.cashRegisters || []).find((c) => c.id === m.cashRegisterId);
        return reg?.branchId === selectedBranchId;
      })
    : cashMovements;

  const movementIngresos = filteredMovements
    .filter((m) => m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalRevenue = directPaymentsTotal + movementIngresos;

  // Revenue by branch breakdown
  const branchMetrics = branches.map((b) => {
    const branchPayments = payments.filter((p) => p.branchId === b.id);
    const bMovements = cashMovements.filter((m) => {
      const reg = (snapshot.cashRegisters || []).find((c) => c.id === m.cashRegisterId);
      return reg?.branchId === b.id && m.movementType === 'INGRESO';
    });
    const totalB = branchPayments.reduce((s, p) => s + p.amount, 0) + bMovements.reduce((s, m) => s + m.amount, 0);
    const patientCount = patients.filter((p) => p.primaryBranchId === b.id).length;
    return {
      branch: b,
      revenue: totalB,
      patientCount,
    };
  });

  const grandTotalAllBranches = branchMetrics.reduce((s, bm) => s + bm.revenue, 0) || 1;

  // Revenue by payment method
  const paymentMethodsBreakdown: { [key: string]: { label: string; icon: any; amount: number; count: number } } = {
    TRANSFERENCIA_SIPAP: {
      label: 'SIPAP (Bancos de Paraguay)',
      icon: Landmark,
      amount: 0,
      count: 0,
    },
    QR_BANCARIO: {
      label: 'QR Bancard / Dinelco',
      icon: QrCode,
      amount: 0,
      count: 0,
    },
    EFECTIVO: {
      label: 'Efectivo en Caja (PYG)',
      icon: Wallet,
      amount: 0,
      count: 0,
    },
    TARJETA_DEBITO: {
      label: 'POS Débito Bancard',
      icon: CreditCard,
      amount: 0,
      count: 0,
    },
    TARJETA_CREDITO: {
      label: 'POS Crédito Bancard',
      icon: CreditCard,
      amount: 0,
      count: 0,
    },
  };

  // Tally payments
  filteredPayments.forEach((p) => {
    const method = p.paymentMethod || 'EFECTIVO';
    if (paymentMethodsBreakdown[method]) {
      paymentMethodsBreakdown[method].amount += p.amount;
      paymentMethodsBreakdown[method].count += 1;
    }
  });

  // Tally movements
  filteredMovements
    .filter((m) => m.movementType === 'INGRESO')
    .forEach((m) => {
      const method = m.paymentMethod || 'EFECTIVO';
      if (paymentMethodsBreakdown[method]) {
        paymentMethodsBreakdown[method].amount += m.amount;
        paymentMethodsBreakdown[method].count += 1;
      }
    });

  // Ticket promedio
  const totalTransactionsCount =
    filteredPayments.length + filteredMovements.filter((m) => m.movementType === 'INGRESO').length;
  const averageTicket = totalTransactionsCount > 0 ? Math.round(totalRevenue / totalTransactionsCount) : 0;

  // Modality metrics: Particulares vs Aseguradoras (Fase 5)
  const branchFilteredClaims = selectedBranchId
    ? insuranceClaims.filter((c: any) => c.branchId === selectedBranchId)
    : insuranceClaims;

  let particularPaymentsTotal = 0;
  let insuranceCopaysTotal = 0;

  filteredPayments.forEach((pay) => {
    const pat = patients.find((p) => p.id === pay.patientId);
    if (pat?.modality === 'PLAN_SEGURO') {
      insuranceCopaysTotal += pay.amount;
    } else {
      particularPaymentsTotal += pay.amount;
    }
  });

  const insuranceSettledTotal = branchFilteredClaims
    .filter((c: any) => c.status === 'LIQUIDADO_COBRADO')
    .reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);

  const insurancePendingTotal = branchFilteredClaims
    .filter((c: any) => c.status !== 'LIQUIDADO_COBRADO' && c.status !== 'RECHAZADO')
    .reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);

  const totalGrossCommercial = particularPaymentsTotal + insuranceCopaysTotal + insuranceSettledTotal + insurancePendingTotal;

  // Plan metrics breakdown
  const planBreakdown = insurancePlans.map((pl) => {
    const pClaims = branchFilteredClaims.filter((c: any) => c.planId === pl.id);
    const coveredSum = pClaims.reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
    const settledSum = pClaims.filter((c: any) => c.status === 'LIQUIDADO_COBRADO').reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
    const pendingSum = pClaims.filter((c: any) => c.status !== 'LIQUIDADO_COBRADO' && c.status !== 'RECHAZADO').reduce((s: number, c: any) => s + (c.coveredAmount || 0), 0);
    return {
      plan: pl,
      claimsCount: pClaims.length,
      coveredSum,
      settledSum,
      pendingSum,
    };
  });

  // Handle Export CSV
  const handleExportCSV = () => {
    const headers = ['Sucursal', 'Departamento', 'Ciudad', 'Pacientes_Registrados', 'Ingresos_PYG', 'Aportacion_Pct'];
    const rows = branchMetrics.map((bm) => [
      `"${bm.branch.name}"`,
      `"${bm.branch.department}"`,
      `"${bm.branch.city}"`,
      bm.patientCount,
      bm.revenue,
      `${Math.round((bm.revenue / grandTotalAllBranches) * 100)}%`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Financiero_OdontoPro_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">
              Consolidado Financiero e Ingresos Globales
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              SET / DNIT Paraguay
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitoreo en tiempo real de facturación, medios de cobro bancarios (SIPAP / QR Bancard) y rendimiento por sucursal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV (Excel)</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Informe</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Ingresos Totales (PYG)</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatPYG(totalRevenue)}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+19.4% vs mes anterior (SET)</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Ticket Promedio por Paciente</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatPYG(averageTicket)}</div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            Sobre {totalTransactionsCount} transacciones liquidadas
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pacientes con Historia Activa</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{patients.length}</div>
          <div className="text-[11px] text-teal-700 font-medium mt-1.5">
            Distribuídos en {branches.length} sucursales
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Presupuestos Emitidos</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPYG(quotes.reduce((s, q) => s + q.totalAmount, 0))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5">
            {quotes.filter((q) => q.status === 'APROBADO').length} de {quotes.length} aprobados
          </div>
        </div>
      </div>

      {/* Grid: Branch Comparison & Payment Methods Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Branch Performance Comparison */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Rendimiento y Recaudación por Sucursal
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Aportación porcentual al ingreso institucional en Guaraníes
              </p>
            </div>
            <span className="text-xs font-semibold text-teal-700">Total: {formatPYG(grandTotalAllBranches)}</span>
          </div>

          <div className="space-y-4">
            {branchMetrics.map((bm) => {
              const pct = Math.round((bm.revenue / grandTotalAllBranches) * 100);
              const isSelected = selectedBranchId === bm.branch.id;

              return (
                <div
                  key={bm.branch.id}
                  onClick={() => onSelectBranch(isSelected ? '' : bm.branch.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-300 shadow-xs ring-2 ring-teal-500/20'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className={`h-4 w-4 ${isSelected ? 'text-teal-700' : 'text-slate-500'}`} />
                      <span className="text-xs font-bold text-slate-900">{bm.branch.name}</span>
                      <span className="text-[11px] text-slate-500">({bm.branch.city}, {bm.branch.department})</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-900">{formatPYG(bm.revenue)}</span>
                      <span className="ml-2 text-xs font-semibold text-teal-700">({pct}%)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                    <span>{bm.patientCount} pacientes adscritos</span>
                    <span className="text-teal-700 font-medium">
                      {isSelected ? '✓ Filtrando sucursal' : 'Clic para filtrar'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods Distribution */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Distribución por Medio de Pago
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Integración bancaria SIPAP, QR Bancard y Efectivo en caja
            </p>
          </div>

          <div className="space-y-3">
            {Object.entries(paymentMethodsBreakdown).map(([key, data]) => {
              const Icon = data.icon;
              const pct = totalRevenue > 0 ? Math.round((data.amount / totalRevenue) * 100) : 0;

              return (
                <div key={key} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-teal-700 flex items-center justify-center shrink-0 shadow-xs">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{data.label}</div>
                      <div className="text-[11px] text-slate-500">{data.count} operaciones registradas</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">{formatPYG(data.amount)}</div>
                    <div className="text-[11px] font-semibold text-teal-700">{pct}% del total</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong>Conciliación Bancaria Automática:</strong> Los cobros mediante SIPAP y QR Bancard no requieren arqueo físico en caja, ingresando directamente a la cuenta corriente del banco.
            </div>
          </div>
        </div>
      </div>

      {/* Fase 5: Insurance & Prepagas Financial Performance Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-0.5">
              <ShieldCheck className="h-4 w-4" />
              <span>Fase 5 • Facturación por Modalidad Comercial</span>
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              Desglose de Ingresos: Particulares vs Seguros & Prepagas Odontológicas
            </h3>
            <p className="text-xs text-slate-500">
              Comparativa entre aranceles particulares directos, copagos recaudados en caja y liquidaciones cobradas/pendientes de aseguradoras.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volumen Económico Total</span>
            <span className="text-base font-black text-indigo-950">{formatPYG(totalGrossCommercial)}</span>
          </div>
        </div>

        {/* 4 Cards Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ingresos Particulares */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pacientes Particulares
              </span>
              <Users className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-lg font-black text-slate-900 mt-2">
              {formatPYG(particularPaymentsTotal)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {totalGrossCommercial > 0 ? Math.round((particularPaymentsTotal / totalGrossCommercial) * 100) : 0}% del volumen comercial
            </div>
          </div>

          {/* Copagos Recaudados */}
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Copagos en Clínica
              </span>
              <Wallet className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-lg font-black text-indigo-900 mt-2">
              {formatPYG(insuranceCopaysTotal)}
            </div>
            <div className="text-[11px] text-indigo-700 font-semibold mt-1">
              Abonados por pacientes asegurados
            </div>
          </div>

          {/* Liquidaciones Cobradas en Banco */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Liquidado Aseguradoras
              </span>
              <Landmark className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg font-black text-emerald-900 mt-2">
              {formatPYG(insuranceSettledTotal)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              Cancelado vía SIPAP por aseguradoras
            </div>
          </div>

          {/* Cuentas por Cobrar Aseguradoras */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Por Cobrar a Aseguradoras
              </span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-lg font-black text-amber-900 mt-2">
              {formatPYG(insurancePendingTotal)}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              En auditoría o pendiente de remesa
            </div>
          </div>
        </div>

        {/* Plan Breakdown Table */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rendimiento por Entidad Aseguradora & Convenio
          </h4>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Aseguradora / Convenio</th>
                  <th className="px-4 py-3 text-center">Prestaciones</th>
                  <th className="px-4 py-3 text-right">Total Cobertura</th>
                  <th className="px-4 py-3 text-right">Cobrado (SIPAP)</th>
                  <th className="px-4 py-3 text-right text-amber-800">Por Cobrar</th>
                  <th className="px-4 py-3 text-right">Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {planBreakdown.map((pb) => {
                  const pct = totalGrossCommercial > 0 ? Math.round((pb.coveredSum / totalGrossCommercial) * 100) : 0;
                  return (
                    <tr key={pb.plan.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                        <div>
                          <div>{pb.plan.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{pb.plan.code}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-700">
                        {pb.claimsCount}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                        {formatPYG(pb.coveredSum)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatPYG(pb.settledSum)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">
                        {formatPYG(pb.pendingSum)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-600">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
