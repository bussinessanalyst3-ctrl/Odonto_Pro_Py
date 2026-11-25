import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import {
  NO_PROFESSIONALS_MESSAGE,
  formatProfessionalName,
  formatProfessionalOptionLabel,
  getActiveHealthProfessionals,
} from '../../utils/healthProfessional.ts';
import {
  X,
  Plus,
  Trash2,
  Calculator,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Info,
  Tag,
  Building2,
  Stethoscope,
} from 'lucide-react';

function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string;
  quoteToEditId?: string | null;
  onQuoteCreated?: (quoteId: string) => void;
  onSaved?: (message: string) => void;
}

export interface QuoteItemInput {
  serviceId?: string;
  toothNumber?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  appliedModality?: 'PARTICULAR' | 'PLAN_SEGURO';
  appliedPlanId?: string | null;
  appliedPlanName?: string | null;
  originalListPrice?: number;
  hasSpecialPrice?: boolean;
}

export const CreateQuoteModal: React.FC<CreateQuoteModalProps> = ({
  isOpen,
  onClose,
  initialPatientId,
  quoteToEditId,
  onQuoteCreated,
  onSaved,
}) => {
  const { session } = useAuth();

  // Almacén reactivo de datos
  const [patients, setPatients] = useState(() => dbStore.getPatients());
  const [branches, setBranches] = useState(() => dbStore.getBranches());
  const [services, setServices] = useState(() => dbStore.getServices());
  const [users, setUsers] = useState(() => dbStore.getUsers());
  const [insurancePlans, setInsurancePlans] = useState(() => dbStore.getInsurancePlans(false));

  const dentists = useMemo(() => {
    return getActiveHealthProfessionals(users);
  }, [users]);

  // Recarga reactiva de catálogos
  const reloadStoreData = useCallback(() => {
    setPatients([...dbStore.getPatients()]);
    setBranches([...dbStore.getBranches()]);
    setServices([...dbStore.getServices()]);
    setUsers([...dbStore.getUsers()]);
    setInsurancePlans([...dbStore.getInsurancePlans(false)]);
  }, []);

  useEffect(() => {
    return dbStore.subscribe(reloadStoreData);
  }, [reloadStoreData]);

  // Estado del formulario
  const [patientId, setPatientId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [odontologistId, setOdontologistId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(''); // '' = PARTICULAR
  const [validDays, setValidDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>(
    'Validez de 30 días. Financiación hasta en 3 cuotas sin intereses con entrega inicial del 40%.'
  );
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [items, setItems] = useState<QuoteItemInput[]>([]);
  const [existingValidUntil, setExistingValidUntil] = useState<string | null>(null);
  const [validUntilTouched, setValidUntilTouched] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Helper para resolver precio unitario según servicio y plan seleccionado
  const calculateItemPrice = useCallback(
    (sId: string, pId: string, bId: string, planIdToApply: string) => {
      const s = services.find((srv) => srv.id === sId);
      if (!s) {
        return {
          unitPrice: 0,
          listPrice: 0,
          modality: (planIdToApply ? 'PLAN_SEGURO' : 'PARTICULAR') as 'PARTICULAR' | 'PLAN_SEGURO',
          planId: planIdToApply || null,
          planName: planIdToApply ? (insurancePlans.find((ip) => ip.id === planIdToApply)?.name || null) : null,
          hasSpecialPrice: false,
        };
      }

      const resolved = dbStore.resolveServicePrice({
        serviceId: sId,
        patientId: pId,
        branchId: bId,
        forcedModality: planIdToApply ? 'PLAN_SEGURO' : 'PARTICULAR',
        forcedPlanId: planIdToApply || undefined,
      });

      return {
        unitPrice: resolved.finalPrice,
        listPrice: resolved.listPrice,
        modality: resolved.modality,
        planId: resolved.planId,
        planName: resolved.planName,
        hasSpecialPrice: resolved.hasSpecialPrice,
      };
    },
    [services, insurancePlans]
  );

  // Inicialización o reapertura del modal
  useEffect(() => {
    if (!isOpen) return;

    // Refrescar catálogos frescos al abrir
    reloadStoreData();
    const currentPatients = dbStore.getPatients();
    const currentBranches = dbStore.getBranches();
    const currentServices = dbStore.getServices();
    const currentUsers = dbStore.getUsers();
    const currentPlans = dbStore.getInsurancePlans(false);

    setFormError(null);
    setIsSaving(false);
    setValidUntilTouched(false);

    // Caso A: Modo Edición de un presupuesto existente
    if (quoteToEditId) {
      const existingQuote = dbStore.getQuotes().find((q) => q.id === quoteToEditId);
      if (existingQuote) {
        setPatientId(existingQuote.patientId);
        setBranchId(existingQuote.branchId);
        setOdontologistId(existingQuote.odontologistId || '');
        setSelectedPlanId(existingQuote.planId || '');
        setDiscountAmount(existingQuote.discountAmount || 0);
        setNotes(existingQuote.notes || '');
        setExistingValidUntil(existingQuote.validUntil || null);

        const existingItems = dbStore.getQuoteItems(quoteToEditId);
        if (existingItems && existingItems.length > 0) {
          setItems(
            existingItems.map((qi) => ({
              serviceId: qi.serviceId || undefined,
              toothNumber: qi.toothNumber || undefined,
              description: qi.description,
              quantity: qi.quantity,
              unitPrice: qi.unitPrice,
              subtotal: qi.subtotal,
              appliedModality: (qi.appliedModality as any) || 'PARTICULAR',
              appliedPlanId: qi.appliedPlanId || null,
              appliedPlanName: qi.appliedPlanName || null,
              originalListPrice: qi.originalListPrice ?? qi.unitPrice,
              hasSpecialPrice: qi.appliedModality === 'PLAN_SEGURO' && (qi.originalListPrice ?? 0) > qi.unitPrice,
            }))
          );
        }
        return;
      }
    }

    // Caso B: Modo Nuevo Presupuesto
    const defaultPatientId = initialPatientId || currentPatients[0]?.id || '';
    const defaultBranchId = session?.currentBranchId || currentBranches[0]?.id || '';
    const defaultDentistId = getActiveHealthProfessionals(currentUsers)[0]?.id || '';

    setPatientId(defaultPatientId);
    setBranchId(defaultBranchId);
    setOdontologistId(defaultDentistId);
    setDiscountAmount(0);
    setValidDays(30);
    setExistingValidUntil(null);
    setNotes('Validez de 30 días. Financiación hasta en 3 cuotas sin intereses con entrega inicial del 40%.');

    // Determinar plan por defecto (si el paciente tiene plan asignado, pre-seleccionarlo)
    const pat = currentPatients.find((p) => p.id === defaultPatientId);
    const initialPlanId = pat?.insurancePlanId && currentPlans.some((cp) => cp.id === pat.insurancePlanId)
      ? pat.insurancePlanId
      : '';
    setSelectedPlanId(initialPlanId);

    // Inicializar ítem por defecto
    const firstService = currentServices[0];
    if (firstService) {
      const resolved = dbStore.resolveServicePrice({
        serviceId: firstService.id,
        patientId: defaultPatientId,
        branchId: defaultBranchId,
        forcedModality: initialPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
        forcedPlanId: initialPlanId || undefined,
      });

      setItems([
        {
          serviceId: firstService.id,
          toothNumber: undefined,
          description: firstService.name,
          quantity: 1,
          unitPrice: resolved.finalPrice,
          subtotal: resolved.finalPrice,
          originalListPrice: resolved.listPrice,
          appliedModality: resolved.modality,
          appliedPlanId: resolved.planId,
          appliedPlanName: resolved.planName,
          hasSpecialPrice: resolved.hasSpecialPrice,
        },
      ]);
    } else {
      // Catálogo libre si aún no se han registrado servicios específicos
      setItems([
        {
          serviceId: '',
          toothNumber: undefined,
          description: 'Consulta y Diagnóstico Odontológico',
          quantity: 1,
          unitPrice: 120000,
          subtotal: 120000,
          originalListPrice: 120000,
          appliedModality: 'PARTICULAR',
          appliedPlanId: null,
          appliedPlanName: null,
          hasSpecialPrice: false,
        },
      ]);
    }
  }, [isOpen, quoteToEditId, initialPatientId, session?.currentBranchId, reloadStoreData]);

  // Recalcular ítems SOLO ante un cambio explícito del usuario (plan, sucursal o paciente en presupuesto nuevo)
  // Nunca sobreescribe precios congelados al abrir un presupuesto existente para edición.
  const recalculateItemsForPricing = useCallback(
    (nextPatientId: string, nextBranchId: string, nextPlanId: string) => {
      setItems((prevItems) =>
        prevItems.map((it) => {
          if (!it.serviceId) {
            return {
              ...it,
              appliedModality: nextPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
              appliedPlanId: nextPlanId || null,
              appliedPlanName: nextPlanId
                ? insurancePlans.find((ip) => ip.id === nextPlanId)?.name || null
                : null,
            };
          }
          const res = calculateItemPrice(it.serviceId, nextPatientId, nextBranchId, nextPlanId);
          return {
            ...it,
            unitPrice: res.unitPrice,
            subtotal: res.unitPrice * it.quantity,
            originalListPrice: res.listPrice,
            appliedModality: res.modality,
            appliedPlanId: res.planId,
            appliedPlanName: res.planName,
            hasSpecialPrice: res.hasSpecialPrice,
          };
        })
      );
    },
    [calculateItemPrice, insurancePlans]
  );

  // Si cambia el paciente seleccionado, sincronizar plan por defecto en presupuestos nuevos
  const handlePatientChange = (newPatientId: string) => {
    setPatientId(newPatientId);
    if (!quoteToEditId) {
      const pat = patients.find((p) => p.id === newPatientId);
      const nextPlanId =
        pat?.insurancePlanId && insurancePlans.some((ip) => ip.id === pat.insurancePlanId)
          ? pat.insurancePlanId
          : '';
      setSelectedPlanId(nextPlanId);
      recalculateItemsForPricing(newPatientId, branchId, nextPlanId);
    }
  };

  const handleBranchChange = (newBranchId: string) => {
    setBranchId(newBranchId);
    recalculateItemsForPricing(patientId, newBranchId, selectedPlanId);
  };

  const handlePlanChange = (newPlanId: string) => {
    setSelectedPlanId(newPlanId);
    recalculateItemsForPricing(patientId, branchId, newPlanId);
  };

  if (!isOpen) return null;

  const currentPatient = patients.find((p) => p.id === patientId);
  const activeSelectedPlan = insurancePlans.find((ip) => ip.id === selectedPlanId);

  // Agregar Ítem garantizado (nunca bloqueado)
  const handleAddItem = () => {
    const nextService = services[items.length % (services.length || 1)] || services[0];
    if (nextService) {
      const res = calculateItemPrice(nextService.id, patientId, branchId, selectedPlanId);
      setItems((prev) => [
        ...prev,
        {
          serviceId: nextService.id,
          toothNumber: undefined,
          description: nextService.name,
          quantity: 1,
          unitPrice: res.unitPrice,
          subtotal: res.unitPrice,
          originalListPrice: res.listPrice,
          appliedModality: res.modality,
          appliedPlanId: res.planId,
          appliedPlanName: res.planName,
          hasSpecialPrice: res.hasSpecialPrice,
        },
      ]);
    } else {
      // Ítem manual libre en caso de no haber servicios cargados
      setItems((prev) => [
        ...prev,
        {
          serviceId: '',
          toothNumber: undefined,
          description: 'Procedimiento Odontológico Adicional',
          quantity: 1,
          unitPrice: 100000,
          subtotal: 100000,
          originalListPrice: 100000,
          appliedModality: selectedPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
          appliedPlanId: selectedPlanId || null,
          appliedPlanName: activeSelectedPlan?.name || null,
          hasSpecialPrice: false,
        },
      ]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      // Si solo queda un ítem, resetearlo en vez de eliminarlo
      const firstSrv = services[0];
      if (firstSrv) {
        const res = calculateItemPrice(firstSrv.id, patientId, branchId, selectedPlanId);
        setItems([
          {
            serviceId: firstSrv.id,
            toothNumber: undefined,
            description: firstSrv.name,
            quantity: 1,
            unitPrice: res.unitPrice,
            subtotal: res.unitPrice,
            originalListPrice: res.listPrice,
            appliedModality: res.modality,
            appliedPlanId: res.planId,
            appliedPlanName: res.planName,
            hasSpecialPrice: res.hasSpecialPrice,
          },
        ]);
      } else {
        setItems([
          {
            serviceId: '',
            toothNumber: undefined,
            description: 'Procedimiento Odontológico',
            quantity: 1,
            unitPrice: 0,
            subtotal: 0,
            appliedModality: selectedPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
          },
        ]);
      }
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, sId: string) => {
    const newItems = [...items];
    if (!sId) {
      // Cambio a servicio manual / libre
      newItems[index] = {
        ...newItems[index],
        serviceId: '',
        appliedModality: selectedPlanId ? 'PLAN_SEGURO' : 'PARTICULAR',
        appliedPlanId: selectedPlanId || null,
        appliedPlanName: activeSelectedPlan?.name || null,
        hasSpecialPrice: false,
      };
      setItems(newItems);
      return;
    }

    const s = services.find((srv) => srv.id === sId);
    if (!s) return;

    const res = calculateItemPrice(sId, patientId, branchId, selectedPlanId);
    newItems[index] = {
      ...newItems[index],
      serviceId: sId,
      description: s.name,
      unitPrice: res.unitPrice,
      subtotal: res.unitPrice * newItems[index].quantity,
      originalListPrice: res.listPrice,
      appliedModality: res.modality,
      appliedPlanId: res.planId,
      appliedPlanName: res.planName,
      hasSpecialPrice: res.hasSpecialPrice,
    };
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof QuoteItemInput, value: any) => {
    const newItems = [...items];
    const current = { ...newItems[index] };

    if (field === 'quantity') {
      const q = Math.max(1, parseInt(value, 10) || 1);
      current.quantity = q;
      current.subtotal = q * current.unitPrice;
    } else if (field === 'unitPrice') {
      const p = Math.max(0, parseInt(value, 10) || 0);
      current.unitPrice = p;
      current.subtotal = current.quantity * p;
    } else {
      (current as any)[field] = value;
    }

    newItems[index] = current;
    setItems(newItems);
  };

  // Cálculos financieros en PYG
  const grossTotal = items.reduce((sum, it) => sum + (it.subtotal || 0), 0);
  const totalInsuranceSavings = items.reduce((sum, it) => {
    const orig = it.originalListPrice ?? it.unitPrice;
    return sum + Math.max(0, (orig - it.unitPrice) * it.quantity);
  }, 0);
  const finalTotal = Math.max(0, grossTotal - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormError(null);

    if (!patientId) {
      setFormError('Debe seleccionar un paciente para emitir el presupuesto.');
      return;
    }
    if (!branchId) {
      setFormError('Debe seleccionar una sucursal emisora.');
      return;
    }
    if (items.length === 0) {
      setFormError('Debe agregar al menos un ítem o procedimiento al presupuesto.');
      return;
    }
    if (discountAmount < 0 || !Number.isInteger(discountAmount)) {
      setFormError('El descuento debe ser un monto entero en Guaraníes.');
      return;
    }
    if (discountAmount > grossTotal) {
      setFormError('El descuento no puede superar el subtotal bruto del presupuesto.');
      return;
    }

    const validUntilStr =
      quoteToEditId && existingValidUntil && !validUntilTouched
        ? existingValidUntil
        : addDaysToIsoDate(getTodayAsuncionISO(), validDays);

    const cleanItems = items.map((it) => {
      const qty = Math.max(1, Math.round(it.quantity || 1));
      const unitP = Math.max(0, Math.round(it.unitPrice || 0));
      return {
        serviceId: it.serviceId || undefined,
        toothNumber: it.toothNumber ? Number(it.toothNumber) : undefined,
        description: it.description?.trim() || 'Procedimiento Odontológico',
        quantity: qty,
        unitPrice: unitP,
        subtotal: qty * unitP,
        appliedModality: selectedPlanId ? ('PLAN_SEGURO' as const) : ('PARTICULAR' as const),
        appliedPlanId: selectedPlanId || undefined,
        appliedPlanName: activeSelectedPlan?.name || undefined,
        originalListPrice: it.originalListPrice ?? unitP,
      };
    });

    setIsSaving(true);
    try {
      let savedQuoteId: string | null = null;
      if (quoteToEditId) {
        // Actualizar presupuesto existente
        const updated = dbStore.updateQuote(quoteToEditId, {
          branchId,
          patientId,
          odontologistId: odontologistId || undefined,
          planId: selectedPlanId || null,
          validUntil: validUntilStr,
          notes,
          discountAmount,
          items: cleanItems,
          actorUserId: session?.userId,
        });
        savedQuoteId = updated?.id || null;
      } else {
        // Crear nuevo presupuesto
        const quote = dbStore.createQuote({
          branchId,
          patientId,
          odontologistId: odontologistId || undefined,
          planId: selectedPlanId || null,
          validUntil: validUntilStr,
          notes,
          discountAmount,
          items: cleanItems,
          actorUserId: session?.userId,
        });
        savedQuoteId = quote.id;
      }

      await dbStore.flushPendingSyncStrict();

      if (savedQuoteId && onQuoteCreated) {
        onQuoteCreated(savedQuoteId);
      }
      if (onSaved) {
        onSaved(
          quoteToEditId
            ? 'Presupuesto actualizado y guardado correctamente.'
            : 'Presupuesto emitido y guardado correctamente.'
        );
      }
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar el presupuesto en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-teal-500/20 text-teal-300 rounded-xl">
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                {quoteToEditId ? 'Editar Presupuesto Odontológico' : 'Nuevo Presupuesto Odontológico'}
              </h2>
              <p className="text-xs text-slate-400">
                Cotización oficial con aranceles vigentes en Guaraníes (PYG) y cobertura de planes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Fila 1: Paciente, Sucursal y Odontólogo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paciente Beneficiario <span className="text-red-500">*</span>
              </label>
              <select
                value={patientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium text-slate-900"
              >
                {patients.length === 0 ? (
                  <option value="">No hay pacientes registrados</option>
                ) : (
                  patients.map((p) => {
                    const plan = insurancePlans.find((ip) => ip.id === p.insurancePlanId);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} — C.I. {p.documentNumber} {p.modality === 'PLAN_SEGURO' ? `🛡️ ${plan?.name || 'Seguro'}` : '👤 Particular'}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sucursal Emisora <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900"
              >
                {branches.length === 0 ? (
                  <option value="">Sin sucursales disponibles</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.city})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Odontólogo Tratante
              </label>
              <select
                value={odontologistId}
                onChange={(e) => setOdontologistId(e.target.value)}
                disabled={dentists.length === 0 && !odontologistId}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-900 disabled:opacity-60"
              >
                {(() => {
                  const historicalAssigned =
                    quoteToEditId && odontologistId && !dentists.some((d) => d.id === odontologistId)
                      ? users.find((u) => u.id === odontologistId)
                      : null;
                  if (dentists.length === 0 && !historicalAssigned) {
                    return <option value="">{NO_PROFESSIONALS_MESSAGE}</option>;
                  }
                  return (
                    <>
                      {historicalAssigned && (
                        <option key={historicalAssigned.id} value={historicalAssigned.id}>
                          {formatProfessionalName(historicalAssigned)} (Registro histórico)
                        </option>
                      )}
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatProfessionalOptionLabel(d)}
                        </option>
                      ))}
                    </>
                  );
                })()}
              </select>
              {dentists.length === 0 && (
                <p className="text-[11px] text-amber-700 font-medium mt-1">
                  {NO_PROFESSIONALS_MESSAGE}
                </p>
              )}
            </div>
          </div>

          {/* Fila 2: Selector Explicito y Transparente de Planes y Coberturas (Problema 1 Solucionado) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl ${selectedPlanId ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <label htmlFor="plan-selector" className="text-xs font-bold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                    <span>Plan / Cobertura Odontológica:</span>
                    {selectedPlanId ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Tarifario Preferencial Activo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                        Tarifa Estándar Particular
                      </span>
                    )}
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Aplica automáticamente los precios acordados, copagos o bonificaciones del plan seleccionado.
                  </p>
                </div>
              </div>

              {/* Selector de Plan */}
              <div className="w-full sm:w-72">
                <select
                  id="plan-selector"
                  value={selectedPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className={`w-full text-xs font-semibold p-2.5 rounded-xl border focus:outline-none transition-all ${
                    selectedPlanId
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 focus:ring-2 focus:ring-indigo-500'
                      : 'bg-white border-slate-300 text-slate-800 focus:ring-2 focus:ring-teal-500'
                  }`}
                >
                  <option value="">👤 Particular (Tarifa Estándar de Lista)</option>
                  {insurancePlans.map((ip) => (
                    <option key={ip.id} value={ip.id}>
                      🛡️ {ip.name} ({ip.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner de Cobertura y Ahorro */}
            {selectedPlanId && activeSelectedPlan && (
              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-indigo-900 gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold">{activeSelectedPlan.name}</span>
                  {activeSelectedPlan.coverageTerms && (
                    <p className="text-[11px] text-indigo-700">{activeSelectedPlan.coverageTerms}</p>
                  )}
                </div>
                {totalInsuranceSavings > 0 && (
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-[11px] inline-flex items-center gap-1 border border-emerald-200 shrink-0">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Ahorro total por cobertura: ₲ {totalInsuranceSavings.toLocaleString('es-PY')}</span>
                  </div>
                )}
              </div>
            )}

            {/* Aviso en caso de no haber planes creados aún */}
            {insurancePlans.length === 0 && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
                <Info className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  No hay planes creados en esta organización. El presupuesto se cotizará con tarifa Particular estándar.
                  Puede dar de alta planes en la sección <strong>Tratamientos &gt; Planes &amp; Seguros</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Fila 3: Detalle de Procedimientos & Ítems (Problema 2 Solucionado) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-teal-600" />
                  Detalle de Procedimientos &amp; Aranceles ({items.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Agregar Ítem</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-left text-xs min-w-[580px]">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Servicio / Procedimiento</th>
                    <th className="py-2.5 px-2 w-20 text-center">Pieza FDI</th>
                    <th className="py-2.5 px-2 w-16 text-center">Cant.</th>
                    <th className="py-2.5 px-3 w-32 text-right">Precio Unit. (₲)</th>
                    <th className="py-2.5 px-3 w-32 text-right">Subtotal (₲)</th>
                    <th className="py-2.5 px-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 space-y-1">
                        <select
                          value={it.serviceId || ''}
                          onChange={(e) => handleServiceChange(idx, e.target.value)}
                          className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none font-medium text-slate-900"
                        >
                          <option value="">-- Personalizado / Libre --</option>
                          {services.map((s) => (
                            <option key={s.id} value={s.id}>
                              [{s.category}] {s.name} - ₲ {s.basePrice.toLocaleString('es-PY')}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Descripción detallada del procedimiento"
                          required
                          className="w-full text-xs p-1 bg-transparent border-b border-slate-200 focus:border-teal-500 focus:outline-none text-slate-800"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="11"
                          max="85"
                          placeholder="Ej. 16"
                          value={it.toothNumber || ''}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              'toothNumber',
                              e.target.value ? parseInt(e.target.value, 10) : undefined
                            )
                          }
                          className="w-16 p-1.5 text-xs text-center border border-slate-300 rounded-lg text-slate-900"
                        />
                      </td>

                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          max="32"
                          value={it.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-14 p-1.5 text-xs text-center border border-slate-300 rounded-lg font-semibold text-slate-900"
                        />
                      </td>

                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          inputMode="numeric"
                          value={it.unitPrice}
                          onChange={(e) =>
                            handleItemChange(idx, 'unitPrice', parseInt(e.target.value, 10) || 0)
                          }
                          className={`w-28 p-1.5 text-xs text-right font-medium border rounded-lg ${
                            it.hasSpecialPrice
                              ? 'border-indigo-300 bg-indigo-50/60 font-bold text-indigo-950'
                              : 'border-slate-300 text-slate-900'
                          }`}
                        />
                        {it.hasSpecialPrice && it.originalListPrice && it.originalListPrice > it.unitPrice && (
                          <div className="text-[10px] text-indigo-700 font-medium flex items-center justify-end gap-1 mt-0.5">
                            <span className="line-through text-slate-400">₲ {it.originalListPrice.toLocaleString('es-PY')}</span>
                            <span>🛡️ (-₲ {(it.originalListPrice - it.unitPrice).toLocaleString('es-PY')})</span>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 text-right font-bold text-slate-800">
                        ₲ {it.subtotal.toLocaleString('es-PY')}
                      </td>

                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          title="Eliminar este ítem"
                          className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fila 4: Totales & Términos Financieros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Validez del Presupuesto
                </label>
                <div className="flex items-center gap-2">
                  {[15, 30, 45, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        setValidDays(days);
                        setValidUntilTouched(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        (!quoteToEditId || validUntilTouched) && validDays === days
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {days} días
                    </button>
                  ))}
                </div>
                {quoteToEditId && existingValidUntil && !validUntilTouched && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Se conservará el vencimiento actual ({existingValidUntil}) salvo que elija nuevos días.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Condiciones y Plan de Pagos
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Especificaciones sobre cuotas, materiales o garantía..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none text-slate-800"
                />
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal Bruto:</span>
                <span className="font-semibold text-slate-900">
                  ₲ {grossTotal.toLocaleString('es-PY')}
                </span>
              </div>

              {selectedPlanId && totalInsuranceSavings > 0 && (
                <div className="flex justify-between items-center text-xs text-indigo-700">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Bonificación Plan:</span>
                  </span>
                  <span className="font-bold">
                    -₲ {totalInsuranceSavings.toLocaleString('es-PY')}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span>Descuento Adicional:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">₲</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max={grossTotal}
                    inputMode="numeric"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-28 p-1 text-xs text-right font-medium bg-white border border-slate-300 rounded-lg text-red-600"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-slate-900">Total Presupuestado:</span>
                  <p className="text-[10px] text-slate-500">Exento de IVA según régimen odontológico</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-teal-700">
                    ₲ {finalTotal.toLocaleString('es-PY')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {isSaving
                  ? 'Guardando...'
                  : quoteToEditId
                    ? 'Guardar Cambios del Presupuesto'
                    : 'Emitir Presupuesto Oficial'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
