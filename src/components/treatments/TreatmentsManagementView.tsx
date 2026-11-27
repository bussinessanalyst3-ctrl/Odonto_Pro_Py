import React, { useState, useMemo, useEffect } from 'react';
import {
  Stethoscope,
  Plus,
  Search,
  Filter,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  BookOpen,
  DollarSign,
  TrendingUp,
  Tag,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Edit2,
  Shield,
  ShieldCheck,
  Landmark,
  FileSpreadsheet
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG, validatePygPrice } from '../../db/seeds/paraguay-catalogs.ts';
import { CreateTreatmentModal } from './CreateTreatmentModal.tsx';
import { RecordTreatmentPaymentModal } from './RecordTreatmentPaymentModal.tsx';
import { CreateServiceModal } from './CreateServiceModal.tsx';
import { InsurancePlansTab } from './InsurancePlansTab.tsx';
import { InsuranceClaimsTab } from './InsuranceClaimsTab.tsx';
import { HistoricalImportModal } from '../shared/HistoricalImportModal.tsx';
import { useAuth } from '../../auth/authContext.tsx';
import { hasBackendSession, patchAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { formatProfessionalName } from '../../utils/healthProfessional.ts';
import { EmptyState, StatusLabel, UnderlineTabs } from '../ui/DesignPrimitives.tsx';

interface TreatmentsManagementViewProps {
  initialPatientId?: string;
  initialToothNumber?: number;
}

export const TreatmentsManagementView: React.FC<TreatmentsManagementViewProps> = ({
  initialPatientId,
  initialToothNumber,
}) => {
  const { session } = useAuth();
  const [storeTick, setStoreTick] = useState(0);

  useEffect(() => {
    return dbStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const snapshot = dbStore.getSnapshot();

  const [activeTab, setActiveTab] = useState<'treatments' | 'catalog' | 'branch_pricing' | 'insurance_plans' | 'insurance_claims'>('treatments');

  // Filters for treatments
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState<string>('TODOS');
  const [treatmentModalityFilter, setTreatmentModalityFilter] = useState<string>('TODAS');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Catalog category filter
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('TODAS');
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [branchPricingSearch, setBranchPricingSearch] = useState<string>('');

  // Modals & pagination
  const [isCreateTreatmentOpen, setIsCreateTreatmentOpen] = useState(!!initialPatientId);
  const [isHistoricalImportOpen, setIsHistoricalImportOpen] = useState(false);
  const [treatmentsPage, setTreatmentsPage] = useState(1);
  const TREATMENTS_PAGE_SIZE = 20;
  const [selectedTreatmentForPayment, setSelectedTreatmentForPayment] = useState<any>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<any>(null);

  // Branch pricing editing state
  const [editingBranchService, setEditingBranchService] = useState<{
    branchId: string;
    serviceId: string;
    priceInput: string;
  } | null>(null);
  const [isSavingBranchPrice, setIsSavingBranchPrice] = useState<boolean>(false);
  const [updatingTreatmentId, setUpdatingTreatmentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtered treatments
  const filteredTreatments = useMemo(() => {
    return (snapshot.treatments || []).filter((t) => {
      if (treatmentStatusFilter !== 'TODOS' && t.status !== treatmentStatusFilter) return false;
      if (selectedBranchFilter !== 'TODAS' && t.branchId !== selectedBranchFilter) return false;

      if (treatmentModalityFilter !== 'TODAS') {
        if (treatmentModalityFilter === 'PLAN_SEGURO' && t.appliedModality !== 'PLAN_SEGURO') return false;
        if (treatmentModalityFilter === 'PARTICULAR' && t.appliedModality === 'PLAN_SEGURO') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const p = snapshot.patients.find((pat) => pat.id === t.patientId);
        const patientMatch =
          p?.firstName.toLowerCase().includes(q) ||
          p?.lastName.toLowerCase().includes(q) ||
          p?.documentNumber?.toLowerCase().includes(q) ||
          p?.nationalId?.includes(q);
        const titleMatch = t.title.toLowerCase().includes(q);
        if (!patientMatch && !titleMatch) return false;
      }

      return true;
    });
  }, [storeTick, snapshot.treatments, snapshot.patients, treatmentStatusFilter, treatmentModalityFilter, selectedBranchFilter, searchQuery]);

  const treatmentsTotalPages = Math.max(1, Math.ceil(filteredTreatments.length / TREATMENTS_PAGE_SIZE));
  const paginatedTreatments = useMemo(() => {
    const start = (treatmentsPage - 1) * TREATMENTS_PAGE_SIZE;
    return filteredTreatments.slice(start, start + TREATMENTS_PAGE_SIZE);
  }, [filteredTreatments, treatmentsPage]);

  useEffect(() => {
    setTreatmentsPage(1);
  }, [treatmentStatusFilter, treatmentModalityFilter, selectedBranchFilter, searchQuery]);

  // Treatments Financial Metrics (excluye tratamientos cancelados)
  const metrics = useMemo(() => {
    const activeList = (snapshot.treatments || []).filter((t) => t.status !== 'CANCELADO');
    const totalAmount = activeList.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const paidAmount = activeList.reduce((sum, t) => sum + (t.paidAmount || 0), 0);
    const balanceDue = activeList.reduce((sum, t) => sum + (t.balanceDue || 0), 0);
    const inProgressCount = activeList.filter((t) => t.status === 'EN_PROGRESO').length;

    return { totalAmount, paidAmount, balanceDue, inProgressCount, totalCount: activeList.length };
  }, [storeTick, snapshot.treatments]);

  // Catalog services filtered
  const filteredServices = useMemo(() => {
    return snapshot.services.filter((s) => {
      if (catalogCategoryFilter !== 'TODAS' && s.category !== catalogCategoryFilter) return false;
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase();
        return s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q));
      }
      return true;
    });
  }, [storeTick, snapshot.services, catalogCategoryFilter, catalogSearch]);

  // Branch pricing services filtered (todos los servicios, sin recorte .slice(0, 10))
  const filteredBranchServices = useMemo(() => {
    if (!branchPricingSearch.trim()) return snapshot.services;
    const q = branchPricingSearch.toLowerCase();
    return snapshot.services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q))
    );
  }, [storeTick, snapshot.services, branchPricingSearch]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    snapshot.services.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [storeTick, snapshot.services]);

  const handleStatusChange = async (treatmentId: string, newStatus: any) => {
    if (updatingTreatmentId) return;
    setActionError(null);
    setUpdatingTreatmentId(treatmentId);

    try {
      if (hasBackendSession()) {
        const res = await patchAuthoritativeAction<{
          treatment?: any;
          generatedCommissions?: any[];
          auditLogs?: any[];
          stateVersion?: number;
        }>(`/api/treatments/${treatmentId}/status`, { status: newStatus });

        dbStore.applyAuthoritativeSync(
          {
            ...(res.treatment ? { treatments: [res.treatment] } : {}),
            ...(res.generatedCommissions?.length
              ? { generatedCommissions: res.generatedCommissions }
              : {}),
            ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
          },
          res.stateVersion
        );
      } else {
        dbStore.updateTreatmentStatus(treatmentId, newStatus, undefined, session?.userId);
      }
    } catch (err: any) {
      setActionError(err.message || 'No se pudo actualizar el estado del tratamiento.');
    } finally {
      setUpdatingTreatmentId(null);
    }
  };

  const handleSaveBranchPrice = async (branchId: string, serviceId: string, priceInput: string) => {
    if (isSavingBranchPrice) return;
    setActionError(null);
    setSuccessMessage(null);

    const trimmed = priceInput.trim();
    if (!trimmed) {
      setActionError('Debe ingresar un precio válido en Guaraníes (PYG).');
      return;
    }

    let validatedPrice: number;
    try {
      validatedPrice = validatePygPrice(Number(trimmed), 'El precio por sucursal');
    } catch (validationErr: any) {
      setActionError(validationErr.message || 'El precio ingresado no es válido.');
      return;
    }

    setIsSavingBranchPrice(true);
    try {
      dbStore.setBranchServicePrice(branchId, serviceId, validatedPrice, true, session?.userId);
      await dbStore.flushPendingSyncStrict();
      setEditingBranchService(null);
      setSuccessMessage(
        'Precio actualizado. Se aplicará a los nuevos tratamientos; los ya registrados no cambian.'
      );
    } catch (err: any) {
      setActionError(
        err?.message || 'No se pudo guardar el precio por sucursal en el servidor.'
      );
    } finally {
      setIsSavingBranchPrice(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1C1F1E] tracking-tight">
            Tratamientos
          </h1>
          <p className="text-xs text-[#6B706D] mt-0.5 tabular-nums">
            {snapshot.treatments?.length || 0} planes · {snapshot.services.length} aranceles en Guaraníes
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'treatments' && (
            <>
              <button
                type="button"
                onClick={() => setIsHistoricalImportOpen(true)}
                className="px-3.5 py-2 bg-white hover:bg-[#F2F0EB] text-[#1C1F1E] border border-[#E6E2D9] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[40px] cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#525755]" />
                <span>Importar CSV</span>
              </button>
              <button
                onClick={() => setIsCreateTreatmentOpen(true)}
                className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[40px] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo tratamiento</span>
              </button>
            </>
          )}

          {activeTab === 'catalog' && (
            <button
              onClick={() => {
                setServiceToEdit(null);
                setServiceModalOpen(true);
              }}
              className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[40px] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo servicio</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <UnderlineTabs
        items={[
          { id: 'treatments', label: 'Planes', count: snapshot.treatments?.length || 0 },
          { id: 'catalog', label: 'Catálogo', count: snapshot.services.length },
          { id: 'branch_pricing', label: 'Precios por sucursal' },
          { id: 'insurance_plans', label: 'Planes y seguros', count: snapshot.insurancePlans?.length || 0 },
          { id: 'insurance_claims', label: 'Liquidaciones', count: snapshot.insuranceClaims?.length || 0 },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="font-bold text-emerald-700 hover:text-emerald-950"
          >
            Cerrar
          </button>
        </div>
      )}

      {actionError && activeTab !== 'treatments' && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-rose-800">
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="font-semibold text-rose-700 hover:text-rose-900"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* TAB 1: TRATAMIENTOS DE PACIENTES */}
      {activeTab === 'treatments' && (
        <>
          {/* Continuous Financial KPI Strip */}
          <div className="bg-white rounded-lg border border-[#E6E2D9] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EFECE5]">
            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Presupuestado</div>
              <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                {formatPYG(metrics.totalAmount)}
              </div>
              <div className="text-[11px] text-[#6B706D] mt-0.5 tabular-nums">
                {metrics.totalCount} planes activos
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Cobrado</div>
              <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                {formatPYG(metrics.paidAmount)}
              </div>
              <div className="text-[11px] text-[#3F6212] font-medium mt-0.5 tabular-nums">
                {metrics.totalAmount > 0
                  ? `${Math.round((metrics.paidAmount / metrics.totalAmount) * 100)}% recuperado`
                  : '0% recuperado'}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Saldo pendiente</div>
              <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                {formatPYG(metrics.balanceDue)}
              </div>
              <div className="text-[11px] text-[#6B706D] mt-0.5">Por percibir en caja</div>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">En progreso</div>
              <div className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                {metrics.inProgressCount}
              </div>
              <div className="text-[11px] text-[#6B706D] mt-0.5">Intervenciones activas</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por paciente, cédula o tratamiento..."
                className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden min-h-[40px]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={treatmentModalityFilter}
                onChange={(e) => setTreatmentModalityFilter(e.target.value)}
                className="flex-1 sm:flex-none text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden min-h-[40px] cursor-pointer"
              >
                <option value="TODAS">Todas las Modalidades</option>
                <option value="PARTICULAR">👤 Particular (Lista)</option>
                <option value="PLAN_SEGURO">🛡️ Con Seguro / Plan</option>
              </select>

              <select
                value={treatmentStatusFilter}
                onChange={(e) => setTreatmentStatusFilter(e.target.value)}
                className="flex-1 sm:flex-none text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden min-h-[40px] cursor-pointer"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="PLANIFICADO">Planificados</option>
                <option value="EN_PROGRESO">En Progreso</option>
                <option value="COMPLETADO">Completados</option>
                <option value="SUSPENDIDO">Suspendidos</option>
              </select>

              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="flex-1 sm:flex-none text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden min-h-[40px] cursor-pointer"
              >
                <option value="TODAS">Todas las Sucursales</option>
                {snapshot.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-rose-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="font-semibold text-rose-700 hover:text-rose-900"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Treatments List */}
          <div className="space-y-3">
            {filteredTreatments.length === 0 ? (
              <div className="bg-white rounded-lg border border-[#E6E2D9]">
                <EmptyState
                  icon={Stethoscope}
                  title="Sin tratamientos registrados"
                  description="No se encontraron planes con los filtros actuales."
                  action={
                    <button
                      onClick={() => setIsCreateTreatmentOpen(true)}
                      className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Nuevo tratamiento</span>
                    </button>
                  }
                />
              </div>
            ) : (
              paginatedTreatments.map((t) => {
                const pat = snapshot.patients.find((p) => p.id === t.patientId);
                const branch = snapshot.branches.find((b) => b.id === t.branchId);
                const doc = snapshot.users.find((u) => u.id === t.odontologistId);
                const percentPaid =
                  t.totalAmount > 0 ? Math.min(100, Math.round((t.paidAmount / t.totalAmount) * 100)) : 0;

                const statusTone =
                  t.status === 'COMPLETADO'
                    ? 'paid'
                    : t.status === 'EN_PROGRESO'
                    ? 'active'
                    : t.status === 'SUSPENDIDO' || t.status === 'CANCELADO'
                    ? 'danger'
                    : 'pending';
                const statusText =
                  t.status === 'COMPLETADO'
                    ? 'Completado'
                    : t.status === 'EN_PROGRESO'
                    ? 'En progreso'
                    : t.status === 'SUSPENDIDO'
                    ? 'Suspendido'
                    : t.status === 'CANCELADO'
                    ? 'Cancelado'
                    : 'Planificado';

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-lg p-5 border border-[#E6E2D9] hover:border-[#D4CFC3] transition-colors space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#EFECE5] pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#1C1F1E]">{t.title}</span>
                          <StatusLabel tone={statusTone} label={statusText} />
                          {t.appliedModality === 'PLAN_SEGURO' ? (
                            <span className="text-xs font-medium text-[#0F5C63] inline-flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>{t.appliedPlanName || 'Seguro dental'}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-[#6B706D]">Particular</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B706D] mt-1">
                          <span>
                            <span className="font-medium text-[#1C1F1E]">
                              {pat?.firstName} {pat?.lastName}
                            </span>{' '}
                            <span className="tabular-nums">(C.I. {pat?.documentNumber || pat?.nationalId})</span>
                          </span>
                          <span>·</span>
                          <span>{branch?.name}</span>
                          <span>·</span>
                          <span>{doc ? formatProfessionalName(doc, { lastNameOnly: true }) : ((t as any).historicalDoctorName || 'Asignado')}</span>
                        </div>
                      </div>

                      {/* Financial Figures */}
                      <div className="text-left md:text-right">
                        <div className="text-sm font-semibold text-[#1C1F1E] tabular-nums">
                          {formatPYG(t.totalAmount)}
                        </div>
                        {t.originalListPrice && t.originalListPrice > t.totalAmount && (
                          <div className="text-[11px] text-[#3F6212] font-medium tabular-nums">
                            <span className="line-through text-[#6B706D] mr-1">{formatPYG(t.originalListPrice)}</span>
                            <span>Ahorro: {formatPYG(t.originalListPrice - t.totalAmount)}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-[#6B706D] tabular-nums">
                          Cobrado: <span className="font-medium text-[#1C1F1E]">{formatPYG(t.paidAmount)}</span> ·
                          Saldo: <span className={`font-medium ${t.balanceDue > 0 ? 'text-[#B91C1C]' : 'text-[#1C1F1E]'}`}>{formatPYG(t.balanceDue)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Teeth Chips */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-4">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span>Progreso de Pago</span>
                          <span className="font-bold">{percentPaid}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              percentPaid === 100 ? 'bg-emerald-500' : 'bg-teal-600'
                            }`}
                            style={{ width: `${percentPaid}%` }}
                          />
                        </div>
                      </div>

                      {/* Tooth numbers linked */}
                      <div className="md:col-span-4 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-slate-400 font-semibold">Piezas FDI:</span>
                        {t.toothNumbers && t.toothNumbers.length > 0 ? (
                          t.toothNumbers.map((num: number) => (
                            <span
                              key={num}
                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-bold"
                            >
                              #{num}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Tratamiento General</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="md:col-span-4 flex items-center justify-end gap-2">
                        {t.balanceDue > 0 && (
                          <button
                            onClick={() => setSelectedTreatmentForPayment(t)}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Cobrar Cuota</span>
                          </button>
                        )}

                        <select
                          value={t.status}
                          disabled={updatingTreatmentId === t.id}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden disabled:opacity-60"
                        >
                          <option value="PLANIFICADO">PLANIFICADO</option>
                          <option value="EN_PROGRESO">EN PROGRESO</option>
                          <option value="COMPLETADO">COMPLETADO</option>
                          <option value="SUSPENDIDO">SUSPENDIDO</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {treatmentsTotalPages > 1 && (
              <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Mostrando {(treatmentsPage - 1) * TREATMENTS_PAGE_SIZE + 1}–
                  {Math.min(treatmentsPage * TREATMENTS_PAGE_SIZE, filteredTreatments.length)} de{' '}
                  <strong>{filteredTreatments.length}</strong> tratamientos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={treatmentsPage <= 1}
                    onClick={() => setTreatmentsPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="font-bold text-slate-800">
                    {treatmentsPage} / {treatmentsTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={treatmentsPage >= treatmentsTotalPages}
                    onClick={() => setTreatmentsPage((p) => Math.min(treatmentsTotalPages, p + 1))}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: CATÁLOGO DE SERVICIOS ODONTOLÓGICOS */}
      {activeTab === 'catalog' && (
        <>
          {/* Category Filter & Search */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar servicio por nombre o código..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setCatalogCategoryFilter('TODAS')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  catalogCategoryFilter === 'TODAS'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas ({snapshot.services.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatalogCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                    catalogCategoryFilter === cat
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Services Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Servicio / Procedimiento</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Duración Est.</th>
                    <th className="py-3 px-4 text-right">Precio Base (PYG)</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredServices.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-teal-800">
                        {s.code || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        {s.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">{s.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {s.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        {s.defaultDurationMin} min
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        {formatPYG(s.basePrice)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setServiceToEdit(s);
                            setServiceModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-teal-700 rounded-lg transition-colors"
                          title="Editar Servicio"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: PRECIOS DIFERENCIADOS POR SUCURSAL */}
      {activeTab === 'branch_pricing' && (
        <div className="space-y-4">
          <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 text-xs text-teal-900">
            <span className="font-bold">Política de Precios Multi-Sucursal (Guaraníes): </span>
            Permite a la clínica establecer aranceles diferenciados en sucursales según infraestructura o zona. Si no se define precio personalizado, rige el precio base del catálogo. Los cambios solo afectan a nuevos tratamientos y presupuestos.
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={branchPricingSearch}
                onChange={(e) => setBranchPricingSearch(e.target.value)}
                placeholder="Buscar servicio por nombre, código o categoría..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-800">{filteredBranchServices.length}</span> de {snapshot.services.length} servicios
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Servicio</th>
                    <th className="py-3.5 px-4 text-right">Precio Base</th>
                    {snapshot.branches.map((b) => (
                      <th key={b.id} className="py-3.5 px-4 text-right">
                        {b.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranchServices.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{s.name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{s.code}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-700">
                        {formatPYG(s.basePrice)}
                      </td>
                      {snapshot.branches.map((b) => {
                        const custom = (snapshot.branchServices || []).find(
                          (bs) => bs.branchId === b.id && bs.serviceId === s.id
                        );
                        const isEditing =
                          editingBranchService?.branchId === b.id &&
                          editingBranchService?.serviceId === s.id &&
                          editingBranchService !== null;

                        return (
                          <td key={b.id} className="py-3 px-4 text-right">
                            {isEditing && editingBranchService ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  inputMode="numeric"
                                  disabled={isSavingBranchPrice}
                                  className="w-28 p-1 text-xs font-bold border border-teal-500 rounded-md text-right"
                                  value={editingBranchService.priceInput}
                                  onChange={(e) =>
                                    setEditingBranchService({
                                      branchId: b.id,
                                      serviceId: s.id,
                                      priceInput: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveBranchPrice(b.id, s.id, editingBranchService.priceInput);
                                    } else if (e.key === 'Escape') {
                                      setEditingBranchService(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={isSavingBranchPrice}
                                  onClick={() =>
                                    handleSaveBranchPrice(b.id, s.id, editingBranchService.priceInput)
                                  }
                                  className="px-1.5 py-1 text-emerald-700 hover:bg-emerald-50 rounded-sm font-bold disabled:opacity-50"
                                  title="Guardar precio"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingBranchPrice}
                                  onClick={() => setEditingBranchService(null)}
                                  className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 rounded-sm font-bold disabled:opacity-50"
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setEditingBranchService({
                                    branchId: b.id,
                                    serviceId: s.id,
                                    priceInput: String(
                                      Math.round(Number(custom?.customPrice ?? s.basePrice) || 0)
                                    ),
                                  });
                                }}
                                className={`px-2 py-1 rounded-lg font-bold transition-all text-xs ${
                                  custom && Number(custom.customPrice) !== Number(s.basePrice)
                                    ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Click para personalizar precio en esta sucursal"
                              >
                                {custom ? formatPYG(custom.customPrice) : formatPYG(s.basePrice)}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLANES & SEGUROS ODONTOLÓGICOS (MODALIDAD DE COBERTURA) */}
      {activeTab === 'insurance_plans' && <InsurancePlansTab />}

      {/* TAB 5: LIQUIDACIONES DE SEGUROS Y RECLAMOS DE COBERTURA */}
      {activeTab === 'insurance_claims' && <InsuranceClaimsTab />}

      {/* Modals */}
      <CreateTreatmentModal
        isOpen={isCreateTreatmentOpen}
        onClose={() => setIsCreateTreatmentOpen(false)}
        initialPatientId={initialPatientId}
        initialToothNumber={initialToothNumber}
      />

      <RecordTreatmentPaymentModal
        treatment={selectedTreatmentForPayment}
        isOpen={selectedTreatmentForPayment !== null}
        onClose={() => setSelectedTreatmentForPayment(null)}
      />

      <CreateServiceModal
        isOpen={serviceModalOpen}
        onClose={() => {
          setServiceModalOpen(false);
          setServiceToEdit(null);
        }}
        serviceToEdit={serviceToEdit}
        onSaved={(msg) => {
          setActionError(null);
          setSuccessMessage(msg);
        }}
      />

      <HistoricalImportModal
        isOpen={isHistoricalImportOpen}
        onClose={() => setIsHistoricalImportOpen(false)}
        defaultEntity="treatments"
        onImportCompleted={(msg) => {
          setActionError(null);
          setSuccessMessage(msg);
        }}
      />
    </div>
  );
};
