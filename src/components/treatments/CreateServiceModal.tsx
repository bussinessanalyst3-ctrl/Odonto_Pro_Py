import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, BookOpen, AlertCircle, Info } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG, validatePygPrice } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceToEdit?: any;
  onSaved?: (message: string) => void;
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
  onSaved,
}) => {
  const { session } = useAuth();

  const [category, setCategory] = useState<string>(SERVICE_CATEGORIES[0]);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [defaultDurationMin, setDefaultDurationMin] = useState<number>(45);
  const [basePriceInput, setBasePriceInput] = useState<string>('200000');
  const [syncCustomBranchPrices, setSyncCustomBranchPrices] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsSaving(false);
    setSyncCustomBranchPrices(false);

    if (serviceToEdit) {
      setCategory(serviceToEdit.category || SERVICE_CATEGORIES[0]);
      setCode(serviceToEdit.code || '');
      setName(serviceToEdit.name || '');
      setDescription(serviceToEdit.description || '');
      setDefaultDurationMin(Number(serviceToEdit.defaultDurationMin) || 45);
      setBasePriceInput(String(Math.round(Number(serviceToEdit.basePrice) || 0)));
    } else {
      setCategory(SERVICE_CATEGORIES[0]);
      setCode('');
      setName('');
      setDescription('');
      setDefaultDurationMin(45);
      setBasePriceInput('200000');
    }
  }, [serviceToEdit, isOpen]);

  const branchCustomOverridesCount = useMemo(() => {
    if (!isOpen || !serviceToEdit) return 0;
    const snap = dbStore.getSnapshot();
    const oldBase = Number(serviceToEdit.basePrice);
    return (snap.branchServices || []).filter(
      (bs) => bs.serviceId === serviceToEdit.id && Number(bs.customPrice) !== oldBase
    ).length;
  }, [isOpen, serviceToEdit]);

  if (!isOpen) return null;

  const parsedPreviewPrice = (() => {
    const trimmed = basePriceInput.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) && Number.isInteger(num) && num > 0 ? num : null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!name.trim()) {
      setError('El nombre del procedimiento es requerido.');
      return;
    }

    const trimmedPrice = basePriceInput.trim();
    if (!trimmedPrice) {
      setError('Debe ingresar un precio base en Guaraníes (PYG).');
      return;
    }

    let validatedPrice: number;
    try {
      validatedPrice = validatePygPrice(Number(trimmedPrice), 'El precio base');
    } catch (validationErr: any) {
      setError(validationErr.message || 'El precio ingresado no es válido.');
      return;
    }

    setIsSaving(true);
    try {
      const priceChanged = Boolean(
        serviceToEdit && Number(serviceToEdit.basePrice) !== validatedPrice
      );

      if (serviceToEdit) {
        dbStore.updateService(
          serviceToEdit.id,
          {
            category,
            code,
            name,
            description,
            defaultDurationMin,
            basePrice: validatedPrice,
          },
          session?.userId,
          {
            syncBranchPrices: syncCustomBranchPrices ? 'all' : 'matching_only',
          }
        );
      } else {
        dbStore.addService({
          category,
          code: code || `SERV-${Math.floor(10 + Math.random() * 90)}`,
          name,
          description,
          defaultDurationMin,
          basePrice: validatedPrice,
          actorUserId: session?.userId,
        });
      }

      await dbStore.flushPendingSyncStrict();

      const confirmationMessage = serviceToEdit
        ? priceChanged
          ? 'Precio actualizado. Se aplicará a los nuevos tratamientos; los ya registrados no cambian.'
          : 'Servicio actualizado correctamente.'
        : 'Servicio agregado al catálogo correctamente.';

      onSaved?.(confirmationMessage);
      onClose();
    } catch (err: any) {
      setError(
        err?.message ||
          'No se pudo guardar el servicio en el servidor. Verifique su conexión e intente nuevamente.'
      );
    } finally {
      setIsSaving(false);
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
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
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
                disabled={isSaving}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              >
                {!SERVICE_CATEGORIES.includes(category) && category && (
                  <option value={category}>{category}</option>
                )}
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
                disabled={isSaving}
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
              disabled={isSaving}
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
                step="1"
                min="1"
                inputMode="numeric"
                value={basePriceInput}
                onChange={(e) => setBasePriceInput(e.target.value)}
                disabled={isSaving}
                required
                className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-teal-700 font-bold mt-1 block">
                {parsedPreviewPrice !== null
                  ? formatPYG(parsedPreviewPrice)
                  : 'Ingrese un monto entero mayor a ₲ 0 (sin decimales)'}
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Duración Estimada en Sillón (min):
              </label>
              <input
                type="number"
                step="5"
                min="5"
                max="240"
                value={defaultDurationMin}
                onChange={(e) => setDefaultDurationMin(parseInt(e.target.value, 10) || 30)}
                disabled={isSaving}
                required
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
              />
            </div>
          </div>

          {serviceToEdit && (
            <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl text-[11px] text-teal-900 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  El cambio de precio solo afecta a <strong>nuevos tratamientos y presupuestos</strong>. Los registros históricos y cobros ya realizados conservan su monto original.
                </span>
              </div>
              {branchCustomOverridesCount > 0 && (
                <label className="flex items-center gap-2 pt-1 border-t border-teal-200/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncCustomBranchPrices}
                    onChange={(e) => setSyncCustomBranchPrices(e.target.checked)}
                    disabled={isSaving}
                    className="rounded border-teal-400 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-medium text-teal-950">
                    Aplicar este nuevo precio también en {branchCustomOverridesCount}{' '}
                    {branchCustomOverridesCount === 1
                      ? 'sucursal con tarifa diferenciada'
                      : 'sucursales con tarifa diferenciada'}
                  </span>
                </label>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Descripción / Protocolo Clínico:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="Detalles sobre materiales, indicaciones previas o número sugerido de citas..."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
              <span>
                {isSaving
                  ? 'Guardando...'
                  : serviceToEdit
                  ? 'Guardar Cambios'
                  : 'Crear Servicio'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

