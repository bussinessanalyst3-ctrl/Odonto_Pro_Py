import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  Printer,
  Globe,
  Lock,
  FileText,
  CheckCircle2,
  RefreshCw,
  Eye,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { getApiBaseUrl } from '../../config/apiConfig.ts';
import { getTodayAsuncionISO } from '../../config/appBrand.ts';
import { toAsuncionDateISO } from '../../utils/reportPeriod.ts';
import { AuditLogDetailModal } from './AuditLogDetailModal.tsx';

const PAGE_SIZE = 25;

export const AuditLogsView: React.FC = () => {
  const [, setStoreTick] = useState(0);
  useEffect(() => dbStore.subscribe(() => setStoreTick((t) => t + 1)), []);

  const snapshot = dbStore.getSnapshot();
  const localLogs = snapshot.auditLogs || [];
  const users = snapshot.users || [];
  const branches = snapshot.branches || [];

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedUserId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<any>(null);
  const [offset, setOffset] = useState<number>(0);

  const [serverLogs, setServerLogs] = useState<any[] | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverStats, setServerStats] = useState<{
    sensitiveAccessesCount: number;
    financialOperationsCount: number;
    uniqueIpsCount: number;
  } | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState<boolean>(false);
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  const fetchAuditPage = useCallback(async () => {
    const token = dbStore.getSessionToken();
    const actor = dbStore.getBackendActorContext();
    if (typeof fetch === 'undefined' || (!token && !actor)) {
      setServerLogs(null);
      setServerTotal(null);
      setServerStats(null);
      return;
    }

    setIsLoadingServer(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (selectedAction !== 'ALL') params.set('action', selectedAction);
      if (selectedEntity !== 'ALL') params.set('entity', selectedEntity);
      if (selectedBranchId) params.set('branchId', selectedBranchId);
      if (selectedUserId) params.set('userId', selectedUserId);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const headers: Record<string, string> = {};
      if (token && !token.startsWith('httpOnly_')) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${getApiBaseUrl()}/api/audit-logs?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const payload = await res.json();
        if (Array.isArray(payload?.logs)) {
          setServerLogs(payload.logs);
          setServerTotal(typeof payload.total === 'number' ? payload.total : payload.logs.length);
          setServerStats(payload.stats || null);
          return;
        }
      }
      setServerLogs(null);
      setServerTotal(null);
      setServerStats(null);
    } catch {
      setServerLogs(null);
      setServerTotal(null);
      setServerStats(null);
    } finally {
      setIsLoadingServer(false);
    }
  }, [offset, selectedAction, selectedEntity, selectedBranchId, selectedUserId, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditPage();
    }, 120);
    return () => clearTimeout(timer);
  }, [fetchAuditPage, localLogs.length]);

  useEffect(() => {
    setOffset(0);
  }, [searchTerm, selectedAction, selectedEntity, selectedBranchId, selectedUserId, dateFrom, dateTo]);

  // Local fallback filtering
  const localFilteredLogs = localLogs.filter((log) => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
    if (selectedEntity !== 'ALL' && log.entity !== selectedEntity) return false;
    if (selectedBranchId && log.branchId !== selectedBranchId) return false;
    if (selectedUserId && log.userId !== selectedUserId) return false;
    if (dateFrom || dateTo) {
      const logDateIso = toAsuncionDateISO(log.createdAt);
      if (!logDateIso) return false;
      if (dateFrom && logDateIso < dateFrom) return false;
      if (dateTo && logDateIso > dateTo) return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const user = users.find((u) => u.id === log.userId);
      const userMatch =
        user &&
        (`${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(term) ||
          String((user as any).documentNumber || '').includes(term) ||
          (user.email || '').toLowerCase().includes(term));
      const ipMatch = log.ipAddress?.toLowerCase().includes(term);
      const descMatch = log.description?.toLowerCase().includes(term);
      const entityMatch = log.entity?.toLowerCase().includes(term);
      const actionMatch = log.action?.toLowerCase().includes(term);
      if (!userMatch && !ipMatch && !descMatch && !entityMatch && !actionMatch) return false;
    }

    return true;
  });

  const isServerPaginated = serverLogs !== null && serverTotal !== null;
  const totalMatching = isServerPaginated ? serverTotal! : localFilteredLogs.length;
  const displayedLogs = isServerPaginated
    ? serverLogs!
    : localFilteredLogs.slice(offset, offset + PAGE_SIZE);

  // Tally stats
  const sensitiveAccessesCount =
    serverStats?.sensitiveAccessesCount ??
    localFilteredLogs.filter((l) => l.action === 'READ_SENSITIVE' || l.entity === 'CLINICAL_RECORD').length;
  const financialOperationsCount =
    serverStats?.financialOperationsCount ??
    localFilteredLogs.filter(
      (l) =>
        l.action === 'CASH_MOVEMENT' ||
        l.action === 'CLOSE_CASH_REGISTER' ||
        l.action === 'PAYMENT_ANNUL' ||
        l.entity === 'PAYMENT'
    ).length;
  const uniqueIpsCount =
    serverStats?.uniqueIpsCount ?? new Set(localFilteredLogs.map((l) => l.ipAddress).filter(Boolean)).size;

  const hasActiveFilters = Boolean(
    searchTerm.trim() || selectedAction !== 'ALL' || selectedEntity !== 'ALL' || selectedBranchId || dateFrom || dateTo
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedAction('ALL');
    setSelectedEntity('ALL');
    setSelectedBranchId('');
    setDateFrom('');
    setDateTo('');
  };

  // Export CSV (en modo servidor solicita hasta 500 registros filtrados reales, no solo la página actual)
  const handleExportCSV = async () => {
    setIsExportingCsv(true);
    try {
      let exportSource = isServerPaginated ? displayedLogs : localFilteredLogs;

      if (isServerPaginated && totalMatching > displayedLogs.length && typeof fetch !== 'undefined') {
        try {
          const token = dbStore.getSessionToken();
          const params = new URLSearchParams({
            limit: String(Math.min(totalMatching, 500)),
            offset: '0',
          });
          if (selectedAction !== 'ALL') params.set('action', selectedAction);
          if (selectedEntity !== 'ALL') params.set('entity', selectedEntity);
          if (selectedBranchId) params.set('branchId', selectedBranchId);
          if (selectedUserId) params.set('userId', selectedUserId);
          if (dateFrom) params.set('dateFrom', dateFrom);
          if (dateTo) params.set('dateTo', dateTo);
          if (searchTerm.trim()) params.set('search', searchTerm.trim());

          const headers: Record<string, string> = {};
          if (token && !token.startsWith('httpOnly_')) {
            headers.Authorization = `Bearer ${token}`;
          }
          const res = await fetch(`${getApiBaseUrl()}/api/audit-logs?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers,
          });
          if (res.ok) {
            const payload = await res.json();
            if (Array.isArray(payload?.logs)) {
              exportSource = payload.logs;
            }
          }
        } catch {
          // Fallback silencioso a los registros visibles
        }
      }

      const headers = ['Fecha_Hora_PY', 'Accion', 'Entidad', 'Descripcion', 'Operador', 'Rol', 'Sucursal', 'IP_Address'];
      const rows = exportSource.map((l) => {
        const u = users.find((usr) => usr.id === l.userId);
        const b = branches.find((br) => br.id === l.branchId);
        const formattedPy = new Date(l.createdAt).toLocaleString('es-PY', {
          timeZone: 'America/Asuncion',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const operatorName = u
          ? `${u.firstName} ${u.lastName}`
          : (l as any).historicalUserName || 'Sistema';
        return [
          `"${formattedPy}"`,
          l.action,
          l.entity,
          `"${(l.description || '').replace(/"/g, '""')}"`,
          `"${operatorName}"`,
          u?.roleId || 'SISTEMA',
          `"${b?.name || 'Central'}"`,
          l.ipAddress || 'No registrada',
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Libro_Auditoria_ODONTOPRO_${getTodayAsuncionISO()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Get action color styling
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'READ_SENSITIVE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UPDATE':
      case 'UPDATE_SETTINGS':
      case 'UPDATE_CHAIRS':
      case 'STATUS_CHANGE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'DELETE':
      case 'PAYMENT_ANNUL':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'LOGIN':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CASH_MOVEMENT':
      case 'CLOSE_CASH_REGISTER':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Auditoría, Trazabilidad & Compliance Sanitario
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                  Ley N° 1682/01 MSPBS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Libro inmutable de eventos, trazabilidad de datos médicos sensibles, IPs paraguayas y control de cambios
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              disabled={isExportingCsv}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExportingCsv ? 'Exportando...' : 'Exportar Libro CSV'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir Registro</span>
            </button>
          </div>
        </div>

        {/* Legal Regulatory Compliance Banner */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 flex items-start gap-3">
          <Lock className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-slate-900">Custodia de Historias Clínicas (Resolución MSPBS N° 845):</strong> Toda consulta o modificación a fichas médicas, odontogramas y recetas odontológicas queda asentada de forma permanente con identificación del profesional colegiado, dirección IP de origen, estampilla de tiempo y detalle antes/después.
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Text Search */}
          <div className="lg:col-span-2 relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por IP, usuario, cédula o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">Todas las Acciones ({totalMatching})</option>
              <option value="READ_SENSITIVE">Lectura Sensible (MSPBS)</option>
              <option value="CREATE">Creación (CREATE)</option>
              <option value="UPDATE">Modificación (UPDATE)</option>
              <option value="DELETE">Eliminación / Baja (DELETE)</option>
              <option value="PAYMENT_ANNUL">Anulación de Cobro</option>
              <option value="STATUS_CHANGE">Cambio de Estado</option>
              <option value="LOGIN">Acceso / Login (LOGIN)</option>
              <option value="CASH_MOVEMENT">Movimiento de Caja</option>
              <option value="CLOSE_CASH_REGISTER">Cierre de Caja</option>
              <option value="UPDATE_CHAIRS">Sillones Odontológicos</option>
              <option value="UPDATE_SETTINGS">Parámetros de Sucursal</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="ALL">Todas las Entidades</option>
              <option value="SERVICE">Catálogo de Servicios</option>
              <option value="TREATMENT">Tratamientos</option>
              <option value="CLINICAL_RECORD">Fichas Clínicas</option>
              <option value="ODONTOGRAM">Odontogramas</option>
              <option value="PATIENT">Pacientes</option>
              <option value="QUOTE">Presupuestos</option>
              <option value="PAYMENT">Pagos / Recibos</option>
              <option value="CASH_REGISTER">Caja Diaria</option>
              <option value="APPOINTMENT">Citas / Agenda</option>
              <option value="EMPLOYEE">Personal / Nómina</option>
              <option value="PAYROLL_SETTLEMENT">Liquidaciones</option>
              <option value="STAFF_PAYMENT">Pagos al Personal</option>
              <option value="BRANCH">Sucursales</option>
              <option value="ORGANIZATION">Organización</option>
              <option value="USER">Usuarios / Roles</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="">Todas las Sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range Filter Row (Hora Paraguay) */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <label htmlFor="audit-date-from" className="font-semibold">Desde:</label>
            <input
              id="audit-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <label htmlFor="audit-date-to" className="font-semibold">Hasta:</label>
            <input
              id="audit-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total de Eventos Auditados</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalMatching}</div>
          <div className="text-[11px] text-slate-500 mt-1">Registro inmutable con fecha y hora (PY)</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-purple-200 bg-purple-50/40 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <span className="text-xs font-bold">Accesos Médicos Sensibles</span>
            <div className="p-2 rounded-xl bg-purple-600 text-white">
              <Stethoscope className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-900">{sensitiveAccessesCount}</div>
          <div className="text-[11px] text-purple-700 font-medium mt-1">
            Lectura de historias y antecedentes
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Operaciones Financieras / Caja</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{financialOperationsCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Cobros, arqueos y comprobantes
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Direcciones IP Monitoreadas</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{uniqueIpsCount} IPs</div>
          <div className="text-[11px] text-slate-500 mt-1">Red local y proveedores PY</div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Libro Cronológico de Auditoría
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Mostrando {displayedLogs.length} de {totalMatching} registros
              {isServerPaginated ? ' (consulta paginada en servidor)' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={fetchAuditPage}
              disabled={isLoadingServer}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors"
              title="Actualizar registros desde el servidor"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingServer ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
              {selectedAction === 'ALL' ? 'Todos los tipos' : selectedAction}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3.5 px-4">Fecha & Hora (PY)</th>
                <th className="py-3.5 px-4">Acción</th>
                <th className="py-3.5 px-4">Entidad</th>
                <th className="py-3.5 px-4">Descripción del Evento</th>
                <th className="py-3.5 px-4">Operador / Rol</th>
                <th className="py-3.5 px-4">IP & Sucursal</th>
                <th className="py-3.5 px-4 text-center">Trazabilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No se encontraron registros de auditoría que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                displayedLogs.map((log) => {
                  const user = users.find((u) => u.id === log.userId);
                  const branch = branches.find((b) => b.id === log.branchId);
                  const isSensitive = log.action === 'READ_SENSITIVE' || log.entity === 'CLINICAL_RECORD';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSensitive ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {new Date(log.createdAt).toLocaleDateString('es-PY', {
                            timeZone: 'America/Asuncion',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString('es-PY', {
                            timeZone: 'America/Asuncion',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 font-semibold whitespace-nowrap">
                        {log.entity}
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 font-medium max-w-md">
                        <p className="line-clamp-2">{log.description}</p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {user
                            ? `${user.firstName} ${user.lastName}`
                            : (log as any).historicalUserName || 'Sistema Central'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {user ? `Rol: ${user.roleId}` : 'Tarea Automática'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        <div className="font-mono text-[11px] text-slate-800">{log.ipAddress || 'No registrada'}</div>
                        <div className="text-[11px] text-slate-400">{branch?.name || 'Sede Central'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLogForDetail(log)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-teal-600" />
                          <span>Inspeccionar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalMatching > PAGE_SIZE && (
          <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
            <span>
              Página {Math.floor(offset / PAGE_SIZE) + 1} de {Math.max(1, Math.ceil(totalMatching / PAGE_SIZE))}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                disabled={offset === 0 || isLoadingServer}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Anterior</span>
              </button>
              <button
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= totalMatching || isLoadingServer}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded-lg font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>Siguiente</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspector Detail Modal */}
      {selectedLogForDetail && (
        <AuditLogDetailModal
          log={selectedLogForDetail}
          onClose={() => setSelectedLogForDetail(null)}
        />
      )}
    </div>
  );
};
