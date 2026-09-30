import React, { useState, useMemo } from 'react';
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
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Edit2
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { CreateTreatmentModal } from './CreateTreatmentModal.tsx';
import { RecordTreatmentPaymentModal } from './RecordTreatmentPaymentModal.tsx';
import { CreateServiceModal } from './CreateServiceModal.tsx';
import { useAuth } from '../../auth/authContext.tsx';

interface TreatmentsManagementViewProps {
  initialPatientId?: string;
  initialToothNumber?: number;
}

export const TreatmentsManagementView: React.FC<TreatmentsManagementViewProps> = ({
  initialPatientId,
  initialToothNumber,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const [activeTab, setActiveTab] = useState<'treatments' | 'catalog' | 'branch_pricing'>('treatments');

  // Filters for treatments
  const [treatmentStatusFilter, setTreatmentStatusFilter] = useState<string>('TODOS');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Catalog category filter
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('TODAS');
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // Modals
  const [isCreateTreatmentOpen, setIsCreateTreatmentOpen] = useState(!!initialPatientId);
  const [selectedTreatmentForPayment, setSelectedTreatmentForPayment] = useState<any>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<any>(null);

  // Branch pricing editing state
  const [editingBranchService, setEditingBranchService] = useState<{
    branchId: string;
    serviceId: string;
    price: number;
  } | null>(null);

  // Filtered treatments
  const filteredTreatments = useMemo(() => {
    return (snapshot.treatments || []).filter((t) => {
      if (treatmentStatusFilter !== 'TODOS' && t.status !== treatmentStatusFilter) return false;
      if (selectedBranchFilter !== 'TODAS' && t.branchId !== selectedBranchFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const p = snapshot.patients.find((pat) => pat.id === t.patientId);
        const patientMatch =
          p?.firstName.toLowerCase().includes(q) ||
          p?.lastName.toLowerCase().includes(q) ||
          p?.nationalId.includes(q);
        const titleMatch = t.title.toLowerCase().includes(q);
        if (!patientMatch && !titleMatch) return false;
      }

      return true;
    });
  }, [snapshot.treatments, snapshot.patients, treatmentStatusFilter, selectedBranchFilter, searchQuery]);

  // Treatments Financial Metrics
  const metrics = useMemo(() => {
    const list = snapshot.treatments || [];
    const totalAmount = list.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const paidAmount = list.reduce((sum, t) => sum + (t.paidAmount || 0), 0);
    const balanceDue = list.reduce((sum, t) => sum + (t.balanceDue || 0), 0);
    const inProgressCount = list.filter((t) => t.status === 'EN_PROGRESO').length;

    return { totalAmount, paidAmount, balanceDue, inProgressCount, totalCount: list.length };
  }, [snapshot.treatments]);

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
  }, [snapshot.services, catalogCategoryFilter, catalogSearch]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    snapshot.services.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [snapshot.services]);

  const handleStatusChange = (treatmentId: string, newStatus: any) => {
    dbStore.updateTreatmentStatus(treatmentId, newStatus, undefined, session?.userId);
  };

  const handleSaveBranchPrice = (branchId: string, serviceId: string, customPrice: number) => {
    dbStore.setBranchServicePrice(branchId, serviceId, customPrice, true, session?.userId);
    setEditingBranchService(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
              <Stethoscope className="h-4 w-4" />
              <span>Fase 10 • Tratamientos & Catálogo Odontológico</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Tratamientos Clínicos & Aranceles
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gestión integral de planes de tratamiento, vinculación a piezas dentales FDI y precios en Guaraníes (PYG).
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'treatments' && (
              <button
                onClick={() => setIsCreateTreatmentOpen(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Plan de Tratamiento</span>
              </button>
            )}

            {activeTab === 'catalog' && (
              <button
                onClick={() => {
                  setServiceToEdit(null);
                  setServiceModalOpen(true);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Servicio en Catálogo</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex border-b border-slate-100 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('treatments')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'treatments'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            <span>Planes de Tratamiento ({snapshot.treatments?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Catálogo de Servicios Odontológicos ({snapshot.services.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('branch_pricing')}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'branch_pricing'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Precios por Sucursal</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TRATAMIENTOS DE PACIENTES */}
      {activeTab === 'treatments' && (
        <>
          {/* Financial Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Monto Presupuestado</span>
                <DollarSign className="h-4 w-4 text-teal-600" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatPYG(metrics.totalAmount)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {metrics.totalCount} planes de tratamiento
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Cobrado Efectivo / SIPAP</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                {formatPYG(metrics.paidAmount)}
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">
                {metrics.totalAmount > 0
                  ? `${Math.round((metrics.paidAmount / metrics.totalAmount) * 100)}% recuperado`
                  : '0%'}
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Saldo Pendiente de Cobro</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-red-600 mt-1">
                {formatPYG(metrics.balanceDue)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Por percibir en caja</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">En Tratamiento Activo</span>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-xl font-black text-blue-700 mt-1">
                {metrics.inProgressCount} Pacientes
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Intervenciones en curso</div>
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

          {/* Treatments List */}
          <div className="space-y-3">
            {filteredTreatments.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 text-slate-400">
                <Stethoscope className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold">No se encontraron tratamientos con los filtros seleccionados.</p>
              </div>
            ) : (
              filteredTreatments.map((t) => {
                const pat = snapshot.patients.find((p) => p.id === t.patientId);
                const branch = snapshot.branches.find((b) => b.id === t.branchId);
                const doc = snapshot.users.find((u) => u.id === t.odontologistId);
                const percentPaid =
                  t.totalAmount > 0 ? Math.min(100, Math.round((t.paidAmount / t.totalAmount) * 100)) : 0;

                return (
                  <div
                    key={t.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-teal-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{t.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              t.status === 'COMPLETADO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.status === 'EN_PROGRESO'
                                ? 'bg-blue-100 text-blue-800'
                                : t.status === 'SUSPENDIDO'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>
                            Paciente:{' '}
                            <span className="font-semibold text-slate-800">
                              {pat?.firstName} {pat?.lastName}
                            </span>{' '}
                            (C.I. {pat?.nationalId})
                          </span>
                          <span>•</span>
                          <span>{branch?.name}</span>
                          <span>•</span>
                          <span>Dr(a). {doc?.lastName || (t as any).historicalDoctorName || 'Asignado'}</span>
                        </div>
                      </div>

                      {/* Financial Status Chips */}
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900">
                          {formatPYG(t.totalAmount)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Cobrado: <span className="font-semibold text-emerald-700">{formatPYG(t.paidAmount)}</span> •
                          Saldo: <span className="font-bold text-red-600">{formatPYG(t.balanceDue)}</span>
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
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
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
            Permite a la clínica establecer aranceles diferenciados en sucursales según infraestructura o zona (ej. Asunción Centro vs San Lorenzo vs Luque). Si no se define precio personalizado, rige el precio base del catálogo.
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
                  {snapshot.services.slice(0, 10).map((s) => (
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
                                  step="5000"
                                  className="w-24 p-1 text-xs font-bold border border-teal-500 rounded-md text-right"
                                  value={editingBranchService.price}
                                  onChange={(e) =>
                                    setEditingBranchService({
                                      branchId: b.id,
                                      serviceId: s.id,
                                      price: parseInt(e.target.value, 10) || 0,
                                    })
                                  }
                                />
                                <button
                                  onClick={() =>
                                    handleSaveBranchPrice(b.id, s.id, editingBranchService.price)
                                  }
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-sm"
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  setEditingBranchService({
                                    branchId: b.id,
                                    serviceId: s.id,
                                    price: custom?.customPrice || s.basePrice,
                                  })
                                }
                                className={`px-2 py-1 rounded-lg font-bold transition-all text-xs ${
                                  custom
                                    ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                                    : 'text-slate-500 hover:bg-slate-100'
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
      />
    </div>
  );
};
