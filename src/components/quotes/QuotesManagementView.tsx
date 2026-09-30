import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { CreateQuoteModal } from './CreateQuoteModal.tsx';
import { QuoteDetailModal } from './QuoteDetailModal.tsx';
import {
  Calculator,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Send,
  Eye,
  Building2,
  TrendingUp,
  FileCheck,
  AlertCircle,
} from 'lucide-react';

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

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [inspectQuoteId, setInspectQuoteId] = useState<string | null>(null);

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

  // KPIs
  const totalAmountQuotes = quotes.reduce((acc, q) => acc + q.finalAmount, 0);
  const approvedQuotes = quotes.filter((q) => q.status === 'APROBADO');
  const pendingQuotes = quotes.filter((q) => q.status === 'PENDIENTE');
  const conversionRate = quotes.length > 0 ? (approvedQuotes.length / quotes.length) * 100 : 0;
  const approvedTotalAmount = approvedQuotes.reduce((acc, q) => acc + q.finalAmount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APROBADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Aprobado
          </span>
        );
      case 'RECHAZADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="h-3 w-3" /> Rechazado
          </span>
        );
      case 'VENCIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="h-3 w-3" /> Vencido
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="h-3 w-3" /> Pendiente
          </span>
        );
    }
  };

  const handleQuickApprove = (qId: string) => {
    if (confirm('¿Aprobar presupuesto y generar automáticamente el Plan de Tratamiento?')) {
      const res = dbStore.updateQuoteStatus(qId, 'APROBADO', session?.userId, true);
      reloadData();
      if (res?.treatment && onNavigateToTreatments) {
        if (confirm('Plan de tratamiento generado con éxito. ¿Desea ir a la vista de tratamientos?')) {
          onNavigateToTreatments(res.treatment.patientId);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Presupuestos Odontológicos (Fase 11)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Guaraníes (PYG)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Generador de cotizaciones formales, conversión a tratamientos y envío por WhatsApp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Nuevo Presupuesto
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Cotizado
              </span>
              <Calculator className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-xl font-black text-slate-900 mt-2">
              ₲ {totalAmountQuotes.toLocaleString('es-PY')}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              En {quotes.length} presupuestos emitidos
            </p>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Presupuestos Aprobados
              </span>
              <FileCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-black text-emerald-800 mt-2">
              ₲ {approvedTotalAmount.toLocaleString('es-PY')}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">
              {approvedQuotes.length} planes en ejecución
            </p>
          </div>

          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Pendientes de Decisión
              </span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-black text-amber-800 mt-2">
              {pendingQuotes.length}
            </p>
            <p className="text-[11px] text-amber-600 mt-1">
              Seguimiento por WhatsApp recomendado
            </p>
          </div>

          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Tasa de Aprobación
              </span>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xl font-black text-blue-800 mt-2">
              {conversionRate.toFixed(1)}%
            </p>
            <p className="text-[11px] text-blue-600 mt-1">
              Conversión de consulta a tratamiento
            </p>
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nro de presupuesto, paciente o C.I..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto justify-end">
          {/* Branch filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent font-medium text-slate-800 focus:outline-none"
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            {['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quotes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4">Presupuesto</th>
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-3">Sucursal & Odontólogo</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">Descuento</th>
                <th className="py-3 px-4 text-right">Total Final (PYG)</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-center">Validez</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No se encontraron presupuestos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((q) => {
                  const patient = patients.find((p) => p.id === q.patientId);
                  const branch = branches.find((b) => b.id === q.branchId);
                  const odontologist = users.find((u) => u.id === q.odontologistId);

                  const cleanPhone = (patient?.whatsapp || patient?.phone || '').replace(/[^0-9]/g, '');
                  const waPhone = cleanPhone.startsWith('595')
                    ? cleanPhone
                    : cleanPhone.startsWith('0')
                    ? '595' + cleanPhone.substring(1)
                    : '595' + cleanPhone;

                  const waUrl = `https://wa.me/${waPhone}?text=Hola%20${patient?.firstName}!%20Le%20saludamos%20de%20OdontoPro.%20Adjuntamos%20su%20presupuesto%20${q.quoteNumber}%20por%20₲%20${q.finalAmount.toLocaleString('es-PY')}.`;

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{q.quoteNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(q.createdAt).toLocaleDateString('es-PY')}
                        </div>
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
                          Dr(a). {odontologist?.lastName || (q as any).historicalDoctorName || 'General'}
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
                            <button
                              onClick={() => handleQuickApprove(q.id)}
                              title="Aprobar y Generar Tratamiento"
                              className="px-2 py-1 text-[11px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-xs"
                            >
                              Aprobar
                            </button>
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
      </div>

      {/* Modals */}
      <CreateQuoteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onQuoteCreated={(quoteId) => {
          reloadData();
          setInspectQuoteId(quoteId);
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
