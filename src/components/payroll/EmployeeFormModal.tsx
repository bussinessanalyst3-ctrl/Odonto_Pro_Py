import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Link2 } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import {
  EmployeeRecord,
  PaymentFrequency,
  RemunerationModality,
  StaffArea,
} from '../../db/payrollEngine.ts';
import { DOCUMENT_TYPES } from '../../db/seeds/paraguay-catalogs.ts';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit?: EmployeeRecord | null;
  onSaved?: (emp: EmployeeRecord) => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  employeeToEdit,
  onSaved,
}) => {
  const branches = dbStore.getBranches();
  const users = dbStore.getUsers();
  const existingEmployees = dbStore.getEmployees({ status: 'ALL' });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] = useState('CI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('+595 ');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState<StaffArea>('COMERCIAL');
  const [position, setPosition] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [userId, setUserId] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [remunerationModality, setRemunerationModality] = useState<RemunerationModality>('MIXTO');
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [observations, setObservations] = useState('');
  const [initialSalary, setInitialSalary] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>('MENSUAL');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (employeeToEdit) {
      setFirstName(employeeToEdit.firstName || '');
      setLastName(employeeToEdit.lastName || '');
      setDocumentType(employeeToEdit.documentType || 'CI');
      setDocumentNumber(employeeToEdit.documentNumber || '');
      setPhone(employeeToEdit.phone || '');
      setEmail(employeeToEdit.email || '');
      setArea(employeeToEdit.area || 'OPERATIVA');
      setPosition(employeeToEdit.position || '');
      setBranchId(employeeToEdit.branchId || '');
      setUserId(employeeToEdit.userId || '');
      setHireDate(employeeToEdit.hireDate || new Date().toISOString().split('T')[0]);
      setStatus(employeeToEdit.status || 'ACTIVE');
      setRemunerationModality(employeeToEdit.remunerationModality || 'SALARIO_FIJO');
      setIsAdvisor(Boolean(employeeToEdit.isAdvisor));
      setObservations(employeeToEdit.observations || '');
      setInitialSalary('');
    } else {
      setFirstName('');
      setLastName('');
      setDocumentType('CI');
      setDocumentNumber('');
      setPhone('+595 ');
      setEmail('');
      setArea('COMERCIAL');
      setPosition('');
      setBranchId(branches[0]?.id || '');
      setUserId('');
      setHireDate(new Date().toISOString().split('T')[0]);
      setStatus('ACTIVE');
      setRemunerationModality('MIXTO');
      setIsAdvisor(true);
      setObservations('');
      setInitialSalary('');
      setPaymentFrequency('MENSUAL');
    }
  }, [isOpen, employeeToEdit]);

  if (!isOpen) return null;

  // Usuarios disponibles para vincular (no vincular dos empleados al mismo usuario)
  const linkedUserIds = new Set(
    existingEmployees
      .filter((e: any) => e.userId && (!employeeToEdit || e.id !== employeeToEdit.id))
      .map((e: any) => e.userId)
  );
  const availableUsers = users.filter((u: any) => !linkedUserIds.has(u.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!firstName.trim() || !lastName.trim() || !documentNumber.trim() || !position.trim()) {
      setFormError('Complete nombre, apellido, documento de identidad y cargo.');
      return;
    }

    try {
      let saved: EmployeeRecord;
      if (employeeToEdit) {
        saved = dbStore.updateEmployee(employeeToEdit.id, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          documentType,
          documentNumber: documentNumber.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          area,
          position: position.trim(),
          branchId: branchId || null,
          userId: userId || null,
          hireDate,
          status,
          remunerationModality,
          isAdvisor,
          observations: observations.trim() || null,
        });
      } else {
        const parsedInitialSalary = initialSalary.trim() ? Number(initialSalary) : null;
        if (parsedInitialSalary !== null && (Number.isNaN(parsedInitialSalary) || parsedInitialSalary < 0)) {
          setFormError('El salario base inicial debe ser un monto válido en PYG.');
          return;
        }
        saved = dbStore.createEmployee({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          documentType,
          documentNumber: documentNumber.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          area,
          position: position.trim(),
          branchId: branchId || null,
          userId: userId || null,
          hireDate,
          status,
          remunerationModality,
          isAdvisor,
          observations: observations.trim() || null,
          initialSalary: parsedInitialSalary,
          paymentFrequency,
        });
      }
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar la ficha de personal.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {employeeToEdit ? `Editar Colaborador (${employeeToEdit.employeeCode})` : 'Registrar Nuevo Colaborador'}
              </h3>
              <p className="text-xs text-slate-500">
                Ficha laboral para gestión de salarios, comisiones y cartera sin duplicar cuentas de usuario.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. Sofía"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Benítez Gómez"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Doc.</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.code} value={dt.code}>
                    {dt.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nro. Documento *</label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej. 4521890"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+595 981 000000"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Área Operativa *</label>
              <select
                value={area}
                onChange={(e) => {
                  const nextArea = e.target.value as StaffArea;
                  setArea(nextArea);
                  if (!employeeToEdit && nextArea === 'COMERCIAL') {
                    setIsAdvisor(true);
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500 font-semibold"
              >
                <option value="COMERCIAL">Área Comercial</option>
                <option value="CLINICA">Área Clínica</option>
                <option value="OPERATIVA">Área Operativa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo o Función *</label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ej. Asesora Comercial / Recepción"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clínica / Sucursal</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todas / Corporativo</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Modalidad Remuneración *</label>
              <select
                value={remunerationModality}
                onChange={(e) => setRemunerationModality(e.target.value as RemunerationModality)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="SALARIO_FIJO">Salario Fijo</option>
                <option value="COMISION">Solo Comisiones</option>
                <option value="MIXTO">Mixto (Salario + Comisión)</option>
                <option value="HONORARIOS">Honorarios Profesionales</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Ingreso *</label>
              <input
                type="date"
                required
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@clinica.com.py"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                <Link2 className="h-3.5 w-3.5 text-teal-600" />
                <span>Usuario del Sistema Asociado (Opcional)</span>
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Sin acceso al sistema (Empleado no-usuario)</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.roleId})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Vincula un usuario existente sin crear cuentas duplicadas.
              </p>
            </div>

            <div className="flex flex-col justify-between gap-2">
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdvisor}
                  onChange={(e) => setIsAdvisor(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <div className="text-xs font-bold text-slate-800">Elegible como Asesor de Pacientes</div>
                  <div className="text-[11px] text-slate-500">
                    Aparecerá en el selector &quot;Asesor designado&quot; de las fichas de pacientes.
                  </div>
                </div>
              </label>

              {employeeToEdit && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold text-slate-700">Estado Laboral:</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {!employeeToEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-teal-50/50 border border-teal-200/80 rounded-xl">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Salario Base Inicial (PYG ₲) — Opcional
                </label>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={initialSalary}
                  onChange={(e) => setInitialSalary(e.target.value)}
                  placeholder="Ej. 3500000"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono tabular-nums focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frecuencia de Pago</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => setPaymentFrequency(e.target.value as PaymentFrequency)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="MENSUAL">Mensual</option>
                  <option value="QUINCENAL">Quincenal</option>
                  <option value="SEMANAL">Semanal</option>
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas contractuales, turno, especialidad o condiciones especiales..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer"
            >
              {employeeToEdit ? 'Guardar Cambios' : 'Registrar Colaborador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
