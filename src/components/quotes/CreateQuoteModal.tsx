import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { X, Plus, Trash2, Calculator, Calendar, User, FileText, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string;
  onQuoteCreated?: (quoteId: string) => void;
}

interface QuoteItemInput {
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
  onQuoteCreated,
}) => {
  const { session } = useAuth();
  const patients = dbStore.getPatients();
  const branches = dbStore.getBranches();
  const services = dbStore.getServices();
  const users = dbStore.getUsers();
  const insurancePlans = dbStore.getInsurancePlans(true);

  const dentists = users.filter((u) => u.roleId === 'ODONTOLOGO');

  const [patientId, setPatientId] = useState<string>(initialPatientId || patients[0]?.id || '');
  const [branchId, setBranchId] = useState<string>(session?.currentBranchId || branches[0]?.id || '');
  const [odontologistId, setOdontologistId] = useState<string>(dentists[0]?.id || '');
  const [validDays, setValidDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>(
    'Validez de 30 días. Financiación hasta en 3 cuotas sin intereses con entrega inicial del 40%.'
  );
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Control comercial del presupuesto
  const [quoteModality, setQuoteModality] = useState<'AUTO' | 'PARTICULAR' | 'PLAN_SEGURO'>('AUTO');
  const [quotePlanId, setQuotePlanId] = useState<string>('');

  const currentPatient = patients.find((p) => p.id === patientId);

  // Helper para resolver precio unitario según modalidad
  const calculateItemPrice = (sId: string, qModality: string, qPlanId: string) => {
    const s = services.find((srv) => srv.id === sId);
    if (!s) return { unitPrice: 0, listPrice: 0, modality: 'PARTICULAR' as const, planId: null, planName: null, hasSpecialPrice: false };

    const resolved = dbStore.resolveServicePrice({
      serviceId: sId,
      patientId,
      branchId,
      forcedModality: qModality === 'AUTO' ? undefined : (qModality as any),
      forcedPlanId: qPlanId || undefined,
    });

    return {
      unitPrice: resolved.finalPrice,
      listPrice: resolved.listPrice,
      modality: resolved.modality,
      planId: resolved.planId,
      planName: resolved.planName,
      hasSpecialPrice: resolved.hasSpecialPrice,
    };
  };

  const [items, setItems] = useState<QuoteItemInput[]>(() => {
    const firstService = services[0];
    if (!firstService) {
      return [{
        serviceId: '',
        toothNumber: undefined,
        description: 'Consulta Odontológica',
        quantity: 1,
        unitPrice: 120000,
        subtotal: 120000,
        originalListPrice: 120000,
      }];
    }
    const resolved = dbStore.resolveServicePrice({
      serviceId: firstService.id,
      patientId: initialPatientId || patients[0]?.id || '',
      branchId: session?.currentBranchId || branches[0]?.id || '',
    });
    return [{
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
    }];
  });

  // Cuando cambia el paciente o la modalidad del presupuesto, recalcular los ítems que tengan servicio
  useEffect(() => {
    if (!patientId) return;
    setItems((prevItems) =>
      prevItems.map((it) => {
        if (!it.serviceId) return it;
        const res = calculateItemPrice(it.serviceId, quoteModality, quotePlanId);
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
  }, [patientId, branchId, quoteModality, quotePlanId]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const firstService = services[0];
    if (!firstService) return;
    const res = calculateItemPrice(firstService.id, quoteModality, quotePlanId);
    setItems([
      ...items,
      {
        serviceId: firstService.id,
        toothNumber: undefined,
        description: firstService.name,
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
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleServiceChange = (index: number, sId: string) => {
    const s = services.find((srv) => srv.id === sId);
    if (!s) return;

    const res = calculateItemPrice(sId, quoteModality, quotePlanId);
    const newItems = [...items];
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
    const current = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(value) : current.quantity;
      const p = field === 'unitPrice' ? Number(value) : current.unitPrice;
      current.subtotal = q * p;
    }

    newItems[index] = current;
    setItems(newItems);
  };

  const grossTotal = items.reduce((sum, it) => sum + it.subtotal, 0);
  const totalInsuranceSavings = items.reduce((sum, it) => {
    const orig = it.originalListPrice ?? it.unitPrice;
    return sum + Math.max(0, (orig - it.unitPrice) * it.quantity);
  }, 0);
  const finalTotal = Math.max(0, grossTotal - discountAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !branchId || items.length === 0) return;

    const d = new Date();
    d.setDate(d.getDate() + validDays);
    const validUntilStr = d.toISOString().split('T')[0];

    const quote = dbStore.createQuote({
      branchId,
      patientId,
      odontologistId: odontologistId || undefined,
      validUntil: validUntilStr,
      notes,
      discountAmount,
      items: items.map((it) => ({
        serviceId: it.serviceId || undefined,
        toothNumber: it.toothNumber ? Number(it.toothNumber) : undefined,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
        appliedModality: it.appliedModality,
        appliedPlanId: it.appliedPlanId || undefined,
        appliedPlanName: it.appliedPlanName || undefined,
        originalListPrice: it.originalListPrice ?? it.unitPrice,
      })),
      actorUserId: session?.userId,
    });

    if (onQuoteCreated) {
      onQuoteCreated(quote.id);
    }
    onClose();
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
              <h2 className="text-base font-bold text-white">Nuevo Presupuesto Odontológico</h2>
              <p className="text-xs text-slate-400">
                Cotización oficial con aranceles vigentes en Guaraníes (PYG)
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
          {/* Header metadata row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Paciente Beneficiario <span className="text-red-500">*</span>
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
              >
                {patients.map((p) => {
                  const plan = insurancePlans.find((ip) => ip.id === p.insurancePlanId);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} — C.I. {p.documentNumber} {p.modality === 'PLAN_SEGURO' ? `🛡️ ${plan?.name || 'Seguro'}` : '👤 Particular'}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sucursal Emisora <span className="text-red-500">*</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Odontólogo Tratante
              </label>
              <select
                value={odontologistId}
                onChange={(e) => setOdontologistId(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.firstName} {d.lastName} {d.medicalLicenseNumber ? `(Reg: ${d.medicalLicenseNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modalidad Comercial y Cobertura Banner */}
          {currentPatient && (
            <div className={`p-3.5 rounded-2xl border text-xs transition-all ${
              (quoteModality === 'PLAN_SEGURO' || (quoteModality === 'AUTO' && currentPatient.modality === 'PLAN_SEGURO'))
                ? 'bg-indigo-50/70 border-indigo-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className={`h-4 w-4 ${
                    (quoteModality === 'PLAN_SEGURO' || (quoteModality === 'AUTO' && currentPatient.modality === 'PLAN_SEGURO'))
                      ? 'text-indigo-600'
                      : 'text-slate-400'
                  }`} />
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Modalidad: {(quoteModality === 'PLAN_SEGURO' || (quoteModality === 'AUTO' && currentPatient.modality === 'PLAN_SEGURO')) ? 'Plan / Seguro Odontológico' : 'Particular (Precio Lista)'}</span>
                      {totalInsuranceSavings > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-emerald-600" />
                          <span>Ahorro Cobertura: ₲ {totalInsuranceSavings.toLocaleString('es-PY')}</span>
                        </span>
                      )}
                    </div>
                    {currentPatient.modality === 'PLAN_SEGURO' && (
                      <span className="text-[11px] text-indigo-800 font-medium block mt-0.5">
                        Plan Afiliado: {insurancePlans.find((ip) => ip.id === currentPatient.insurancePlanId)?.name || 'Seguro Activo'}
                        {currentPatient.insuranceMemberNumber ? ` • Carnet: ${currentPatient.insuranceMemberNumber}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <span className="text-[10px] text-slate-500 font-medium">Cotizar con:</span>
                  <select
                    value={quoteModality}
                    onChange={(e) => setQuoteModality(e.target.value as any)}
                    className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="AUTO">Automático (Según ficha)</option>
                    <option value="PLAN_SEGURO">🛡️ Plan / Seguro</option>
                    <option value="PARTICULAR">👤 Particular (Lista)</option>
                  </select>
                </div>
              </div>

              {quoteModality === 'PLAN_SEGURO' && !currentPatient.insurancePlanId && (
                <div className="mt-2 pt-2 border-t border-indigo-100 flex items-center gap-2">
                  <label className="text-[10px] font-semibold text-indigo-900">Seleccionar Plan:</label>
                  <select
                    value={quotePlanId}
                    onChange={(e) => setQuotePlanId(e.target.value)}
                    className="text-xs bg-white border border-indigo-200 rounded-lg px-2 py-1 text-indigo-950 font-medium"
                  >
                    {insurancePlans.map((ip) => (
                      <option key={ip.id} value={ip.id}>
                        {ip.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Line items section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-teal-600" />
                Detalle de Procedimientos & Aranceles
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Ítem
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
                          className="w-full text-xs p-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
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
                          className="w-full text-xs p-1 bg-transparent border-b border-slate-200 focus:border-teal-500 focus:outline-none"
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
                          className="w-16 p-1.5 text-xs text-center border border-slate-300 rounded-lg"
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
                          className="w-14 p-1.5 text-xs text-center border border-slate-300 rounded-lg"
                        />
                      </td>

                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="5000"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) =>
                            handleItemChange(idx, 'unitPrice', parseInt(e.target.value, 10) || 0)
                          }
                          className={`w-28 p-1.5 text-xs text-right font-medium border rounded-lg ${
                            it.hasSpecialPrice
                              ? 'border-emerald-300 bg-emerald-50/50 font-bold text-emerald-950'
                              : 'border-slate-300'
                          }`}
                        />
                        {it.hasSpecialPrice && it.originalListPrice && it.originalListPrice > it.unitPrice && (
                          <div className="text-[10px] text-emerald-700 font-medium flex items-center justify-end gap-1 mt-0.5">
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
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded-md transition-colors"
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

          {/* Totals & Financial terms row */}
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
                      onClick={() => setValidDays(days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        validDays === days
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {days} días
                    </button>
                  ))}
                </div>
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
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Calculations Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-600">
                <span>Subtotal Bruto:</span>
                <span className="font-semibold text-slate-900">
                  ₲ {grossTotal.toLocaleString('es-PY')}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <span>Descuento Comercial:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">₲</span>
                  <input
                    type="number"
                    step="10000"
                    min="0"
                    max={grossTotal}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseInt(e.target.value, 10) || 0)}
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

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl transition-all shadow-md shadow-teal-700/20 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Emitir Presupuesto Oficial</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
