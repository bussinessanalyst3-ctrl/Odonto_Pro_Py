import React, { useState, useEffect } from 'react';
import { X, Check, ShieldCheck, AlertCircle, FileText, User } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';

interface CreateInsuranceClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateInsuranceClaimModal: React.FC<CreateInsuranceClaimModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();
  const patients = snapshot.patients || [];
  const plans = (snapshot.insurancePlans || []).filter((p) => p.status === 'ACTIVO');
  const services = snapshot.services || [];
  const branches = snapshot.branches || [];

  const insuredPatients = patients.filter((p) => p.modality === 'PLAN_SEGURO' || p.insurancePlanId);
  const eligiblePatients = insuredPatients.length > 0 ? insuredPatients : patients;

  const [patientId, setPatientId] = useState(eligiblePatients[0]?.id || '');
  const [planId, setPlanId] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [toothNumber, setToothNumber] = useState('');
  const [originalListPrice, setOriginalListPrice] = useState(150000);
  const [copayAmount, setCopayAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update plan and member number when patient changes
  useEffect(() => {
    const pat = patients.find((p) => p.id === patientId);
    if (pat) {
      if (pat.insurancePlanId) {
        setPlanId(pat.insurancePlanId);
      } else if (plans[0]) {
        setPlanId(plans[0].id);
      }
      setMemberNumber(pat.insuranceMemberNumber || '');
      if (pat.primaryBranchId) {
        setBranchId(pat.primaryBranchId);
      }
    }
  }, [patientId, patients, plans]);

  // Update prices when service or plan changes
  useEffect(() => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc) {
      const base = svc.basePrice || 150000;
      setOriginalListPrice(base);

      if (planId) {
        const resolved = dbStore.getEffectiveServicePrice(serviceId, patientId, branchId);
        setCopayAmount(resolved.price);
      }
    }
  }, [serviceId, planId, patientId, branchId, services]);

  if (!isOpen) return null;

  const coveredAmount = Math.max(0, originalListPrice - copayAmount);
  const selectedService = services.find((s) => s.id === serviceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!patientId) {
      setError('Seleccione un paciente para el reclamo.');
      return;
    }
    if (!planId) {
      setError('Seleccione el plan o seguro médico responsable.');
      return;
    }
    if (!serviceId) {
      setError('Seleccione la prestación u orden clínica.');
      return;
    }
    if (coveredAmount <= 0) {
      setError('El monto de cobertura a reclamar a la aseguradora debe ser mayor a ₲ 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      dbStore.createInsuranceClaim({
        branchId,
        planId,
        patientId,
        serviceId,
        patientMemberNumber: memberNumber.trim() || undefined,
        serviceName: selectedService?.name || 'Prestación Odontológica',
        toothNumber: toothNumber ? parseInt(toothNumber, 10) : null,
        originalListPrice,
        copayAmount,
        coveredAmount,
        notes: notes.trim() || undefined,
        actorUserId: session?.userId,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al generar el reclamo.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Nuevo Reclamo de Cobertura Odontológica
              </h3>
              <p className="text-xs text-slate-500">
                Generación de comprobante para auditoría y cobro a aseguradora
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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
          {/* Patient Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Paciente Afiliado: <span className="text-red-500">*</span>
            </label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              required
              className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
            >
              {eligiblePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — CI: {p.documentNumber} {p.insuranceMemberNumber ? `(Carnet: ${p.insuranceMemberNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Plan */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Aseguradora / Plan: <span className="text-red-500">*</span>
              </label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                required
                className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} ({pl.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Member Card */}
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                N° de Carnet / Afiliado:
              </label>
              <input
                type="text"
                value={memberNumber}
                onChange={(e) => setMemberNumber(e.target.value)}
                placeholder="Ej: SDB-489201"
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Service & Tooth */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Prestación Odontológica: <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">
                Pieza FDI:
              </label>
              <input
                type="number"
                min="11"
                max="85"
                value={toothNumber}
                onChange={(e) => setToothNumber(e.target.value)}
                placeholder="Ej: 16 o 24"
                className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 space-y-2">
            <span className="text-[11px] font-bold text-indigo-900 block">
              Desglose Económico de la Cobertura (PYG):
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-xl border border-indigo-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Arancel Lista</span>
                <input
                  type="number"
                  value={originalListPrice}
                  onChange={(e) => setOriginalListPrice(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center text-xs font-bold text-slate-800 focus:outline-hidden"
                />
              </div>
              <div className="p-2 bg-white rounded-xl border border-indigo-100">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Copago Paciente</span>
                <input
                  type="number"
                  value={copayAmount}
                  onChange={(e) => setCopayAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center text-xs font-bold text-slate-800 focus:outline-hidden"
                />
              </div>
              <div className="p-2 bg-indigo-100/80 rounded-xl border border-indigo-200">
                <span className="text-[10px] text-indigo-800 font-bold uppercase block">Cobertura Seguro</span>
                <span className="font-extrabold text-indigo-950 text-sm">{formatPYG(coveredAmount)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Observaciones / Datos para Auditoría Médica:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Radiografía periapical adjunta en ficha. Tratamiento finalizado."
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'Generando...' : 'Crear Reclamo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
