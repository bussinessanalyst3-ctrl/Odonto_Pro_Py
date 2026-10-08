import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Shield,
  Landmark,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Printer,
  Download,
  Building2,
  ArrowRight,
  TrendingUp,
  DollarSign,
  UserCheck,
  Check,
  XCircle,
  RotateCw
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { SettleClaimsBatchModal } from './SettleClaimsBatchModal.tsx';
import { ClaimSheetModal } from './ClaimSheetModal.tsx';
import { CreateInsuranceClaimModal } from './CreateInsuranceClaimModal.tsx';

export const InsuranceClaimsTab: React.FC = () => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();

  const plans = snapshot.insurancePlans || [];
  const rawClaims = snapshot.insuranceClaims || [];
  const patients = snapshot.patients || [];
  const branches = snapshot.branches || [];

  // Filters
  const [selectedPlanId, setSelectedPlanId] = useState<string>('TODOS');
  const [selectedStatus, setSelectedStatus] = useState<string>('TODOS');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected claims for batch settlement / export
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);

  // Modals
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filtered claims memo
  const filteredClaims = useMemo(() => {
    return rawClaims.filter((claim) => {
      if (selectedPlanId !== 'TODOS' && claim.planId !== selectedPlanId) return false;
      if (selectedStatus !== 'TODOS' && claim.status !== selectedStatus) return false;
      if (selectedBranchId !== 'TODAS' && claim.branchId !== selectedBranchId) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pat = patients.find((p) => p.id === claim.patientId);
        const patName = pat ? `${pat.firstName} ${pat.lastName}`.toLowerCase() : '';
        const patDoc = pat ? pat.documentNumber.toLowerCase() : '';
        const matchNumber = claim.claimNumber && claim.claimNumber.toLowerCase().includes(q);
        const matchCard = claim.patientMemberNumber && claim.patientMemberNumber.toLowerCase().includes(q);
        const matchService = claim.serviceName && claim.serviceName.toLowerCase().includes(q);

        if (!patName.includes(q) && !patDoc.includes(q) && !matchNumber && !matchCard && !matchService) {
          return false;
        }
      }

      return true;
    });
  }, [rawClaims, selectedPlanId, selectedStatus, selectedBranchId, searchQuery, patients]);

  // Overall financial metrics
  const metrics = useMemo(() => {
    const totalClaimed = rawClaims.reduce((s, c) => s + (c.coveredAmount || 0), 0);
    const settledAmount = rawClaims
      .filter((c) => c.status === 'LIQUIDADO_COBRADO')
      .reduce((s, c) => s + (c.coveredAmount || 0), 0);
    const pendingAmount = rawClaims
      .filter((c) => c.status !== 'LIQUIDADO_COBRADO' && c.status !== 'RECHAZADO')
      .reduce((s, c) => s + (c.coveredAmount || 0), 0);
    const approvedAmount = rawClaims
      .filter((c) => c.status === 'APROBADO')
      .reduce((s, c) => s + (c.coveredAmount || 0), 0);

    return {
      totalClaimed,
      settledAmount,
      pendingAmount,
      approvedAmount,
      countTotal: rawClaims.length,
      countPending: rawClaims.filter((c) => c.status === 'PENDIENTE_ENVIO').length,
      countAuditing: rawClaims.filter((c) => c.status === 'EN_AUDITORIA').length,
      countApproved: rawClaims.filter((c) => c.status === 'APROBADO').length,
      countSettled: rawClaims.filter((c) => c.status === 'LIQUIDADO_COBRADO').length,
    };
  }, [rawClaims]);

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClaimIds(filteredClaims.map((c) => c.id));
    } else {
      setSelectedClaimIds([]);
    }
  };

  const handleToggleClaim = (claimId: string) => {
    setSelectedClaimIds((prev) =>
      prev.includes(claimId) ? prev.filter((id) => id !== claimId) : [...prev, claimId]
    );
  };

  // Change individual claim status
  const handleStatusChange = (claimId: string, newStatus: any) => {
    dbStore.updateInsuranceClaimStatus(claimId, newStatus, {
      actorUserId: session?.userId,
    });
  };

  const selectedClaimsList = rawClaims.filter((c) => selectedClaimIds.includes(c.id));
  const activePlanForBatch = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reclamado */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Coberturas Reclamadas
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {formatPYG(metrics.totalClaimed)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.countTotal} prestaciones con cobertura registrada
          </p>
        </div>

        {/* Liquidado / Cobrado en Banco */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cobrado / Liquidado en Banco
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2">
            {formatPYG(metrics.settledAmount)}
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>{metrics.countSettled} prestaciones canceladas vía SIPAP</span>
          </p>
        </div>

        {/* Pendiente por Cobrar a Aseguradoras */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cuentas por Cobrar Aseguradoras
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-800 mt-2">
            {formatPYG(metrics.pendingAmount)}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            {metrics.countPending} pendientes de envío • {metrics.countAuditing} en auditoría
          </p>
        </div>

        {/* Aprobadas Listas para Cobro */}
        <div className="p-4 bg-white rounded-3xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Aprobadas Listas para Liquidar
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 mt-2">
            {formatPYG(metrics.approvedAmount)}
          </div>
          <p className="text-[11px] text-blue-700 font-medium mt-1">
            {metrics.countApproved} prestaciones con auditoría conforme
          </p>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Actions & Filters Toolbar */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Landmark className="h-5 w-5 text-indigo-600" />
                <span>Liquidaciones de Seguros & Reclamos de Cobertura (Claims)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Control de planillas quincenales/mensuales, auditoría médica, conciliación bancaria SIPAP y facturación a aseguradoras en Paraguay.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSheetModalOpen(true)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span>Planilla Oficial Remesa</span>
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nuevo Reclamo Manual</span>
              </button>

              {selectedClaimIds.length > 0 && (
                <button
                  onClick={() => setIsSettleModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer animate-in zoom-in-95 duration-150"
                >
                  <Landmark className="h-4 w-4" />
                  <span>Liquidar Lote ({selectedClaimIds.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="pt-2 flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por paciente, cédula C.I., N° carnet, N° de reclamo o prestación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Plan Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
              >
                <option value="TODOS">Todas las Aseguradoras ({plans.length})</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
            >
              <option value="TODOS">Todos los Estados ({rawClaims.length})</option>
              <option value="PENDIENTE_ENVIO">⏳ Pendiente de Envío ({metrics.countPending})</option>
              <option value="EN_AUDITORIA">🔍 En Auditoría Médica ({metrics.countAuditing})</option>
              <option value="APROBADO">✅ Aprobado ({metrics.countApproved})</option>
              <option value="LIQUIDADO_COBRADO">🏦 Liquidado / Cobrado ({metrics.countSettled})</option>
              <option value="RECHAZADO">❌ Rechazado</option>
            </select>

            {/* Branch Filter */}
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-xs font-semibold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
            >
              <option value="TODAS">Todas las Sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Batch Notification Bar */}
        {selectedClaimIds.length > 0 && (
          <div className="bg-indigo-50/80 px-6 py-2.5 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <span className="font-extrabold">{selectedClaimIds.length} prestaciones seleccionadas</span>
              <span>• Total acumulado a liquidar:</span>
              <span className="font-black text-indigo-900 text-sm">
                {formatPYG(selectedClaimsList.reduce((s, c) => s + (c.coveredAmount || 0), 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedClaimIds([])}
                className="text-[11px] text-indigo-700 hover:text-indigo-950 underline font-semibold cursor-pointer"
              >
                Deseleccionar todo
              </button>
              <button
                onClick={() => setIsSettleModalOpen(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
              >
                Liquidar en Lote ahora
              </button>
            </div>
          </div>
        )}

        {/* Claims Table View */}
        {filteredClaims.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Shield className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              No se encontraron reclamos de seguro con los filtros seleccionados
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Los reclamos se generan automáticamente cuando un odontólogo crea un tratamiento para un paciente afiliado a un seguro, o bien puede crearlos manualmente.
            </p>
            <button
              onClick={() => {
                setSelectedPlanId('TODOS');
                setSelectedStatus('TODOS');
                setSelectedBranchId('TODAS');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Restablecer Filtros</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedClaimIds.length === filteredClaims.length && filteredClaims.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5">Reclamo & Fecha</th>
                  <th className="px-4 py-3.5">Aseguradora / Plan</th>
                  <th className="px-4 py-3.5">Paciente & Carnet</th>
                  <th className="px-4 py-3.5">Prestación Odontológica</th>
                  <th className="px-4 py-3.5 text-right">Arancel Particular</th>
                  <th className="px-4 py-3.5 text-right">Copago Paciente</th>
                  <th className="px-4 py-3.5 text-right text-indigo-900">Cobertura Seguro</th>
                  <th className="px-4 py-3.5 text-center">Estado del Reclamo</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClaims.map((claim) => {
                  const patient = patients.find((p) => p.id === claim.patientId);
                  const plan = plans.find((p) => p.id === claim.planId);
                  const isSelected = selectedClaimIds.includes(claim.id);

                  return (
                    <tr
                      key={claim.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleClaim(claim.id)}
                          className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Claim Number & Date */}
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-800 text-[11px]">
                          {claim.claimNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {claim.createdAt
                            ? new Date(claim.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '-'}
                        </div>
                      </td>

                      {/* Plan / Insurance */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[150px]">{plan?.name || claim.planName || 'Seguro Dental'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {plan?.code || 'SEG'}
                        </div>
                      </td>

                      {/* Patient & Member Card */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Paciente'}
                        </div>
                        <div className="text-[10px] text-indigo-700 font-mono font-semibold">
                          Carnet: {claim.patientMemberNumber || patient?.insuranceMemberNumber || 'S/N'}
                        </div>
                      </td>

                      {/* Service Name & Tooth */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 max-w-[220px] truncate" title={claim.serviceName}>
                          {claim.serviceName}
                        </div>
                        {claim.toothNumber && (
                          <span className="inline-block px-1.5 py-0.2 rounded-sm text-[10px] font-mono font-bold bg-slate-100 text-slate-700 mt-0.5">
                            Pieza FDI {claim.toothNumber}
                          </span>
                        )}
                      </td>

                      {/* Original List Price */}
                      <td className="px-4 py-3 text-right font-medium text-slate-500">
                        {formatPYG(claim.originalListPrice)}
                      </td>

                      {/* Copay */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-600">
                        {formatPYG(claim.copayAmount)}
                      </td>

                      {/* Covered Amount */}
                      <td className="px-4 py-3 text-right font-black text-indigo-950 text-xs">
                        {formatPYG(claim.coveredAmount)}
                      </td>

                      {/* Status Selector */}
                      <td className="px-4 py-3 text-center">
                        <select
                          value={claim.status}
                          onChange={(e) => handleStatusChange(claim.id, e.target.value)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-hidden ${
                            claim.status === 'LIQUIDADO_COBRADO'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : claim.status === 'APROBADO'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : claim.status === 'EN_AUDITORIA'
                              ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                              : claim.status === 'RECHAZADO'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="PENDIENTE_ENVIO">⏳ Pendiente</option>
                          <option value="EN_AUDITORIA">🔍 En Auditoría</option>
                          <option value="APROBADO">✅ Aprobado</option>
                          <option value="LIQUIDADO_COBRADO">🏦 Liquidado (Cobrado)</option>
                          <option value="RECHAZADO">❌ Rechazado</option>
                        </select>
                        {claim.settlementReference && (
                          <div className="text-[9px] text-slate-400 font-mono mt-0.5" title={claim.settlementReference}>
                            Ref: {claim.settlementReference}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        {claim.status !== 'LIQUIDADO_COBRADO' ? (
                          <button
                            onClick={() => {
                              setSelectedClaimIds([claim.id]);
                              setIsSettleModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Liquidar
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Cobrado</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <SettleClaimsBatchModal
        isOpen={isSettleModalOpen}
        onClose={() => {
          setIsSettleModalOpen(false);
          setSelectedClaimIds([]);
        }}
        claimsToSettle={selectedClaimsList.length > 0 ? selectedClaimsList : filteredClaims.filter((c) => c.status !== 'LIQUIDADO_COBRADO')}
        plan={activePlanForBatch}
        onSuccess={() => {
          setSelectedClaimIds([]);
        }}
      />

      <ClaimSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        claims={selectedClaimsList.length > 0 ? selectedClaimsList : filteredClaims}
        plan={activePlanForBatch}
        branchName={branches.find((b) => b.id === selectedBranchId)?.name}
      />

      <CreateInsuranceClaimModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
