import React, { useState, useEffect } from 'react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { OpenCashRegisterModal } from './OpenCashRegisterModal.tsx';
import { RecordCashMovementModal } from './RecordCashMovementModal.tsx';
import { CloseCashRegisterModal } from './CloseCashRegisterModal.tsx';
import { CashReceiptModal } from './CashReceiptModal.tsx';
import {
  DollarSign,
  Plus,
  Lock,
  Unlock,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Send,
  QrCode,
  CreditCard,
  Printer,
  History,
  Receipt,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const CashRegisterManagementView: React.FC = () => {
  const { session } = useAuth();
  const branches = dbStore.getBranches();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    session?.currentBranchId || branches[0]?.id || ''
  );

  const [cashRegisters, setCashRegisters] = useState(dbStore.getCashRegisters());
  const [cashMovements, setCashMovements] = useState(dbStore.getCashMovements());
  const [payments, setPayments] = useState(dbStore.getPayments());
  const [users, setUsers] = useState(dbStore.getUsers());
  const [patients, setPatients] = useState(dbStore.getPatients());

  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'receipts'>('current');

  // Modals state
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [viewPaymentId, setViewPaymentId] = useState<string | null>(null);
  const [annulPaymentId, setAnnulPaymentId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState<string>('');
  const [annulError, setAnnulError] = useState<string | null>(null);
  const [isAnnulling, setIsAnnulling] = useState<boolean>(false);

  const reloadData = () => {
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

  const totalSipap = activeMovements
    .filter((m) => m.paymentMethod === 'TRANSFERENCIA_SIPAP' && m.movementType === 'INGRESO')
    .reduce((sum, m) => sum + m.amount, 0);

  const totalQrYPos = activeMovements
    .filter(
      (m) =>
        (m.paymentMethod === 'QR_BANCARIO' ||
          m.paymentMethod === 'TARJETA_DEBITO' ||
          m.paymentMethod === 'TARJETA_CREDITO') &&
        m.movementType === 'INGRESO'
    )
    .reduce((sum, m) => sum + m.amount, 0);

  // Active cashier user
  const activeCashier = activeRegister
    ? users.find((u) => u.id === activeRegister.openedBy)
    : null;

  const currentBranch = branches.find((b) => b.id === selectedBranchId);

  // Branch history registers
  const branchHistoryRegisters = cashRegisters.filter(
    (cr) => cr.branchId === selectedBranchId
  );

  // Branch payments
  const branchPayments = payments.filter((p) => p.branchId === selectedBranchId);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Caja Diaria & Pagos (Fase 12)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Guaraníes (PYG)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de apertura, cobros por SIPAP, QR y efectivo, arqueos y emisión de recibos
              </p>
            </div>
          </div>

          {/* Branch selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-300 text-xs">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span className="text-slate-500 font-medium">Sucursal:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Active Cash Register Banner */}
        <div className="mt-6">
          {activeRegister ? (
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Unlock className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-950 text-sm">
                        Turno de Caja Abierto en {currentBranch?.name}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-200 text-emerald-900">
                        ACTIVA
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Abierta por{' '}
                      <span className="font-semibold">
                        {activeCashier?.firstName} {activeCashier?.lastName}
                      </span>{' '}
                      el {new Date(activeRegister.openedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}hs
                      con fondo inicial de ₲ {activeRegister.openingAmount.toLocaleString('es-PY')}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMovementModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo Cobro / Movimiento
                  </button>

                  <button
                    onClick={() => setIsCloseModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    <Lock className="h-4 w-4" />
                    Arqueo & Cierre de Caja
                  </button>
                </div>
              </div>

              {/* Real-time turn KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-emerald-200/60">
                <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Efectivo en Cajón
                  </span>
                  <p className="text-lg font-black text-emerald-800 mt-1">
                    ₲ {currentCashInDrawer.toLocaleString('es-PY')}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    Apertura: ₲ {activeRegister.openingAmount.toLocaleString('es-PY')}
                  </span>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    Total Recaudado Hoy
                  </span>
                  <p className="text-lg font-black text-slate-900 mt-1">
                    ₲ {totalTurnoIngresos.toLocaleString('es-PY')}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {activeMovements.filter((m) => m.movementType === 'INGRESO').length} cobros
                  </span>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                    <Send className="h-3 w-3" /> Cobros SIPAP
                  </span>
                  <p className="text-lg font-black text-blue-800 mt-1">
                    ₲ {totalSipap.toLocaleString('es-PY')}
                  </p>
                  <span className="text-[10px] text-blue-600">Transferencias</span>
                </div>

                <div className="bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1">
                    <QrCode className="h-3 w-3" /> QR & Tarjetas
                  </span>
                  <p className="text-lg font-black text-teal-800 mt-1">
                    ₲ {totalQrYPos.toLocaleString('es-PY')}
                  </p>
                  <span className="text-[10px] text-teal-600">Pagos POS / QR</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-amber-500 text-white rounded-xl">
                  <Lock className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    No hay un turno de caja abierto en {currentBranch?.name}
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Debe realizar la apertura de turno con un fondo de cambio inicial para registrar cobros o gastos.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpenModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shrink-0"
              >
                <Unlock className="h-4 w-4" />
                Abrir Turno de Caja
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'current'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Banknote className="h-4 w-4" />
          <span>Movimientos del Turno Actual ({activeMovements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'receipts'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Recibos Emitidos ({branchPayments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Historial de Cajas & Arqueos ({branchHistoryRegisters.length})</span>
        </button>
      </div>

      {/* Sub-Tab 1: Movements of current turn */}
      {activeTab === 'current' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Asientos Contables del Turno Activo
            </h3>
            {activeRegister && (
              <button
                onClick={() => setIsMovementModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Registrar Movimiento
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-4">Concepto / Motivo</th>
                  <th className="py-3 px-3">Medio de Pago</th>
                  <th className="py-3 px-3">Referencia</th>
                  <th className="py-3 px-3">Cajero</th>
                  <th className="py-3 px-4 text-right">Monto (PYG)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <AlertCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                      {activeRegister
                        ? 'No se han registrado cobros o egresos en este turno aún.'
                        : 'No hay turno activo para visualizar movimientos.'}
                    </td>
                  </tr>
                ) : (
                  activeMovements.map((m) => {
                    const performer = users.find((u) => u.id === m.performedBy);
                    const isIngreso = m.movementType === 'INGRESO';

                    return (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('es-PY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isIngreso
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {isIngreso ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {m.movementType}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-medium text-slate-900">{m.concept}</td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {m.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {m.referenceNumber || '—'}
                        </td>

                        <td className="py-3 px-3 text-slate-600">
                          {performer?.firstName} {performer?.lastName}
                        </td>

                        <td
                          className={`py-3 px-4 text-right font-black text-sm ${
                            isIngreso ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {isIngreso ? '+' : '-'}₲ {m.amount.toLocaleString('es-PY')}
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
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recibos de Dinero Emitidos en {currentBranch?.name}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4">Recibo N°</th>
                  <th className="py-3 px-4">Fecha & Hora</th>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-3">Medio de Cobro</th>
                  <th className="py-3 px-4 text-right">Monto (PYG)</th>
                  <th className="py-3 px-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branchPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No se han emitido recibos en esta sucursal aún.
                    </td>
                  </tr>
                ) : (
                  branchPayments.map((p) => {
                    const pat = patients.find((pt) => pt.id === p.patientId);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-teal-800">
                          {p.receiptNumber}
                        </td>

                        <td className="py-3 px-4 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString('es-PY')}{' '}
                          {new Date(p.createdAt).toLocaleTimeString('es-PY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">
                            {pat?.firstName} {pat?.lastName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            C.I. {pat?.documentNumber}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-700">{p.notes || 'Atención Odontológica'}</td>

                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {p.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                          ₲ {p.amount.toLocaleString('es-PY')}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setViewPaymentId(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200"
                            >
                              <Printer className="h-3 w-3" />
                              Ver Recibo
                            </button>
                            {p.status !== 'ANULADO' ? (
                              <button
                                onClick={() => {
                                  setAnnulPaymentId(p.id);
                                  setAnnulReason('');
                                  setAnnulError(null);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                                title="Anular Recibo y Revertir Saldo"
                              >
                                Anular
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-black text-rose-700 bg-rose-100 rounded-md border border-rose-200">
                                ANULADO
                              </span>
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
                onClick={() => {
                  if (annulReason.trim().length < 5) {
                    setAnnulError('El motivo debe contener al menos 5 caracteres.');
                    return;
                  }
                  setIsAnnulling(true);
                  try {
                    dbStore.annulPayment({
                      paymentId: annulPaymentId,
                      reason: annulReason.trim(),
                      actorUserId: session?.userId || dbStore.getUsers()[0]?.id,
                    });
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
    </div>
  );
};
