import React from 'react';
import { X, ShieldCheck, Check, Lock, AlertTriangle, FileText } from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';

interface RolePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSIONS = [
  {
    module: 'Historia Clínica & Odontograma (FDI)',
    actions: [
      { name: 'Ver historial clínico y evolución', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ODONTOLOGO'] },
      { name: 'Editar odontograma y planes de tratamiento', roles: ['SUPER_ADMIN', 'ODONTOLOGO'] },
      { name: 'Emitir recetas médicas con registro MSPBS', roles: ['ODONTOLOGO'] },
      { name: 'Ver antecedentes y alertas médicas (Anamnesis)', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION'] },
    ],
  },
  {
    module: 'Agendamiento & Turnos',
    actions: [
      { name: 'Ver calendario y agenda general', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'ODONTOLOGO', 'RECEPCION', 'VENDEDOR'] },
      { name: 'Crear, reprogramar o cancelar turnos', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'RECEPCION', 'VENDEDOR'] },
      { name: 'Bloquear horarios propios del profesional', roles: ['ODONTOLOGO'] },
      { name: 'Confirmar asistencia y sala de espera', roles: ['SUPER_ADMIN', 'ADMIN_SUCURSAL', 'RECEPCION'] },
    ],
  },
  {
    module: 'Ventas, Presupuestos & Caja (PYG)',
    actions: [
      { name: 'Cotizar y emitir presupuestos dentales', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'VENDEDOR', 'ODONTOLOGO', 'RECEPCION'] },
      { name: 'Apertura y cierre de caja chica', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'CAJA'] },
      { name: 'Registrar cobros (Efectivo, SIPAP, QR Bancard)', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'CAJA'] },
      { name: 'Emisión de recibos y facturas legales', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL', 'CAJA'] },
      { name: 'Ver balances financieros consolidados', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL'] },
    ],
  },
  {
    module: 'Configuración & Auditoría',
    actions: [
      { name: 'Gestión de clínicas y sucursales', roles: ['SUPER_ADMIN'] },
      { name: 'Alta, baja y asignación de usuarios', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL'] },
      { name: 'Autoridad para crear y modificar Roles', roles: ['SUPER_ADMIN'] },
      { name: 'Bitácora inmutable de auditoría forense', roles: ['SUPER_ADMIN', 'SUPERVISOR'] },
      { name: 'Configuración de catálogo y precios', roles: ['SUPER_ADMIN', 'SUPERVISOR', 'ADMIN_SUCURSAL'] },
    ],
  },
];

export const RolePermissionsModal: React.FC<RolePermissionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  const roles = dbStore.getRoles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Matriz de Permisos y Control de Acceso (RBAC)
              </h3>
              <p className="text-xs text-slate-500">
                Conforme a la Ley N° 1682/01 y normativas del MSPBS de Paraguay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Roles summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {roles.map((r: any) => (
              <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="text-xs font-bold text-slate-900 truncate">{r.name}</div>
                <div className="text-[10px] font-mono text-teal-700 font-semibold truncate">{r.id}</div>
              </div>
            ))}
          </div>

          {/* Permissions table */}
          <div className="space-y-4">
            {PERMISSIONS.map((group, gIdx) => (
              <div key={gIdx} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-100/80 px-4 py-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {group.module}
                </div>

                <div className="divide-y divide-slate-100">
                  {group.actions.map((act, aIdx) => (
                    <div
                      key={aIdx}
                      className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/60"
                    >
                      <span className="text-xs font-medium text-slate-800">{act.name}</span>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {roles.map((r: any) => {
                          const hasAccess = act.roles.includes(r.id) || (r.allowedNavTabs && r.allowedNavTabs.includes('dashboard') && r.id === 'SUPER_ADMIN');
                          return (
                            <span
                              key={r.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                                hasAccess
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-400 opacity-50'
                              }`}
                            >
                              {hasAccess ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <Lock className="h-2.5 w-2.5 text-slate-400" />
                              )}
                              <span>{r.name.split(' ')[0]}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Ley de Protección de Datos Médicos (Paraguay):</strong> El personal administrativo y de recepción tiene
              restringido el acceso a notas de diagnóstico y procedimientos clínicos confidenciales, visualizando
              únicamente alertas esenciales de anamnesis (alergias o patologías de riesgo).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
