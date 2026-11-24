import React, { useState, useEffect } from 'react';
import { X, UserCheck, HeartPulse, AlertTriangle, ShieldCheck, Briefcase, Lock } from 'lucide-react';
import { PARAGUAY_DEPARTMENTS } from '../../db/seeds/paraguay-catalogs.ts';
import { dbStore } from '../../db/inMemoryStore.ts';
import { hasPermission } from '../../security/rbacHierarchy.ts';
import { UNKNOWN_CREATOR_LABEL } from '../../db/payrollEngine.ts';
import {
  hasBackendSession,
  postAuthoritativeAction,
  putAuthoritativeAction,
} from '../../services/authoritativeApi.ts';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientToEdit?: any | null;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  patientToEdit,
}) => {
  const snapshot = dbStore.getSnapshot();
  const branches = snapshot.branches;

  const [documentType, setDocumentType] = useState('CI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('NO_ESPECIFICA');
  const [bloodType, setBloodType] = useState('');
  const [phone, setPhone] = useState('+595 981 ');
  const [whatsapp, setWhatsapp] = useState('+595 981 ');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Central');
  const [city, setCity] = useState('San Lorenzo');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [allergies, setAllergies] = useState('Ninguna conocida');
  const [medicalConditions, setMedicalConditions] = useState('Ninguna');
  const [medications, setMedications] = useState('Ninguna');
  const [primaryBranchId, setPrimaryBranchId] = useState('');
  const [modality, setModality] = useState<'PARTICULAR' | 'PLAN_SEGURO'>('PARTICULAR');
  const [insurancePlanId, setInsurancePlanId] = useState('');
  const [insuranceMemberNumber, setInsuranceMemberNumber] = useState('');
  const [assignedAdvisorId, setAssignedAdvisorId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const actor = dbStore.getBackendActorContext();
  const canAssignAdvisor = !actor || hasPermission(actor, 'patients.assign_advisor');
  const currentActorUser = actor?.userId ? dbStore.findUserById(actor.userId) : snapshot.users?.[0];
  const currentActorDisplay = currentActorUser
    ? `${currentActorUser.firstName || ''} ${currentActorUser.lastName || ''}`.trim() || currentActorUser.email
    : 'Usuario en sesión';

  const activeAdvisors = dbStore.getAdvisorEmployees();
  const allEmployees = dbStore.getEmployees({ status: 'ALL' });
  const assignedHistoricalEmp =
    patientToEdit?.assignedAdvisorId && !activeAdvisors.some((a) => a.id === patientToEdit.assignedAdvisorId)
      ? allEmployees.find((e) => e.id === patientToEdit.assignedAdvisorId)
      : null;

  const allInsurancePlans = dbStore.getInsurancePlans(true);
  const availablePlans = allInsurancePlans.filter(
    (p) => p.status === 'ACTIVE' || p.id === patientToEdit?.insurancePlanId
  );

  useEffect(() => {
    if (patientToEdit) {
      setDocumentType(patientToEdit.documentType || 'CI');
      setDocumentNumber(patientToEdit.documentNumber || '');
      setFirstName(patientToEdit.firstName || '');
      setLastName(patientToEdit.lastName || '');
      setBirthDate(patientToEdit.birthDate || '');
      setGender(patientToEdit.gender || 'NO_ESPECIFICA');
      setBloodType(patientToEdit.bloodType || '');
      setPhone(patientToEdit.phone || '+595 ');
      setWhatsapp(patientToEdit.whatsapp || patientToEdit.phone || '+595 ');
      setEmail(patientToEdit.email || '');
      setDepartment(patientToEdit.department || 'Central');
      setCity(patientToEdit.city || 'San Lorenzo');
      setNeighborhood(patientToEdit.neighborhood || '');
      setAddress(patientToEdit.address || '');
      setEmergencyName(patientToEdit.emergencyContactName || '');
      setEmergencyPhone(patientToEdit.emergencyContactPhone || '');
      setAllergies(patientToEdit.allergies || 'Ninguna conocida');
      setMedicalConditions(patientToEdit.medicalConditions || 'Ninguna');
      setMedications(patientToEdit.medications || 'Ninguna');
      setPrimaryBranchId(patientToEdit.primaryBranchId || branches[0]?.id || '');
      setModality(patientToEdit.modality === 'PLAN_SEGURO' ? 'PLAN_SEGURO' : 'PARTICULAR');
      setInsurancePlanId(patientToEdit.insurancePlanId || (availablePlans[0]?.id || ''));
      setInsuranceMemberNumber(patientToEdit.insuranceMemberNumber || '');
      setAssignedAdvisorId(patientToEdit.assignedAdvisorId || '');
      setFormError(null);
      setIsSaving(false);
    } else {
      setDocumentType('CI');
      setDocumentNumber('');
      setFirstName('');
      setLastName('');
      setBirthDate('');
      setGender('NO_ESPECIFICA');
      setBloodType('');
      setPhone('+595 981 ');
      setWhatsapp('+595 981 ');
      setEmail('');
      setDepartment('Central');
      setCity('San Lorenzo');
      setNeighborhood('');
      setAddress('');
      setEmergencyName('');
      setEmergencyPhone('');
      setAllergies('Ninguna conocida');
      setMedicalConditions('Ninguna');
      setMedications('Ninguna');
      setPrimaryBranchId(branches[0]?.id || '');
      setModality('PARTICULAR');
      setInsurancePlanId(availablePlans[0]?.id || '');
      setInsuranceMemberNumber('');
      setAssignedAdvisorId('');
      setFormError(null);
      setIsSaving(false);
    }
  }, [patientToEdit, isOpen]);

  if (!isOpen) return null;

  const currentDeptObj =
    PARAGUAY_DEPARTMENTS.find((d) => d.name === department) || PARAGUAY_DEPARTMENTS[1];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    if (!documentNumber.trim() || !firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError('Por favor complete todos los campos obligatorios (*).');
      return;
    }

    const basePayload: any = {
      documentType,
      documentNumber: documentNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate.trim() || null,
      gender: gender || 'NO_ESPECIFICA',
      bloodType: bloodType.trim() || null,
      phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(),
      email: email.trim() || null,
      department,
      city,
      neighborhood: neighborhood.trim() || null,
      address: address.trim() || null,
      emergencyContactName: emergencyName.trim() || null,
      emergencyContactPhone: emergencyPhone.trim() || null,
      allergies: allergies.trim() || 'Ninguna conocida',
      medicalConditions: medicalConditions.trim() || 'Ninguna',
      medications: medications.trim() || 'Ninguna',
      primaryBranchId: primaryBranchId || branches[0]?.id,
      modality,
      insurancePlanId: modality === 'PLAN_SEGURO' ? (insurancePlanId || null) : null,
      insuranceMemberNumber: modality === 'PLAN_SEGURO' ? (insuranceMemberNumber.trim() || null) : null,
    };
    if (canAssignAdvisor) {
      basePayload.assignedAdvisorId = assignedAdvisorId || null;
    }

    setIsSaving(true);
    try {
      if (patientToEdit) {
        if (hasBackendSession()) {
          const res = await putAuthoritativeAction<{
            patient?: any;
            auditLogs?: any[];
            stateVersion?: number;
          }>(`/api/patients/${patientToEdit.id}`, basePayload);
          dbStore.applyAuthoritativeSync(
            {
              ...(res.patient ? { patients: [res.patient] } : {}),
              ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
            },
            res.stateVersion
          );
        } else {
          dbStore.updatePatient(patientToEdit.id, basePayload, actor?.userId);
        }
      } else {
        if (hasBackendSession()) {
          const res = await postAuthoritativeAction<{
            patient?: any;
            patientBranch?: any;
            auditLogs?: any[];
            stateVersion?: number;
          }>('/api/patients', basePayload);
          dbStore.applyAuthoritativeSync(
            {
              ...(res.patient ? { patients: [res.patient] } : {}),
              ...(res.patientBranch ? { patientBranches: [res.patientBranch] } : {}),
              ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
            },
            res.stateVersion
          );
        } else {
          dbStore.addPatient({
            ...basePayload,
            assignedAdvisorId: canAssignAdvisor ? (assignedAdvisorId || null) : null,
            actorUserId: actor?.userId || null,
          });
        }
      }

      onClose();
    } catch (err: any) {
      setFormError(err.message || 'No se pudo guardar la ficha del paciente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {patientToEdit ? 'Editar Ficha Médica Única' : 'Ficha Médica Única: Nuevo Paciente'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Registro clínico odontológico unificado para Paraguay (Ley 1682/01)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Documento</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              >
                <option value="CI">C.I. (Cédula de Identidad)</option>
                <option value="RUC">RUC con Dígito</option>
                <option value="PASAPORTE">Pasaporte Extranjero</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 4.382.910"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
              <input
                type="text"
                required
                placeholder="Ej. Gustavo Adolfo"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
              <input
                type="text"
                required
                placeholder="Ej. Caballero Paredes"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Género</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              >
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
                <option value="OTRO">Otro / No especifica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Grupo Sanguíneo</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-500 min-h-[42px]"
              >
                <option value="O+">O+ (Frecuente PY)</option>
                <option value="O-">O- (Donante universal)</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono Móvil (+595) *
              </label>
              <input
                type="text"
                required
                placeholder="+595 981 123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Notificaciones</label>
              <input
                type="text"
                placeholder="+595 981 123456"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  const d = PARAGUAY_DEPARTMENTS.find((dept) => dept.name === e.target.value);
                  if (d && d.cities.length > 0) setCity(d.cities[0]);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              >
                {PARAGUAY_DEPARTMENTS.map((d) => (
                  <option key={d.code} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ciudad / Distrito</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              >
                {currentDeptObj.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barrio</label>
              <input
                type="text"
                placeholder="Ej. Sajonia, Villa Morra, etc."
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de Domicilio</label>
              <input
                type="text"
                placeholder="Ej. Avda. Carlos A. López 1240"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
              />
            </div>
          </div>

          {/* Anamnesis / Medical Alerts (Crucial for Odontology) */}
          <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-1.5 text-rose-900 text-xs font-bold">
              <HeartPulse className="h-4 w-4 text-rose-600 shrink-0" />
              <span>Anamnesis Odontológica & Alertas Médicas Críticas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-rose-950 mb-1">
                  Alergias Conocidas (Penicilina, Látex, Anestésicos...)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Penicilina (reacción severa), Látex..."
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-semibold text-rose-950 focus:ring-2 focus:ring-rose-500 min-h-[42px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-rose-950 mb-1">
                  Condiciones / Patologías de Base (Diabetes, HTA...)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Hipertensión arterial, Diabetes Tipo 2..."
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 min-h-[42px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-950 mb-1">
                Medicamentos de Uso Habitual
              </label>
              <input
                type="text"
                placeholder="Ej. Losartán 50mg, Metformina 850mg, Aspirina..."
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500 min-h-[42px]"
              />
            </div>
          </div>

          {/* Modalidad Comercial y Cobertura */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>Modalidad Comercial & Cobertura Odontológica</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                Determina el tarifario del paciente
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  modality === 'PARTICULAR'
                    ? 'border-teal-600 bg-teal-50/70 ring-1 ring-teal-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="patientModality"
                  value="PARTICULAR"
                  checked={modality === 'PARTICULAR'}
                  onChange={() => setModality('PARTICULAR')}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">Particular / Financiación Directa</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Tarifario oficial de lista. Pagos directos o cuotas sin cobertura de seguro.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  modality === 'PLAN_SEGURO'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="patientModality"
                  value="PLAN_SEGURO"
                  checked={modality === 'PLAN_SEGURO'}
                  onChange={() => setModality('PLAN_SEGURO')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-indigo-950 flex items-center gap-1">
                    <span>Plan / Seguro Dental</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800">Convenio</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Precios preferenciales o cobertura según póliza/seguro mensual.
                  </div>
                </div>
              </label>
            </div>

            {modality === 'PLAN_SEGURO' && (
              <div className="p-3.5 bg-white border border-indigo-100 rounded-xl space-y-3 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Plan Odontológico Asociado *
                    </label>
                    <select
                      value={insurancePlanId}
                      onChange={(e) => setInsurancePlanId(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                      required={modality === 'PLAN_SEGURO'}
                    >
                      {availablePlans.length === 0 ? (
                        <option value="">No hay planes activos configurados</option>
                      ) : (
                        availablePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} {plan.status === 'INACTIVE' ? '(Inactivo)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nº de Afiliado / Carnet / Póliza
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. SEG-2026-9812 / 845210"
                      value={insuranceMemberNumber}
                      onChange={(e) => setInsuranceMemberNumber(e.target.value)}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 min-h-[42px]"
                    />
                  </div>
                </div>

                {/* Resumen del plan seleccionado */}
                {(() => {
                  const selectedPlan = availablePlans.find((p) => p.id === insurancePlanId);
                  if (!selectedPlan) return null;
                  return (
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">{selectedPlan.name} ({selectedPlan.code})</div>
                        <div className="text-[11px] text-indigo-800 mt-0.5">{selectedPlan.description}</div>
                        {selectedPlan.coverageTerms && (
                          <div className="text-[10px] text-indigo-600 font-mono mt-0.5">
                            Condición: {selectedPlan.coverageTerms}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Trazabilidad Comercial & Origen de Registro */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Briefcase className="h-4 w-4 text-teal-600" />
                <span>Trazabilidad Comercial & Origen del Registro</span>
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Campos independientes entre sí
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Asesor Designado (Comercial)
                </label>
                <select
                  value={assignedAdvisorId}
                  onChange={(e) => setAssignedAdvisorId(e.target.value)}
                  disabled={!canAssignAdvisor}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px] disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">Sin asesor designado</option>
                  {activeAdvisors.map((adv) => (
                    <option key={adv.id} value={adv.id}>
                      {adv.firstName} {adv.lastName} — {adv.position}
                    </option>
                  ))}
                  {assignedHistoricalEmp && (
                    <option value={assignedHistoricalEmp.id}>
                      {assignedHistoricalEmp.firstName} {assignedHistoricalEmp.lastName} (Inactivo)
                    </option>
                  )}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {canAssignAdvisor
                    ? 'Determina la cartera y comisiones comerciales futuras sin alterar liquidaciones previas.'
                    : 'Solo lectura: su rol no posee permiso para reasignar asesores.'}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                  <Lock className="h-3 w-3 text-slate-400" />
                  <span>Usuario de Creación (Inmutable)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={
                    patientToEdit
                      ? (patientToEdit.createdByNameSnapshot || UNKNOWN_CREATOR_LABEL)
                      : `${currentActorDisplay} (Automático al guardar)`
                  }
                  className="w-full text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 font-medium text-slate-600 cursor-not-allowed min-h-[42px]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Se captura automáticamente en el alta y no puede modificarse ni copiarse como asesor.
                </p>
              </div>
            </div>
          </div>

          {/* Primary branch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sucursal Base / Principal
            </label>
            <select
              value={primaryBranchId}
              onChange={(e) => setPrimaryBranchId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500 min-h-[42px]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800">
              {formError}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 min-h-[44px] flex items-center justify-center cursor-pointer disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : patientToEdit ? 'Guardar Cambios' : 'Registrar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
