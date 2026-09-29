import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Shield,
  Award,
  Building2,
  Phone,
  Mail,
  Check,
  AlertCircle,
  KeyRound,
  Sparkles,
  Lock,
  AtSign,
  Building,
  Eye,
  EyeOff,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { dbStore, BackendActorContext } from '../../db/inMemoryStore.ts';
import { hashPassword } from '../../auth/cryptoUtils.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { canManageRole, isSuperAdminRole } from '../../security/rbacHierarchy.ts';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: any | null;
  actor?: BackendActorContext;
  onOpenPermissions?: (user: any) => void;
  onOpenResetPassword?: (user: any) => void;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  userToEdit,
  actor,
  onOpenPermissions,
  onOpenResetPassword,
}) => {
  const { session } = useAuth();
  const effectiveActor = actor || (session ? {
    userId: session.userId,
    role: session.role,
    organizationId: session.organizationId,
    allowedBranchIds: session.allowedBranchIds,
  } : undefined);

  const isSuperAdmin = effectiveActor?.role === 'SUPER_ADMIN';
  const allOrganizations = dbStore.getOrganizations();
  const snapshot = dbStore.getSnapshot(effectiveActor);

  // Estados del Formulario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [roleId, setRoleId] = useState('ODONTOLOGO');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [phone, setPhone] = useState('+595 981 ');
  const [specialty, setSpecialty] = useState('Odontología General');
  const [license, setLicense] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sucursales pertenecientes a la empresa seleccionada
  const activeOrgBranches = dbStore.getBranches(effectiveActor).filter((b) => {
    if (!selectedOrgId) return true;
    return b.organizationId === selectedOrgId;
  });

  const allRoles = dbStore.getRoles();
  const isEditingSelf = !!userToEdit && effectiveActor?.userId === userToEdit.id;
  const isRoleSelectDisabled = isEditingSelf && !isSuperAdmin;

  const availableRoles = allRoles.filter((r) => {
    if (!effectiveActor || effectiveActor.role === 'SUPER_ADMIN') {
      return true;
    }
    if (isSuperAdminRole(r.id)) {
      return false;
    }
    return canManageRole(effectiveActor.role, r.id);
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);
    for (let i = 0; i < 10; i++) {
      pwd += chars[array[i] % chars.length];
    }
    pwd += '2026!';
    return pwd;
  };

  const generateSuggestedUsername = (first: string, last: string) => {
    const cleanFirst = first.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const cleanLast = last.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanFirst && cleanLast) {
      return `${cleanFirst}.${cleanLast}`;
    }
    if (cleanFirst) return cleanFirst;
    return '';
  };

  useEffect(() => {
    setErrorMsg(null);
    if (userToEdit) {
      setFirstName(userToEdit.firstName || '');
      setLastName(userToEdit.lastName || '');
      setEmail(userToEdit.email || '');
      setUsername(userToEdit.username || userToEdit.email?.split('@')[0] || '');
      setSelectedOrgId(userToEdit.organizationId || allOrganizations[0]?.id || '');
      setRoleId(userToEdit.roleId || 'ODONTOLOGO');
      setStatus(userToEdit.status || 'ACTIVE');
      setPhone(userToEdit.phone || '+595 ');
      setSpecialty(userToEdit.specialty || 'Odontología General');
      setLicense(userToEdit.professionalLicense || '');

      const userBranchRecords = snapshot.userBranches.filter((ub) => ub.userId === userToEdit.id);
      const bIds = userBranchRecords.map((ub) => ub.branchId);
      const availableIds = activeOrgBranches.map(b => b.id);
      const validBIds = bIds.filter(id => availableIds.length === 0 || availableIds.includes(id));
      setSelectedBranches(validBIds.length > 0 ? validBIds : [activeOrgBranches[0]?.id || '']);
      const def = userBranchRecords.find((ub) => ub.isDefault)?.branchId || validBIds[0] || activeOrgBranches[0]?.id;
      setDefaultBranchId(def || '');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setUsername('');
      const defaultOrg = isSuperAdmin ? (allOrganizations[0]?.id || '') : (effectiveActor?.organizationId || '');
      setSelectedOrgId(defaultOrg);
      const defaultRole = availableRoles.some((r) => r.id === 'ODONTOLOGO')
        ? 'ODONTOLOGO'
        : (availableRoles[0]?.id || 'ODONTOLOGO');
      setRoleId(defaultRole);
      setStatus('ACTIVE');
      setPhone('+595 981 ');
      setSpecialty('Odontología General');
      setLicense('');
      setInitialPassword(generateRandomPassword());
      const orgBranches = dbStore.getBranches(effectiveActor).filter(b => !defaultOrg || b.organizationId === defaultOrg);
      setSelectedBranches(orgBranches.slice(0, 1).map((b) => b.id));
      setDefaultBranchId(orgBranches[0]?.id || '');
    }
  }, [userToEdit, isOpen]);

  // Cuando cambia la organización seleccionada al crear/editar, sincronizar sucursales
  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    const orgBranches = dbStore.getBranches(effectiveActor).filter(b => b.organizationId === newOrgId);
    if (orgBranches.length > 0) {
      setSelectedBranches([orgBranches[0].id]);
      setDefaultBranchId(orgBranches[0].id);
    } else {
      setSelectedBranches([]);
      setDefaultBranchId('');
    }
  };

  if (!isOpen) return null;

  const isOdonto = roleId === 'ODONTOLOGO';

  const handleToggleBranch = (bId: string) => {
    if (selectedBranches.includes(bId)) {
      if (selectedBranches.length === 1) {
        setErrorMsg('El usuario debe estar asignado como mínimo a una sucursal.');
        return;
      }
      const updated = selectedBranches.filter((id) => id !== bId);
      setSelectedBranches(updated);
      if (defaultBranchId === bId) {
        setDefaultBranchId(updated[0]);
      }
    } else {
      setSelectedBranches([...selectedBranches, bId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent, openPermissionsAfter = false) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username.trim() || cleanEmail.split('@')[0]).toLowerCase().replace(/[^a-z0-9._-]/g, '');

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !phone.trim()) {
      setErrorMsg('Por favor complete los campos obligatorios (*).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Por favor ingrese un formato de correo electrónico válido (ejemplo: usuario@clinica.com.py).');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg('El nombre de usuario debe tener como mínimo 3 caracteres alfanuméricos.');
      return;
    }

    const usernameRegex = /^[a-z0-9._-]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setErrorMsg('El nombre de usuario solo puede contener letras minúsculas, números, puntos (.), guiones (-) o guiones bajos (_).');
      return;
    }

    if (isOdonto && !license.trim()) {
      setErrorMsg('Para profesionales odontólogos es obligatorio ingresar el Registro Profesional del MSPBS.');
      return;
    }

    if (selectedBranches.length === 0) {
      setErrorMsg('Debe asignar al menos una sucursal habilitada para este usuario.');
      return;
    }

    setIsSubmitting(true);
    try {
      let savedUser: any = null;

      if (userToEdit) {
        savedUser = dbStore.updateUser(
          userToEdit.id,
          {
            firstName: cleanFirstName,
            lastName: cleanLastName,
            email: cleanEmail,
            username: cleanUsername,
            organizationId: isSuperAdmin && selectedOrgId ? selectedOrgId : userToEdit.organizationId,
            roleId: isRoleSelectDisabled ? userToEdit.roleId : roleId,
            status,
            phone: phone.trim(),
            specialty: specialty.trim(),
            professionalLicense: isOdonto ? license.trim() : null,
            branchIds: selectedBranches,
            defaultBranchId,
          },
          effectiveActor
        );
      } else {
        if (!initialPassword || initialPassword.length < 8) {
          setErrorMsg('La contraseña inicial debe tener como mínimo 8 caracteres para cumplir con las políticas de seguridad institucional.');
          setIsSubmitting(false);
          return;
        }

        savedUser = dbStore.addUser(
          {
            firstName: cleanFirstName,
            lastName: cleanLastName,
            email: cleanEmail,
            username: cleanUsername,
            organizationId: isSuperAdmin && selectedOrgId ? selectedOrgId : effectiveActor?.organizationId,
            roleId,
            status,
            phone: phone.trim(),
            specialty: specialty.trim(),
            professionalLicense: isOdonto ? license.trim() : undefined,
            branchIds: selectedBranches,
            defaultBranchId,
          },
          effectiveActor
        );

        // Derivar y almacenar hash PBKDF2 (100,000 iteraciones + Salt)
        if (savedUser && initialPassword) {
          const hashRec = await hashPassword(initialPassword);
          dbStore.setUserPasswordHash(savedUser.id, {
            hash: hashRec.hash,
            salt: hashRec.salt,
            iterations: hashRec.iterations,
          });
        }
      }

      onClose();

      if (openPermissionsAfter && savedUser && onOpenPermissions) {
        setTimeout(() => onOpenPermissions(savedUser), 100);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el usuario en el sistema.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {userToEdit ? `Editar Usuario: ${userToEdit.firstName} ${userToEdit.lastName}` : 'Nuevo Usuario del Sistema'}
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {userToEdit ? `@${userToEdit.username || userToEdit.email?.split('@')[0]} • Control RBAC & MSPBS` : 'Alta de funcionario, asignación de empresa, sucursales y rol'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-xl p-2 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Bloque 1: Datos Personales (Nombres y Apellidos) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombres *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Valeria María"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (!userToEdit && !username) {
                    setUsername(generateSuggestedUsername(e.target.value, lastName));
                  }
                }}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Apellidos *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Gómez Benítez"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (!userToEdit && !username) {
                    setUsername(generateSuggestedUsername(firstName, e.target.value));
                  }
                }}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Bloque 2: Correo y Nombre de Usuario (Login dual) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Correo Institucional *</span>
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="usuario@clinica.com.py"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!userToEdit && !username) {
                      setUsername(e.target.value.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                    }
                  }}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Nombre de Usuario *</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase">Para login rápido</span>
              </label>
              <div className="relative">
                <AtSign className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="valeria.gomez"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 font-medium text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Permite al funcionario ingresar escribiendo <span className="font-semibold text-slate-600">@{username || 'usuario'}</span> o su correo.
              </p>
            </div>
          </div>

          {/* Bloque 3: Teléfono y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Teléfono / WhatsApp (+595) *
              </label>
              <div className="relative">
                <Phone className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="+595 981 123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Estado de Acceso *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('ACTIVE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  <span>Activo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('INACTIVE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    status === 'INACTIVE'
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <span>Inactivo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bloque 4: Asignación de Empresa (Multi-Tenant para Super Admin) */}
          {isSuperAdmin && (
            <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-teal-600" />
                <span>Empresa / Organización Asignada *</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => handleOrgChange(e.target.value)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
              >
                {allOrganizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} (RUC: {o.taxId})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                El usuario tendrá acceso restringido a los pacientes y datos de esta entidad médica.
              </p>
            </div>
          )}

          {/* Bloque 5: Rol y Especialidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rol en el Sistema *
              </label>
              {isRoleSelectDisabled ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs sm:text-sm bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-800">
                    <span>{allRoles.find((r) => r.id === (userToEdit?.roleId || roleId))?.name || roleId}</span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Fijo
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium">
                    Su rol está protegido para prevenir auto-elevación de privilegios.
                  </p>
                </div>
              ) : (
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none cursor-pointer"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isSystem ? '(Sistema)' : '(Personalizado)'}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Especialidad / Cargo Clínico
              </label>
              <input
                type="text"
                placeholder="Ej. Ortodoncia, Cirugía, Recepción..."
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Licencia Sanitaria MSPBS (Obligatorio para Odontólogos) */}
          {isOdonto && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-amber-900 text-xs font-bold">
                <Award className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Habilitación Sanitaria MSPBS (Paraguay) *</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                El MSPBS exige registrar el número de registro profesional para la firma de odontogramas, evolución y recetas.
              </p>
              <div>
                <input
                  type="text"
                  required={isOdonto}
                  placeholder="Ej. MSPBS N° 14.821 / Reg. Odontológico"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full text-xs sm:text-sm font-mono font-bold bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Bloque 6: Contraseña */}
          {!userToEdit ? (
            <div className="p-3.5 bg-teal-50/60 border border-teal-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-teal-600" />
                  Contraseña Inicial de Acceso *
                </label>
                <button
                  type="button"
                  onClick={() => setInitialPassword(generateRandomPassword())}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-100 hover:bg-teal-200 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Generar Segura
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Contraseña segura temporal..."
                  className="w-full text-xs sm:text-sm font-mono bg-white border border-teal-300 rounded-xl pl-3.5 pr-10 py-2.5 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-teal-800">
                La contraseña se cifra inmediatamente con <strong>PBKDF2 (100,000 iteraciones + Salt criptográfico)</strong>. La clave en plano nunca se almacena.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Contraseña de Acceso</div>
                  <div className="text-[11px] text-slate-500">Cifrada con PBKDF2. No es visible por seguridad médica.</div>
                </div>
              </div>
              {onOpenResetPassword && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenResetPassword(userToEdit);
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  Restablecer Contraseña
                </button>
              )}
            </div>
          )}

          {/* Bloque 7: Sucursales Habilitadas */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-teal-600" />
                <span>Sucursales Autorizadas ({selectedBranches.length}) *</span>
              </label>
              <span className="text-[10px] text-slate-400">Marque la sucursal principal</span>
            </div>

            {activeOrgBranches.length === 0 ? (
              <p className="text-xs text-amber-700 p-3 bg-amber-50 rounded-xl border border-amber-200">
                No hay sucursales registradas para esta empresa. Por favor cree una sucursal primero.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeOrgBranches.map((b) => {
                  const isChecked = selectedBranches.includes(b.id);
                  const isDefault = defaultBranchId === b.id;

                  return (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        isChecked
                          ? 'bg-teal-50/70 border-teal-300 text-teal-950 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70'
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleBranch(b.id)}
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 shrink-0"
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold truncate">{b.name}</div>
                          <div className="text-[10px] text-slate-500">{b.city} ({b.code})</div>
                        </div>
                      </label>

                      {isChecked && (
                        <button
                          type="button"
                          onClick={() => setDefaultBranchId(b.id)}
                          title="Marcar como sucursal principal de inicio de sesión"
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all shrink-0 ${
                            isDefault
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-white border border-teal-300 text-teal-800 hover:bg-teal-100'
                          }`}
                        >
                          {isDefault ? '★ Principal' : 'Predeterminar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Footer sticky con botones adaptados a móvil/desktop */}
        <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div>
            {userToEdit && onOpenPermissions && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPermissions(userToEdit);
                }}
                className="w-full sm:w-auto text-xs font-bold text-teal-800 hover:text-teal-950 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 min-h-[44px] rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5 text-teal-700" />
                <span>Gobernanza de Permisos & MSPBS</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {!userToEdit && onOpenPermissions && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
                className="hidden sm:inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 rounded-xl transition-colors cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Guardar y Configurar Permisos</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-6 py-2.5 min-h-[44px] text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Guardando...' : userToEdit ? 'Guardar Cambios' : 'Crear Usuario'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
