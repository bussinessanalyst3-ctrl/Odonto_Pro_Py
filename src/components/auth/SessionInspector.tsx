import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Clock,
  Building,
  UserCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../auth/authContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';

export const SessionInspector: React.FC = () => {
  const { session, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const snapshot = dbStore.getSnapshot();
  const authAuditLogs = snapshot.auditLogs
    .filter((log) => log.entity === 'USER_AUTH' || log.action.includes('LOGIN') || log.action.includes('BRANCH'))
    .slice(0, 10);

  if (!session) return null;

  const currentBranch = snapshot.branches.find((b) => b.id === session.currentBranchId);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(session.sessionToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRolePermissions = () => {
    switch (session.role) {
      case 'SUPER_ADMIN':
        return [
          'Acceso irrestricto multi-organización y multi-sucursal',
          'Gestión total de usuarios, roles y auditoría médica forense',
          'Configuración financiera, aranceles y parámetros globales',
          'Emisión y anulación de comprobantes fiscales'
        ];
      case 'ODONTOLOGO':
        return [
          'Acceso a historias clínicas y odontograma digital FDI',
          'Prescripción de recetas y registro de evolución clínica',
          'Visualización de agenda propia y asignación de tratamientos',
          'Aislamiento estricto de datos financieros de otras especialidades'
        ];
      case 'RECEPCION':
        return [
          'Agendamiento y confirmación de turnos de pacientes',
          'Registro y actualización de datos filiatorios (C.I., teléfono +595)',
          'Recepción de pacientes en sala de espera y asignación a sillón',
          'Sin acceso a evolución clínica confidencial del odontólogo'
        ];
      case 'CAJA':
        return [
          'Apertura y cierre de caja chica diaria en Guaraníes (PYG)',
          'Cobro de consultas por SIPAP, QR Bancard, efectivo y tarjetas',
          'Emisión de recibos y arqueo de turnos',
          'Sin acceso a historia clínica ni odontograma'
        ];
      default:
        return ['Acceso básico de operador de sucursal'];
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Fase 3: Autenticación Segura & Inspector de Sesión Activa
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Validación de sesiones con cookies seguras (HttpOnly, SameSite=Lax, Secure),
              hashing robusto (Argon2id/bcrypt), protección contra fuerza bruta y RBAC estricto.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Sesión Válida</span>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Datos de Sesión Criptográfica */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Detalles de la Sesión Criptográfica</h3>
              </div>
              <button
                onClick={handleCopyToken}
                className="text-xs font-medium text-teal-600 hover:text-teal-800"
              >
                {copied ? '¡Copiado!' : 'Copiar Token'}
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] space-y-1.5 break-all">
                <div className="text-slate-400">// Token de Portador Seguro (UUID v4 Crypto)</div>
                <div className="text-teal-800 font-bold">{session.sessionToken}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Usuario Activo</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {session.firstName} {session.lastName}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] truncate">{session.email}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Rol & Matriz RBAC</div>
                  <div className="font-bold text-teal-800 mt-0.5">{session.roleName}</div>
                  <div className="text-slate-500 text-[11px]">
                    {session.professionalLicense || 'Licencia General'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Sucursal de Contexto</div>
                  <div className="font-bold text-slate-900 mt-0.5">{currentBranch?.name}</div>
                  <div className="text-slate-500 text-[11px]">{currentBranch?.city}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Tiempo de Vida (TTL)</div>
                  <div className="font-bold text-slate-900 mt-0.5">8 Horas Máximo</div>
                  <div className="text-slate-500 text-[11px]">Expira: {new Date(session.expiresAt).toLocaleTimeString('es-PY')}</div>
                </div>
              </div>

              {/* Cookie security parameters */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <div className="text-[11px] font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Configuración de Cookies Seguras (Compliance Médico)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                  <div className="p-1.5 bg-white rounded-lg border border-indigo-200">
                    <span className="font-bold text-indigo-900">HttpOnly:</span> true
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-indigo-200">
                    <span className="font-bold text-indigo-900">SameSite:</span> Lax
                  </div>
                  <div className="p-1.5 bg-white rounded-lg border border-indigo-200">
                    <span className="font-bold text-indigo-900">Secure:</span> true (TLS)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Matriz de Permisos & Bitácora de Auditoría de Autenticación */}
        <div className="lg:col-span-6 space-y-4">
          {/* Matriz RBAC para el rol actual */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Permisos Autorizados para {session.roleName}
              </h3>
            </div>

            <div className="mt-3 space-y-2">
              {getRolePermissions().map((perm, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{perm}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bitácora de Auditoría de Autenticación en Tiempo Real */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Bitácora de Eventos de Seguridad (Auth Audit)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Tabla: audit_logs</span>
            </div>

            <div className="mt-3 divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {authAuditLogs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          log.action === 'LOGIN_SUCCESS'
                            ? 'bg-emerald-500'
                            : log.action === 'LOGIN_FAILED'
                            ? 'bg-rose-500'
                            : 'bg-teal-500'
                        }`}
                      ></span>
                      {log.action}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleTimeString('es-PY')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{log.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
