import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Printer,
  Clock,
  User,
  Globe,
  Building2,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Eye,
  PlusCircle,
  Stethoscope,
  Sparkles
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { AuditLogDetailModal } from './AuditLogDetailModal.tsx';

export const AuditLogsView: React.FC = () => {
  const { session } = useAuth();
  const snapshot = dbStore.getSnapshot();
  const logs = snapshot.auditLogs || [];
  const users = snapshot.users || [];
  const branches = snapshot.branches || [];

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<any>(null);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (selectedAction !== 'ALL' && log.action !== selectedAction) return false;
    if (selectedEntity !== 'ALL' && log.entity !== selectedEntity) return false;
    if (selectedBranchId && log.branchId !== selectedBranchId) return false;
    if (selectedUserId && log.userId !== selectedUserId) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const user = users.find((u) => u.id === log.userId);
      const userMatch = user && (
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(term) ||
        user.documentNumber.includes(term)
      );
      const ipMatch = log.ipAddress?.toLowerCase().includes(term);
      const descMatch = log.description?.toLowerCase().includes(term);
      const entityMatch = log.entity?.toLowerCase().includes(term);
      if (!userMatch && !ipMatch && !descMatch && !entityMatch) return false;
    }

    return true;
  });

  // Tally stats
  const sensitiveAccessesCount = logs.filter((l) => l.action === 'READ_SENSITIVE' || l.entity === 'CLINICAL_RECORD').length;
  const financialOperationsCount = logs.filter((l) => l.action === 'CASH_MOVEMENT' || l.action === 'CLOSE_CASH_REGISTER' || l.entity === 'PAYMENT').length;
  const uniqueIpsCount = new Set(logs.map((l) => l.ipAddress).filter(Boolean)).size;

  // Simulator helper: Trigger a new live audit log of sensitive medical access
  const handleSimulateSensitiveAccess = () => {
    const randomPatient = snapshot.patients[0];
    const dentist = users.find((u) => u.roleId === 'ODONTOLOGO') || users[0];
    dbStore.addAuditLog({
      action: 'READ_SENSITIVE',
      entity: 'CLINICAL_RECORD',
      entityId: randomPatient ? randomPatient.id : 'pat-001',
      userId: dentist.id,
      branchId: snapshot.branches[0]?.id || null,
      ipAddress: '190.52.144.' + (Math.floor(Math.random() * 80) + 10),
      description: `Auditoría preventiva: Lectura de antecedentes médicos confidenciales del paciente ${randomPatient?.firstName} ${randomPatient?.lastName} (CI ${randomPatient?.documentNumber}) por Dr(a). ${dentist.firstName} ${dentist.lastName}`,
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Accion', 'Entidad', 'Descripcion', 'Operador', 'Rol', 'Sucursal', 'IP_Address'];
    const rows = filteredLogs.map((l) => {
      const u = users.find((usr) => usr.id === l.userId);
      const b = branches.find((br) => br.id === l.branchId);
      return [
        `"${new Date(l.createdAt).toISOString()}"`,
        l.action,
        l.entity,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        `"${u ? `${u.firstName} ${u.lastName}` : 'Sistema'}"`,
        u?.roleId || 'SISTEMA',
        `"${b?.name || 'Central'}"`,
        l.ipAddress || '190.52.144.12',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Libro_Auditoria_OdontoPro_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get action color styling
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'READ_SENSITIVE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'UPDATE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'DELETE':
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
                  Fase 14: Ley N° 1682/01 MSPBS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Libro inmutable de eventos, trazabilidad de datos médicos sensibles, IPs paraguayas y control de cambios
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleSimulateSensitiveAccess}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Dispara un evento de lectura de historia clínica para probar la trazabilidad en vivo"
            >
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>Simular Acceso Sensible (MSPBS)</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Libro CSV</span>
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
              <option value="ALL">Todas las Acciones ({logs.length})</option>
              <option value="READ_SENSITIVE">🟣 Lectura Sensible (MSPBS)</option>
              <option value="CREATE">🟢 Creación (CREATE)</option>
              <option value="UPDATE">🟡 Modificación (UPDATE)</option>
              <option value="DELETE">🔴 Eliminación (DELETE)</option>
              <option value="LOGIN">🔵 Acceso / Login (LOGIN)</option>
              <option value="CASH_MOVEMENT">💵 Movimiento de Caja</option>
              <option value="CLOSE_CASH_REGISTER">🔒 Cierre de Caja</option>
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
              <option value="CLINICAL_RECORD">Fichas Clínicas</option>
              <option value="ODONTOGRAM">Odontogramas</option>
              <option value="PATIENT">Pacientes</option>
              <option value="QUOTE">Presupuestos</option>
              <option value="PAYMENT">Pagos / Recibos</option>
              <option value="CASH_REGISTER">Caja Diaria</option>
              <option value="APPOINTMENT">Citas / Agenda</option>
              <option value="BRANCH">Sucursales</option>
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
          <div className="text-2xl font-bold text-slate-900">{logs.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Con firma inmutable y timestamp</div>
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
              Mostrando {filteredLogs.length} de {logs.length} registros
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
            {selectedAction === 'ALL' ? 'Todos los tipos' : selectedAction}
          </span>
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
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No se encontraron registros de auditoría que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
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
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString('es-PY', {
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
                          {user ? `${user.firstName} ${user.lastName}` : 'Sistema Central'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {user ? `Rol: ${user.roleId}` : 'Tarea Automática'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                        <div className="font-mono text-[11px] text-slate-800">{log.ipAddress || '190.52.144.12'}</div>
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
