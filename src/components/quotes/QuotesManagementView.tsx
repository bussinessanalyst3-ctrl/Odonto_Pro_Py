import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { CreateQuoteModal } from './CreateQuoteModal.tsx';
import { QuoteDetailModal } from './QuoteDetailModal.tsx';
import { resolveOrganizationLegalName } from '../../config/appBrand.ts';
import { formatProfessionalName } from '../../utils/healthProfessional.ts';
import {
  Calculator,
  Search,
  Plus,
  CheckCircle2,
  Printer,
  Send,
  Eye,
  Building2,
  AlertCircle,
  Edit2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EmptyState, StatusLabel, UnderlineTabs } from '../ui/DesignPrimitives.tsx';

interface QuotesManagementViewProps {
  onNavigateToTreatments?: (patientId: string) => void;
}

export const QuotesManagementView: React.FC<QuotesManagementViewProps> = ({
  onNavigateToTreatments,
}) => {
  const { session } = useAuth();
  const [quotes, setQuotes] = useState(dbStore.getQuotes());
  const [patients, setPatients] = useState(dbStore.getPatients());
  const [branches, setBranches] = useState(dbStore.getBranches());
  const [users, setUsers] = useState(dbStore.getUsers());

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const QUOTES_PAGE_SIZE = 20;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [quoteToEditId, setQuoteToEditId] = useState<string | null>(null);
  const [inspectQuoteId, setInspectQuoteId] = useState<string | null>(null);
  const [confirmingApproveId, setConfirmingApproveId] = useState<string | null>(null);
  const [approvingQuoteId, setApprovingQuoteId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    patientId?: string;
  } | null>(null);

  const reloadData = () => {
    setQuotes([...dbStore.getQuotes()]);
    setPatients([...dbStore.getPatients()]);
    setBranches([...dbStore.getBranches()]);
    setUsers([...dbStore.getUsers()]);
  };

  useEffect(() => {
    return dbStore.subscribe(reloadData);
  }, []);

  // Filtered quotes
  const filteredQuotes = quotes.filter((q) => {
    if (selectedBranchId && q.branchId !== selectedBranchId) return false;
    if (selectedStatus !== 'TODOS' && q.status !== selectedStatus) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const patient = patients.find((p) => p.id === q.patientId);
      const patName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.toLowerCase();
      const patCi = (patient?.documentNumber || '').toLowerCase();
      const quoteNum = q.quoteNumber.toLowerCase();

      return (
        quoteNum.includes(term) ||
        patName.includes(term) ||
        patCi.includes(term)
      );
    }
    return true;
  });

  const quotesTotalPages = Math.max(1, Math.ceil(filteredQuotes.length / QUOTES_PAGE_SIZE));
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * QUOTES_PAGE_SIZE,
    currentPage * QUOTES_PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, selectedStatus]);

  // KPIs
  const totalAmountQuotes = quotes.reduce((acc, q) => acc + q.finalAmount, 0);
  const approvedQuotes = quotes.filter((q) => q.status === 'APROBADO');
  const pendingQuotes = quotes.filter((q) => q.status === 'PENDIENTE');
  const conversionRate = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;
  const approvedTotalAmount = approvedQuotes.reduce((acc, q) => acc + q.finalAmount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROBADO':
        return <StatusLabel tone="paid" label="Aprobado" />;
      case 'RECHAZADO':
        return <StatusLabel tone="danger" label="Rechazado" />;
      case 'VENCIDO':
        return <StatusLabel tone="danger" label="Vencido" />;
      default:
        return <StatusLabel tone="pending" label="Pendiente" />;
    }
  };

  const handleQuickApprove = async (qId: string) => {
    if (approvingQuoteId) return;
    setActionFeedback(null);
    setApprovingQuoteId(qId);

    try {
      let generatedPatientId: string | undefined;

      if (hasBackendSession()) {
        const res = await postAuthoritativeAction<{
          quote?: any;
          treatment?: any;
          insuranceClaim?: any;
          auditLogs?: any[];
          stateVersion?: number;
        }>(`/api/quotes/${qId}/approve`, { autoCreateTreatment: true });

        dbStore.applyAuthoritativeSync(
          {
            ...(res.quote ? { quotes: [res.quote] } : {}),
            ...(res.treatment ? { treatments: [res.treatment] } : {}),
            ...(res.insuranceClaim ? { insuranceClaims: [res.insuranceClaim] } : {}),
            ...(res.auditLogs?.length ? { auditLogs: res.auditLogs } : {}),
          },
          res.stateVersion
        );
        generatedPatientId = res.treatment?.patientId;
      } else {
        const res = dbStore.updateQuoteStatus(qId, 'APROBADO', session?.userId, true);
        generatedPatientId = res?.treatment?.patientId;
      }

      setConfirmingApproveId(null);
      reloadData();
      setActionFeedback({
        type: 'success',
        message: 'Presupuesto aprobado y Plan de Tratamiento generado con éxito.',
        patientId: generatedPatientId,
      });
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'No se pudo aprobar el presupuesto.',
      });
    } finally {
      setApprovingQuoteId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1C1F1E] tracking-tight">
            Presupuestos
          </h1>
          <p className="text-xs text-[#6B706D] mt-0.5 tabular-nums">
            {quotes.length} cotizaciones en Guaraníes (₲)
          </p>
        </div>

        <button
          onClick={() => {
            setQuoteToEditId(null);
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold transition-colors min-h-[40px] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo presupuesto</span>
        </button>
      </div>

      {/* Continuous KPI Strip */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EFECE5]">
        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Total cotizado</div>
          <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            ₲ {totalAmountQuotes.toLocaleString('es-PY')}
          </p>
          <p className="text-[11px] text-[#6B706D] mt-0.5 tabular-nums">
            {quotes.length} emitidos
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Aprobados</div>
          <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            ₲ {approvedTotalAmount.toLocaleString('es-PY')}
          </p>
          <p className="text-[11px] text-[#3F6212] font-medium mt-0.5 tabular-nums">
            {approvedQuotes.length} en ejecución
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Pendientes</div>
          <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {pendingQuotes.length}
          </p>
          <p className="text-[11px] text-[#6B706D] mt-0.5">En espera de decisión</p>
        </div>

        <div className="px-5 py-4">
          <div className="text-[11px] font-medium text-[#6B706D]">Tasa de aprobación</div>
          <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
            {conversionRate.toFixed(1)}%
          </p>
          <p className="text-[11px] text-[#6B706D] mt-0.5">Conversión a tratamiento</p>
        </div>
      </div>

      {/* Filters and Underline Status Tabs */}
      <div className="bg-white rounded-lg border border-[#E6E2D9]">
        <div className="px-4 sm:px-5 pt-2 border-b border-[#EFECE5]">
          <UnderlineTabs
            items={[
              { id: 'TODOS', label: 'Todos', count: quotes.length },
              { id: 'PENDIENTE', label: 'Pendientes', count: pendingQuotes.length },
              { id: 'APROBADO', label: 'Aprobados', count: approvedQuotes.length },
              { id: 'RECHAZADO', label: 'Rechazados' },
              { id: 'VENCIDO', label: 'Vencidos' },
            ]}
            activeId={selectedStatus}
            onChange={setSelectedStatus}
            className="border-b-0"
          />
        </div>

        <div className="p-3.5 sm:px-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="relative flex-1 md:max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B706D]" />
            <input
              type="text"
              placeholder="Buscar por número, paciente o C.I..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F8F7F4] border border-[#E6E2D9] rounded-md text-xs text-[#1C1F1E] focus:bg-white focus:border-[#0F5C63] focus:outline-none min-h-[40px]"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#F8F7F4] px-3 py-2 rounded-md border border-[#E6E2D9] text-xs min-h-[40px]">
            <Building2 className="h-3.5 w-3.5 text-[#6B706D]" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-medium text-[#1C1F1E] focus:outline-none cursor-pointer"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`rounded-lg p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            actionFeedback.type === 'success'
              ? 'bg-[#F4F8EA] border-[#D7E6B5] text-[#3F6212]'
              : 'bg-[#FEF2F2] border-[#F5C2C2] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' && actionFeedback.patientId && onNavigateToTreatments && (
              <button
                type="button"
                onClick={() => onNavigateToTreatments(actionFeedback.patientId!)}
                className="px-3 py-1.5 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-md font-semibold transition-colors cursor-pointer"
              >
                Ir a Tratamientos
              </button>
            )}
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="px-2.5 py-1 text-[#525755] hover:text-[#1C1F1E] font-medium cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Quotes Table */}
      <div className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F0EB] border-b border-[#E6E2D9] text-[#525755] font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Presupuesto</th>
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-3">Sucursal y profesional</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">Descuento</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-center">Validez</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE5]">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      icon={Calculator}
                      title="Sin presupuestos"
                      description="No se encontraron presupuestos con los filtros seleccionados."
                      action={
                        <button
                          onClick={() => {
                            setQuoteToEditId(null);
                            setIsCreateModalOpen(true);
                          }}
                          className="px-4 py-2 bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Nuevo presupuesto</span>
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((q) => {
                  const patient = patients.find((p) => p.id === q.patientId);
                  const branch = branches.find((b) => b.id === q.branchId);
                  const odontologist = users.find((u) => u.id === q.odontologistId);

                  const cleanPhone = (patient?.whatsapp || patient?.phone || '').replace(/[^0-9]/g, '');
                  const waPhone = cleanPhone.startsWith('595')
                    ? cleanPhone
                    : cleanPhone.startsWith('0')
                    ? '595' + cleanPhone.substring(1)
                    : '595' + cleanPhone;

                  const activeOrg = dbStore.getActiveOrganization();
                  const orgLegalName = resolveOrganizationLegalName(activeOrg);
                  const waSender = orgLegalName ? ` de ${orgLegalName}` : '';
                  const waText = encodeURIComponent(
                    `Hola ${patient?.firstName || ''}! Le saludamos${waSender}. Adjuntamos su presupuesto ${q.quoteNumber} por ₲ ${q.finalAmount.toLocaleString('es-PY')}.`
                  );
                  const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{q.quoteNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString('es-PY')}
                        </div>
                        {q.planName ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mt-1 max-w-[140px] truncate">
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                            <span className="truncate">{q.planName}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block mt-0.5">👤 Particular</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {patient?.firstName} {patient?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          C.I. {patient?.documentNumber}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium">{branch?.name}</div>
                        <div className="text-[11px] text-teal-700">
                          {odontologist
                            ? formatProfessionalName(odontologist, { lastNameOnly: true })
                            : ((q as any).historicalDoctorName || 'General')}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right text-slate-600">
                        ₲ {q.totalAmount.toLocaleString('es-PY')}
                      </td>

                      <td className="py-3 px-3 text-right text-red-600">
                        {q.discountAmount > 0 ? `-₲ ${q.discountAmount.toLocaleString('es-PY')}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                        ₲ {q.finalAmount.toLocaleString('es-PY')}
                      </td>

                      <td className="py-3 px-3 text-center">{getStatusBadge(q.status)}</td>

                      <td className="py-3 px-3 text-center text-slate-600 text-[11px]">
                        {q.validUntil ? q.validUntil : '30 días'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectQuoteId(q.id)}
                            title="Ver e Imprimir Detalle"
                            className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {q.status === 'PENDIENTE' && (
                            <button
                              onClick={() => {
                                setQuoteToEditId(q.id);
                                setIsCreateModalOpen(true);
                              }}
                              title="Editar Presupuesto"
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Compartir por WhatsApp"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <Send className="h-4 w-4" />
                          </a>

                          {q.status === 'PENDIENTE' && (
                            confirmingApproveId === q.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={approvingQuoteId === q.id}
                                  onClick={() => handleQuickApprove(q.id)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0F5C63] hover:bg-[#0B474D] disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                                >
                                  {approvingQuoteId === q.id ? '...' : 'Confirmar'}
                                </button>
                                <button
                                  type="button"
                                  disabled={approvingQuoteId === q.id}
                                  onClick={() => setConfirmingApproveId(null)}
                                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={Boolean(approvingQuoteId)}
                                onClick={() => setConfirmingApproveId(q.id)}
                                title="Aprobar y Generar Tratamiento"
                                className="px-2 py-1 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 rounded-lg transition-colors shadow-xs"
                              >
                                Aprobar
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {quotesTotalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando {(currentPage - 1) * QUOTES_PAGE_SIZE + 1}–
              {Math.min(currentPage * QUOTES_PAGE_SIZE, filteredQuotes.length)} de{' '}
              <strong>{filteredQuotes.length}</strong> presupuestos
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <span className="font-bold text-slate-800">
                {currentPage} / {quotesTotalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= quotesTotalPages}
                onClick={() => setCurrentPage((p) => Math.min(quotesTotalPages, p + 1))}
                className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateQuoteModal
        isOpen={isCreateModalOpen}
        quoteToEditId={quoteToEditId}
        onClose={() => {
          setIsCreateModalOpen(false);
          setQuoteToEditId(null);
        }}
        onQuoteCreated={(quoteId) => {
          reloadData();
          setInspectQuoteId(quoteId);
        }}
        onSaved={(message) => {
          setActionFeedback({ type: 'success', message });
        }}
      />

      <QuoteDetailModal
        quoteId={inspectQuoteId}
        onClose={() => setInspectQuoteId(null)}
        onStatusUpdated={reloadData}
      />
    </div>
  );
};
