import React from 'react';
import { X, Printer, Download, ShieldCheck, Building2, Stethoscope, FileText, CheckCircle2 } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';

interface ClaimSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  claims: any[];
  plan?: any;
  branchName?: string;
}

export const ClaimSheetModal: React.FC<ClaimSheetModalProps> = ({
  isOpen,
  onClose,
  claims,
  plan,
  branchName,
}) => {
  const snapshot = dbStore.getSnapshot();
  const org = snapshot.organization;
  const patients = snapshot.patients || [];
  const doctors = snapshot.users.filter((u) => u.roleId === 'ODONTOLOGO');
  const mainDoctor = doctors[0] || snapshot.users[0];

  if (!isOpen) return null;

  const totalListPrice = claims.reduce((s, c) => s + (c.originalListPrice || 0), 0);
  const totalCopay = claims.reduce((s, c) => s + (c.copayAmount || 0), 0);
  const totalCovered = claims.reduce((s, c) => s + (c.coveredAmount || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'Nro Reclamo',
      'Fecha',
      'Aseguradora / Plan',
      'Paciente',
      'Cedula CI',
      'Carnet Afiliado',
      'Pieza FDI',
      'Prestacion Odontologica',
      'Arancel Particular (PYG)',
      'Copago Paciente (PYG)',
      'Cobertura Aseguradora (PYG)',
      'Estado',
      'Referencia Liquidacion',
    ];

    const rows = claims.map((c) => {
      const patient = patients.find((p) => p.id === c.patientId);
      const patName = patient ? `${patient.firstName} ${patient.lastName}` : c.patientName || 'Paciente';
      const patDoc = patient?.documentNumber || '';
      const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('es-PY') : '';

      return [
        c.claimNumber,
        dateStr,
        plan?.name || c.planName || 'Seguro',
        `"${patName}"`,
        `"${patDoc}"`,
        `"${c.patientMemberNumber || patient?.insuranceMemberNumber || ''}"`,
        c.toothNumber || '-',
        `"${c.serviceName}"`,
        c.originalListPrice,
        c.copayAmount,
        c.coveredAmount,
        c.status,
        `"${c.settlementReference || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Planilla_Liquidacion_${plan?.code || 'SEGURO'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Actions Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <span>Planilla Oficial de Reclamo y Liquidación Odontológica</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Planilla</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="mt-6 flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-6 text-slate-800">
          {/* Header Membrete */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slate-800/20">
            <div>
              <div className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                <span>{org?.name || 'Clínica Odontológica OdontoPro'}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Razón Social: {org?.businessName || 'OdontoPro S.A.'} • RUC: {org?.ruc || '80012345-6'}
              </p>
              <p className="text-xs text-slate-500">
                Establecimiento Habilitado por MSPBS • Reg. Sanitario N° 456/2020 • Asunción, Paraguay
              </p>
            </div>
            <div className="text-right sm:border-l sm:pl-6 border-slate-200 text-xs">
              <span className="px-2.5 py-1 rounded-full font-black bg-indigo-50 text-indigo-900 border border-indigo-200 inline-block uppercase text-[10px] tracking-wider mb-1">
                Remesa a Aseguradora
              </span>
              <div className="font-mono font-bold text-slate-800 text-sm">
                PLANILLA N° {plan?.code || 'SEG'}-{new Date().getFullYear()}-{Math.floor(100 + Math.random() * 900)}
              </div>
              <div className="text-slate-500 text-[11px]">
                Fecha de Emisión: {new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Insurance & Doctor Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Entidad Aseguradora / Convenio</span>
              <div className="font-extrabold text-indigo-900 text-sm">{plan?.name || 'Plan de Seguro Odontológico'}</div>
              <div className="text-slate-600">Código Plan: <span className="font-mono font-semibold">{plan?.code || 'N/A'}</span></div>
              <div className="text-slate-500 text-[11px]">{plan?.coverageTerms || 'Términos de cobertura estándar'}</div>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sucursal & Profesional Auditor</span>
              <div className="font-bold text-slate-900">{branchName || 'Sucursal Principal'}</div>
              <div className="text-slate-600">
                Dr(a). Tratante: <span className="font-semibold">{mainDoctor ? `${mainDoctor.firstName} ${mainDoctor.lastName}` : 'Dr. Lucas Arrua'}</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                Registro Profesional MSPBS N° {mainDoctor?.dentalLicenseNumber || '14.892'}
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">N° Reclamo</th>
                  <th className="px-3 py-2.5">Paciente & Cédula</th>
                  <th className="px-3 py-2.5">N° Carnet</th>
                  <th className="px-3 py-2.5">Pieza</th>
                  <th className="px-3 py-2.5">Prestación Realizada</th>
                  <th className="px-3 py-2.5 text-right">Arancel (₲)</th>
                  <th className="px-3 py-2.5 text-right">Copago (₲)</th>
                  <th className="px-3 py-2.5 text-right text-indigo-900">Cobertura (₲)</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => {
                  const patient = patients.find((p) => p.id === claim.patientId);
                  const patName = patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente';
                  const patDoc = patient?.documentNumber || '';
                  const memberCard = claim.patientMemberNumber || patient?.insuranceMemberNumber || '-';

                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 font-mono text-[11px] font-semibold text-slate-700">
                        {claim.claimNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{patName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">CI {patDoc}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-700 font-bold">
                        {memberCard}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-center text-slate-700 font-semibold">
                        {claim.toothNumber || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 font-medium">
                        {claim.serviceName}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-semibold">
                        {formatPYG(claim.originalListPrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600 font-semibold">
                        {formatPYG(claim.copayAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-indigo-900">
                        {formatPYG(claim.coveredAmount)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          claim.status === 'LIQUIDADO_COBRADO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : claim.status === 'APROBADO'
                            ? 'bg-blue-100 text-blue-800'
                            : claim.status === 'EN_AUDITORIA'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {claim.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-right uppercase tracking-wider text-slate-600">
                    Totales Consolidados ({claims.length} prestaciones):
                  </td>
                  <td className="px-3 py-3 text-right text-slate-800">
                    {formatPYG(totalListPrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    {formatPYG(totalCopay)}
                  </td>
                  <td className="px-3 py-3 text-right text-indigo-950 font-black text-sm">
                    {formatPYG(totalCovered)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Legal and Signatures Footer */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-4">
            <p className="text-[11px] leading-relaxed">
              Certificamos que las prestaciones detalladas en esta planilla fueron efectivamente ejecutadas con apego a los protocolos odontológicos del Ministerio de Salud Pública y Bienestar Social (MSPBS), cumpliendo los términos de confidencialidad de la Ley N° 1682/01.
            </p>

            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">
                  {mainDoctor ? `${mainDoctor.firstName} ${mainDoctor.lastName}` : 'Dr. Lucas Arrua Almada'}
                </div>
                <div className="text-[11px] text-slate-500">
                  Odontólogo Tratante • Reg. MSPBS N° {mainDoctor?.dentalLicenseNumber || '14.892'}
                </div>
              </div>
              <div className="border-t border-slate-400 pt-2">
                <div className="font-bold text-slate-900">
                  Auditoría Odontológica / Aseguradora
                </div>
                <div className="text-[11px] text-slate-500">
                  Sello y Firma de Recepción de la Planilla
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
