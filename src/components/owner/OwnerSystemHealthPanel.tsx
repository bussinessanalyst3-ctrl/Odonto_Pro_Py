import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Server,
  Database,
  Layers,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { getApiBaseUrl } from '../../config/apiConfig.ts';

type TrafficStatus = 'green' | 'yellow' | 'red';

interface OwnerHealthPayload {
  checkedAt: string;
  server: {
    status: TrafficStatus;
    uptimeSec: number;
    startedAt: string;
    version?: string;
    environment: string;
    memory: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
    nodeVersion: string;
  };
  database: {
    status: TrafficStatus;
    publicStatus: 'ok' | 'degraded' | 'down';
    mode: 'postgres' | 'local-fallback';
    latencyMs: number | null;
    checkedAt: string;
    cached: boolean;
    errorMessage?: string;
  };
  modules: Array<{
    id: string;
    label: string;
    errors24h: number;
    status: TrafficStatus;
    lastError: {
      timestamp: string;
      route: string;
      method: string;
      statusCode: number;
      source: 'backend' | 'database' | 'frontend';
      message: string;
    } | null;
  }>;
  summary: {
    overallStatus: TrafficStatus;
    totalErrors24h: number;
    affectedModulesCount: number;
    alerts: Array<{
      level: 'red' | 'yellow';
      title: string;
      detail: string;
    }>;
    recentErrors: Array<{
      id: string;
      timestamp: string;
      module: string;
      route: string;
      method: string;
      statusCode: number;
      source: 'backend' | 'database' | 'frontend';
      message: string;
      organizationId?: string;
      userId?: string;
    }>;
    retentionNote: string;
  };
}

const AUTO_REFRESH_MS = 45_000;

