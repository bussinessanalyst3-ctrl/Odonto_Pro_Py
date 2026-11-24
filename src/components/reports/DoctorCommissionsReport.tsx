import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Award,
  DollarSign,
  CheckCircle2,
  Printer,
  Download,
  Percent,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  ReportPeriodFilter,
  getPeriodLabel,
  isDateInReportPeriod,
  toAsuncionDateISO,
} from '../../utils/reportPeriod.ts';

interface DoctorCommissionsReportProps {
  selectedBranchId: string;
  periodFilter?: ReportPeriodFilter;
  selectedDoctorId?: string;
  onDoctorChange?: (doctorId: string) => void;
}

export const DoctorCommissionsReport: React.FC<DoctorCommissionsReportProps> = ({
  selectedBranchId,
  periodFilter,
  selectedDoctorId,
  onDoctorChange,
}) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, []);

  const snapshot = dbStore.getSnapshot();
  const doctors = (snapshot.users || []).filter(
    (u) => u.roleId === 'ODONTOLOGO' || u.roleId === 'SUPER_ADMIN' || u.roleId === 'ADMIN_SUCURSAL'
  );

  const [activeDoctorId, setActiveDoctorId] = useState<string>(
    selectedDoctorId || doctors[0]?.id || ''
  );
  const [commissionRate, setCommissionRate] = useState<number>(40); // 40% estándar para odontólogos en PY
  const [irpRetentionRate, setIrpRetentionRate] = useState<number>(0); // 0%, 8% o 10% IRP en Paraguay

  useEffect(() => {
    if (selectedDoctorId) {
      setActiveDoctorId(selectedDoctorId);
    } else if (!activeDoctorId && doctors[0]?.id) {
      setActiveDoctorId(doctors[0].id);
    }
  }, [selectedDoctorId, doctors.length]);

  const currentDoctor = doctors.find((d) => d.id === activeDoctorId) || doctors[0];
  const todayIso = getTodayAsuncionISO();
  const activePeriod: ReportPeriodFilter = periodFilter || { preset: 'ALL' };
  const periodLabel = getPeriodLabel(activePeriod, todayIso);

  // Tratamientos, presupuestos y citas vinculados a este profesional
  const allTreatments = snapshot.treatments || [];
  const allQuotes = snapshot.quotes || [];
  const allAppointments = snapshot.appointments || [];

  const doctorQuoteIds = new Set(
    allQuotes
      .filter((q) => q.odontologistId === currentDoctor?.id)
      .map((q) => q.id)
  );

  const doctorTreatmentsMap = new Map<string, any>();
  for (const t of allTreatments) {
    const matchesDoctor =
      t.odontologistId === currentDoctor?.id ||
      (t.quoteId && doctorQuoteIds.has(t.quoteId));
    if (matchesDoctor) {
      doctorTreatmentsMap.set(t.id, t);
    }
  }

  const doctorAppointmentsMap = new Map<string, any>();
  for (const a of allAppointments) {
    if (a.odontologistId !== currentDoctor?.id) continue;
    if (selectedBranchId && a.branchId !== selectedBranchId) continue;
    if (isDateInReportPeriod(a.appointmentDate, activePeriod, todayIso)) {
      doctorAppointmentsMap.set(a.id, a);
    }
  }

  const attendedAppointmentsCount = Array.from(doctorAppointmentsMap.values()).filter(
    (a) => a.status === 'FINALIZADA' || a.status === 'EN_ATENCION'
  ).length;

  // Producción REAL: únicamente cobros efectivos (status !== 'ANULADO') vinculados a tratamientos o citas del profesional
  const allPayments = snapshot.payments || [];
  const doctorPayments = allPayments
    .filter((p) => {
      if (!p || p.status === 'ANULADO') return false;
      if (selectedBranchId && p.branchId !== selectedBranchId) return false;
      if (!isDateInReportPeriod(p.createdAt || p.paymentDate, activePeriod, todayIso)) return false;

      if (p.treatmentId && doctorTreatmentsMap.has(p.treatmentId)) return true;
      if (p.quoteId && doctorQuoteIds.has(p.quoteId)) return true;
      if (p.appointmentId && allAppointments.some((a) => a.id === p.appointmentId && a.odontologistId === currentDoctor?.id)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const finalItems = doctorPayments.map((pay) => {
    const patient = snapshot.patients.find((p) => p.id === pay.patientId);
    const branch = snapshot.branches.find((b) => b.id === pay.branchId);
    const treatment = pay.treatmentId ? doctorTreatmentsMap.get(pay.treatmentId) : null;
    const appointment = pay.appointmentId
      ? allAppointments.find((a) => a.id === pay.appointmentId)
      : null;

    const amount = Math.round(Number(pay.amount || 0));
    const docCommission = Math.round((amount * commissionRate) / 100);

    return {
      id: pay.id,
      dateIso: toAsuncionDateISO(pay.createdAt || pay.paymentDate),
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente Clínico',
      patientDoc: patient?.documentNumber || 'Sin Doc',
      procedureName:
        treatment?.title ||
        appointment?.reason ||
        pay.notes ||
        `Cobro Recibo ${pay.receiptNumber || ''}`.trim(),
      branchName: branch?.name || 'Sucursal',
      totalBilled: amount,
      commissionPct: commissionRate,
      commissionAmount: docCommission,
      receiptNumber: pay.receiptNumber || '—',
    };
  });

  const totalProduction = finalItems.reduce((acc, it) => acc + it.totalBilled, 0);
  const grossCommission = Math.round((totalProduction * commissionRate) / 100);
  const irpRetentionAmount = Math.round((grossCommission * irpRetentionRate) / 100);
  const netCommissionToPay = grossCommission - irpRetentionAmount;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Doctor',
      'Reg_Profesional',
      'Paciente',
      'Cedula',
      'Procedimiento',
      'Sucursal',
      'Recibo',
      'Cobrado_PYG',
      'Comision_Pct',
      'Comision_PYG',
    ];
    const rows = finalItems.map((it) => [
      it.dateIso,
      `"${currentDoctor?.firstName || ''} ${currentDoctor?.lastName || ''}"`,
      currentDoctor?.professionalLicense || 'Sin registro',
      `"${it.patientName}"`,
      it.patientDoc,
      `"${String(it.procedureName).replace(/"/g, '""')}"`,
      `"${it.branchName}"`,
      `"${it.receiptNumber}"`,
      it.totalBilled,
      `${it.commissionPct}%`,
      it.commissionAmount,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Liquidacion_Honorarios_${currentDoctor?.lastName || 'Doctor'}_${todayIso}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Doctor Selection & Configuration Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-lg">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Dr(a). {currentDoctor?.firstName || ''} {currentDoctor?.lastName || ''}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
                Reg. MSPBS: {currentDoctor?.professionalLicense || 'Sin registro'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Liquidación individual de honorarios reales • Período: {periodLabel} • {attendedAppointmentsCount} citas atendidas
            </p>
          </div>
        </div>

        {/* Doctor Selector and Commission Rate Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Seleccionar Odontólogo
            </label>
            <select
              value={activeDoctorId}
              onChange={(e) => {
                setActiveDoctorId(e.target.value);
                if (onDoctorChange) onDoctorChange(e.target.value);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr(a). {d.firstName} {d.lastName} ({d.professionalLicense || 'Profesional'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              % Comisión Pactada
            </label>
            <select
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value={30}>30% (General)</option>
              <option value={35}>35% (Especialista)</option>
              <option value={40}>40% (Estándar Clínica PY)</option>
              <option value={45}>45% (Alta Complejidad)</option>
              <option value={50}>50% (Socio / Cirujano)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Retención IRP (SET)
            </label>
            <select
              value={irpRetentionRate}
              onChange={(e) => setIrpRetentionRate(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value={0}>0% (Sin Retención en Fuente)</option>
              <option value={8}>8% (IRP Servicios Personales)</option>
              <option value={10}>10% (Tasa Máxima IRP)</option>
            </select>
          </div>

          <div className="flex items-end gap-2 pt-4 sm:pt-0">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Exportar a archivo CSV para Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Imprimir boleta de honorarios"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards for Doctor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Cobros Efectivos Generados</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{formatPYG(totalProduction)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>En {finalItems.length} cobros registrados ({periodLabel})</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Comisión Bruta ({commissionRate}%)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700">{formatPYG(grossCommission)}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Honorarios profesionales antes de IRP
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Retención IRP ({irpRetentionRate}%)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-800">
            {irpRetentionAmount > 0 ? `- ${formatPYG(irpRetentionAmount)}` : '₲ 0'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {irpRetentionRate > 0 ? 'Comprobante de Retención SET' : 'Factura emitida por el profesional'}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-teal-300 bg-teal-50/50 shadow-xs">
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className="text-xs font-bold">Monto Neto a Liquidar</span>
            <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-teal-900">{formatPYG(netCommissionToPay)}</div>
          <div className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
            <span>Calculado sobre cobros efectivos</span>
          </div>
        </div>
      </div>

      {/* Production & Procedures Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Detalle de Cobros y Comisiones Odontológicas
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Cobros efectivos vinculados a tratamientos y citas de {currentDoctor?.firstName || ''} {currentDoctor?.lastName || ''}
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
            {finalItems.length} registros reales
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3.5 px-4">Fecha</th>
                <th className="py-3.5 px-4">Paciente</th>
                <th className="py-3.5 px-4">Tratamiento / Concepto</th>
                <th className="py-3.5 px-4">Sucursal</th>
                <th className="py-3.5 px-4 text-right">Cobrado (PYG)</th>
                <th className="py-3.5 px-4 text-center">% Com.</th>
                <th className="py-3.5 px-4 text-right">Honorario (PYG)</th>
                <th className="py-3.5 px-4 text-center">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finalItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-slate-400">
                    No existen cobros efectivos registrados para este profesional en el período seleccionado ({periodLabel}).
                  </td>
                </tr>
              ) : (
                finalItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono">
                      {item.dateIso}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.patientName}</div>
                      <div className="text-[11px] text-slate-500">CI: {item.patientDoc}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium max-w-xs truncate">
                      {item.procedureName}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {item.branchName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatPYG(item.totalBilled)}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-teal-700">
                      {item.commissionPct}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                      {formatPYG(item.commissionAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                        {item.receiptNumber}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                <td colSpan={4} className="py-3.5 px-4 text-right uppercase text-xs tracking-wider">
                  Totales de Liquidación:
                </td>
                <td className="py-3.5 px-4 text-right text-sm">{formatPYG(totalProduction)}</td>
                <td className="py-3.5 px-4 text-center text-xs">{commissionRate}%</td>
                <td className="py-3.5 px-4 text-right text-emerald-700 text-sm">
                  {formatPYG(grossCommission)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Legal & Medical Notice */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
            <span>
              Cálculo basado únicamente en cobros efectivos (sin anulados) conforme al Contrato de Prestación de Servicios Odontológicos y disposiciones de la DNIT / SET.
            </span>
          </div>
          <div className="font-semibold text-slate-700 shrink-0">
            Moneda Oficial: Guaraníes (PYG ₲)
          </div>
        </div>
      </div>
    </div>
  );
};

