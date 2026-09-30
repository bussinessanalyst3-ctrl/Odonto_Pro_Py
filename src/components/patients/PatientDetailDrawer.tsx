import React, { useState } from 'react';
import {
  X,
  User,
  HeartPulse,
  AlertTriangle,
  Phone,
  MessageCircle,
  Calendar,
  CreditCard,
  Building2,
  MapPin,
  Clock,
  Award,
  CheckCircle2,
  FileText,
  Receipt,
  Sparkles
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';

interface PatientDetailDrawerProps {
  patientId: string | null;
  onClose: () => void;
  onEdit: (patient: any) => void;
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patientId,
  onClose,
  onEdit,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'clinical' | 'evolutions' | 'appointments' | 'branches' | 'payments'>('clinical');

  if (!patientId) return null;

  const snapshot = dbStore.getSnapshot();
  const patient = snapshot.patients.find((p) => p.id === patientId);

  if (!patient) return null;

  const patientBranches = snapshot.patientBranches.filter((pb) => pb.patientId === patientId);
  const patientAppointments = snapshot.appointments.filter((a) => a.patientId === patientId);
  const patientPayments = snapshot.payments.filter((p) => p.patientId === patientId);
  const patientEvolutions = (snapshot.clinicalRecords || []).filter((cr) => cr.patientId === patientId);
  const primaryBranch = snapshot.branches.find((b) => b.id === patient.primaryBranchId);

  // Calculate age
  const birthYear = patient.birthDate ? new Date(patient.birthDate).getFullYear() : 1995;
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  // Paraguay WhatsApp link
  const cleanPhone = (patient.whatsapp || patient.phone || '').replace(/\D/g, '');
  const waNumber = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;
  const greeting = encodeURIComponent(
    `Hola ${patient.firstName}, le saludamos desde OdontoSol S.R.L. clínica odontológica.`
  );
  const waUrl = `https://wa.me/${waNumber}?text=${greeting}`;

  // Check critical medical alerts
  const hasSevereAllergy =
    patient.allergies &&
    patient.allergies.toLowerCase() !== 'ninguna' &&
    patient.allergies.toLowerCase() !== 'ninguna conocida';

  const hasSystemicCondition =
    patient.medicalConditions &&
    patient.medicalConditions.toLowerCase() !== 'ninguna' &&
    patient.medicalConditions.toLowerCase() !== 'ninguna conocida';

  const totalPaid = patientPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-14 w-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-teal-700/20 shrink-0">
                  {patient.firstName.charAt(0)}
                  {patient.lastName.charAt(0)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {patient.firstName} {patient.lastName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      {patient.bloodType || 'O+'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-bold text-slate-700">
                      C.I. {patient.documentNumber}
                    </span>
                    <span>•</span>
                    <span>{age} años ({patient.birthDate})</span>
                    <span>•</span>
                    <span className="capitalize">{patient.gender?.toLowerCase()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(patient)}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Actions Ribbon */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp Oficial ({patient.whatsapp || patient.phone})</span>
              </a>

              <a
                href={`tel:${patient.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
              >
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                <span>Llamar</span>
              </a>
            </div>

            {/* Critical Medical Alert Banner */}
            {(hasSevereAllergy || hasSystemicCondition) && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-900 animate-in fade-in">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Alerta Médica de Seguridad Clínica</div>
                  {hasSevereAllergy && <div>• Alergias: <strong>{patient.allergies}</strong></div>}
                  {hasSystemicCondition && (
                    <div>• Patología de Base: <strong>{patient.medicalConditions}</strong></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sub Navigation */}
          <div className="flex border-b border-slate-200 px-6 gap-4 bg-white text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveSubTab('clinical')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'clinical'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <HeartPulse className="h-4 w-4" />
              <span>Anamnesis & Datos</span>
            </button>

            <button
              onClick={() => setActiveSubTab('evolutions')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'evolutions'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Evolución Médica ({patientEvolutions.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('appointments')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'appointments'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Turnos ({patientAppointments.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('branches')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'branches'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Sucursales ({patientBranches.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('payments')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'payments'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Pagos ({patientPayments.length})</span>
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 flex-1 overflow-y-auto space-y-5">
            {activeSubTab === 'clinical' && (
              <div className="space-y-4">
                {/* Location & Contact Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Ubicación & Contacto en Paraguay
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400">Departamento</div>
                      <div className="font-bold text-slate-800">{patient.department}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Ciudad / Distrito</div>
                      <div className="font-bold text-slate-800">{patient.city}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Barrio</div>
                      <div className="font-bold text-slate-800">{patient.neighborhood || 'Centro'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Dirección Domiciliaria</div>
                      <div className="font-bold text-slate-800 truncate">{patient.address}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-slate-400">Contacto de Emergencia</div>
                      <div className="font-bold text-slate-800">
                        {patient.emergencyContactName || 'No especificado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Teléfono Emergencia</div>
                      <div className="font-bold text-slate-800">
                        {patient.emergencyContactPhone || 'No registrado'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Anamnesis Detail */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Antecedentes Médicos & Farmacológicos
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium">Alergias Conocidas:</span>
                      <div className="font-bold text-rose-900 mt-0.5">{patient.allergies}</div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium">Patologías Sistémicas / Enfermedades:</span>
                      <div className="font-bold text-slate-800 mt-0.5">{patient.medicalConditions}</div>
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 font-medium">Medicamentos de Uso Diario:</span>
                      <div className="font-bold text-slate-800 mt-0.5">{patient.medications}</div>
                    </div>
                  </div>
                </div>

                {/* Clinical Guarantee Notice */}
                <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-2xl text-xs text-teal-800 flex items-start gap-2">
                  <Award className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>
                    Ficha clínica unificada vinculada a la Ley N° 1682/01 de Protección de Datos Médicos.
                    Válida en cualquiera de las sucursales de la red OdontoSol.
                  </span>
                </div>
              </div>
            )}

            {activeSubTab === 'evolutions' && (
              <div className="space-y-4">
                {patientEvolutions.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No registra evoluciones clínicas previas.
                  </div>
                ) : (
                  patientEvolutions.map((ev) => {
                    const branch = snapshot.branches.find((b) => b.id === ev.branchId);
                    const doc = snapshot.users.find((u) => u.id === ev.odontologistId);
                    const dateStr = new Date(ev.createdAt).toLocaleDateString('es-PY', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={ev.id}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                          <div>
                            <span className="font-bold text-slate-900">{dateStr}</span>
                            <div className="text-[11px] text-slate-500">{branch?.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-teal-800">
                              Dr(a). {doc ? `${doc.firstName} ${doc.lastName}` : ((ev as any).historicalDoctorName || 'Tratante')}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              MSPBS: {doc?.professionalLicense || 'N/A'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Diagnóstico:</span>
                          <div className="font-semibold text-slate-800 mt-0.5">{ev.diagnosis}</div>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Tratamiento Realizado:</span>
                          <div className="text-slate-700 mt-0.5">{ev.treatmentPerformed}</div>
                        </div>

                        {ev.prescriptions && (
                          <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                            <span className="font-bold text-teal-900">Receta: </span>
                            <span className="text-slate-700">{ev.prescriptions}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeSubTab === 'appointments' && (
              <div className="space-y-3">
                {patientAppointments.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No registra turnos en el sistema.
                  </div>
                ) : (
                  patientAppointments.map((app) => {
                    const branch = snapshot.branches.find((b) => b.id === app.branchId);
                    const odontologist = snapshot.users.find((u) => u.id === app.odontologistId);

                    return (
                      <div
                        key={app.id}
                        className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">
                            {app.appointmentDate} a las {app.startTime.slice(0, 5)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                            {app.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{branch?.name}</span>
                        </div>

                        <div className="text-xs text-slate-600 flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>Dr. {odontologist ? `${odontologist.firstName} ${odontologist.lastName}` : ((app as any).historicalDoctorName || 'Tratante Asignado')}</span>
                        </div>

                        <div className="text-xs text-slate-700 bg-white p-2 rounded-xl border border-slate-100 mt-1">
                          <strong>Motivo:</strong> {app.reason}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeSubTab === 'branches' && (
              <div className="space-y-3">
                {patientBranches.map((pb) => {
                  const branch = snapshot.branches.find((b) => b.id === pb.branchId);
                  const isPrimary = patient.primaryBranchId === pb.branchId;

                  return (
                    <div
                      key={pb.branchId}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{branch?.name}</span>
                          {isPrimary && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                              Matriz Principal
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {branch?.city} • {branch?.address}
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <div className="text-slate-400 text-[10px]">Primera visita</div>
                        <div className="font-semibold text-slate-800">{pb.firstVisitDate}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeSubTab === 'payments' && (
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-800 font-medium">Total Facturado & Pagado</div>
                    <div className="text-base font-bold text-emerald-950">{formatPYG(totalPaid)}</div>
                  </div>
                  <Receipt className="h-6 w-6 text-emerald-600" />
                </div>

                {patientPayments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No hay recibos o facturas registradas para este paciente.
                  </div>
                ) : (
                  patientPayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{pay.receiptNumber}</div>
                        <div className="text-[11px] text-slate-500">{pay.paymentMethod} • {pay.paymentDate}</div>
                      </div>
                      <div className="font-bold text-emerald-700 font-mono text-sm">
                        {formatPYG(pay.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span className="text-[11px] text-slate-400">ID Ficha: {patient.id.slice(0, 8)}...</span>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cerrar Ficha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
