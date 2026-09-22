import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Sparkles, AlertCircle, Wrench, Shield, ArrowRight } from 'lucide-react';
import { ToothData } from './ToothSVG.tsx';

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

interface ToothConditionModalProps {
  toothNumber: number | null;
  toothData?: ToothData;
  isUpper: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: (toothNumber: number, surface: string, condition: string, material?: string, notes?: string, colorCode?: string) => void;
  onCreateTreatment?: (toothNumber: number, condition: string) => void;
}

export const ToothConditionModal: React.FC<ToothConditionModalProps> = ({
  toothNumber,
  toothData,
  isUpper,
  isOpen,
  onClose,
  onSave,
  onCreateTreatment,
}) => {
  if (!isOpen || toothNumber === null) return null;

  const palatineOrLingual = isUpper ? 'PALATINA' : 'LINGUAL';

  const [selectedSurface, setSelectedSurface] = useState<string>('OCLUSAL');
  const [condition, setCondition] = useState<string>('CARIES');
  const [material, setMaterial] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Prepopulate when surface changes
  useEffect(() => {
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              {toothNumber}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Detalle Clínico - Pieza Dental FDI {toothNumber}
              </h3>
              <p className="text-xs text-slate-500">
                {isUpper ? 'Arcada Superior' : 'Arcada Inferior'} • Odontograma Internacional
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Surface Selector Tabs */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-700 mb-2 block">
            Superficie Anatómica a Intervenir:
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { id: 'GENERAL', label: 'Pieza Total' },
              { id: 'OCLUSAL', label: 'Oclusal / Inc.' },
              { id: 'VESTIBULAR', label: 'Vestibular' },
              { id: palatineOrLingual, label: isUpper ? 'Palatina' : 'Lingual' },
              { id: 'MESIAL', label: 'Mesial' },
              { id: 'DISTAL', label: 'Distal' },
            ].map((surf) => {
              const hasRecorded = !!toothData?.surfaces[surf.id as keyof typeof toothData.surfaces];
              const recordedCond = toothData?.surfaces[surf.id as keyof typeof toothData.surfaces]?.condition;
              const isSelected = selectedSurface === surf.id;

              return (
                <button
                  key={surf.id}
                  type="button"
                  onClick={() => setSelectedSurface(surf.id)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-medium transition-all relative border ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : hasRecorded
                      ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate">{surf.label}</div>
                  {hasRecorded && (
                    <span
                      className={`text-[9px] block truncate font-bold ${
                        isSelected ? 'text-teal-100' : 'text-amber-700'
                      }`}
                    >
                      {recordedCond}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition Picker */}
        <div className="mt-5">
          <label className="text-xs font-semibold text-slate-700 mb-2 block">
            Diagnóstico / Condición Clínica para <span className="text-teal-700 font-bold">{selectedSurface}</span>:
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
                      ? `${item.bg} ring-2 ring-offset-1 shadow-xs`
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

        {/* Material Selection (optional) */}
        {(condition === 'OBTURACION' || condition === 'CORONA' || condition === 'IMPLANTE') && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Material Dental Utilizado:
            </label>
            <select
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
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

        {/* Clinical Notes */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Observaciones Clínicas de la Pieza (Opcional):
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Caries interproximal profunda, cavidad sellada provisionalmente..."
            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />
        </div>

        {/* Quick Treatment Link */}
        {onCreateTreatment && condition !== 'SANO' && (
          <div className="mt-4 p-3 bg-teal-50/70 rounded-2xl border border-teal-200 flex items-center justify-between">
            <div className="text-xs text-teal-900">
              <span className="font-bold">¿Programar Tratamiento?</span>
              <p className="text-[11px] text-teal-700">Crear plan de tratamiento vinculado a la pieza {toothNumber}.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onCreateTreatment(toothNumber, condition);
                onClose();
              }}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
            >
              <span>Tratar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Actions Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClearSurface}
            className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
            title="Limpiar superficie seleccionada a estado Sano"
          >
            <Trash2 className="h-4 w-4" />
            <span>Restablecer</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Guardar en Pieza</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
