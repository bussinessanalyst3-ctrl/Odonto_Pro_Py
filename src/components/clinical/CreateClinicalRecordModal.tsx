import React, { useState } from 'react';
import {
  X,
  Stethoscope,
  User,
  Building2,
  FileText,
  AlertTriangle,
  Pill,
  Award,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface CreateClinicalRecordModalProps {
  initialPatientId?: string;
  onClose: () => void;
}

export const CreateClinicalRecordModal: React.FC<CreateClinicalRecordModalProps> = ({
  initialPatientId,
  onClose,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const patients = snapshot.patients;
  const branches = snapshot.branches;
  const dentists = snapshot.users.filter((u) => u.roleId === 'ODONTOLOGO');

  const [patientId, setPatientId] = useState<string>(initialPatientId || patients[0]?.id || '');
  const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
  const [odontologistId, setOdontologistId] = useState<string>(
    session?.role === 'ODONTOLOGO' ? session.userId : (dentists[0]?.id || '')
  );

  const [reasonForConsultation, setReasonForConsultation] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [treatmentPerformed, setTreatmentPerformed] = useState<string>('');
  const [prescriptions, setPrescriptions] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedDentist = snapshot.users.find((u) => u.id === odontologistId);

  const hasAllergy =
    selectedPatient?.allergies &&
    selectedPatient.allergies.toLowerCase() !== 'ninguna' &&
    selectedPatient.allergies.toLowerCase() !== 'ninguna conocida';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!patientId || !branchId || !odontologistId || !diagnosis.trim() || !treatmentPerformed.trim()) {
      setErrorMessage('Por favor ingrese el diagnóstico médico y el procedimiento realizado.');
      return;
    }

    try {
      dbStore.addClinicalRecord({
        branchId,
        patientId,
        odontologistId,
        reasonForConsultation: reasonForConsultation || 'Consulta odontológica programada',
        diagnosis,
        treatmentPerformed,
        prescriptions,
        recommendations,
        internalNotes,
        actorUserId: session?.userId,
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar la evolución clínica.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-700/20">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registrar Evolución Clínica Odontológica</h2>
              <p className="text-xs text-slate-500">
                Firma Profesional Colegiada • Registro de Expediente Sanitario Ley 1682/01
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Patient Warning Banner if has allergies */}
          {hasAllergy && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-2xl flex items-center gap-2 text-xs text-rose-900 font-medium">
              <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0" />
              <span>
                <strong>Atención Clínica (Alergias del Paciente):</strong> {selectedPatient?.allergies}
              </span>
            </div>
          )}

          {/* Patient, Branch & Doctor Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Paciente *
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} (C.I. {p.documentNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sucursal de Atención *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Odontólogo Firmante *
              </label>
              <select
                value={odontologistId}
                onChange={(e) => setOdontologistId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr(a). {d.firstName} {d.lastName} ({d.professionalLicense || 'MSPBS'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reason for consultation */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Motivo de Consulta / Anamnesis
            </label>
            <input
              type="text"
              value={reasonForConsultation}
              onChange={(e) => setReasonForConsultation(e.target.value)}
              placeholder="Ej. Paciente refiere dolor a la masticación en pieza 1.6 desde hace 3 días..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Diagnosis & Treatment Performed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Diagnóstico Odontológico Clínico *
              </label>
              <textarea
                rows={3}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Ej. Pulpitis irreversible sintomática en pieza 1.6 con compromiso cameral..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tratamiento Odontológico Realizado *
              </label>
              <textarea
                rows={3}
                value={treatmentPerformed}
                onChange={(e) => setTreatmentPerformed(e.target.value)}
                placeholder="Ej. Apertura cameral bajo anestesia infiltrativa (Mepivacaína 2%), pulpectomía de 3 conductos e irrigación profusa con NaOCl al 2.5%..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Prescriptions & Instructions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receta Médica / Prescripción Farmacológica
              </label>
              <textarea
                rows={2}
                value={prescriptions}
                onChange={(e) => setPrescriptions(e.target.value)}
                placeholder="Ej. Ibuprofeno 600mg cada 8 horas por 3 días si hay dolor. Amoxicilina 875mg..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recomendaciones & Cuidados Pos-operatorios
              </label>
              <textarea
                rows={2}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="Ej. No masticar del lado intervenido por 24hs. Hielo local intermitente. Próximo control en 7 días..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Internal confidential notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notas Confidenciales del Profesional (Interno)
            </label>
            <input
              type="text"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Ej. Conducto mesiovestibular estrecho, se requiere lima #10 para permeabilización en próxima cita..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Signature preview */}
          <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-2xl flex items-center justify-between text-xs text-teal-900">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-700 shrink-0" />
              <div>
                <strong>Firma Digital de Registro Profesional:</strong> Asentada por Dr(a).{' '}
                {selectedDentist?.firstName} {selectedDentist?.lastName} (
                {selectedDentist?.professionalLicense || 'Registro MSPBS N° 9.155'})
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Guardar y Firmar Ficha</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
