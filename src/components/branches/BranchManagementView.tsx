import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Clock,
  Settings,
  Plus,
  Edit2,
  Power,
  ShieldCheck,
  CheckCircle2,
  Users,
  Armchair,
  MessageCircle,
  FileSpreadsheet,
  Globe2,
  Landmark,
  Save
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { BranchModal } from './BranchModal.tsx';
import { BranchSettingsModal } from './BranchSettingsModal.tsx';
import { useAuth } from '../../auth/authContext.tsx';

export const BranchManagementView: React.FC = () => {
  const { session } = useAuth();
  const [, setTick] = useState(0);

  // Modals state
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<any | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [branchToConfigure, setBranchToConfigure] = useState<any | null>(null);

  // Edit organization state
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgLegalName, setOrgLegalName] = useState('');
  const [orgTaxId, setOrgTaxId] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgAddress, setOrgAddress] = useState('');

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const snapshot = dbStore.getSnapshot();
  const org = snapshot.organization;
  const branches = snapshot.branches;

  useEffect(() => {
    if (org) {
      setOrgLegalName(org.legalName || org.name);
      setOrgTaxId(org.taxId);
      setOrgPhone(org.phone);
      setOrgEmail(org.email);
      setOrgAddress(org.address);
    }
  }, [org]);

  const canCreateBranch = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN_ORGANIZACION';
  const canEditOrg = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN_ORGANIZACION';

  const handleOpenAddBranch = () => {
    if (!canCreateBranch) {
      alert('403 Prohibido: El Administrador de Sucursal no tiene autorización para crear sucursales.');
      return;
    }
    setBranchToEdit(null);
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (branch: any) => {
    setBranchToEdit(branch);
    setIsBranchModalOpen(true);
  };

  const handleOpenSettings = (branch: any) => {
    setBranchToConfigure(branch);
    setIsSettingsModalOpen(true);
  };

  const handleToggleStatus = (branchId: string) => {
    const actor = session ? {
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      allowedBranchIds: session.allowedBranchIds,
    } : undefined;

    try {
      dbStore.toggleBranchStatus(branchId, actor);
    } catch (err: any) {
      alert(err.message || 'Operación de cambio de estado no autorizada.');
    }
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    dbStore.updateOrganization({
      legalName: orgLegalName,
      name: orgLegalName,
      taxId: orgTaxId,
      phone: orgPhone,
      email: orgEmail,
      address: orgAddress,
    });
    setIsEditingOrg(false);
  };

  const activeBranches = branches.filter((b) => b.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  Organización & Red de Sucursales
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Fase 4: Multi-Sucursal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Administración de la clínica central en Paraguay, apertura de sucursales, horarios
                de atención y configuración de sillones dentales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditOrg && (
              <button
                onClick={() => setIsEditingOrg(!isEditingOrg)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                <span>{isEditingOrg ? 'Cancelar Edición' : 'Editar Datos Fiscales'}</span>
              </button>
            )}

            {canCreateBranch && (
              <button
                onClick={handleOpenAddBranch}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Nueva Sucursal</span>
              </button>
            )}
          </div>
        </div>

        {/* Organization Info Form or Summary */}
        {isEditingOrg ? (
          <form onSubmit={handleSaveOrg} className="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Modificar Parámetros de la Organización Central
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Razón Social</label>
                <input
                  type="text"
                  required
                  value={orgLegalName}
                  onChange={(e) => setOrgLegalName(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">RUC Paraguay</label>
                <input
                  type="text"
                  required
                  value={orgTaxId}
                  onChange={(e) => setOrgTaxId(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Central</label>
                <input
                  type="text"
                  required
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Institucional</label>
                <input
                  type="email"
                  required
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Matriz</label>
                <input
                  type="text"
                  required
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingOrg(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Clínica / Razón Social</div>
              <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{org.legalName}</div>
              <div className="text-[11px] font-mono text-teal-700">RUC: {org.taxId}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Sucursales Activas</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {activeBranches.length} de {branches.length} operativas
              </div>
              <div className="text-[11px] text-slate-400">Paraguay (Central & Capital)</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Zona Horaria & Moneda</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">America/Asuncion</div>
              <div className="text-[11px] text-emerald-700 font-semibold">Guaraníes (PYG ₲)</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[11px] font-medium text-slate-500 uppercase">Aislamiento de Datos</div>
              <div className="text-sm font-bold text-teal-800 mt-0.5">Multi-Tenant Activo</div>
              <div className="text-[11px] text-emerald-600 font-medium">Anti-IDOR estricto</div>
            </div>
          </div>
        )}
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map((b) => {
          const settings = dbStore.getBranchSettings(b.id);
          const branchUsers = snapshot.userBranches.filter((ub) => ub.branchId === b.id);
          const branchAppointments = snapshot.appointments.filter((a) => a.branchId === b.id);
          const isCurrentActive = session?.currentBranchId === b.id;
          const canToggleStatus = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN_ORGANIZACION';
          const canManageThisBranch =
            session?.role === 'SUPER_ADMIN' ||
            session?.role === 'ADMIN_ORGANIZACION' ||
            (session?.role === 'ADMIN_SUCURSAL' && (session.allowedBranchIds?.includes(b.id) ?? false));

          return (
            <div
              key={b.id}
              className={`bg-white rounded-3xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                isCurrentActive
                  ? 'border-teal-500 ring-2 ring-teal-500/20'
                  : b.status === 'ACTIVE'
                  ? 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200 bg-slate-50/50 opacity-75'
              }`}
            >
              <div>
                {/* Branch Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                      {b.code}
                    </span>
                    {isCurrentActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                        Sucursal Activa en Sesión
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        b.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-500'
                      }`}
                    ></span>
                    {b.status === 'ACTIVE' ? 'OPERATIVA' : 'INACTIVA'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-tight">{b.name}</h3>

                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  <span>
                    {b.neighborhood ? `${b.neighborhood}, ` : ''}
                    {b.city} ({b.department})
                  </span>
                </div>

                <div className="text-xs text-slate-600 mt-1 pl-4 text-[11px] truncate">
                  {b.address}
                </div>

                {/* Operating details */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Horario</span>
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {b.openingTime} - {b.closingTime}
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>Teléfono</span>
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5 truncate">{b.phone}</div>
                  </div>
                </div>

                {/* Additional metrics */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs">
                  <div className="p-2 rounded-xl bg-teal-50/50 border border-teal-100/60">
                    <div className="text-xs font-bold text-teal-900">{branchUsers.length}</div>
                    <div className="text-[10px] text-teal-700">Personal</div>
                  </div>

                  <div className="p-2 rounded-xl bg-indigo-50/50 border border-indigo-100/60">
                    <div className="text-xs font-bold text-indigo-900">{branchAppointments.length}</div>
                    <div className="text-[10px] text-indigo-700">Turnos</div>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-100/70 border border-slate-200/60">
                    <div className="text-xs font-bold text-slate-800 font-mono">
                      {settings?.receiptSeries || '001-001'}
                    </div>
                    <div className="text-[10px] text-slate-500">Serie Legal</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {canToggleStatus ? (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(b.id)}
                    title={b.status === 'ACTIVE' ? 'Desactivar sucursal' : 'Activar sucursal'}
                    className={`p-2 rounded-xl border transition-colors ${
                      b.status === 'ACTIVE'
                        ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold px-2 py-1 rounded bg-slate-50 border border-slate-100">
                    Solo Org Admin
                  </span>
                )}

                <div className="flex items-center gap-1.5">
                  {canManageThisBranch ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenSettings(b)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <Settings className="h-3.5 w-3.5 text-slate-500" />
                        <span>Sillones & Reglas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditBranch(b)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-xs flex items-center gap-1"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">
                      Sucursal no asignada
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <BranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        branchToEdit={branchToEdit}
      />

      <BranchSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        branch={branchToConfigure}
      />
    </div>
  );
};
