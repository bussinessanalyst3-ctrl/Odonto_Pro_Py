import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { resolveOrganizationLegalName } from '../../config/appBrand.ts';
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Building2,
  User,
  Stethoscope,
  Send,
  AlertCircle,
} from 'lucide-react';

interface QuoteDetailModalProps {
  quoteId: string | null;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

export const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({
  quoteId,
  onClose,
  onStatusUpdated,
}) => {
  const { session } = useAuth();
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setPendingAction(null);
    setActionError(null);
    setIsSubmitting(false);
  }, [quoteId]);

  if (!quoteId) return null;

  const quote = dbStore.getQuotes().find((q) => q.id === quoteId);
  if (!quote) return null;

  const items = dbStore.getQuoteItems(quote.id);
  const patient = dbStore.getPatients().find((p) => p.id === quote.patientId);
  const branch = dbStore.getBranches().find((b) => b.id === quote.branchId);
  const odontologist = dbStore.getUsers().find((u) => u.id === quote.odontologistId);
  const organization = dbStore.getOrganization();
  const orgLegalName = resolveOrganizationLegalName(organization);

  const handleConfirmAction = async () => {
    if (!pendingAction || isSubmitting) return;
    setActionError(null);
    setIsSubmitting(true);

    try {
      if (hasBackendSession()) {
        const endpoint =
          pendingAction === 'approve'
            ? `/api/quotes/${quote.id}/approve`
            : `/api/quotes/${quote.id}/reject`;
        const res = await postAuthoritativeAction<{
          quote?: any;
          treatment?: any;
          insuranceClaim?: any;
          auditLogs?: any[];
          stateVersion?: number;
        }>(endpoint, pendingAction === 'approve' ? { autoCreateTreatment: true } : {});

        dbStore.applyAuthoritativeSync(
          {
            ...(res.quote ? { quotes: [res.quote] } : {}),
            ...(res.treatment ? { treatments: [res.treatment] } : {}),
            ...(res.insuranceClaim ? { insuranceClaims: [res.insuranceClaim] } : {}),
            ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
          },
          res.stateVersion
        );
      } else {
        if (pendingAction === 'approve') {
          dbStore.updateQuoteStatus(quote.id, 'APROBADO', session?.userId, true);
        } else {
          dbStore.updateQuoteStatus(quote.id, 'RECHAZADO', session?.userId, false);
        }
      }

      setPendingAction(null);
      if (onStatusUpdated) onStatusUpdated();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'No se pudo actualizar el estado del presupuesto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const cleanPhone = (patient?.whatsapp || patient?.phone || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone.startsWith('595')
    ? cleanPhone
    : cleanPhone.startsWith('0')
    ? '595' + cleanPhone.substring(1)
    : '595' + cleanPhone;

  const itemsListText = items
    .map(
      (it, idx) =>
        `${idx + 1}. ${it.description}${it.toothNumber ? ` (Pieza FDI ${it.toothNumber})` : ''}: ₲ ${it.subtotal.toLocaleString('es-PY')}`
    )
    .join('%0A');

  const senderText = orgLegalName ? ` de *${orgLegalName}*` : '';
  const branchText = branch?.name ? ` (Sucursal ${branch.name})` : '';
  const waMessage = `Hola ${patient?.firstName}! Le compartimos el presupuesto formal N° ${quote.quoteNumber}${senderText}${branchText}:%0A%0A*Detalle de Procedimientos:*%0A${itemsListText}%0A%0A*Total Presupuestado:* ₲ ${quote.finalAmount.toLocaleString('es-PY')}%0A*Validez:* Hasta ${quote.validUntil || '30 días'}%0A%0AQuedamos a su disposición para coordinar el inicio de su tratamiento.`;

  const waUrl = `https://wa.me/${waPhone}?text=${waMessage}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROBADO':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="h-3.5 w-3.5" /> Rechazado
          </span>
        );
      case 'VENCIDO':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="h-3.5 w-3.5" /> Vencido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="h-3.5 w-3.5" /> Pendiente de Aprobación
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 md:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full my-2 md:my-6 overflow-hidden print:shadow-none print:border-none print:m-0 print:max-w-none">
        {/* Actions Bar (Hidden when printing) */}
        <div className="px-3 py-2.5 md:px-6 md:py-3 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Presupuesto Clínico
            </span>
            <span className="text-xs font-mono font-bold text-teal-300">
              {quote.quoteNumber}
            </span>
            {getStatusBadge(quote.status)}
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
              WhatsApp
            </a>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>

            <button
              onClick={onClose}
              className="p-1.5 md:p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-4 md:p-8 print:p-4 space-y-4 md:space-y-6">
          {/* Clinic Header */}
          <div className="border-b-2 border-slate-800 pb-4 md:pb-6 flex flex-col md:flex-row items-start justify-between gap-3">
            <div>
              {orgLegalName && (
                <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">
                  {orgLegalName}
                </h1>
              )}
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                Clínica Odontológica Integral & Especialidades
              </p>
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                {organization?.taxId && <p>RUC: {organization.taxId}</p>}
                {branch?.name && (
                  <p>
                    Sucursal: {branch.name}{branch.address ? ` — ${branch.address}` : ''}{branch.city ? `, ${branch.city}` : ''}
                  </p>
                )}
                {(branch?.phone || branch?.whatsapp) && (
                  <p>
                    {branch?.phone ? `Tel: ${branch.phone}` : ''}
                    {branch?.phone && branch?.whatsapp ? ' | ' : ''}
                    {branch?.whatsapp ? `WhatsApp: ${branch.whatsapp}` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 inline-block text-left">
                <span className="block text-[10px] uppercase font-bold text-slate-500">
                  Presupuesto N°
                </span>
                <span className="text-base font-black font-mono text-teal-700">
                  {quote.quoteNumber}
                </span>
                <span className="block text-[11px] text-slate-600 mt-1">
                  Fecha: {new Date(quote.createdAt).toLocaleDateString('es-PY')}
                </span>
                <span className="block text-[11px] font-semibold text-amber-700">
                  Válido hasta: {quote.validUntil || '30 días'}
                </span>
              </div>
            </div>
          </div>

          {/* Patient, Odontologist & Plan Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wide">
                Datos del Paciente
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {patient?.firstName} {patient?.lastName}
              </p>
              <p className="text-slate-600">Documento: C.I. {patient?.documentNumber}</p>
              <p className="text-slate-600">Teléfono: {patient?.phone || 'Sin registro'}</p>
              <p className="text-slate-600">Ciudad: {patient?.city || 'Asunción'}</p>
            </div>
            <div>
              <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wide">
                Profesional Responsable
              </span>
              <p className="font-bold text-slate-900 text-sm">
                Dr(a). {odontologist?.firstName} {odontologist?.lastName}
              </p>
              <p className="text-slate-600">
                Registro MSPBS: {odontologist?.medicalLicenseNumber || 'En trámite'}
              </p>
              <p className="text-slate-600">Sede: {branch?.name}</p>
            </div>
            <div>
              <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wide">
                Modalidad & Cobertura
              </span>
              {quote.planName ? (
                <div className="space-y-1">
                  <p className="font-bold text-indigo-900 text-sm flex items-center gap-1">
                    <span>🛡️ {quote.planName}</span>
                  </p>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Tarifario Preferencial Aplicado
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 text-sm">👤 Particular</p>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                    Tarifa Estándar de Lista
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Ítem / Procedimiento</th>
                  <th className="py-2.5 px-2 text-center w-20">Pieza FDI</th>
                  <th className="py-2.5 px-2 text-center w-16">Cant.</th>
                  <th className="py-2.5 px-3 text-right w-32">Precio Unit. (₲)</th>
                  <th className="py-2.5 px-3 text-right w-36 rounded-r-lg">Subtotal (₲)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900">{it.description}</p>
                      {it.appliedPlanName && (
                        <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">
                          🛡️ {it.appliedPlanName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-teal-700">
                      {it.toothNumber ? `Pieza ${it.toothNumber}` : 'General'}
                    </td>
                    <td className="py-3 px-2 text-center font-medium text-slate-700">
                      {it.quantity}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      ₲ {it.unitPrice.toLocaleString('es-PY')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ₲ {it.subtotal.toLocaleString('es-PY')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal General:</span>
                <span className="font-semibold text-slate-800">
                  ₲ {quote.totalAmount.toLocaleString('es-PY')}
                </span>
              </div>
              {quote.discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Descuento Otorgado:</span>
                  <span>- ₲ {quote.discountAmount.toLocaleString('es-PY')}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                <span className="font-black text-slate-900 text-sm">TOTAL A PAGAR:</span>
                <span className="font-black text-teal-700 text-base">
                  ₲ {quote.finalAmount.toLocaleString('es-PY')}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Observations */}
          {quote.notes && (
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-xs">
              <span className="font-bold text-amber-900 block mb-1">
                Términos y Condiciones del Presupuesto:
              </span>
              <p className="text-amber-800 leading-relaxed">{quote.notes}</p>
            </div>
          )}

          {/* Signatures Area for clinical formality */}
          <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-center text-xs">
            <div>
              <div className="border-t border-dashed border-slate-400 w-48 mx-auto mb-1"></div>
              <p className="font-bold text-slate-800">Firma del Odontólogo</p>
              <p className="text-[11px] text-slate-500">
                Reg. MSPBS: {odontologist?.medicalLicenseNumber || 'Profesional Autorizado'}
              </p>
            </div>
            <div>
              <div className="border-t border-dashed border-slate-400 w-48 mx-auto mb-1"></div>
              <p className="font-bold text-slate-800">Firma / Conformidad del Paciente</p>
              <p className="text-[11px] text-slate-500">
                C.I. {patient?.documentNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden when printing) */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 space-y-3 print:hidden">
          {actionError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{actionError}</span>
            </div>
          )}

          {pendingAction && (
            <div className="p-3 bg-white border border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                {pendingAction === 'approve'
                  ? '¿Confirmar aprobación? Se creará automáticamente el Plan de Tratamiento activo.'
                  : '¿Confirmar rechazo de este presupuesto?'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPendingAction(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAction}
                  className={`px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-colors disabled:opacity-60 ${
                    pendingAction === 'approve'
                      ? 'bg-teal-600 hover:bg-teal-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isSubmitting
                    ? 'Procesando...'
                    : pendingAction === 'approve'
                      ? 'Sí, Aprobar y Crear Plan'
                      : 'Sí, Rechazar'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {quote.status === 'PENDIENTE' && (
                <span>* Al aprobar, se creará el Plan de Tratamiento en el módulo clínico.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {quote.status === 'PENDIENTE' && !pendingAction && (
                <>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setActionError(null);
                      setPendingAction('reject');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors border border-red-200 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setActionError(null);
                      setPendingAction('approve');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprobar y Crear Tratamiento
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
