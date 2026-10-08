import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Edit2,
  Check,
  Search,
  Filter,
  Sparkles,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Info,
  DollarSign,
  Tag,
  Building2,
  Lock
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasPermission } from '../../security/rbacHierarchy.ts';
import { InsurancePlanModal } from './InsurancePlanModal.tsx';

export const InsurancePlansTab: React.FC = () => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const canManagePlans =
    hasPermission(session?.role || '', 'plans.manage') ||
    session?.role === 'SUPER_ADMIN' ||
    session?.role === 'ADMIN_ORGANIZACION';

  const plans = snapshot.insurancePlans || [];
  const planPrices = snapshot.planServicePrices || [];
  const services = snapshot.services || [];

  // Selected plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || '');
  const activePlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  // Filters within active plan
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [coverageFilter, setCoverageFilter] = useState<'TODOS' | 'FULL' | 'COPAY' | 'NOT_SET'>('TODOS');

  // Modals
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<any | null>(null);

  // Edit states per row in matrix: { [serviceId]: { price: number; notes: string; isSaved?: boolean } }
  const [editingRows, setEditingRows] = useState<Record<string, { price: number; notes: string; savedFlash?: boolean }>>({});

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [services]);

  // Map of serviceId -> plan price for active plan
  const activePlanPriceMap = useMemo(() => {
    const map = new Map<string, { price: number; notes: string; id: string }>();
    if (!activePlan) return map;
    planPrices
      .filter((psp) => psp.planId === activePlan.id)
      .forEach((psp) => {
        map.set(psp.serviceId, { price: psp.price, notes: psp.notes || '', id: psp.id });
      });
    return map;
  }, [activePlan, planPrices]);

  // Statistics for active plan
  const stats = useMemo(() => {
    if (!activePlan) return { totalServices: 0, coveredCount: 0, zeroCount: 0, copayCount: 0 };
    const list = planPrices.filter((psp) => psp.planId === activePlan.id);
    const zeroCount = list.filter((psp) => psp.price === 0).length;
    const copayCount = list.filter((psp) => psp.price > 0).length;
    return {
      totalServices: services.length,
      coveredCount: list.length,
      zeroCount,
      copayCount,
    };
  }, [activePlan, planPrices, services]);

  // Filtered services in the matrix
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategory !== 'TODAS' && s.category !== selectedCategory) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchCode = s.code && s.code.toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }

      const planConfig = activePlanPriceMap.get(s.id);
      if (coverageFilter === 'FULL' && (!planConfig || planConfig.price !== 0)) return false;
      if (coverageFilter === 'COPAY' && (!planConfig || planConfig.price <= 0)) return false;
      if (coverageFilter === 'NOT_SET' && planConfig) return false;

      return true;
    });
  }, [services, selectedCategory, searchQuery, coverageFilter, activePlanPriceMap]);

  // Handle row price input changes
  const handlePriceChange = (serviceId: string, newPrice: number) => {
    const existing = editingRows[serviceId] || {
      price: activePlanPriceMap.get(serviceId)?.price ?? 0,
      notes: activePlanPriceMap.get(serviceId)?.notes ?? '',
    };
    setEditingRows({
      ...editingRows,
      [serviceId]: { ...existing, price: Math.max(0, newPrice) },
    });
  };

  const handleNotesChange = (serviceId: string, newNotes: string) => {
    const existing = editingRows[serviceId] || {
      price: activePlanPriceMap.get(serviceId)?.price ?? 0,
      notes: activePlanPriceMap.get(serviceId)?.notes ?? '',
    };
    setEditingRows({
      ...editingRows,
      [serviceId]: { ...existing, notes: newNotes },
    });
  };

  // Quick action: Set 100% cover (0 Gs)
  const handleQuickZero = (serviceId: string) => {
    const existing = editingRows[serviceId] || {
      price: 0,
      notes: activePlanPriceMap.get(serviceId)?.notes ?? '',
    };
    setEditingRows({
      ...editingRows,
      [serviceId]: { ...existing, price: 0, notes: '100% Cubierto' },
    });
  };

  // Quick action: Apply discount percentage to base price
  const handleQuickDiscount = (serviceId: string, basePrice: number, discountPct: number) => {
    const discounted = Math.round((basePrice * (100 - discountPct)) / 100 / 1000) * 1000;
    const existing = editingRows[serviceId] || {
      price: discounted,
      notes: activePlanPriceMap.get(serviceId)?.notes ?? '',
    };
    setEditingRows({
      ...editingRows,
      [serviceId]: {
        ...existing,
        price: discounted,
        notes: `Copago con ${discountPct}% de cobertura`,
      },
    });
  };

  // Save single service price to plan
  const handleSavePrice = (serviceId: string, defaultBasePrice: number) => {
    if (!activePlan || !canManagePlans) return;
    const current = editingRows[serviceId];
    const finalPrice = current ? current.price : activePlanPriceMap.get(serviceId)?.price ?? defaultBasePrice;
    const finalNotes = current ? current.notes : activePlanPriceMap.get(serviceId)?.notes ?? '';

    dbStore.setPlanServicePrice(activePlan.id, serviceId, finalPrice, finalNotes, session?.userId);

    // Flash saved effect
    setEditingRows({
      ...editingRows,
      [serviceId]: { price: finalPrice, notes: finalNotes, savedFlash: true },
    });
    setTimeout(() => {
      setEditingRows((prev) => {
        if (!prev[serviceId]) return prev;
        return {
          ...prev,
          [serviceId]: { ...prev[serviceId], savedFlash: false },
        };
      });
    }, 1500);
  };

  // Toggle active/inactive plan
  const handleTogglePlanStatus = () => {
    if (!activePlan || !canManagePlans) return;
    const willDeactivate = activePlan.status === 'ACTIVO';
    if (
      willDeactivate &&
      !window.confirm(
        `¿Desea desactivar el plan "${activePlan.name}"? Los pacientes actuales mantendrán su historial, pero no podrá ser asignado a nuevos pacientes.`
      )
    ) {
      return;
    }
    dbStore.toggleInsurancePlanStatus(activePlan.id, session?.userId);
  };

  // Apply quick bulk template: 100% prevention (consultas y limpiezas gratis)
  const handleApplyPreventive100 = () => {
    if (!activePlan || !canManagePlans) return;
    if (
      !window.confirm(
        `¿Desea fijar automáticamente todas las consultas y limpiezas al 100% de cobertura (₲ 0) para "${activePlan.name}"?`
      )
    ) {
      return;
    }
    services.forEach((s) => {
      if (
        s.category.toLowerCase().includes('diagnóstico') ||
        s.category.toLowerCase().includes('prevención') ||
        s.code?.startsWith('DIAG') ||
        s.code?.startsWith('PREV')
      ) {
        dbStore.setPlanServicePrice(activePlan.id, s.id, 0, '100% Cobertura Preventiva', session?.userId);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Selector de Planes / Seguros */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">
              <Shield className="h-4 w-4" />
              <span>Modalidad de Cobertura • Planes & Seguros Odontológicos</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Convenios y Aranceles por Seguro
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura los precios especiales y copagos para cada tratamiento según la modalidad del paciente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManagePlans && (
              <button
                onClick={() => {
                  setPlanToEdit(null);
                  setIsPlanModalOpen(true);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Plan / Seguro</span>
              </button>
            )}
          </div>
        </div>

        {/* Listado de Tarjetas de Planes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
          {plans.map((p) => {
            const isSelected = p.id === (activePlan?.id || selectedPlanId);
            const planSpecificCount = planPrices.filter((psp) => psp.planId === p.id).length;

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-teal-600 bg-teal-50/40 shadow-xs ring-2 ring-teal-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-md">
                      {p.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.status === 'ACTIVO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  {canManagePlans && isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlanToEdit(p);
                        setIsPlanModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-100 rounded-lg transition-colors"
                      title="Editar parámetros del plan"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2.5 line-clamp-1">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {p.description || 'Sin descripción comercial registrada.'}
                </p>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100/80 text-[11px]">
                  <span className="text-slate-500 font-medium">
                    {planSpecificCount} de {services.length} tarifados
                  </span>
                  <span className="font-bold text-teal-700">
                    {isSelected ? '✓ Seleccionado' : 'Click para ver'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle y Matriz de Precios del Plan Seleccionado */}
      {activePlan && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          {/* Header del Plan Activo */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {activePlan.name}
                  </h3>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {activePlan.code}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activePlan.status === 'ACTIVO'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {activePlan.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {activePlan.coverageTerms || activePlan.description || 'Sin condiciones específicas.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canManagePlans && (
                <>
                  <button
                    onClick={handleTogglePlanStatus}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                      activePlan.status === 'ACTIVO'
                        ? 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
                        : 'border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {activePlan.status === 'ACTIVO' ? 'Desactivar Plan' : 'Activar Plan'}
                  </button>

                  <button
                    onClick={() => {
                      setPlanToEdit(activePlan);
                      setIsPlanModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Editar Datos</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Métricas Rápidas del Plan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Servicios</span>
              <span className="text-lg font-black text-slate-900 mt-0.5 block">{stats.totalServices}</span>
            </div>
            <div className="p-3.5 bg-teal-50/50 rounded-2xl border border-teal-100/60">
              <span className="text-[10px] font-bold text-teal-800 uppercase block">Tarifas Asignadas</span>
              <span className="text-lg font-black text-teal-900 mt-0.5 block">{stats.coveredCount}</span>
            </div>
            <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100/60">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">100% Cubiertos (₲ 0)</span>
              <span className="text-lg font-black text-emerald-900 mt-0.5 block">{stats.zeroCount}</span>
            </div>
            <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100/60">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Con Copago Preferencial</span>
              <span className="text-lg font-black text-blue-900 mt-0.5 block">{stats.copayCount}</span>
            </div>
          </div>

          {/* Plantillas Rápidas (Atajos) */}
          {canManagePlans && (
            <div className="p-4 bg-teal-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-teal-300 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Atajo Comercial Rápido para este Plan
                  </h4>
                  <p className="text-[11px] text-teal-200">
                    Aplica reglas automáticas de cobertura sin tener que editar cada fila manualmente.
                  </p>
                </div>
              </div>
              <button
                onClick={handleApplyPreventive100}
                className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow-2xs"
              >
                Fijar Consultas y Limpiezas al 100% (₲ 0)
              </button>
            </div>
          )}

          {/* Barra de Filtros de la Matriz */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar procedimiento por nombre o código (ej: REST-01)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="TODAS">Todas las Categorías ({services.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={coverageFilter}
                onChange={(e) => setCoverageFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                <option value="TODOS">Todos los tipos de tarifa</option>
                <option value="FULL">Solo 100% Cubiertos (₲ 0)</option>
                <option value="COPAY">Solo Con Copago Preferencial</option>
                <option value="NOT_SET">Sin Tarifa Especial Asignada</option>
              </select>
            </div>
          </div>

          {/* Matriz de Precios */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Procedimiento Odontológico</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Precio Particular Lista</th>
                  <th className="py-3 px-4 text-center">Tarifa Plan / Seguro (PYG)</th>
                  <th className="py-3 px-4 text-center">Ahorro / Cobertura</th>
                  <th className="py-3 px-4">Notas de Cobertura</th>
                  {canManagePlans && <th className="py-3 px-4 text-center">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredServices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No se encontraron procedimientos que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((svc) => {
                    const savedConfig = activePlanPriceMap.get(svc.id);
                    const editing = editingRows[svc.id];
                    const currentPrice = editing ? editing.price : savedConfig ? savedConfig.price : svc.basePrice;
                    const currentNotes = editing ? editing.notes : savedConfig ? savedConfig.notes : '';
                    const isConfigured = !!savedConfig;
                    const isZero = currentPrice === 0;

                    // Calculate discount percentage
                    const savingsAmount = Math.max(0, svc.basePrice - currentPrice);
                    const savingsPct = svc.basePrice > 0 ? Math.round((savingsAmount / svc.basePrice) * 100) : 0;

                    return (
                      <tr
                        key={svc.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          editing?.savedFlash ? 'bg-emerald-50/70 transition-all duration-300' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {svc.code && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {svc.code}
                              </span>
                            )}
                            <span>{svc.name}</span>
                          </div>
                          {svc.description && (
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5 line-clamp-1">
                              {svc.description}
                            </p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {svc.category}
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-500 line-through">
                          {formatPYG(svc.basePrice)}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManagePlans ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={5000}
                                  value={currentPrice}
                                  onChange={(e) =>
                                    handlePriceChange(svc.id, parseInt(e.target.value, 10) || 0)
                                  }
                                  className={`w-28 text-right text-xs font-bold p-1.5 rounded-lg border focus:ring-2 focus:ring-teal-500 focus:outline-hidden ${
                                    isZero
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-white text-slate-900 border-slate-200'
                                  }`}
                                />
                                <div className="flex flex-col gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickZero(svc.id)}
                                    title="100% Cubierto (₲ 0)"
                                    className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[9px] font-bold"
                                  >
                                    ₲ 0
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickDiscount(svc.id, svc.basePrice, 50)}
                                    title="50% de descuento"
                                    className="px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-[9px] font-bold"
                                  >
                                    -50%
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span
                                className={`font-bold ${
                                  isZero ? 'text-emerald-700' : 'text-slate-900'
                                }`}
                              >
                                {isZero ? '100% CUBIERTO (₲ 0)' : formatPYG(currentPrice)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isZero ? (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              100% Cubierto
                            </span>
                          ) : savingsPct > 0 ? (
                            <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                              {savingsPct}% Ahorro (₲ {savingsAmount.toLocaleString('es-PY')})
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Tarifa de Lista
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {canManagePlans ? (
                            <input
                              type="text"
                              value={currentNotes}
                              onChange={(e) => handleNotesChange(svc.id, e.target.value)}
                              placeholder="Ej: Copago 50%, 100% cubierto..."
                              className="w-full text-[11px] p-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              {currentNotes || '—'}
                            </span>
                          )}
                        </td>

                        {canManagePlans && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleSavePrice(svc.id, svc.basePrice)}
                              className={`p-1.5 rounded-xl font-bold transition-all ${
                                editing?.savedFlash
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700'
                              }`}
                              title="Guardar tarifa para este plan"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal para Crear/Editar Plan */}
      <InsurancePlanModal
        isOpen={isPlanModalOpen}
        onClose={() => {
          setIsPlanModalOpen(false);
          setPlanToEdit(null);
        }}
        planToEdit={planToEdit}
        onSave={(data) => {
          if (planToEdit) {
            dbStore.updateInsurancePlan(planToEdit.id, data, session?.userId);
          } else {
            const created = dbStore.createInsurancePlan({
              ...data,
              actorUserId: session?.userId,
            });
            if (created) {
              setSelectedPlanId(created.id);
            }
          }
        }}
      />
    </div>
  );
};
