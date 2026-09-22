import React, { useState } from 'react';
import { X, Check, BookOpen, AlertCircle } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: any;
}

const SERVICE_CATEGORIES = [
  'Diagnóstico y Prevención',
  'Operatoria Dental',
  'Endodoncia',
  'Periodoncia',
  'Ortodoncia',
  'Cirugía Bucal',
  'Prótesis Dental',
  'Implantología',
  'Estética Dental',
  'Odontopediatría',
];

export const CreateServiceModal: React.FC<CreateServiceModalProps> = ({
  isOpen,
  onClose,
  serviceToEdit,
}) => {
  const { session } = useAuth();

  const [category, setCategory] = useState<string>(serviceToEdit?.category || SERVICE_CATEGORIES[0]);
  const [code, setCode] = useState<string>(serviceToEdit?.code || '');
  const [name, setName] = useState<string>(serviceToEdit?.name || '');
  const [description, setDescription] = useState<string>(serviceToEdit?.description || '');
  const [defaultDurationMin, setDefaultDurationMin] = useState<number>(serviceToEdit?.defaultDurationMin || 45);
  const [basePrice, setBasePrice] = useState<number>(serviceToEdit?.basePrice || 200000);

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del procedimiento es requerido.');
      return;
    }
    if (basePrice <= 0) {
      setError('El precio base debe ser mayor a ₲ 0.');
      return;
    }

    try {
      if (serviceToEdit) {
        dbStore.updateService(
          serviceToEdit.id,
          {
            category,
            code,
            name,
            description,
            defaultDurationMin,
            basePrice,
          },
          session?.userId
        );
      } else {
        dbStore.addService({
          category,
          code: code || `SERV-${Math.floor(10 + Math.random() * 90)}`,
          name,
          description,
          defaultDurationMin,
          basePrice,
          actorUserId: session?.userId,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el servicio.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {serviceToEdit ? 'Editar Servicio Odontológico' : 'Nuevo Servicio en Catálogo'}
              </h3>
              <p className="text-xs text-slate-500">
                Precios e intervenciones estandarizadas en Guaraníes (PYG)
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

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Categoría Especializada:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Código de Procedimiento:
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: REST-03"
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Nombre del Tratamiento / Procedimiento:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Reconstrucción dental con perno de fibra y corona"
              required
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Precio Base en Guaraníes (PYG):
              </label>
              <input
                type="number"
                step="5000"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(parseInt(e.target.value, 10) || 0)}
                required
                className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-teal-700 font-bold mt-0.5 block">
                {formatPYG(basePrice)}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Duración Estimada en Sillón (min):
              </label>
              <input
                type="number"
                step="5"
                min="10"
                max="240"
                value={defaultDurationMin}
                onChange={(e) => setDefaultDurationMin(parseInt(e.target.value, 10) || 30)}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Descripción / Protocolo Clínico:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre materiales, indicaciones previas o número sugerido de citas..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>{serviceToEdit ? 'Guardar Cambios' : 'Crear Servicio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
