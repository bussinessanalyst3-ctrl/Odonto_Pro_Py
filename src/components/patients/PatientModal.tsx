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
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {patientToEdit ? 'Editar Ficha Médica Única' : 'Ficha Médica Única: Nuevo Paciente'}
              </h3>
              <p className="text-xs text-slate-500">
                Registro clínico odontológico unificado para Paraguay (Ley 1682/01)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Identification */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Documento</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                <option value="CI">C.I. (Cédula de Identidad)</option>
                <option value="RUC">RUC con Dígito</option>
                <option value="PASAPORTE">Pasaporte Extranjero</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Número de Documento *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. 4.382.910"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
              <input
                type="text"
                required
                placeholder="Ej. Gustavo Adolfo"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
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
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha Nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Género</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
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
                className="w-full text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-500"
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
          <div className="grid grid-cols-2 gap-3">
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
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Notificaciones</label>
              <input
                type="text"
                placeholder="+595 981 123456"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  const d = PARAGUAY_DEPARTMENTS.find((dept) => dept.name === e.target.value);
                  if (d && d.cities.length > 0) setCity(d.cities[0]);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
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
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              >
                {currentDeptObj.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Barrio</label>
              <input
                type="text"
                placeholder="Ej. Sajonia, Villa Morra, etc."
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de Domicilio</label>
              <input
                type="text"
                placeholder="Ej. Avda. Carlos A. López 1240"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
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
                  className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-semibold text-rose-950 focus:ring-2 focus:ring-rose-500"
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
                  className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500"
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
                className="w-full text-xs bg-white border border-rose-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-rose-500"
              />
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
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:ring-2 focus:ring-teal-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
            >
              {patientToEdit ? 'Guardar Cambios' : 'Registrar Paciente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
