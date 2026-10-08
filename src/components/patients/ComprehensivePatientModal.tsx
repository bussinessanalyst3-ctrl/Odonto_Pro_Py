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
  Sparkles,
  Stethoscope,
  Calculator,
  ArrowRight,
  TrendingUp,
  Tag,
  DollarSign,
  ShieldCheck
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { ToothSVG, ToothData } from '../odontogram/ToothSVG.tsx';

interface ComprehensivePatientModalProps {
  patientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (patient: any) => void;
  onNavigateToTab?: (tab: string, payload?: any) => void;
}

export const ComprehensivePatientModal: React.FC<ComprehensivePatientModalProps> = ({
  patientId,
  isOpen,
  onClose,
  onEdit,
  onNavigateToTab,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'odontogram' | 'treatments' | 'quotes' | 'appointments' | 'financial'>('summary');

  if (!isOpen || !patientId) return null;

  const snapshot = dbStore.getSnapshot();
  const patient = snapshot.patients.find((p) => p.id === patientId);

  if (!patient) return null;

  const insurancePlans = snapshot.insurancePlans || [];
  const assignedPlan = insurancePlans.find((ip) => ip.id === patient.insurancePlanId);

  // Relaciones integradas
  const patientAppointments = snapshot.appointments.filter((a) => a.patientId === patientId);
  const patientTreatments = (snapshot.treatments || []).filter((t) => t.patientId === patientId);
  const patientQuotes = (snapshot.quotes || []).filter((q) => q.patientId === patientId);
  const patientPayments = (snapshot.payments || []).filter((p) => p.patientId === patientId);
  const patientOdontograms = (snapshot.odontograms || []).filter((o) => o.patientId === patientId);
  const activeOdontogram = patientOdontograms[0];
  const odontogramItems = activeOdontogram
    ? snapshot.odontogramItems.filter((oi) => oi.odontogramId === activeOdontogram.id)
    : [];

  // Mapeo anatómico de piezas para previsualización
  const teethDataMap: Record<number, ToothData> = {};
  odontogramItems.forEach((item) => {
    if (!teethDataMap[item.toothNumber]) {
      teethDataMap[item.toothNumber] = {
        toothNumber: item.toothNumber,
        surfaces: {},
      };
    }
    teethDataMap[item.toothNumber].surfaces[item.surface as keyof ToothData['surfaces']] = {
      condition: item.condition,
      material: item.material,
      colorCode: item.colorCode || '#EF4444',
      notes: item.notes,
    };
  });

  // Cálculo de finanzas del paciente
  const totalBilledPyg = patientQuotes.reduce((acc, q) => acc + (q.finalAmount || 0), 0);
  const totalPaidPyg = patientPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const pendingBalancePyg = Math.max(0, totalBilledPyg - totalPaidPyg);

  // Alertas críticas
  const hasSevereAllergy =
    patient.allergies &&
    patient.allergies.toLowerCase() !== 'ninguna' &&
    patient.allergies.toLowerCase() !== 'ninguna conocida';

  const hasSystemicCondition =
    patient.medicalConditions &&
    patient.medicalConditions.toLowerCase() !== 'ninguna' &&
    patient.medicalConditions.toLowerCase() !== 'ninguna conocida';

  // WhatsApp link
  const cleanPhone = (patient.whatsapp || patient.phone || '').replace(/\D/g, '');
  const waNumber = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Hola ${patient.firstName}, le saludamos de OdontoPro Dental Suite.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera Superior de la Ficha */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-teal-700/20 shrink-0">
              {patient.firstName.charAt(0)}
              {patient.lastName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  C.I. {patient.documentNumber}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  Grupo Sanguíneo: {patient.bloodType || 'O+'}
                </span>
                {patient.modality === 'PLAN_SEGURO' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{assignedPlan?.name || 'Seguro Dental'}</span>
                    {patient.insuranceMemberNumber && (
                      <span className="text-[11px] font-mono text-indigo-700 font-normal">
                        • Nº {patient.insuranceMemberNumber}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    Particular
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span>{patient.city}, {patient.department}</span>
                <span>•</span>
                <span>Tel: {patient.phone}</span>
                <span>•</span>
                <span>{patient.email || 'Sin correo registrado'}</span>
              </div>
            </div>
          </div>

          {/* Acciones Rápidas del Paciente */}
          <div className="flex items-center gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={() => onEdit(patient)}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Editar Ficha
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Alerta Médica Destacada si existe */}
        {(hasSevereAllergy || hasSystemicCondition) && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200/80 flex items-center gap-3 text-xs text-rose-900">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold uppercase tracking-wider">Alerta Médica Activa:</span>
              {hasSevereAllergy && (
                <span>Alergias: <strong>{patient.allergies}</strong></span>
              )}
              {hasSystemicCondition && (
                <span>Enfermedad de Base: <strong>{patient.medicalConditions}</strong></span>
              )}
            </div>
          </div>
        )}

        {/* Barra de Pestañas Unificadas */}
        <div className="flex border-b border-slate-200 px-6 gap-2 sm:gap-6 bg-white overflow-x-auto text-xs font-bold text-slate-600 scrollbar-none">
          {[
            { id: 'summary', label: 'Resumen Clínico', icon: HeartPulse },
            { id: 'odontogram', label: `Odontograma FDI (${odontogramItems.length})`, icon: Stethoscope },
            { id: 'treatments', label: `Tratamientos (${patientTreatments.length})`, icon: Building2 },
            { id: 'quotes', label: `Presupuestos (${patientQuotes.length})`, icon: Calculator },
            { id: 'appointments', label: `Citas & Turnos (${patientAppointments.length})`, icon: Calendar },
            { id: 'financial', label: 'Caja & Pagos', icon: DollarSign },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'border-teal-600 text-teal-700 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido Dinámico de la Pestaña */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Resumen Financiero Rápido */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Presupuestado</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {formatPYG(totalBilledPyg)}
                  </div>
                  <span className="text-xs text-slate-500">{patientQuotes.length} presupuestos emitidos</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Abonado / Cobrado</span>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {formatPYG(totalPaidPyg)}
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold">{patientPayments.length} pagos registrados</span>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Saldo Pendiente</span>
                  <div className={`text-xl font-black mt-1 ${pendingBalancePyg > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                    {formatPYG(pendingBalancePyg)}
                  </div>
                  <span className="text-xs text-slate-500">
                    {pendingBalancePyg > 0 ? 'Cobro pendiente en caja' : 'Al día / Sin saldo deudor'}
                  </span>
                </div>
              </div>

              {/* Modalidad Comercial y Cobertura */}
              <div className={`p-5 rounded-2xl border ${
                patient.modality === 'PLAN_SEGURO'
                  ? 'bg-indigo-50/50 border-indigo-200'
                  : 'bg-white border-slate-200/80 shadow-2xs'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`h-5 w-5 ${patient.modality === 'PLAN_SEGURO' ? 'text-indigo-600' : 'text-teal-600'}`} />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Modalidad Comercial & Cobertura Odontológica
                    </h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${
                    patient.modality === 'PLAN_SEGURO'
                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {patient.modality === 'PLAN_SEGURO' ? 'Plan / Seguro Mensual Activo' : 'Atención Particular / Precio de Lista'}
                  </span>
                </div>

                {patient.modality === 'PLAN_SEGURO' && assignedPlan ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-indigo-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Plan Asignado</span>
                      <span className="font-bold text-indigo-950 text-sm block mt-0.5">{assignedPlan.name}</span>
                      <span className="text-[11px] text-slate-500 block font-mono mt-0.5">Código: {assignedPlan.code}</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-indigo-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Credencial / Carnet</span>
                      <span className="font-mono font-bold text-slate-800 text-sm block mt-0.5">
                        {patient.insuranceMemberNumber || 'Sin número registrado'}
                      </span>
                      <span className="text-[11px] text-emerald-600 block font-semibold mt-0.5">Estado: Activo</span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-indigo-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Condiciones y Cobertura</span>
                      <span className="text-slate-800 text-[11px] line-clamp-2 block mt-0.5">{assignedPlan.description}</span>
                      {assignedPlan.coverageTerms && (
                        <span className="text-[10px] text-indigo-700 font-mono block mt-1">
                          {assignedPlan.coverageTerms}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    El paciente está registrado bajo modalidad <strong>Particular</strong>. Las atenciones, tratamientos y presupuestos se liquidan con el precio institucional de lista de la clínica sin bonificaciones de seguro.
                  </div>
                )}
              </div>

              {/* Anamnesis y Antecedentes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Antecedentes Médicos y Farmacológicos
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-500 font-semibold block">Alergias Declaradas:</span>
                      <span className="font-bold text-rose-800">{patient.allergies || 'Ninguna'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-500 font-semibold block">Patologías de Base:</span>
                      <span className="font-bold text-slate-800">{patient.medicalConditions || 'Ninguna'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-500 font-semibold block">Medicamentos Habituales:</span>
                      <span className="font-bold text-slate-800">{patient.medications || 'Ninguno'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Próxima Cita y Contacto Familiar
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-teal-50/70 border border-teal-200/60 rounded-xl">
                      <span className="text-teal-900 font-bold block">Próximo Turno:</span>
                      {patientAppointments.length > 0 ? (
                        <div className="mt-1">
                          <span className="font-extrabold text-teal-950">
                            {patientAppointments[0].date} a las {patientAppointments[0].time}
                          </span>
                          <p className="text-[11px] text-teal-800 mt-0.5">
                            Motivo: {patientAppointments[0].reason}
                          </p>
                        </div>
                      ) : (
                        <span className="text-teal-700">Sin turnos pendientes agendados</span>
                      )}
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <span className="text-slate-500 font-semibold block">Contacto de Emergencia:</span>
                      <span className="font-bold text-slate-800">
                        {patient.emergencyContactName || 'No declarado'} ({patient.emergencyContactPhone || 'S/N'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'odontogram' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Odontograma Digital del Paciente
                  </h3>
                  <p className="text-xs text-slate-500">
                    {odontogramItems.length} hallazgos registrados según la nomenclatura internacional FDI.
                  </p>
                </div>
                {onNavigateToTab && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToTab('odontogram', { patientId });
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <span>Abrir en Visor Completo</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Lista de Hallazgos Dentales */}
              {odontogramItems.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400 font-medium">
                    No se han registrado hallazgos en el odontograma de este paciente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {odontogramItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-800 font-black text-sm flex items-center justify-center border border-teal-200">
                          {item.toothNumber}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            Superficie: {item.surface}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {item.condition}
                          </div>
                        </div>
                      </div>
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white shadow-xs"
                        style={{ backgroundColor: item.colorCode || '#EF4444' }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'treatments' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Planes de Tratamiento Activos
                </h3>
                {onNavigateToTab && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToTab('treatments', { patientId });
                    }}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <span>Ir a Tratamientos</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>

              {patientTreatments.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">Sin tratamientos registrados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientTreatments.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{t.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'COMPLETADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status}
                          </span>
                          {t.appliedModality === 'PLAN_SEGURO' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 inline-flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-indigo-600" />
                              <span>{t.appliedPlanName || 'Plan Seguro'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              Particular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Piezas: {t.toothNumbers?.join(', ') || 'General'} • Inicio: {t.startDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-teal-800">
                          {formatPYG(t.totalAmount)}
                        </div>
                        {t.originalListPrice && t.originalListPrice > t.totalAmount ? (
                          <span className="text-[10px] text-emerald-700 font-semibold block">
                            Lista: <span className="line-through text-slate-400">{formatPYG(t.originalListPrice)}</span> • Seguro
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Tarifa Aplicada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Historial de Presupuestos
                </h3>
              </div>

              {patientQuotes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">Sin presupuestos emitidos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientQuotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Presupuesto {q.quoteNumber}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                            {q.status}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5 block">
                          Emitido: {q.validUntil}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900">
                          {formatPYG(q.finalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Historial de Turnos</h3>
              {patientAppointments.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">Sin citas agendadas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {patientAppointments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-900">
                          {a.date} a las {a.time} hs
                        </span>
                        <p className="text-xs text-slate-500">{a.reason}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-teal-950 uppercase">
                    Estado de Cuenta General
                  </span>
                  <p className="text-xs text-teal-800 mt-0.5">
                    Saldo total a cobrar en caja: <strong>{formatPYG(pendingBalancePyg)}</strong>
                  </p>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Recibos de Pago Emitidos ({patientPayments.length})
              </h4>
              {patientPayments.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">No se han registrado pagos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {patientPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">
                          Recibo {p.receiptNumber}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {p.date} • {p.paymentMethod}
                        </div>
                      </div>
                      <span className="font-black text-emerald-700">
                        {formatPYG(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
