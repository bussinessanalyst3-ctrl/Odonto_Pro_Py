import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  RefreshCw,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Users,
  GitBranch,
  AlertCircle,
  Calendar,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { getApiBaseUrl } from '../../config/apiConfig.ts';

export interface OwnerOrganizationMetadata {
  id: string;
  code: string;
  name: string;
  legalName: string;
  taxId: string;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  branchesCount: number;
  usersCount: number;
  activeUsersCount: number;
  isOwnerOrganization: boolean;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

function formatDatePY(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toLocaleDateString('es-PY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const OwnerClientsPanel: React.FC = () => {
  const { session } = useAuth();
  const [organizations, setOrganizations] = useState<OwnerOrganizationMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const [pendingAction, setPendingAction] = useState<{
    org: OwnerOrganizationMetadata;
    nextStatus: 'ACTIVE' | 'SUSPENDED';
  } | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const buildHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.sessionToken && !session.sessionToken.startsWith('httpOnly_')) {
      headers.Authorization = `Bearer ${session.sessionToken}`;
    }
    return headers;
  }, [session?.sessionToken]);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/owner/organizations`, {
        method: 'GET',
        credentials: 'include',
        headers: buildHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar la lista de empresas.');
      }
      setOrganizations(Array.isArray(data.organizations) ? data.organizations : []);
    } catch (err: any) {
      setError(err?.message || 'Error de conexión al consultar empresas.');
    } finally {
      setLoading(false);
    }
  }, [buildHeaders]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleConfirmStatusChange = async () => {
    if (!pendingAction) return;
    const { org, nextStatus } = pendingAction;
    setSubmittingId(org.id);
    setFeedback(null);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/owner/organizations/${encodeURIComponent(org.id)}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: buildHeaders(),
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo actualizar el estado de la empresa.');
      }

      setOrganizations((prev) =>
        prev.map((item) => (item.id === org.id ? data.organization : item))
      );
      setFeedback({
        type: 'success',
        text:
          nextStatus === 'SUSPENDED'
            ? `Clínica "${org.name}" suspendida para nuevos inicios de sesión.`
            : `Clínica "${org.name}" reactivada correctamente.`,
      });
      setPendingAction(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Error al actualizar el estado de la clínica.',
      });
      setPendingAction(null);
    } finally {
      setSubmittingId(null);
    }
  };

  const totalCount = organizations.length;
  const activeCount = organizations.filter((o) => o.status === 'ACTIVE').length;
  const suspendedCount = organizations.filter((o) => o.status === 'SUSPENDED').length;

  const filteredOrgs = organizations.filter((org) => {
    if (statusFilter === 'ACTIVE' && org.status !== 'ACTIVE') return false;
    if (statusFilter === 'SUSPENDED' && org.status !== 'SUSPENDED') return false;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      return (
        org.name.toLowerCase().includes(q) ||
        org.legalName.toLowerCase().includes(q) ||
        org.code.toLowerCase().includes(q) ||
        org.taxId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Activa
        </span>
      );
    }
    if (status === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Suspendida
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {status || 'Inactiva'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y métricas resumidas (solo metadatos administrativos) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Empresas y Clínicas Registradas</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Metadatos operativos por organización. Al suspender una clínica solo se impiden nuevos inicios de sesión con un mensaje amable.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrganizations}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* KPIs sobrios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Empresas</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{totalCount}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activas</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">{activeCount}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suspendidas</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">{suspendedCount}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <PauseCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Mensajes de estado */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, razón social, código o RUC..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: `Todas (${totalCount})` },
                { id: 'ACTIVE', label: `Activas (${activeCount})` },
                { id: 'SUSPENDED', label: `Suspendidas (${suspendedCount})` },
              ] as Array<{ id: StatusFilter; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === opt.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla principal (Desktop) */}
        {loading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-500">
            <div className="h-6 w-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            <span className="text-xs font-medium">Cargando empresas...</span>
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            No se encontraron empresas con los filtros aplicados.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Empresa / Razón Social</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Fecha de Alta</th>
                    <th className="py-3 px-4 text-center">Sucursales</th>
                    <th className="py-3 px-4 text-center">Usuarios</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOrgs.map((org) => {
                    const isSuspended = org.status === 'SUSPENDED';
                    const isBusy = submittingId === org.id;
                    return (
                      <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900">{org.name}</span>
                                {org.isOwnerOrganization && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                    Tu organización
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 truncate max-w-xs" title={org.legalName}>
                                {org.legalName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {org.code ? `${org.code} · ` : ''}
                                {org.taxId ? `RUC ${org.taxId}` : org.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{renderStatusBadge(org.status)}</td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDatePY(org.createdAt)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 tabular-nums">
                            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                            {org.branchesCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 tabular-nums">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {org.usersCount}
                          </span>
                          {org.activeUsersCount !== org.usersCount && (
                            <div className="text-[10px] text-slate-400">
                              {org.activeUsersCount} activos
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isSuspended || org.status !== 'ACTIVE' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setPendingAction({ org, nextStatus: 'ACTIVE' })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              <span>Reactivar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy || org.isOwnerOrganization}
                              title={
                                org.isOwnerOrganization
                                  ? 'No puede suspender la organización vinculada a su propia cuenta'
                                  : 'Suspender nuevos inicios de sesión de esta clínica'
                              }
                              onClick={() => setPendingAction({ org, nextStatus: 'SUSPENDED' })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <PauseCircle className="h-3.5 w-3.5" />
                              <span>Suspender</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tarjetas (Móvil) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredOrgs.map((org) => {
                const isSuspended = org.status === 'SUSPENDED';
                const isBusy = submittingId === org.id;
                return (
                  <div key={org.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{org.name}</p>
                        <p className="text-xs text-slate-600 truncate">{org.legalName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {org.code ? `${org.code} · ` : ''}
                          {org.taxId ? `RUC ${org.taxId}` : ''}
                        </p>
                      </div>
                      {renderStatusBadge(org.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Alta</span>
                        <span className="font-semibold text-slate-700">{formatDatePY(org.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Sucursales</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{org.branchesCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Usuarios</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{org.usersCount}</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      {isSuspended || org.status !== 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setPendingAction({ org, nextStatus: 'ACTIVE' })}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>Reactivar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy || org.isOwnerOrganization}
                          onClick={() => setPendingAction({ org, nextStatus: 'SUSPENDED' })}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                          <span>Suspender</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de confirmación (sin diálogos nativos) */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-status-modal-title"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    pendingAction.nextStatus === 'SUSPENDED'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {pendingAction.nextStatus === 'SUSPENDED' ? (
                    <PauseCircle className="h-5 w-5" />
                  ) : (
                    <PlayCircle className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 id="owner-status-modal-title" className="text-sm font-bold text-slate-900">
                    {pendingAction.nextStatus === 'SUSPENDED'
                      ? 'Confirmar suspensión de clínica'
                      : 'Confirmar reactivación de clínica'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{pendingAction.org.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {pendingAction.nextStatus === 'SUSPENDED'
                ? 'Al suspender esta clínica, sus usuarios no podrán iniciar nuevas sesiones y verán un mensaje claro y amable para comunicarse con soporte de OdontoPro. No se eliminan datos ni se interrumpen sesiones que ya estén abiertas.'
                : 'Al reactivar esta clínica, sus usuarios podrán volver a iniciar sesión normalmente de inmediato.'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={Boolean(submittingId)}
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(submittingId)}
                onClick={handleConfirmStatusChange}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                  pendingAction.nextStatus === 'SUSPENDED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {submittingId
                  ? 'Guardando...'
                  : pendingAction.nextStatus === 'SUSPENDED'
                  ? 'Sí, suspender'
                  : 'Sí, reactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
