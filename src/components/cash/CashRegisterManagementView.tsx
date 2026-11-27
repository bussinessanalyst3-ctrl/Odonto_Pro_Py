import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';
import { OpenCashRegisterModal } from './OpenCashRegisterModal.tsx';
import { RecordCashMovementModal } from './RecordCashMovementModal.tsx';
import { CloseCashRegisterModal } from './CloseCashRegisterModal.tsx';
import { CashReceiptModal } from './CashReceiptModal.tsx';
import { HistoricalImportModal } from '../shared/HistoricalImportModal.tsx';
import {
  Plus,
  Lock,
  Unlock,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  AlertCircle,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { StatusLabel, UnderlineTabs } from '../ui/DesignPrimitives.tsx';

export const CashRegisterManagementView: React.FC = () => {
  const { session } = useAuth();
  const [branches, setBranches] = useState(() => dbStore.getBranches());
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    session?.currentBranchId || dbStore.getBranches()[0]?.id || ''
  );

  const [cashRegisters, setCashRegisters] = useState(dbStore.getCashRegisters());
  const [cashMovements, setCashMovements] = useState(dbStore.getCashMovements());
  const [payments, setPayments] = useState(dbStore.getPayments());
  const [users, setUsers] = useState(dbStore.getUsers());
  const [patients, setPatients] = useState(dbStore.getPatients());

  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'receipts'>('current');
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [receiptsPage, setReceiptsPage] = useState<number>(1);
  const RECEIPTS_PAGE_SIZE = 25;

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isHistoricalImportOpen, setIsHistoricalImportOpen] = useState(false);
  const [viewPaymentId, setViewPaymentId] = useState<string | null>(null);
  const [annulPaymentId, setAnnulPaymentId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState<string>('');
  const [annulError, setAnnulError] = useState<string | null>(null);
  const [isAnnulling, setIsAnnulling] = useState<boolean>(false);

  const reloadData = () => {
    const freshBranches = [...dbStore.getBranches()];
    setBranches(freshBranches);
    setSelectedBranchId((prev) =>
      prev && freshBranches.some((b) => b.id === prev)
        ? prev
        : session?.currentBranchId && freshBranches.some((b) => b.id === session.currentBranchId)
          ? session.currentBranchId
          : freshBranches[0]?.id || ''
    );
    setCashRegisters([...dbStore.getCashRegisters()]);
    setCashMovements([...dbStore.getCashMovements()]);
    setPayments([...dbStore.getPayments()]);
    setUsers([...dbStore.getUsers()]);
    setPatients([...dbStore.getPatients()]);
  };

  useEffect(() => {
    return dbStore.subscribe(reloadData);
  }, []);

  // Find active open register for current selected branch
  const activeRegister = cashRegisters.find(
    (cr) => cr.branchId === selectedBranchId && cr.status === 'ABIERTA'
  );

  // Movements of the active register
  const activeMovements = activeRegister
    ? cashMovements.filter((m) => m.cashRegisterId === activeRegister.id)
    : [];

  // Summary calculations for active register
  const cashIngresos = activeMovements
    .filter((m) => m.movementType === 'INGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const cashEgresos = activeMovements
    .filter((m) => m.movementType === 'EGRESO' && m.paymentMethod === 'EFECTIVO')
    .reduce((sum, m) => sum + m.amount, 0);

  const currentCashInDrawer = activeRegister
    ? activeRegister.openingAmount + cashIngresos - cashEgresos
    : 0;

  const totalTurnoIngresos = activeMovements
    .filter((m) => m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalTurnoEgresos = activeMovements
    .filter((m) => m.movementType === 'EGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalTurnoNeto = totalTurnoIngresos - totalTurnoEgresos;

  const totalSipap = activeMovements
    .filter((m) => m.paymentMethod === 'TRANSFERENCIA_SIPAP')
    .reduce((sum, m) => sum + (m.movementType === 'INGRESO' ? m.amount : -m.amount), 0);

  const totalQrYPos = activeMovements
    .filter(
      (m) =>
        m.paymentMethod === 'QR_BANCARIO' ||
        m.paymentMethod === 'TARJETA_DEBITO' ||
        m.paymentMethod === 'TARJETA_CREDITO'
    )
    .reduce((sum, m) => sum + (m.movementType === 'INGRESO' ? m.amount : -m.amount), 0);

  // Active cashier user
  const activeCashier = activeRegister
    ? users.find((u) => u.id === activeRegister.openedBy)
    : null;

  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  // Branch history registers
  const branchHistoryRegisters = cashRegisters.filter(
    (cr) => cr.branchId === selectedBranchId
  );

  // Branch payments + lightweight search filter
  const branchPayments = payments.filter((p) => p.branchId === selectedBranchId);
  const filteredBranchPayments = receiptSearch.trim()
    ? branchPayments.filter((p) => {
        const term = receiptSearch.trim().toLowerCase();
        const pat = patients.find((pt) => pt.id === p.patientId);
        const patName = `${pat?.firstName || ''} ${pat?.lastName || ''}`.toLowerCase();
        const patCi = (pat?.documentNumber || '').toLowerCase();
        return (
          (p.receiptNumber || '').toLowerCase().includes(term) ||
          patName.includes(term) ||
          patCi.includes(term) ||
          (p.notes || '').toLowerCase().includes(term)
        );
      })
    : branchPayments;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1C1F1E] tracking-tight">
            Caja
          </h1>
          <p className="text-xs text-[#6B706D] mt-0.5">
            {currentBranch?.name || 'Sucursal'} · Guaraníes (₲)
          </p>
        </div>

        {/* Branch selector */}
        <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-lg border border-[#E6E2D9] text-xs min-h-[40px]">
          <Building2 className="h-4 w-4 text-[#525755]" />
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-transparent font-medium text-[#1C1F1E] focus:outline-none cursor-pointer"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Cash Register Surface (flat, no card-in-card) */}
      {activeRegister ? (
        <div className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
          <div className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EFECE5]">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusLabel tone="paid" label="Turno abierto" />
                <span className="text-sm font-semibold text-[#1C1F1E]">
                  {currentBranch?.name}
                </span>
              </div>
              <p className="text-xs text-[#6B706D] tabular-nums">
                Abierta por{' '}
                <span className="font-medium text-[#1C1F1E]">
                  {activeCashier?.firstName} {activeCashier?.lastName}
                </span>{' '}
                a las {new Date(activeRegister.openedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} hs · Fondo inicial: ₲ {activeRegister.openingAmount.toLocaleString('es-PY')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo cobro</span>
              </button>

              <button
                onClick={() => setIsCloseModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] bg-white hover:bg-[#F2F0EB] text-[#1C1F1E] border border-[#E6E2D9] rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <Lock className="h-4 w-4 text-[#525755]" />
                <span>Arqueo y cierre</span>
              </button>
            </div>
          </div>

          {/* Continuous Real-time Turn KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EFECE5]">
            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Efectivo en cajón</div>
              <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                ₲ {currentCashInDrawer.toLocaleString('es-PY')}
              </p>
              <span className="text-[11px] text-[#6B706D] tabular-nums">
                Apertura: ₲ {activeRegister.openingAmount.toLocaleString('es-PY')}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Neto del turno</div>
              <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                ₲ {totalTurnoNeto.toLocaleString('es-PY')}
              </p>
              <span className="text-[11px] text-[#6B706D] tabular-nums">
                {activeMovements.filter((m) => m.movementType === 'INGRESO').length} ingresos
                {totalTurnoEgresos > 0 ? ` · -₲ ${totalTurnoEgresos.toLocaleString('es-PY')} egresos` : ''}
              </span>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">Transferencias SIPAP</div>
              <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                ₲ {totalSipap.toLocaleString('es-PY')}
              </p>
              <span className="text-[11px] text-[#6B706D]">Bancos de Paraguay</span>
            </div>

            <div className="px-5 py-4">
              <div className="text-[11px] font-medium text-[#6B706D]">QR y tarjetas</div>
              <p className="text-xl font-semibold text-[#1C1F1E] tabular-nums mt-1">
                ₲ {totalQrYPos.toLocaleString('es-PY')}
              </p>
              <span className="text-[11px] text-[#6B706D]">POS y QR Bancard</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E6E2D9] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusLabel tone="pending" label="Caja cerrada" />
              <span className="text-sm font-semibold text-[#1C1F1E]">
                {currentBranch?.name}
              </span>
            </div>
            <p className="text-xs text-[#6B706D]">
              Abre un turno con fondo inicial para registrar cobros o egresos.
            </p>
          </div>

          <button
            onClick={() => setIsOpenModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-[#0F5C63] hover:bg-[#0B474D] text-white rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            <Unlock className="h-4 w-4" />
            <span>Abrir turno de caja</span>
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <UnderlineTabs
        items={[
          { id: 'current', label: 'Movimientos del turno', count: activeMovements.length },
          { id: 'receipts', label: 'Recibos emitidos', count: branchPayments.length },
          { id: 'history', label: 'Historial y arqueos', count: branchHistoryRegisters.length },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
      />

      {/* Sub-Tab 1: Movements of current turn */}
      {activeTab === 'current' && (
        <div className="bg-white rounded-lg border border-[#E6E2D9] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#EFECE5] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C1F1E]">
              Movimientos del turno activo
            </h3>
            {activeRegister && (
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0F5C63] bg-[#ECF5F5] hover:bg-[#D5EAEA] rounded-md transition-colors border border-[#B9D9DC] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Registrar movimiento</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F0EB] border-b border-[#E6E2D9] text-[#525755] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-3">Medio de pago</th>
                  <th className="py-3 px-3">Referencia</th>
                  <th className="py-3 px-3">Cajero</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE5]">
                {activeMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#6B706D]">
                      <AlertCircle className="h-6 w-6 mx-auto text-[#A0A4A1] mb-2" />
                      {activeRegister
                        ? 'Aún no hay cobros ni egresos en este turno.'
                        : 'Abre un turno para visualizar los movimientos.'}
                    </td>
                  </tr>
                ) : (
                  activeMovements.map((m) => {
                    const performer = users.find((u) => u.id === m.performedBy);
                    const isIngreso = m.movementType === 'INGRESO';

                    return (
                      <tr key={m.id} className="hover:bg-[#F8F7F4] transition-colors">
                        <td className="py-3 px-4 text-[#6B706D] tabular-nums">
                          {new Date(m.createdAt).toLocaleTimeString('es-PY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                              isIngreso
                                ? 'bg-[#F4F8EA] text-[#3F6212] border-[#D7E6B5]'
                                : 'bg-[#FEF2F2] text-[#991B1B] border-[#F5C2C2]'
                            }`}
                          >
                            {isIngreso ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {isIngreso ? 'Ingreso' : 'Egreso'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-medium text-[#1C1F1E]">{m.concept}</td>

                        <td className="py-3 px-3 text-[#525755]">
                          {m.paymentMethod.replace(/_/g, ' ')}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-[#6B706D] tabular-nums">
                          {m.referenceNumber || '—'}
                        </td>

                        <td className="py-3 px-3 text-[#525755]">
                          {performer?.firstName} {performer?.lastName}
                        </td>

                        <td
                          className={`py-3 px-4 text-right font-semibold text-xs tabular-nums ${
                            isIngreso ? 'text-[#1C1F1E]' : 'text-[#B91C1C]'
                          }`}
                        >
                          {isIngreso ? '' : '-'}₲ {m.amount.toLocaleString('es-PY')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Receipts Issued */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recibos de Dinero Emitidos en {currentBranch?.name} ({filteredBranchPayments.length})
            </h3>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsHistoricalImportOpen(true)}
                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Importar Cobros Históricos</span>
              </button>
              <div className="relative flex-1 sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={receiptSearch}
                  onChange={(e) => {
                    setReceiptSearch(e.target.value);
                    setReceiptsPage(1);
                  }}
                  placeholder="Buscar por nro. recibo, paciente o C.I..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Recibo N°</th>
                  <th className="py-3 px-4">Fecha y hora</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-3">Medio de cobro</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE5]">
                {filteredBranchPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#6B706D]">
                      {receiptSearch.trim()
                        ? 'No se encontraron recibos que coincidan con la búsqueda.'
                        : 'No se han emitido recibos en esta sucursal aún.'}
                    </td>
                  </tr>
                ) : (
                  filteredBranchPayments
                    .slice((receiptsPage - 1) * RECEIPTS_PAGE_SIZE, receiptsPage * RECEIPTS_PAGE_SIZE)
                    .map((p) => {
                    const pat = patients.find((pt) => pt.id === p.patientId);
                    const isAnnulled = p.status === 'ANULADO';

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#F8F7F4] transition-colors ${isAnnulled ? 'bg-[#FEF2F2]/40 opacity-80' : ''}`}
                      >
                        <td className={`py-3 px-4 font-semibold tabular-nums ${isAnnulled ? 'text-[#6B706D] line-through' : 'text-[#0F5C63]'}`}>
                          {p.receiptNumber}
                        </td>

                        <td className="py-3 px-4 text-[#6B706D] tabular-nums">
                          {new Date(p.createdAt).toLocaleDateString('es-PY')}{' '}
                          {new Date(p.createdAt).toLocaleTimeString('es-PY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-medium text-[#1C1F1E] block">
                            {pat?.firstName} {pat?.lastName}
                          </span>
                          <span className="text-[11px] text-[#6B706D] tabular-nums">
                            C.I. {pat?.documentNumber}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[#525755]">{p.notes || 'Atención odontológica'}</td>

                        <td className="py-3 px-3 text-[#525755]">
                          {String(p.paymentMethod || '').replace(/_/g, ' ')}
                        </td>

                        <td className={`py-3 px-4 text-right font-semibold text-xs tabular-nums ${isAnnulled ? 'text-[#B91C1C] line-through' : 'text-[#1C1F1E]'}`}>
                          ₲ {p.amount.toLocaleString('es-PY')}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewPaymentId(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0F5C63] bg-[#ECF5F5] hover:bg-[#D5EAEA] rounded-md transition-colors border border-[#B9D9DC] cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Recibo</span>
                            </button>
                            {p.status !== 'ANULADO' ? (
                              <button
                                onClick={() => {
                                  setAnnulPaymentId(p.id);
                                  setAnnulReason('');
                                  setAnnulError(null);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FDE4E4] rounded-md transition-colors border border-[#F5C2C2] cursor-pointer"
                                title="Anular Recibo y Revertir Saldo"
                              >
                                Anular
                              </button>
                            ) : (
                              <StatusLabel tone="danger" label="Anulado" />
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
          {Math.ceil(filteredBranchPayments.length / RECEIPTS_PAGE_SIZE) > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
              <span>
                Mostrando {(receiptsPage - 1) * RECEIPTS_PAGE_SIZE + 1}–
                {Math.min(receiptsPage * RECEIPTS_PAGE_SIZE, filteredBranchPayments.length)} de{' '}
                <strong>{filteredBranchPayments.length}</strong> recibos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={receiptsPage <= 1}
                  onClick={() => setReceiptsPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Anterior</span>
                </button>
                <span className="font-bold text-slate-800">
                  {receiptsPage} / {Math.ceil(filteredBranchPayments.length / RECEIPTS_PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  disabled={receiptsPage >= Math.ceil(filteredBranchPayments.length / RECEIPTS_PAGE_SIZE)}
                  onClick={() =>
                    setReceiptsPage((p) =>
                      Math.min(Math.ceil(filteredBranchPayments.length / RECEIPTS_PAGE_SIZE), p + 1)
                    )
                  }
                  className="px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1 font-semibold"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Cash Registers & Arqueos History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Historial de Turnos de Caja & Balances de Arqueo
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Apertura</th>
                  <th className="py-3 px-4">Cierre</th>
                  <th className="py-3 px-3">Cajero</th>
                  <th className="py-3 px-3 text-right">Fondo Inicial</th>
                  <th className="py-3 px-3 text-right">Esperado</th>
                  <th className="py-3 px-3 text-right">Físico Real</th>
                  <th className="py-3 px-3 text-right">Diferencia</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchHistoryRegisters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No hay registros históricos de caja para esta sucursal.
                    </td>
                  </tr>
                ) : (
                  branchHistoryRegisters.map((cr) => {
                    const opener = users.find((u) => u.id === cr.openedBy);
                    const diff = cr.differenceAmount || 0;
                    const isOpen = cr.status === 'ABIERTA';

                    return (
                      <tr key={cr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {new Date(cr.openedAt).toLocaleDateString('es-PY')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(cr.openedAt).toLocaleTimeString('es-PY', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}hs
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {cr.closedAt ? (
                            <>
                              <div className="font-semibold text-slate-900">
                                {new Date(cr.closedAt).toLocaleDateString('es-PY')}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(cr.closedAt).toLocaleTimeString('es-PY', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}hs
                              </div>
                            </>
                          ) : (
                            <span className="text-emerald-700 font-semibold italic">En curso...</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-700">
                          {opener?.firstName} {opener?.lastName}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-slate-800">
                          ₲ {cr.openingAmount.toLocaleString('es-PY')}
                        </td>

                        <td className="py-3 px-3 text-right font-medium text-slate-800">
                          {cr.closingAmountExpected != null
                            ? `₲ ${cr.closingAmountExpected.toLocaleString('es-PY')}`
                            : '—'}
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {cr.closingAmountReal != null
                            ? `₲ ${cr.closingAmountReal.toLocaleString('es-PY')}`
                            : '—'}
                        </td>

                        <td className="py-3 px-3 text-right font-black">
                          {isOpen ? (
                            '—'
                          ) : diff === 0 ? (
                            <span className="text-emerald-700">₲ 0 (Exacto)</span>
                          ) : diff > 0 ? (
                            <span className="text-blue-700">+₲ {diff.toLocaleString('es-PY')}</span>
                          ) : (
                            <span className="text-red-600">-₲ {Math.abs(diff).toLocaleString('es-PY')}</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isOpen ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Unlock className="h-3 w-3" /> Abierta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              <Lock className="h-3 w-3" /> Cerrada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <OpenCashRegisterModal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        branchId={selectedBranchId}
        onOpened={reloadData}
      />

      {activeRegister && (
        <>
          <RecordCashMovementModal
            isOpen={isMovementModalOpen}
            onClose={() => setIsMovementModalOpen(false)}
            cashRegisterId={activeRegister.id}
            onMovementAdded={reloadData}
          />

          <CloseCashRegisterModal
            isOpen={isCloseModalOpen}
            onClose={() => setIsCloseModalOpen(false)}
            cashRegisterId={activeRegister.id}
            onClosed={reloadData}
          />
        </>
      )}

      <CashReceiptModal
        paymentId={viewPaymentId}
        onClose={() => setViewPaymentId(null)}
      />

      {/* Modal de Anulación de Recibo */}
      {annulPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Anulación de Recibo Oficial</h3>
                <p className="text-xs text-slate-500">Reversión de saldo y contra-asiento de caja</p>
              </div>
            </div>

            {annulError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{annulError}</span>
              </div>
            )}

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Esta acción marcará el recibo como <span className="font-bold text-rose-700">ANULADO</span>, restaurará el saldo pendiente del paciente en su plan de tratamiento y registrará el contra-asiento contable en la caja activa con fines de auditoría forense.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo de Anulación (Requerido):
                </label>
                <textarea
                  value={annulReason}
                  onChange={(e) => setAnnulReason(e.target.value)}
                  placeholder="Ej: Error de digitación en monto, duplicación involuntaria, solicitud del paciente..."
                  rows={3}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isAnnulling}
                onClick={() => {
                  setAnnulPaymentId(null);
                  setAnnulReason('');
                  setAnnulError(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isAnnulling || annulReason.trim().length < 5}
                onClick={async () => {
                  if (annulReason.trim().length < 5) {
                    setAnnulError('El motivo debe contener al menos 5 caracteres.');
                    return;
                  }
                  setIsAnnulling(true);
                  setAnnulError(null);
                  try {
                    if (hasBackendSession()) {
                      const result = await postAuthoritativeAction(`/api/payments/${annulPaymentId}/annul`, {
                        reason: annulReason.trim(),
                      });
                      dbStore.applyAuthoritativeSync(
                        {
                          payments: [result.payment],
                          ...(result.restoredTreatment ? { treatments: [result.restoredTreatment] } : {}),
                          ...(result.counterMovement ? { cashMovements: [result.counterMovement] } : {}),
                          ...(result.reversedCommissions?.length
                            ? { generatedCommissions: result.reversedCommissions }
                            : {}),
                          ...(result.auditLogs?.length ? { auditLogs: result.auditLogs } : {}),
                        },
                        result.stateVersion
                      );
                    } else {
                      dbStore.annulPayment({
                        paymentId: annulPaymentId,
                        reason: annulReason.trim(),
                        actorUserId: session?.userId || dbStore.getUsers()[0]?.id,
                      });
                    }
                    reloadData();
                    setAnnulPaymentId(null);
                    setAnnulReason('');
                    setAnnulError(null);
                  } catch (err: any) {
                    setAnnulError(err.message || 'Error al anular el recibo.');
                  } finally {
                    setIsAnnulling(false);
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAnnulling ? 'Anulando...' : 'Confirmar Anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      <HistoricalImportModal
        isOpen={isHistoricalImportOpen}
        onClose={() => setIsHistoricalImportOpen(false)}
        defaultEntity="payments"
        onImportCompleted={() => reloadData()}
      />
    </div>
  );
};
