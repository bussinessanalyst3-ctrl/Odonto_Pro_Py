import React, { useState, useEffect } from 'react';
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
import { resolveOrganizationLegalName } from '../../config/appBrand.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasModuleAccess } from '../../security/moduleCatalog.ts';

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
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'odontogram' | 'treatments' | 'quotes' | 'appointments' | 'financial'>('summary');
  const [, setTick] = useState(0);

  const roleObj = dbStore.getRoles().find((r) => r.id === session?.role);
  const canOdontogram = hasModuleAccess(session, 'odontogram', roleObj);
  const canTreatments = hasModuleAccess(session, 'treatments', roleObj);
  const canQuotes = hasModuleAccess(session, 'quotes', roleObj);
  const canAgenda = hasModuleAccess(session, 'agenda', roleObj);
  const canCash = hasModuleAccess(session, 'cash', roleObj);

  useEffect(() => {
    setActiveTab('summary');
  }, [patientId, isOpen]);

  useEffect(() => {
    if (
      (activeTab === 'odontogram' && !canOdontogram) ||
      (activeTab === 'treatments' && !canTreatments) ||
      (activeTab === 'quotes' && !canQuotes) ||
      (activeTab === 'appointments' && !canAgenda) ||
      (activeTab === 'financial' && !canCash)
    ) {
      setActiveTab('summary');
    }
  }, [activeTab, canOdontogram, canTreatments, canQuotes, canAgenda, canCash]);

  useEffect(() => {
    if (!isOpen) return;
    return dbStore.subscribe(() => setTick((t) => t + 1));
  }, [isOpen]);

  if (!isOpen || !patientId) return null;

  const snapshot = dbStore.getSnapshot();
  const patient = snapshot.patients.find((p) => p.id === patientId);

  if (!patient) return null;

  const insurancePlans = snapshot.insurancePlans || [];
  const assignedPlan = insurancePlans.find((ip) => ip.id === patient.insurancePlanId);
  const assignedAdvisor = patient.assignedAdvisorId
    ? (snapshot.employees || []).find((e: any) => e.id === patient.assignedAdvisorId)
    : null;
  const creatorDisplay = patient.createdByNameSnapshot || 'Origen histórico / Desconocido';

  // Relaciones integradas ordenadas cronológicamente
  const patientAppointments = snapshot.appointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => `${b.appointmentDate || ''} ${b.startTime || ''}`.localeCompare(`${a.appointmentDate || ''} ${a.startTime || ''}`));
  const activeUpcomingAppointments = patientAppointments.filter(
    (a) => a.status !== 'CANCELADA' && a.status !== 'NO_ASISTIO' && a.status !== 'FINALIZADA'
  );
  const nextAppointment = activeUpcomingAppointments[activeUpcomingAppointments.length - 1] || patientAppointments[0] || null;
  const patientTreatments = (snapshot.treatments || []).filter((t) => t.patientId === patientId);
  const patientQuotes = (snapshot.quotes || []).filter((q) => q.patientId === patientId);
  const patientPayments = (snapshot.payments || [])
    .filter((p) => p.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const patientOdontograms = (snapshot.odontograms || [])
    .filter((o) => o.patientId === patientId)
    .sort((a, b) => (b.version || 1) - (a.version || 1));
  const activeOdontogram = patientOdontograms[0];
  const odontogramItems = activeOdontogram
    ? (snapshot.odontogramItems || []).filter((oi) => oi.odontogramId === activeOdontogram.id)
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

  // Cálculo de finanzas reales del paciente (tratamientos activos y cobros no anulados)
  const activeTreatments = patientTreatments.filter((t) => t.status !== 'CANCELADO');
  const activePayments = patientPayments.filter((p) => p.status !== 'ANULADO');
  const totalBilledPyg = activeTreatments.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
  const totalPaidPyg = activePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const pendingBalancePyg = activeTreatments.reduce(
    (acc, t) => acc + Math.max(0, Number(t.balanceDue ?? (Number(t.totalAmount || 0) - Number(t.paidAmount || 0)))),
    0
  );

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
  const orgLegalName = resolveOrganizationLegalName(snapshot.organization);
  const cleanPhone = (patient.whatsapp || patient.phone || '').replace(/\D/g, '');
  const waNumber = cleanPhone.startsWith('595') ? cleanPhone : `595${cleanPhone.replace(/^0/, '')}`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    orgLegalName
      ? `Hola ${patient.firstName}, le saludamos de ${orgLegalName}.`
      : `Hola ${patient.firstName}, le saludamos cordialmente.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 md:p-6">
      <div className="bg-white rounded-2xl md:rounded-3xl w-full max-w-5xl h-[92dvh] md:h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera Superior de la Ficha */}
        <div className="p-3.5 md:p-6 border-b border-slate-100 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="h-11 w-11 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-base md:text-2xl shadow-md shadow-teal-700/20 shrink-0">
              {patient.firstName.charAt(0)}
              {patient.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                <h2 className="text-base md:text-xl font-bold text-slate-900">
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
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 md:gap-3 text-xs text-slate-500 mt-1">
                <span>{patient.city}, {patient.department}</span>
                <span>•</span>
                <span>Tel: {patient.phone}</span>
                <span>•</span>
                <span className="break-all">{patient.email || 'Sin correo registrado'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 mt-1.5">
                <span>
                  Asesor designado:{' '}
                  <strong className="text-slate-900">
                    {assignedAdvisor ? `${assignedAdvisor.firstName} ${assignedAdvisor.lastName}` : 'Sin asignar'}
                  </strong>
                </span>
                <span>
                  Usuario de creación:{' '}
                  <strong className="text-slate-700">{creatorDisplay}</strong>
                </span>
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
          <div className="px-3.5 md:px-6 py-2 md:py-2.5 bg-rose-50 border-b border-rose-200/80 flex items-center gap-2.5 md:gap-3 text-xs text-rose-900">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
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

        {/* Barra de Pestañas Unificadas (filtrada por módulos habilitados) */}
        <div className="flex border-b border-slate-200 px-3.5 md:px-6 gap-3 md:gap-6 bg-white overflow-x-auto text-xs font-bold text-slate-600 scrollbar-none">
          {[
            { id: 'summary', label: 'Resumen Clínico', icon: HeartPulse, allowed: true },
            { id: 'odontogram', label: `Odontograma FDI (${odontogramItems.length})`, icon: Stethoscope, allowed: canOdontogram },
            { id: 'treatments', label: `Tratamientos (${patientTreatments.length})`, icon: Building2, allowed: canTreatments },
            { id: 'quotes', label: `Presupuestos (${patientQuotes.length})`, icon: Calculator, allowed: canQuotes },
            { id: 'appointments', label: `Citas & Turnos (${patientAppointments.length})`, icon: Calendar, allowed: canAgenda },
            { id: 'financial', label: 'Caja & Pagos', icon: DollarSign, allowed: canCash },
          ]
            .filter((tab) => tab.allowed)
            .map((tab) => {
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
        <div className="flex-1 overflow-y-auto p-3.5 md:p-6 bg-slate-50/50">
          {activeTab === 'summary' && (
            <div className="space-y-4 md:space-y-6">
              {/* Resumen Financiero Rápido (visible solo si tiene Presupuestos o Caja) */}
              {(canQuotes || canCash) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                  {canQuotes && (
                    <div className="p-3.5 md:p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Presupuestado</span>
                      <div className="text-base md:text-xl font-black text-slate-900 mt-1">
                        {formatPYG(totalBilledPyg)}
                      </div>
                      <span className="text-xs text-slate-500">{patientQuotes.length} presupuestos emitidos</span>
                    </div>
                  )}

                  {canCash && (
                    <div className="p-3.5 md:p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Abonado / Cobrado</span>
                      <div className="text-base md:text-xl font-black text-emerald-700 mt-1">
                        {formatPYG(totalPaidPyg)}
                      </div>
                      <span className="text-xs text-emerald-600 font-semibold">{patientPayments.length} pagos registrados</span>
                    </div>
                  )}

                  {canCash && (
                    <div className="p-3.5 md:p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Saldo Pendiente</span>
                      <div className={`text-base md:text-xl font-black mt-1 ${pendingBalancePyg > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                        {formatPYG(pendingBalancePyg)}
                      </div>
                      <span className="text-xs text-slate-500">
                        {pendingBalancePyg > 0 ? 'Cobro pendiente en caja' : 'Al día / Sin saldo deudor'}
                      </span>
                    </div>
                  )}
                </div>
              )}

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
                    {canAgenda && (
                      <div className="p-3 bg-teal-50/70 border border-teal-200/60 rounded-xl">
                        <span className="text-teal-900 font-bold block">Próximo Turno:</span>
                        {nextAppointment ? (
                          <div className="mt-1">
                            <span className="font-extrabold text-teal-950">
                              {nextAppointment.appointmentDate || 'Sin fecha'} a las {String(nextAppointment.startTime || '').slice(0, 5)} hs
                            </span>
                            <p className="text-[11px] text-teal-800 mt-0.5">
                              Motivo: {nextAppointment.reason || 'Consulta odontológica'} ({nextAppointment.status})
                            </p>
                          </div>
                        ) : (
                          <span className="text-teal-700">Sin turnos pendientes agendados</span>
                        )}
                      </div>
                    )}
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

          {activeTab === 'odontogram' && canOdontogram && (
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
                {onNavigateToTab && canOdontogram && (
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

          {activeTab === 'treatments' && canTreatments && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Planes de Tratamiento Activos
                </h3>
                {onNavigateToTab && canTreatments && (
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

          {activeTab === 'quotes' && canQuotes && (
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
                          Válido hasta: {q.validUntil || 'N/A'}
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

          {activeTab === 'appointments' && canAgenda && (
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
                          {a.appointmentDate || 'Sin fecha'} a las {String(a.startTime || '').slice(0, 5)} hs
                        </span>
                        <p className="text-xs text-slate-500">{a.reason || 'Consulta odontológica'}</p>
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

          {activeTab === 'financial' && canCash && (
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
                  {patientPayments.map((p) => {
                    const isAnnulled = p.status === 'ANULADO';
                    const formattedPayDate = p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString('es-PY', {
                          timeZone: 'America/Asuncion',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : 'Sin fecha';
                    return (
                      <div
                        key={p.id}
                        className={`p-3 bg-white rounded-2xl border shadow-2xs flex items-center justify-between text-xs ${
                          isAnnulled ? 'border-rose-200 bg-rose-50/40 opacity-75' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">
                              Recibo {p.receiptNumber}
                            </span>
                            {isAnnulled && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                                ANULADO
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formattedPayDate} • {p.paymentMethod}
                          </div>
                        </div>
                        <span className={`font-black ${isAnnulled ? 'text-rose-500 line-through' : 'text-emerald-700'}`}>
                          {formatPYG(p.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