function formatUptime(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getStatusVisuals(status: TrafficStatus): {
  label: string;
  dotClass: string;
  badgeClass: string;
  cardBorderClass: string;
  iconBgClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  if (status === 'red') {
    return {
      label: 'Con fallas',
      dotClass: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      cardBorderClass: 'border-rose-200',
      iconBgClass: 'bg-rose-50 text-rose-600',
      Icon: XCircle,
    };
  }
  if (status === 'yellow') {
    return {
      label: 'Atención',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      cardBorderClass: 'border-amber-200',
      iconBgClass: 'bg-amber-50 text-amber-600',
      Icon: AlertTriangle,
    };
  }
  return {
    label: 'Operativo',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardBorderClass: 'border-slate-200',
    iconBgClass: 'bg-emerald-50 text-emerald-600',
    Icon: CheckCircle2,
  };
}

export const OwnerSystemHealthPanel: React.FC = () => {
  const { session } = useAuth();
  const [data, setData] = useState<OwnerHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('ALL');

  const fetchHealth = useCallback(
    async (isManual: boolean) => {
      if (isManual) setRefreshing(true);
      try {
        const baseUrl = getApiBaseUrl();
        const headers: Record<string, string> = {};
        if (session?.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
          headers.Authorization = `Bearer ${session.sessionToken}`;
        }
        const url = `${baseUrl}/api/owner/health${isManual ? '?fresh=1' : ''}`;
        const res = await fetch(url, {
          credentials: 'include',
          headers,
        });
        if (!res.ok) {
          throw new Error(`No se pudo consultar el estado del sistema (HTTP ${res.status}).`);
        }
        const payload = (await res.json()) as OwnerHealthPayload;
        setData(payload);
        setFetchError(null);
      } catch (err: any) {
        setFetchError(err?.message || 'Error de red al consultar el estado del sistema.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session?.sessionToken]
  );

  useEffect(() => {
    void fetchHealth(false);
    const interval = window.setInterval(() => {
      void fetchHealth(false);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchHealth]);

  const moduleLabelsMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.modules || []).forEach((m) => map.set(m.id, m.label));
    return map;
  }, [data?.modules]);

  const filteredErrors = useMemo(() => {
    const list = data?.summary.recentErrors || [];
    if (selectedModuleFilter === 'ALL') return list;
    return list.filter((e) => e.module === selectedModuleFilter);
  }, [data?.summary.recentErrors, selectedModuleFilter]);

  const modulesTrafficStatus: TrafficStatus = useMemo(() => {
    if (!data) return 'green';
    if (data.modules.some((m) => m.status === 'red')) return 'red';
    if (data.modules.some((m) => m.status === 'yellow')) return 'yellow';
    return 'green';
  }, [data]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center min-h-[240px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="h-7 w-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Consultando salud de ODONTOPRO...</span>
        </div>
      </div>
    );
  }

  const serverVis = getStatusVisuals(data?.server.status || 'green');
  const dbVis = getStatusVisuals(data?.database.status || 'red');
  const modVis = getStatusVisuals(modulesTrafficStatus);

  return (
    <div className="space-y-5">
      {/* Encabezado y controles */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-600 shrink-0" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Estado del Sistema · ODONTOPRO
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Auto-actualización cada 45 s</span>
            {data?.checkedAt && (
              <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Última lectura: {formatDateTime(data.checkedAt)}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{refreshing ? 'Actualizando...' : 'Actualizar ahora'}</span>
        </button>
      </div>

      {/* Error de red al consultar /api/owner/health */}
      {fetchError && (
        <div
          role="alert"
          className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
        >
          <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">No se pudo actualizar el monitoreo</p>
            <p className="text-rose-700 mt-0.5">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Alertas destacadas cuando la BD está roja o un módulo acumula fallas */}
      {data && data.summary.alerts.length > 0 && (
        <div className="space-y-2.5">
          {data.summary.alerts.map((alert, idx) => (
            <div
              key={`${alert.title}-${idx}`}
              role="alert"
              className={`rounded-2xl border p-4 flex items-start gap-3 ${
                alert.level === 'red'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <AlertTriangle
                className={`h-5 w-5 shrink-0 mt-0.5 ${
                  alert.level === 'red' ? 'text-rose-600' : 'text-amber-600'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold">{alert.title}</p>
                <p className="text-xs sm:text-sm opacity-90 mt-0.5 break-words">{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3 Semáforos Grandes: Servidor, Base de datos, Módulos */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Servidor */}
          <div className={`bg-white rounded-2xl border ${serverVis.cardBorderClass} p-4 sm:p-5 shadow-2xs`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${serverVis.iconBgClass}`}>
                  <Server className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Servidor
                  </p>
                  <p className="text-base font-extrabold text-slate-900">
                    {serverVis.label}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${serverVis.badgeClass}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${serverVis.dotClass}`} />
                Verde
              </span>
            </div>

            <dl className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
              <div>
                <dt className="text-slate-500">Uptime</dt>
                <dd className="font-bold text-slate-800">{formatUptime(data.server.uptimeSec)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Entorno</dt>
                <dd className="font-bold text-slate-800">{data.server.environment}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Memoria (RSS / Heap)</dt>
                <dd className="font-bold text-slate-800">
                  {data.server.memory.rssMb} / {data.server.memory.heapUsedMb} MB
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Versión / Commit</dt>
                <dd className="font-mono font-bold text-slate-800 truncate">
                  {data.server.version || 'No expuesta'}
                </dd>
              </div>
            </dl>
          </div>

          {/* 2. Base de datos */}
          <div className={`bg-white rounded-2xl border ${dbVis.cardBorderClass} p-4 sm:p-5 shadow-2xs`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${dbVis.iconBgClass}`}>
                  <Database className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Base de datos
                  </p>
                  <p className="text-base font-extrabold text-slate-900">
                    {data.database.status === 'green'
                      ? 'Conectada'
                      : data.database.status === 'yellow'
                        ? data.database.mode === 'local-fallback'
                          ? 'Modo local'
                          : 'Lenta'
                        : 'Sin conexión'}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${dbVis.badgeClass}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${dbVis.dotClass}`} />
                {data.database.status === 'green'
                  ? 'Verde'
                  : data.database.status === 'yellow'
                    ? 'Amarillo'
                    : 'Rojo'}
              </span>
            </div>

            <dl className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
              <div>
                <dt className="text-slate-500">Latencia SELECT 1</dt>
                <dd className="font-bold text-slate-800">
                  {data.database.latencyMs !== null ? `${data.database.latencyMs} ms` : 'Sin respuesta'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Motor</dt>
                <dd className="font-bold text-slate-800">
                  {data.database.mode === 'postgres' ? 'PostgreSQL' : 'Fallback local'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Detalle</dt>
                <dd className="font-medium text-slate-700 break-words">
                  {data.database.errorMessage || 'Consulta de control respondida correctamente.'}
                </dd>
              </div>
            </dl>
          </div>

          {/* 3. Módulos */}
          <div className={`bg-white rounded-2xl border ${modVis.cardBorderClass} p-4 sm:p-5 shadow-2xs`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${modVis.iconBgClass}`}>
                  <Layers className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Módulos (24 h)
                  </p>
                  <p className="text-base font-extrabold text-slate-900">
                    {data.summary.totalErrors24h === 0
                      ? 'Sin fallas'
                      : `${data.summary.totalErrors24h} error(es)`}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${modVis.badgeClass}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${modVis.dotClass}`} />
                {modulesTrafficStatus === 'green'
                  ? 'Verde'
                  : modulesTrafficStatus === 'yellow'
                    ? 'Amarillo'
                    : 'Rojo'}
              </span>
            </div>

            <dl className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
              <div>
                <dt className="text-slate-500">Módulos monitoreados</dt>
                <dd className="font-bold text-slate-800">{data.modules.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Con errores (24 h)</dt>
                <dd className="font-bold text-slate-800">{data.summary.affectedModulesCount}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Criterio</dt>
                <dd className="font-medium text-slate-600">
                  Solo errores &gt;= 500, BD y fallos de interfaz (no cuenta 400–404).
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Resumen por módulo */}
      {data && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Salud por Módulo (últimas 24 horas)
              </h3>
              <p className="text-xs text-slate-500">
                Toque un módulo para filtrar la lista de errores recientes.
              </p>
            </div>
            {selectedModuleFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedModuleFilter('ALL')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 underline self-start sm:self-auto cursor-pointer"
              >
                Ver todos los módulos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {data.modules.map((mod) => {
              const vis = getStatusVisuals(mod.status);
              const isSelected = selectedModuleFilter === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() =>
                    setSelectedModuleFilter((prev) => (prev === mod.id ? 'ALL' : mod.id))
                  }
                  className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500'
                      : `${vis.cardBorderClass} hover:bg-slate-50 bg-white`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {mod.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0 ${vis.badgeClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${vis.dotClass}`} />
                      {mod.errors24h}
                    </span>
                  </div>
                  {mod.lastError ? (
                    <div className="mt-2 text-[11px] text-slate-600 space-y-0.5">
                      <p className="font-mono text-slate-500 truncate">
                        {mod.lastError.method} {mod.lastError.route} ({mod.lastError.statusCode})
                      </p>
                      <p className="truncate text-slate-700">{mod.lastError.message}</p>
                      <p className="text-[10px] text-slate-400">
                        Último: {formatDateTime(mod.lastError.timestamp)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">Sin fallas en las últimas 24 h</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Lista de errores recientes con filtro por módulo */}
      {data && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Errores Recientes ({filteredErrors.length})
              </h3>
              <p className="text-xs text-slate-500">
                Registros sanitizados sin datos clínicos de pacientes, contraseñas, tokens ni correos completos.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <label htmlFor="owner-health-module-filter" className="sr-only">
                Filtrar por módulo
              </label>
              <select
                id="owner-health-module-filter"
                value={selectedModuleFilter}
                onChange={(e) => setSelectedModuleFilter(e.target.value)}
                className="min-h-[44px] sm:min-h-[38px] px-3 py-1.5 text-base sm:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">Todos los módulos</option>
                {data.modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.errors24h})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredErrors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs sm:text-sm text-slate-500">
              No hay errores registrados para el filtro seleccionado.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredErrors.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-bold text-[11px]">
                        {moduleLabelsMap.get(ev.module) || ev.module}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono font-bold text-[11px]">
                        {ev.source === 'frontend'
                          ? 'UI'
                          : ev.source === 'database'
                            ? 'BD'
                            : `HTTP ${ev.statusCode}`}
                      </span>
                      <span className="font-mono text-slate-600 break-all">
                        {ev.method} {ev.route}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {formatDateTime(ev.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium break-words">{ev.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Nota discreta sobre persistencia en memoria */}
          <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{data.summary.retentionNote}</span>
          </p>
        </section>
      )}
    </div>
  );
};
