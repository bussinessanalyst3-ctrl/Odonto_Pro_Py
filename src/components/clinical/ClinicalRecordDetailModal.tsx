import React from 'react';
import {
  X,
  Stethoscope,
  Building2,
  Calendar,
  AlertTriangle,
  Award,
  FileText,
  Printer,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';

interface ClinicalRecordDetailModalProps {
  record: any;
  onClose: () => void;
}

export const ClinicalRecordDetailModal: React.FC<ClinicalRecordDetailModalProps> = ({
  record,
  onClose,
}) => {
  const snapshot = dbStore.getSnapshot();

  const patient = snapshot.patients.find((p) => p.id === record.patientId);
  const dentist = snapshot.users.find((u) => u.id === record.odontologistId);
  const branch = snapshot.branches.find((b) => b.id === record.branchId);

  const formattedDate = new Date(record.createdAt).toLocaleDateString('es-PY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-700/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Expediente Clínico Odontológico</h2>
              <p className="text-xs text-slate-500">
                Ficha Legal de Evolución Sanitaria • {record.id.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              title="Imprimir Ficha"
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Patient Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Datos del Paciente
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {patient?.firstName} {patient?.lastName}
              </div>
              <div className="text-slate-600 mt-0.5">
                Cédula: <strong>C.I. {patient?.documentNumber}</strong> • Nacimiento:{' '}
                {patient?.birthDate}
              </div>
              <div className="text-slate-600 mt-0.5">
                Ciudad: {patient?.city} • Contacto: {patient?.phone || patient?.whatsapp}
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Atención Sanitaria
              </div>
              <div className="font-semibold text-slate-800 mt-0.5">{branch?.name}</div>
              <div className="text-slate-500 mt-0.5">{formattedDate}</div>
            </div>
          </div>

          {/* Anamnesis / Motivo */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-teal-900">
              Motivo de Consulta / Anamnesis
            </h4>
            <p className="text-xs text-slate-700 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {record.reasonForConsultation || 'Control y tratamiento odontológico regular.'}
            </p>
          </div>

          {/* Diagnóstico */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-teal-900">
              Diagnóstico Clínico
            </h4>
            <div className="text-xs text-slate-800 font-medium p-3 bg-slate-50 rounded-xl border border-slate-100">
              {record.diagnosis}
            </div>
          </div>

          {/* Procedimiento Realizado */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-teal-900">
              Tratamiento Odontológico Efectuado
            </h4>
            <div className="text-xs text-slate-800 p-3 bg-slate-50 rounded-xl border border-slate-100 whitespace-pre-line leading-relaxed">
              {record.treatmentPerformed}
            </div>
          </div>

          {/* Receta & Recomendaciones */}
          {(record.prescriptions || record.recommendations) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {record.prescriptions && (
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/70 space-y-1">
                  <div className="font-bold text-teal-900">Receta / Farmacología:</div>
                  <p className="text-slate-700">{record.prescriptions}</p>
                </div>
              )}
              {record.recommendations && (
                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200/70 space-y-1">
                  <div className="font-bold text-teal-900">Cuidados Pos-operatorios:</div>
                  <p className="text-slate-700">{record.recommendations}</p>
                </div>
              )}
            </div>
          )}

          {/* Profesional Responsable Signature Box */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900">
                  Dr(a). {dentist?.firstName} {dentist?.lastName}
                </div>
                <div className="text-teal-700 font-semibold">
                  Registro Profesional MSPBS: {dentist?.professionalLicense || 'N° 9.155'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Firma Electrónica Médica Certificada - Ley N° 1682/01
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <ShieldCheck className="h-5 w-5" />
              <span>Verificado</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
