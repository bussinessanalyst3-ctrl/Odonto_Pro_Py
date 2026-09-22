import React, { useState } from 'react';
import {
  FileText,
  User,
  HeartPulse,
  AlertTriangle,
  Stethoscope,
  Plus,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ChevronRight
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { CreateClinicalRecordModal } from './CreateClinicalRecordModal.tsx';
import { ClinicalRecordDetailModal } from './ClinicalRecordDetailModal.tsx';

export const ClinicalRecordsView: React.FC = () => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const userRole = session?.role || 'ODONTOLOGO';
  const isClinicalRole = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN_SUCURSAL' || userRole === 'ODONTOLOGO';

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedOdontologistId, setSelectedOdontologistId] = useState<string>('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<any>(null);

  const handleOpenRecordDetail = (rec: any) => {
    setSelectedRecordForDetail(rec);
    const patient = patients.find((p) => p.id === rec.patientId);
    dbStore.addAuditLog({
      action: 'READ_SENSITIVE',
      entity: 'CLINICAL_RECORD',
      entityId: rec.id,
      userId: session?.userId,
      branchId: rec.branchId,
      description: `Acceso y lectura de historia clínica y evolución sensible de ${patient ? `${patient.firstName} ${patient.lastName} (CI ${patient.documentNumber})` : 'paciente'}`,
    });
  };

  const patients = snapshot.patients;
  const branches = snapshot.branches;
  const dentists = snapshot.users.filter((u) => u.roleId === 'ODONTOLOGO');
  const records = snapshot.clinicalRecords || [];

  // Filter clinical evolutions
  const filteredRecords = records.filter((r) => {
    if (selectedPatientId !== 'ALL' && r.patientId !== selectedPatientId) return false;
    if (selectedBranchId !== 'ALL' && r.branchId !== selectedBranchId) return false;
    if (selectedOdontologistId !== 'ALL' && r.odontologistId !== selectedOdontologistId) return false;

    if (searchTerm.trim()) {
      const patient = patients.find((p) => p.id === r.patientId);
      const search = searchTerm.toLowerCase();
      const patientMatch = patient && (
        patient.firstName.toLowerCase().includes(search) ||
        patient.lastName.toLowerCase().includes(search) ||
        patient.documentNumber.includes(search)
      );
      const diagMatch = r.diagnosis.toLowerCase().includes(search);
      const treatMatch = r.treatmentPerformed.toLowerCase().includes(search);
      return patientMatch || diagMatch || treatMatch;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                Fase 8: Historia Clínica Unificada
              </span>
              <span className="text-xs text-slate-500">
                Ley N° 1682/01 de Secreto Profesional & Datos Médicos
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Fichas Clínicas & Evoluciones Odontológicas
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Historial unificado multi-sucursal con diagnóstico, tratamiento realizado, prescripciones y firma profesional con Registro MSPBS.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isClinicalRole ? (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-semibold text-sm shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Nueva Evolución Clínica</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-amber-600" />
                <span>Modo Solo Lectura (Rol Administrativo)</span>
              </div>
            )}
          </div>
        </div>

        {/* Security & Access Restriction Notice */}
        {!isClinicalRole && (
          <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Restricción por Rol Sanitario (Ley N° 1682/01):</strong> Los usuarios con rol
              Recepción o Caja no poseen permisos para alterar o registrar diagnósticos médicos ni
              prescripciones farmacológicas. Solamente el personal odontológico colegiado puede asentar
              evoluciones clínicas.
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Quick search input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Buscar en Fichas
            </label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Nombre, Cédula o Diagnóstico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Patient Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Filtrar por Paciente
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todos los Pacientes ({patients.length})</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} (C.I. {p.documentNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Branch filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Sucursal de Atención
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todas las Sucursales ({branches.length})</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Odontologist filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Odontólogo Firmante
            </label>
            <select
              value={selectedOdontologistId}
              onChange={(e) => setSelectedOdontologistId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">Todos los Odontólogos ({dentists.length})</option>
              {dentists.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr(a). {d.firstName} {d.lastName} ({d.professionalLicense || 'MSPBS'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Clinical Records List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No se encontraron evoluciones clínicas</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No existen registros con los filtros seleccionados o aún no se han registrado notas clínicas para los pacientes.
          </p>
          {isClinicalRole && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Primera Evolución</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((rec) => {
            const patient = patients.find((p) => p.id === rec.patientId);
            const dentist = dentists.find((d) => d.id === rec.odontologistId);
            const branch = branches.find((b) => b.id === rec.branchId);

            const hasAllergy =
              patient?.allergies &&
              patient.allergies.toLowerCase() !== 'ninguna' &&
              patient.allergies.toLowerCase() !== 'ninguna conocida';

            const recordDate = new Date(rec.createdAt).toLocaleDateString('es-PY', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={rec.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Header: Date, Patient, Branch & Doctor */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {patient ? `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}` : 'PX'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente No Identificado'}
                        </span>
                        {patient && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700">
                            C.I. {patient.documentNumber}
                          </span>
                        )}
                        {hasAllergy && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Alergia: {patient.allergies}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {recordDate}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {branch?.name || 'Clínica Principal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
                        <span>Dr(a). {dentist ? `${dentist.firstName} ${dentist.lastName}` : 'Odontólogo Tratante'}</span>
                      </div>
                      <div className="text-[11px] text-teal-700 font-semibold">
                        Reg. Profesional: {dentist?.professionalLicense || 'MSPBS N° 9.155'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenRecordDetail(rec)}
                      className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors inline-flex items-center gap-1"
                    >
                      <span>Ver Ficha Completa</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clinical Content Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Diagnosis */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-teal-900 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-teal-700" />
                      <span>Diagnóstico Clínico / Motivo</span>
                    </div>
                    <p className="text-slate-700 font-medium">{rec.diagnosis}</p>
                    {rec.reasonForConsultation && (
                      <p className="text-slate-500 italic">"{rec.reasonForConsultation}"</p>
                    )}
                  </div>

                  {/* Treatment Performed */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-teal-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-700" />
                      <span>Tratamiento Realizado en Sesión</span>
                    </div>
                    <p className="text-slate-700 font-medium">{rec.treatmentPerformed}</p>
                  </div>
                </div>

                {/* Prescriptions & Instructions if available */}
                {(rec.prescriptions || rec.recommendations) && (
                  <div className="p-3 bg-teal-50/50 rounded-2xl border border-teal-100/70 text-xs text-slate-700 space-y-1">
                    {rec.prescriptions && (
                      <div>
                        <strong className="text-teal-900 font-semibold">Receta Odontológica / Fármacos: </strong>
                        <span>{rec.prescriptions}</span>
                      </div>
                    )}
                    {rec.recommendations && (
                      <div>
                        <strong className="text-teal-900 font-semibold">Indicaciones Pos-operatorias: </strong>
                        <span>{rec.recommendations}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Record Modal */}
      {isCreateOpen && (
        <CreateClinicalRecordModal onClose={() => setIsCreateOpen(false)} />
      )}

      {/* Detail Record Modal */}
      {selectedRecordForDetail && (
        <ClinicalRecordDetailModal
          record={selectedRecordForDetail}
          onClose={() => setSelectedRecordForDetail(null)}
        />
      )}
    </div>
  );
};
