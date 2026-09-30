import React, { useState } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { X, Plus, Trash2, Calculator, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';

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

  const dentists = users.filter((u) => u.roleId === 'ODONTOLOGO');

  const [patientId, setPatientId] = useState<string>(initialPatientId || patients[0]?.id || '');
  const [branchId, setBranchId] = useState<string>(session?.currentBranchId || branches[0]?.id || '');
  const [odontologistId, setOdontologistId] = useState<string>(dentists[0]?.id || '');
  const [validDays, setValidDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>(
    'Validez de 30 días. Financiación hasta en 3 cuotas sin intereses con entrega inicial del 40%.'
  );
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  const [items, setItems] = useState<QuoteItemInput[]>([
    {
      serviceId: services[0]?.id || '',
      toothNumber: undefined,
      description: services[0]?.name || 'Consulta y Diagnóstico Odontológico',
      quantity: 1,
      unitPrice: services[0]?.basePrice || 120000,
      subtotal: services[0]?.basePrice || 120000,
    },
  ]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    const firstService = services[0];
    setItems([
      ...items,
      {
        serviceId: firstService?.id || '',
        toothNumber: undefined,
        description: firstService?.name || 'Procedimiento Dental',
        quantity: 1,
        unitPrice: firstService?.basePrice || 150000,
        subtotal: firstService?.basePrice || 150000,
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

    // Check branch custom price
    const branchServices = dbStore.getBranchServices();
    const custom = branchServices.find((bs) => bs.branchId === branchId && bs.serviceId === sId);
    const price = custom?.customPrice || s.basePrice;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      serviceId: sId,
      description: s.name,
      unitPrice: price,
      subtotal: price * newItems[index].quantity,
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
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} — C.I. {p.documentNumber}
                  </option>
                ))}
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
                          className="w-28 p-1.5 text-xs text-right font-medium border border-slate-300 rounded-lg"
                        />
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
