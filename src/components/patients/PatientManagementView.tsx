import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Search,
  AlertTriangle,
  Building2,
  Phone,
  MessageCircle,
  Eye,
  Edit2,
  Power,
  ShieldCheck,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  MapPin,
  Briefcase,
  UserCheck,
  Users
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { UNKNOWN_CREATOR_LABEL } from '../../db/payrollEngine.ts';
import { useBranding } from '../../branding/BrandingContext.tsx';
import { PatientModal } from './PatientModal.tsx';
import { ComprehensivePatientModal } from './ComprehensivePatientModal.tsx';
import { HistoricalImportModal } from '../shared/HistoricalImportModal.tsx';
import { resolveOrganizationLegalName } from '../../config/appBrand.ts';
import { hasBackendSession, putAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { EmptyState, PatientAvatar, StatusLabel } from '../ui/DesignPrimitives.tsx';

interface PatientManagementViewProps {
  onNavigateToTab?: (tab: string, payload?: any) => void;
}

export const PatientManagementView: React.FC<PatientManagementViewProps> = ({
  onNavigateToTab,
}) => {
  const [, setTick] = useState(0);
  const { branding } = useBranding();
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [modalityFilter, setModalityFilter] = useState<'ALL' | 'PARTICULAR' | 'PLAN_SEGURO'>('ALL');
  const [advisorFilter, setAdvisorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoricalImportOpen, setIsHistoricalImportOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<any | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dbStore.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const snapshot = dbStore.getSnapshot();
  const patients = snapshot.patients;
  const branches = snapshot.branches;
  const insurancePlans = snapshot.insurancePlans || [];
  const employees = snapshot.employees || [];
  const advisors = dbStore.getAdvisorEmployees();
  const actor = dbStore.getBackendActorContext();
  const linkedEmployee = actor?.userId ? dbStore.getEmployeeLinkedToUser(actor.userId) : null;

  const handleOpenAdd = () => {
    setPatientToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (patient: any) => {
    setPatientToEdit(patient);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (patientId: string) => {
    setActionError(null);
    const target = patients.find((p) => p.id === patientId);
    if (!target) return;
    const isCurrentlyActive = target.status === 'ACTIVE' || target.status === 'ACTIVO';
    const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    try {
      if (hasBackendSession()) {
        const res = await putAuthoritativeAction<{
          patient?: any;
          auditLogs?: any[];
          stateVersion?: number;
        }>(`/api/patients/${patientId}`, { status: nextStatus });
        dbStore.applyAuthoritativeSync(
          {
            ...(res.patient ? { patients: [res.patient] } : {}),
            ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
          },
          res.stateVersion
        );
      } else {
        dbStore.togglePatientStatus(patientId);
      }
    } catch (err: any) {
      setActionError(err.message || 'No se pudo actualizar el estado del paciente.');
    }
  };

  // Filter logic memorized
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        (p.firstName || '').toLowerCase().includes(term) ||
        (p.lastName || '').toLowerCase().includes(term) ||
        `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase().includes(term) ||
        (p.documentNumber || '').toLowerCase().includes(term) ||
        (p.phone || '').toLowerCase().includes(term) ||
        (p.city || '').toLowerCase().includes(term);

      const matchesBranch = branchFilter === 'ALL' || p.primaryBranchId === branchFilter;

      const isActive = p.status !== 'INACTIVE';
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && isActive) ||
        (statusFilter === 'INACTIVE' && !isActive);

      let matchesAlert = true;
      if (alertFilter === 'ALLERGIES') {
        matchesAlert =
          p.allergies &&
          p.allergies.toLowerCase() !== 'ninguna' &&
          p.allergies.toLowerCase() !== 'ninguna conocida';
      } else if (alertFilter === 'CONDITIONS') {
        matchesAlert =
          p.medicalConditions &&
          p.medicalConditions.toLowerCase() !== 'ninguna' &&
          p.medicalConditions.toLowerCase() !== 'ninguna conocida';
      }

      let matchesModality = true;
      if (modalityFilter === 'PARTICULAR') {
        matchesModality = p.modality === 'PARTICULAR' || !p.modality;
      } else if (modalityFilter === 'PLAN_SEGURO') {
        matchesModality = p.modality === 'PLAN_SEGURO';
      }

      let matchesAdvisor = true;
      if (advisorFilter === 'UNASSIGNED') {
        matchesAdvisor = !p.assignedAdvisorId;
      } else if (advisorFilter === 'MY_PORTFOLIO') {
        matchesAdvisor = Boolean(linkedEmployee && p.assignedAdvisorId === linkedEmployee.id);
      } else if (advisorFilter !== 'ALL') {
        matchesAdvisor = p.assignedAdvisorId === advisorFilter;
      }

      return matchesSearch && matchesBranch && matchesStatus && matchesAlert && matchesModality && matchesAdvisor;
    });
  }, [patients, searchTerm, branchFilter, statusFilter, alertFilter, modalityFilter, advisorFilter, linkedEmployee]);

  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, statusFilter, alertFilter, modalityFilter, advisorFilter]);

  const activePatientsCount = patients.filter((p) => p.status !== 'INACTIVE').length;
  const inactivePatientsCount = patients.length - activePatientsCount;
  const insuredPatientsCount = patients.filter((p) => p.status !== 'INACTIVE' && p.modality === 'PLAN_SEGURO').length;
  const patientsWithAllergies = patients.filter(
    (p) =>
      p.allergies &&
      p.allergies.toLowerCase() !== 'ninguna' &&
      p.allergies.toLowerCase() !== 'ninguna conocida'
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1C1F1E] tracking-tight">
            Pacientes
          </h1>
          <p className="text-xs text-[#6B706D] mt-0.5 tabular-nums">
            {patients.length} fichas registradas · Ley N° 1682/01
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsHistoricalImportOpen(true)}
            className="px-3.5 py-2 text-xs font-medium text-[#1C1F1E] bg-white hover:bg-[#F2F0EB] border border-[#E6E2D9] rounded-lg transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#525755]" />
            <span>Importar CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5C63] hover:bg-[#0B474D] rounded-lg transition-colors flex items-center gap-1.5 min-h-[40px] cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Nuevo paciente</span>
          </button>
        </div>
      </div>

      {/* Continuous KPI strip */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EFECE5]">
        <div className="px-4 py-3.5 sm:px-5">
          <div className="text-[11px] font-medium text-[#6B706D]">Fichas activas</div>
          <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-0.5">
            {activePatientsCount}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5 tabular-nums">
            {inactivePatientsCount > 0 ? `${inactivePatientsCount} inactivo(s)` : 'Todos activos'}
          </div>
        </div>

        <div className="px-4 py-3.5 sm:px-5">
          <div className="text-[11px] font-medium text-[#6B706D]">Con cobertura</div>
          <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-0.5">
            {insuredPatientsCount}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">Plan o seguro activo</div>
        </div>

        <div className="px-4 py-3.5 sm:px-5">
          <div className="text-[11px] font-medium text-[#6B706D]">Alertas de alergias</div>
          <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-0.5">
            {patientsWithAllergies}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">
            {patientsWithAllergies > 0 ? 'Con registro en anamnesis' : 'Sin alertas activas'}
          </div>
        </div>

        <div className="px-4 py-3.5 sm:px-5">
          <div className="text-[11px] font-medium text-[#6B706D]">Particulares</div>
          <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-0.5">
            {Math.max(0, activePatientsCount - insuredPatientsCount)}
          </div>
          <div className="text-[11px] text-[#6B706D] mt-0.5">Tarifa de lista</div>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-medium text-rose-800 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold px-2 py-0.5 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B706D]" />
          <input
            type="text"
            placeholder="Buscar por C.I., nombre, teléfono o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 bg-[#F8F7F4] border border-[#E6E2D9] rounded-md focus:bg-white focus:border-[#0F5C63] focus:outline-none text-[#1C1F1E] min-h-[40px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value as any)}
            className="flex-1 sm:flex-none text-xs bg-white border border-[#E6E2D9] rounded-md px-3 py-2 font-medium text-[#1C1F1E] min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todas las modalidades</option>
            <option value="PARTICULAR">Particular</option>
            <option value="PLAN_SEGURO">Con seguro o plan</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="flex-1 sm:flex-none text-xs bg-white border border-[#E6E2D9] rounded-md px-3 py-2 font-medium text-[#1C1F1E] min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 sm:flex-none text-xs bg-white border border-[#E6E2D9] rounded-md px-3 py-2 font-medium text-[#1C1F1E] min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todos los estados</option>
            <option value="ACTIVE">Solo activos</option>
            <option value="INACTIVE">Solo inactivos</option>
          </select>

          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="flex-1 sm:flex-none text-xs bg-white border border-[#E6E2D9] rounded-md px-3 py-2 font-medium text-[#1C1F1E] min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todas las fichas</option>
            <option value="ALLERGIES">Con alergias</option>
            <option value="CONDITIONS">Con patologías</option>
          </select>

          <select
            value={advisorFilter}
            onChange={(e) => setAdvisorFilter(e.target.value)}
            className="flex-1 sm:flex-none text-xs bg-white border border-[#E6E2D9] rounded-md px-3 py-2 font-medium text-[#1C1F1E] min-h-[40px] cursor-pointer"
          >
            <option value="ALL">Todos los asesores</option>
            {linkedEmployee && (
              <option value="MY_PORTFOLIO">Mi cartera ({linkedEmployee.firstName})</option>
            )}
            <option value="UNASSIGNED">Sin asesor designado</option>
            {advisors.map((adv: any) => (
              <option key={adv.id} value={adv.id}>
                Asesor: {adv.firstName} {adv.lastName}
              </option>
            ))}
          </select>

          {linkedEmployee && (
            <button
              type="button"
              onClick={() =>
                setAdvisorFilter((prev) => (prev === 'MY_PORTFOLIO' ? 'ALL' : 'MY_PORTFOLIO'))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors min-h-[40px] cursor-pointer ${
                advisorFilter === 'MY_PORTFOLIO'
                  ? 'bg-[#0F5C63] text-white border-[#0F5C63]'
                  : 'bg-white text-[#525755] border-[#E6E2D9] hover:bg-[#F2F0EB]'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Mi cartera</span>
            </button>
          )}

          {/* Toggle Tarjetas / Tabla */}
          <div className="inline-flex rounded-md border border-[#E6E2D9] bg-[#F8F7F4] p-0.5 shrink-0 ml-auto sm:ml-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Vista de tarjetas"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-[#0F5C63] border border-[#E6E2D9]'
                  : 'text-[#6B706D] hover:text-[#1C1F1E]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Vista de tabla"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#0F5C63] border border-[#E6E2D9]'
                  : 'text-[#6B706D] hover:text-[#1C1F1E]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patients Display: Empty / Cards / Table */}
      {paginatedPatients.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E6E2D9]">
          <EmptyState
            icon={Users}
            title="Sin pacientes para mostrar"
            description="Ajusta los filtros de búsqueda o registra una nueva ficha de paciente."
            action={
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Nuevo paciente</span>
              </button>
            }
          />
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedPatients.map((p) => {
            const primaryBranch = branches.find((b) => b.id === p.primaryBranchId);
            const hasAlert =
              p.allergies &&
              p.allergies.toLowerCase() !== 'ninguna' &&
              p.allergies.toLowerCase() !== 'ninguna conocida';

            const orgLegalName = resolveOrganizationLegalName({
              legalName: branding.legalName,
              name: snapshot.organization?.name,
            });
            const cleanPhone = (p.whatsapp || p.phone || '').replace(/\D/g, '');
            const waUrl = `https://wa.me/${
              cleanPhone.startsWith('595') ? cleanPhone : '595' + cleanPhone.replace(/^0/, '')
            }?text=${encodeURIComponent(
              orgLegalName
                ? `Hola ${p.firstName}, le saludamos desde ${orgLegalName}.`
                : `Hola ${p.firstName}, le saludamos cordialmente.`
            )}`;

            const isInactive = p.status === 'INACTIVE';

            return (
              <div
                key={p.id}
                className={`bg-white rounded-lg border p-4 sm:p-5 flex flex-col justify-between transition-colors ${
                  isInactive ? 'border-[#E6E2D9] opacity-75 bg-[#F8F7F4]' : 'border-[#E6E2D9] hover:border-[#D4CFC3]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PatientAvatar
                        firstName={p.firstName}
                        lastName={p.lastName}
                        seed={p.id}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-[#1C1F1E] text-sm truncate">
                            {p.firstName} {p.lastName}
                          </h3>
                          {isInactive && (
                            <StatusLabel tone="neutral" label="Inactivo" />
                          )}
                        </div>
                        <div className="text-xs text-[#6B706D] tabular-nums">
                          C.I. {p.documentNumber}
                        </div>
                      </div>
                    </div>
                    {p.bloodType && (
                      <span className="text-[11px] font-semibold text-[#991B1B] bg-[#FEF2F2] border border-[#F5C2C2] px-1.5 py-0.5 rounded shrink-0">
                        {p.bloodType}
                      </span>
                    )}
                  </div>

                  {/* Modalidad Comercial */}
                  <div className="mb-2.5 text-xs">
                    {p.modality === 'PLAN_SEGURO' ? (
                      <div className="inline-flex items-center gap-1.5 text-[#0F5C63] font-medium max-w-full">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{insurancePlans.find((ip) => ip.id === p.insurancePlanId)?.name || 'Seguro Dental'}</span>
                        {p.insuranceMemberNumber && (
                          <span className="text-[11px] text-[#6B706D] tabular-nums shrink-0">
                            · Nº {p.insuranceMemberNumber}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#6B706D]">Particular</span>
                    )}
                  </div>

                  {hasAlert && (
                    <div className="mb-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#FEF2F2] border border-[#F5C2C2] text-[#991B1B] text-xs font-medium">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#B91C1C]" />
                      <span className="truncate">{p.allergies}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-[#525755] mt-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate">{p.city} ({p.department})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate">{primaryBranch?.name || 'Sede Central'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-[#6B706D] shrink-0" />
                      <span className="truncate tabular-nums">{p.phone}</span>
                    </div>
                    {(() => {
                      const assignedAdvisor = p.assignedAdvisorId
                        ? employees.find((e: any) => e.id === p.assignedAdvisorId)
                        : null;
                      const creatorUser = p.createdByUserId
                        ? (snapshot.users || []).find((u: any) => u.id === p.createdByUserId)
                        : null;
                      const creatorLabel =
                        p.createdByNameSnapshot ||
                        (creatorUser ? `${creatorUser.firstName} ${creatorUser.lastName}` : UNKNOWN_CREATOR_LABEL);
                      return (
                        <div className="pt-2 mt-2 border-t border-[#EFECE5] space-y-1 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#6B706D] flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              Asesor
                            </span>
                            <span className={`font-medium truncate ${assignedAdvisor ? 'text-[#1C1F1E]' : 'text-[#6B706D]'}`}>
                              {assignedAdvisor ? `${assignedAdvisor.firstName} ${assignedAdvisor.lastName}` : 'No asignado'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#6B706D] flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              Creado por
                            </span>
                            <span className="text-[#525755] truncate">{creatorLabel}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#EFECE5] flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#3F6212] bg-[#F4F8EA] hover:bg-[#E7F0D3] border border-[#D7E6B5] rounded-md transition-colors min-h-[42px] sm:min-h-[44px]"
                  >
                    <MessageCircle className="h-4 w-4 text-[#4D7C0F]" />
                    <span>WhatsApp</span>
                  </a>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedPatientId(p.id)}
                      className="px-3 py-2 rounded-md bg-[#ECF5F5] hover:bg-[#D5EAEA] text-[#0F5C63] border border-[#B9D9DC] text-xs font-semibold transition-colors flex items-center justify-center gap-1 min-h-[42px] sm:min-h-[44px] cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="p-2.5 rounded-md border border-[#E6E2D9] text-[#525755] hover:bg-[#F2F0EB] transition-colors min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center cursor-pointer"
                      title="Editar Ficha"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(p.id)}
                      className={`p-2.5 rounded-md border transition-colors min-h-[42px] min-w-[42px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center cursor-pointer ${
                        p.status !== 'INACTIVE'
                          ? 'border-[#E6E2D9] text-[#6B706D] hover:text-[#B91C1C] hover:bg-[#FEF2F2]'
                          : 'border-[#D7E6B5] text-[#3F6212] hover:bg-[#F4F8EA]'
                      }`}
                      title={p.status !== 'INACTIVE' ? 'Desactivar paciente' : 'Activar paciente'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Patients Table */
        <div className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#525755]">
              <thead className="bg-[#F2F0EB] text-[#525755] font-semibold border-b border-[#E6E2D9] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Paciente</th>
                  <th className="px-4 py-3">Modalidad</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Asesor</th>
                  <th className="px-4 py-3">Alertas clínicas</th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE5]">
                {paginatedPatients.map((p) => {
                  const primaryBranch = branches.find((b) => b.id === p.primaryBranchId);
                  const assignedPlan = insurancePlans.find((ip) => ip.id === p.insurancePlanId);

                  const hasAlert =
                    p.allergies &&
                    p.allergies.toLowerCase() !== 'ninguna' &&
                    p.allergies.toLowerCase() !== 'ninguna conocida';

                  const orgLegalName = resolveOrganizationLegalName({
                    legalName: branding.legalName,
                    name: snapshot.organization?.name,
                  });
                  const cleanPhone = (p.whatsapp || p.phone || '').replace(/\D/g, '');
                  const waUrl = `https://wa.me/${
                    cleanPhone.startsWith('595') ? cleanPhone : '595' + cleanPhone.replace(/^0/, '')
                  }?text=${encodeURIComponent(
                    orgLegalName
                      ? `Hola ${p.firstName}, le saludamos desde ${orgLegalName}.`
                      : `Hola ${p.firstName}, le saludamos cordialmente.`
                  )}`;

                  return (
                    <tr key={p.id} className={`hover:bg-[#F8F7F4] transition-colors ${p.status === 'INACTIVE' ? 'opacity-70 bg-[#F8F7F4]' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <PatientAvatar
                            firstName={p.firstName}
                            lastName={p.lastName}
                            seed={p.id}
                            size="sm"
                          />
                          <div>
                            <div className="font-semibold text-[#1C1F1E] flex items-center gap-1.5 flex-wrap">
                              <span>
                                {p.firstName} {p.lastName}
                              </span>
                              {p.status === 'INACTIVE' && (
                                <StatusLabel tone="neutral" label="Inactivo" />
                              )}
                              {p.bloodType && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FEF2F2] text-[#991B1B] border border-[#F5C2C2]">
                                  {p.bloodType}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#6B706D] tabular-nums">
                              C.I. {p.documentNumber}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {p.modality === 'PLAN_SEGURO' ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1 text-[#0F5C63] font-medium max-w-[170px] truncate">
                              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{assignedPlan?.name || 'Plan de seguro'}</span>
                            </div>
                            {p.insuranceMemberNumber && (
                              <div className="text-[11px] text-[#6B706D] tabular-nums">
                                Nº {p.insuranceMemberNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#6B706D]">Particular</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-[#1C1F1E] font-medium">{p.city}</div>
                        <div className="text-[11px] text-[#6B706D] truncate max-w-[140px]">
                          {p.department}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <div className="text-[#1C1F1E] tabular-nums text-xs">{p.phone}</div>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3F6212] hover:underline"
                          >
                            <MessageCircle className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {(() => {
                          const assignedAdvisor = p.assignedAdvisorId
                            ? employees.find((e: any) => e.id === p.assignedAdvisorId)
                            : null;
                          const creatorUser = p.createdByUserId
                            ? (snapshot.users || []).find((u: any) => u.id === p.createdByUserId)
                            : null;
                          const creatorLabel =
                            p.createdByNameSnapshot ||
                            (creatorUser ? `${creatorUser.firstName} ${creatorUser.lastName}` : UNKNOWN_CREATOR_LABEL);
                          return (
                            <div className="space-y-0.5 text-[11px]">
                              <div className={`font-medium ${assignedAdvisor ? 'text-[#1C1F1E]' : 'text-[#6B706D]'}`}>
                                {assignedAdvisor ? `${assignedAdvisor.firstName} ${assignedAdvisor.lastName}` : 'Sin asesor'}
                              </div>
                              <div className="text-[10px] text-[#6B706D] truncate max-w-[160px]" title={`Creado por: ${creatorLabel}`}>
                                Reg: {creatorLabel}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3">
                        {hasAlert ? (
                          <span className="inline-flex items-center gap-1 text-[#991B1B] font-medium max-w-[190px] truncate">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#B91C1C]" />
                            <span className="truncate">{p.allergies}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#6B706D]">Sin alergias</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-xs text-[#525755]">
                          {primaryBranch?.name.replace('Sucursal ', '')}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPatientId(p.id)}
                            className="px-2.5 py-1.5 rounded-md bg-[#ECF5F5] hover:bg-[#D5EAEA] text-[#0F5C63] border border-[#B9D9DC] text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Ver ficha</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-md border border-[#E6E2D9] text-[#525755] hover:bg-[#F2F0EB] transition-colors cursor-pointer"
                            title="Editar Ficha"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p.id)}
                            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                              p.status !== 'INACTIVE'
                                ? 'border-[#E6E2D9] text-[#6B706D] hover:text-[#B91C1C] hover:bg-[#FEF2F2]'
                                : 'border-[#D7E6B5] text-[#3F6212] hover:bg-[#F4F8EA]'
                            }`}
                            title={p.status !== 'INACTIVE' ? 'Desactivar paciente' : 'Activar paciente'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginación Compartida */}
      {filteredPatients.length > pageSize && (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shadow-xs">
          <div>
            Mostrando <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> a{' '}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredPatients.length)}
            </span>{' '}
            de <span className="font-bold text-slate-900">{filteredPatients.length}</span> pacientes
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-semibold text-slate-800">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Página Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <PatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientToEdit={patientToEdit}
      />

      {/* Comprehensive Patient Unified File Modal */}
      <ComprehensivePatientModal
        patientId={selectedPatientId}
        isOpen={!!selectedPatientId}
        onClose={() => setSelectedPatientId(null)}
        onEdit={(p) => {
          setSelectedPatientId(null);
          handleOpenEdit(p);
        }}
        onNavigateToTab={onNavigateToTab}
      />

      <HistoricalImportModal
        isOpen={isHistoricalImportOpen}
        onClose={() => setIsHistoricalImportOpen(false)}
        defaultEntity="patients"
      />
    </div>
  );
};
