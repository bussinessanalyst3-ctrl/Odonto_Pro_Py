import React, { useState } from 'react';
import {
  X,
  Check,
  Trash2,
  Sparkles,
  AlertCircle,
  Wrench,
  Shield,
  ArrowRight,
  Calculator,
  Calendar,
  Clock,
  User,
  History,
  Tag
} from 'lucide-react';
import { ToothData } from './ToothSVG.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';

export const CONDITIONS_CATALOG = [
  { id: 'SANO', label: 'Sano / Normal', color: '#10B981', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  { id: 'CARIES', label: 'Caries Activa', color: '#EF4444', bg: 'bg-red-50 text-red-800 border-red-300' },
  { id: 'OBTURACION', label: 'Obturación / Restauración', color: '#3B82F6', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
  { id: 'CORONA', label: 'Corona Protésica', color: '#F59E0B', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
  { id: 'ENDODONCIA', label: 'Endodoncia / Conducto', color: '#0D9488', bg: 'bg-teal-50 text-teal-800 border-teal-300' },
  { id: 'AUSENTE', label: 'Pieza Ausente / Exodoncia Previa', color: '#6B7280', bg: 'bg-slate-100 text-slate-700 border-slate-300' },
  { id: 'IMPLANTE', label: 'Implante Dental Integrado', color: '#8B5CF6', bg: 'bg-purple-50 text-purple-800 border-purple-300' },
  { id: 'EXTRACCION', label: 'Extracción / Exodoncia Indicada', color: '#DC2626', bg: 'bg-rose-50 text-rose-800 border-rose-300' },
  { id: 'PROTESIS', label: 'Pilar o Tramo Protésico', color: '#F97316', bg: 'bg-orange-50 text-orange-800 border-orange-300' },
];

export const MATERIALS_CATALOG = [
  'Resina Compuesta Fotocurable',
  'Amalgama de Plata',
  'Ionómero de Vidrio',
  'Zirconio Monolítico',
  'Porcelana / Cerámica Pura',
  'Perno de Fibra de Vidrio',
  'Titanio Grado Médico',
  'Acrílico Termopolimerizable',
];

interface ToothClinicalDrawerProps {
  toothNumber: number | null;
  toothData?: ToothData;
  isUpper: boolean;
  isOpen: boolean;
  patientId: string;
  onClose: () => void;
  onSave: (toothNumber: number, surface: string, condition: string, material?: string, notes?: string, colorCode?: string) => void;
  onCreateTreatment?: (toothNumber: number, condition: string) => void;
  onCreateBudget?: (toothNumber: number, condition: string, surface: string) => void;
}

export const ToothClinicalDrawer: React.FC<ToothClinicalDrawerProps> = ({
  toothNumber,
  toothData,
  isUpper,
  isOpen,
  patientId,
  onClose,
  onSave,
  onCreateTreatment,
  onCreateBudget,
}) => {
  if (!isOpen || toothNumber === null) return null;

  const palatineOrLingual = isUpper ? 'PALATINA' : 'LINGUAL';
  const [selectedSurface, setSelectedSurface] = useState<string>('OCLUSAL');
  const [condition, setCondition] = useState<string>('CARIES');
  const [material, setMaterial] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'clinical' | 'history'>('clinical');

  // Buscar tratamientos y presupuestos relacionados con esta pieza y paciente
  const allTreatments = dbStore.getSnapshot().treatments || [];
  const relatedTreatments = allTreatments.filter(
    (t) => t.patientId === patientId && t.toothNumbers?.includes(toothNumber)
  );

  const allQuotes = dbStore.getQuotes() || [];
  const allQuoteItems = dbStore.getQuoteItems() || [];
  const relatedQuoteItems = allQuoteItems.filter((qi) => qi.toothNumber === toothNumber);
  const relatedQuotes = allQuotes.filter(
    (q) => q.patientId === patientId && relatedQuoteItems.some((qi) => qi.quoteId === q.id)
  );

  // Cargar estado inicial según la superficie
  React.useEffect(() => {
    const item = toothData?.surfaces[selectedSurface as keyof typeof toothData.surfaces];
    if (item) {
      setCondition(item.condition || 'CARIES');
      setMaterial(item.material || '');
      setNotes(item.notes || '');
    } else {
      setCondition('CARIES');
      setMaterial('');
      setNotes('');
    }
  }, [selectedSurface, toothData]);

  const handleApply = () => {
    const condObj = CONDITIONS_CATALOG.find((c) => c.id === condition);
    onSave(
      toothNumber,
      selectedSurface,
      condition,
      material || undefined,
      notes || undefined,
      condObj?.color || '#EF4444'
    );
    onClose();
  };

  const handleClearSurface = () => {
    onSave(toothNumber, selectedSurface, 'SANO');
    onClose();
  };

  const currentConditionObj = CONDITIONS_CATALOG.find((c) => c.id === condition);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Cabecera del Drawer */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-xl shadow-sm">
              {toothNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Pieza FDI {toothNumber}
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  {isUpper ? 'Maxilar Superior' : 'Mandíbula Inferior'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Expediente y Diagnóstico Odontológico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pestañas: Diagnóstico vs Historial */}
        <div className="flex border-b border-slate-200 px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('clinical')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'clinical'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Diagnóstico & Intervención</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Historial Clínico ({relatedTreatments.length + relatedQuotes.length})</span>
          </button>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'clinical' ? (
            <>
              {/* Selector de Superficie */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">
                  1. Seleccione la Cara / Superficie Dental:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'GENERAL', label: 'Pieza Total' },
                    { id: 'OCLUSAL', label: 'Oclusal / Inc.' },
                    { id: 'VESTIBULAR', label: 'Vestibular' },
                    { id: palatineOrLingual, label: isUpper ? 'Palatina' : 'Lingual' },
                    { id: 'MESIAL', label: 'Mesial' },
                    { id: 'DISTAL', label: 'Distal' },
                  ].map((surf) => {
                    const hasRecorded = !!toothData?.surfaces[surf.id as keyof typeof toothData.surfaces];
                    const isSelected = selectedSurface === surf.id;
                    const recCondition = toothData?.surfaces[surf.id as keyof typeof toothData.surfaces]?.condition;

                    return (
                      <button
                        key={surf.id}
                        type="button"
                        onClick={() => setSelectedSurface(surf.id)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : hasRecorded
                            ? 'bg-amber-50 text-amber-900 border-amber-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>{surf.label}</div>
                        {hasRecorded && (
                          <div className={`text-[10px] truncate font-bold ${isSelected ? 'text-teal-100' : 'text-amber-700'}`}>
                            {recCondition}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Condición */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-2 block">
                  2. Condición Diagnóstica para <span className="text-teal-700">{selectedSurface}</span>:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {CONDITIONS_CATALOG.map((item) => {
                    const isSelected = condition === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCondition(item.id)}
                        className={`p-2.5 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between border ${
                          isSelected
                            ? `${item.bg} ring-2 ring-teal-600 shadow-xs font-bold`
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.label}</span>
                        </div>
                        {isSelected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Material (para obturaciones, coronas o implantes) */}
              {(condition === 'OBTURACION' || condition === 'CORONA' || condition === 'IMPLANTE') && (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Material Odontológico Aplicado:
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar material --</option>
                    {MATERIALS_CATALOG.map((mat) => (
                      <option key={mat} value={mat}>
                        {mat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  Notas de la Evolución Clínica:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre profundidad de cavidad, pronóstico, etc."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Enlace Directo a Presupuesto y Tratamiento */}
              {condition !== 'SANO' && (
                <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-teal-950">
                        Flujo Integrado: Odontograma ➔ Cotización
                      </h4>
                      <p className="text-[11px] text-teal-700">
                        Crea el presupuesto en Guaraníes con esta pieza y su diagnóstico.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onCreateBudget && (
                      <button
                        type="button"
                        onClick={() => {
                          onCreateBudget(toothNumber, condition, selectedSurface);
                          onClose();
                        }}
                        className="flex-1 py-2 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        <span>Presupuestar Pieza {toothNumber}</span>
                      </button>
                    )}
                    {onCreateTreatment && (
                      <button
                        type="button"
                        onClick={() => {
                          onCreateTreatment(toothNumber, condition);
                          onClose();
                        }}
                        className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Tratamiento</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Historial Clínico de la Pieza */
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Línea de Tiempo y Tratamientos Asociados
              </h4>

              {relatedTreatments.length === 0 && relatedQuotes.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">
                    No se han registrado planes de tratamiento ni presupuestos previos para la Pieza {toothNumber}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {relatedTreatments.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{t.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.status === 'COMPLETADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Inicio: {t.startDate}</span>
                        <span className="font-bold text-teal-800">{formatPYG(t.totalAmount)}</span>
                      </div>
                      {t.notes && <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">{t.notes}</p>}
                    </div>
                  ))}

                  {relatedQuotes.map((q) => (
                    <div
                      key={q.id}
                      className="p-3.5 bg-teal-50/40 border border-teal-200/70 rounded-2xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-950">Presupuesto {q.quoteNumber}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                          {q.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Total: {formatPYG(q.finalAmount)}</span>
                        <span>Vence: {q.validUntil}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie de Acciones */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClearSurface}
            className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
            title="Restablecer superficie a estado sano"
          >
            <Trash2 className="h-4 w-4" />
            <span>Restablecer</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Guardar en Odontograma</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
