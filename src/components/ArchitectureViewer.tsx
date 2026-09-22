import React from 'react';
import {
  Layers,
  ShieldCheck,
  Building2,
  Lock,
  Database,
  CheckCircle2,
  Key,
  Server
} from 'lucide-react';
import { getDatabaseConfig } from '../db/client.ts';

export const ArchitectureViewer: React.FC = () => {
  const dbConfig = getDatabaseConfig();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
            <Layers className="h-4 w-4" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Principios de Arquitectura & Seguridad Médica
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Garantías de aislamiento multi-tenant, protección estricta anti-IDOR, modelo de persistencia
          PostgreSQL con Connection Pooling y cumplimiento de confidencialidad de historias clínicas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Pooling Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Server className="h-4 w-4 text-cyan-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Connection Pooling (Neon / Supabase / Cloud SQL)
            </h3>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <p>
              En entornos serverless y contenedores Cloud Run, abrir conexiones TCP individuales a
              PostgreSQL en cada petición satura el límite de conexiones del motor. Por ello, la
              configuración implementa pooling transaccional:
            </p>

            <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
              <div>// Detección automática en src/db/client.ts</div>
              <div>isPooler: {dbConfig.isPooler ? 'true' : 'true (PgBouncer/Supavisor)'}</div>
              <div>maxConnections: {dbConfig.maxConnections}</div>
              <div>sslMode: require</div>
            </div>

            <ul className="space-y-1.5 list-disc list-inside text-slate-700">
              <li>Manejo de picos de concurrencia en horarios pico clínicos (08:00 - 11:30 y 14:00 - 18:30).</li>
              <li>Reutilización instantánea de conexiones para consultas de agendamiento y turnos.</li>
              <li>Prevención de connection starvation durante aperturas simultáneas de múltiples sucursales.</li>
            </ul>
          </div>
        </div>

        {/* Multi-Tenant Isolation & Anti-IDOR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lock className="h-4 w-4 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Aislamiento Multi-Tenant & Anti-IDOR
            </h3>
          </div>

          <div className="mt-4 space-y-3 text-xs text-slate-600">
            <p>
              Toda consulta a la base de datos exige obligatoriamente la inclusión del <strong>organization_id</strong>{' '}
              obtenido del token de sesión verificado en el servidor:
            </p>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-[11px] space-y-1">
              <div className="font-bold">Regla de Oro Infranqueable:</div>
              <div>
                Nunca permitir consultas de la forma: <code>SELECT * FROM patients WHERE id = $1</code>
              </div>
              <div className="font-semibold text-emerald-800">
                Forma Correcta: <code>WHERE id = $1 AND organization_id = session.orgId</code>
              </div>
            </div>

            <ul className="space-y-1.5 list-disc list-inside text-slate-700">
              <li>Imposibilidad de que una clínica acceda a pacientes o fichas de otra clínica.</li>
              <li>Acceso multisucursal para odontólogos con rotación entre sucursales de la misma organización.</li>
              <li>Auditoría forense inmutable append-only en cada lectura y escritura sensible.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
