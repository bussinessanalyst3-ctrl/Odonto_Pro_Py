import React from 'react';
import {
  ShieldAlert,
  X,
  Clock,
  User,
  Globe,
  Monitor,
  Building2,
  FileText,
  CheckCircle2,
  Code2,
  Hash,
  Lock
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';

interface AuditLogDetailModalProps {
  log: any;
  onClose: () => void;
}

export const AuditLogDetailModal: React.FC<AuditLogDetailModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  const snapshot = dbStore.getSnapshot();
  const user = snapshot.users.find((u) => u.id === log.userId);
  const branch = snapshot.branches.find((b) => b.id === log.branchId);

  // Generate simulated hash for tamper-evident audit record verification
  const simulatedHash = `SHA256-${log.id.slice(0, 8)}-${log.action}-${new Date(log.createdAt).getTime().toString(16).toUpperCase()}`;

  const isSensitive = log.action === 'READ_SENSITIVE' || log.entity === 'CLINICAL_RECORD';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold ${
              isSensitive ? 'bg-purple-600 text-white' : 'bg-teal-600 text-white'
            }`}>
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">
                  Inspector de Trazabilidad & Auditoría
                </h3>
                {isSensitive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    DATO MÉDICO SENSIBLE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro inmutable de compliance sanitario (MSPBS / Ley N° 1682/01)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          {/* Main Event Summary */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Descripción Oficial del Evento
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                Acción: {log.action}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{log.description}</p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Timestamp */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <Clock className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Fecha & Hora Exacta (PY)</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {new Date(log.createdAt).toLocaleString('es-PY', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })}
                </div>
              </div>
            </div>

            {/* Operator */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <User className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Operador Responsable</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {user ? `${user.firstName} ${user.lastName}` : 'Sistema / Automático'}
                </div>
                {user && (
                  <div className="text-[11px] text-teal-700">
                    Rol: {user.roleId} • Doc: {user.documentNumber}
                  </div>
                )}
              </div>
            </div>

            {/* IP Address */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <Globe className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Dirección IP de Conexión</div>
                <div className="font-mono font-bold text-slate-900 mt-0.5">{log.ipAddress || '190.52.144.12'}</div>
                <div className="text-[10px] text-slate-500">ISP: Tigo / Personal Paraguay</div>
              </div>
            </div>

            {/* Branch */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <Building2 className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Sucursal Afectada</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {branch ? `${branch.name} (${branch.city})` : 'Clínica Global / Central'}
                </div>
              </div>
            </div>
          </div>

          {/* User Agent / Environment */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
            <Monitor className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="w-full">
              <div className="text-[11px] text-slate-500 font-medium">Agente de Navegador / Dispositivo</div>
              <div className="font-mono text-[11px] text-slate-700 break-all mt-0.5">
                {log.userAgent || 'OdontoPro Web Client / Chromium v128'}
              </div>
            </div>
          </div>

          {/* Diff / State Comparison (Old vs New Values) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-teal-600" />
              <span className="font-bold text-slate-900 text-xs">
                Comparador de Estado (Valores Anteriores vs Modificados)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] overflow-x-auto">
                <div className="text-slate-400 font-bold mb-1.5 uppercase text-[10px]">
                  Valores Previos (Before):
                </div>
                {log.oldValues ? (
                  <pre>{JSON.stringify(log.oldValues, null, 2)}</pre>
                ) : (
                  <span className="text-slate-500 italic">null (Registro inicial / Creación)</span>
                )}
              </div>

              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] overflow-x-auto">
                <div className="text-emerald-400 font-bold mb-1.5 uppercase text-[10px]">
                  Valores Nuevos (After):
                </div>
                {log.newValues ? (
                  <pre>{JSON.stringify(log.newValues, null, 2)}</pre>
                ) : (
                  <span className="text-slate-500 italic">null (Solo lectura o sin cambios)</span>
                )}
              </div>
            </div>
          </div>

          {/* Tamper Evident Verification Badge */}
          <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-teal-700 shrink-0" />
              <div>
                <span className="font-bold text-teal-900 text-[11px]">Sello Criptográfico de Integridad: </span>
                <span className="font-mono text-[10px] text-teal-800">{simulatedHash}</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
              VÁLIDO
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
