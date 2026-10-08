import React, { useState, useEffect } from 'react';
import { X, UserCheck, HeartPulse, AlertTriangle, ShieldCheck, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { PARAGUAY_DEPARTMENTS } from '../../db/seeds/paraguay-catalogs.ts';
import { dbStore } from '../../db/inMemoryStore.ts';

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
  const [birthDate, setBirthDate] = useState('1995-05-15');
  const [gender, setGender] = useState('MASCULINO');
  const [bloodType, setBloodType] = useState('O+');
  const [phone, setPhone] = useState('+595 981 ');
  const [whatsapp, setWhatsapp] = useState('+595 981 ');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Central');
  const [city, setCity] = useState('San Lorenzo');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('+595 981 ');
  const [allergies, setAllergies] = useState('Ninguna conocida');
  const [medicalConditions, setMedicalConditions] = useState('Ninguna');
  const [medications, setMedications] = useState('Ninguna');
  const [primaryBranchId, setPrimaryBranchId] = useState('');
  const [modality, setModality] = useState<'PARTICULAR' | 'PLAN_SEGURO'>('PARTICULAR');
  const [insurancePlanId, setInsurancePlanId] = useState('');
  const [insuranceMemberNumber, setInsuranceMemberNumber] = useState('');

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
      setBirthDate(patientToEdit.birthDate || '1995-05-15');
      setGender(patientToEdit.gender || 'MASCULINO');
      setBloodType(patientToEdit.bloodType || 'O+');
      setPhone(patientToEdit.phone || '+595 ');
      setWhatsapp(patientToEdit.whatsapp || patientToEdit.phone || '+595 ');
      setEmail(patientToEdit.email || '');
      setDepartment(patientToEdit.department || 'Central');
      setCity(patientToEdit.city || 'San Lorenzo');
      setNeighborhood(patientToEdit.neighborhood || 'Centro');
      setAddress(patientToEdit.address || '');
      setEmergencyName(patientToEdit.emergencyContactName || '');
      setEmergencyPhone(patientToEdit.emergencyContactPhone || '+595 ');
      setAllergies(patientToEdit.allergies || 'Ninguna conocida');
      setMedicalConditions(patientToEdit.medicalConditions || 'Ninguna');
      setMedications(patientToEdit.medications || 'Ninguna');
      setPrimaryBranchId(patientToEdit.primaryBranchId || branches[0]?.id || '');
      setModality(patientToEdit.modality === 'PLAN_SEGURO' ? 'PLAN_SEGURO' : 'PARTICULAR');
      setInsurancePlanId(patientToEdit.insurancePlanId || (availablePlans[0]?.id || ''));
      setInsuranceMemberNumber(patientToEdit.insuranceMemberNumber || '');
    } else {
      setDocumentType('CI');
      setDocumentNumber('');
      setFirstName('');
      setLastName('');
      setBirthDate('1995-05-15');
      setGender('MASCULINO');
      setBloodType('O+');
      setPhone('+595 981 ');
      setWhatsapp('+595 981 ');
      setEmail('');
      setDepartment('Central');
      setCity('San Lorenzo');
      setNeighborhood('Centro');
      setAddress('');
      setEmergencyName('');
      setEmergencyPhone('+595 981 ');
      setAllergies('Ninguna conocida');
      setMedicalConditions('Ninguna');
      setMedications('Ninguna');
      setPrimaryBranchId(branches[0]?.id || '');
      setModality('PARTICULAR');
      setInsurancePlanId(availablePlans[0]?.id || '');
      setInsuranceMemberNumber('');
    }
  }, [patientToEdit, isOpen]);

  if (!isOpen) return null;

  const currentDeptObj =
    PARAGUAY_DEPARTMENTS.find((d) => d.name === department) || PARAGUAY_DEPARTMENTS[1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentNumber || !firstName || !lastName || !phone) {
      alert('Por favor complete los campos obligatorios (*).');
      return;
    }

    if (patientToEdit) {
      dbStore.updatePatient(patientToEdit.id, {
        documentType,
        documentNumber,
        firstName,
        lastName,
        birthDate,
        gender,
        bloodType,
        phone,
        whatsapp,
        email: email || `${firstName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
        department,
        city,
        neighborhood,
        address,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        allergies,
        medicalConditions,
        medications,
        primaryBranchId,
        modality,
        insurancePlanId: modality === 'PLAN_SEGURO' ? (insurancePlanId || null) : null,
        insuranceMemberNumber: modality === 'PLAN_SEGURO' ? (insuranceMemberNumber.trim() || null) : null,
      });
    } else {
      dbStore.addPatient({
        documentType,
        documentNumber,
        firstName,
        lastName,
        phone,
        primaryBranchId: primaryBranchId || branches[0]?.id,
        department,
        city,
        allergies,
        modality,
        insurancePlanId: modality === 'PLAN_SEGURO' ? (insurancePlanId || null) : null,
        insuranceMemberNumber: modality === 'PLAN_SEGURO' ? (insuranceMemberNumber.trim() || null) : null,
      });
    }

    onClose();
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

          {/* Footer buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 min-h-[44px] flex items-center justify-center cursor-pointer"
            >
              {patientToEdit ? 'Guardar Cambios' : 'Registrar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
