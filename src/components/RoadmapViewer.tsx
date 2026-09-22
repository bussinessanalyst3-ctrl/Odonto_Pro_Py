import React from 'react';
import { CalendarDays, CheckCircle2, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface RoadmapPhase {
  id: number;
  title: string;
  status: 'completed' | 'current' | 'pending';
  desc: string;
  deliverables: string[];
}

const PHASES: RoadmapPhase[] = [
  {
    id: 1,
    title: 'Arquitectura y Fundaciones',
    status: 'completed',
    desc: 'Definición multi-tenant, multi-sucursal, stack y documentación maestra.',
    deliverables: ['README.md', 'ARCHITECTURE.md', 'SECURITY.md', 'DATABASE.md', 'ROADMAP.md'],
  },
  {
    id: 2,
    title: 'Base de Datos y Migraciones',
    status: 'completed',
    desc: 'Esquemas Drizzle ORM, DDL PostgreSQL, Connection Pooling y Catálogos de Paraguay.',
    deliverables: [
      'Esquemas Drizzle ORM (16 tablas)',
      'Migración 0000_init_schema.sql',
      'Connection Pooling (Neon / Supabase)',
      '17 Departamentos de Paraguay + Asunción',
      'Aranceles base en Guaraníes (₲)'
    ],
  },
  {
    id: 3,
    title: 'Autenticación Segura y Sesión',
    status: 'completed',
    desc: 'Sesiones criptográficas, cookies HttpOnly/SameSite=Lax, protección contra fuerza bruta y RBAC.',
    deliverables: [
      'Pantalla de Login Clínico Responsive',
      'Protección Brute-Force (5 intentos / 15 min lock)',
      'Tokens Criptográficos UUIDv4 & TTL 8h',
      'Selector de Sucursales Asignadas Anti-IDOR',
      'Auditoría Inmutable en audit_logs'
    ],
  },
  {
    id: 4,
    title: 'Organizaciones y Sucursales',
    status: 'completed',
    desc: 'Gestor multi-sucursal con configuración local, sillones dentales y selector de contexto en tiempo real.',
    deliverables: [
      'Gestión Institucional (RUC y Razón Social)',
      'ABM de Sucursales (17 Deptos + Asunción)',
      'Configuración de Sillones Odontológicos',
      'Políticas de Agendamiento & Bloqueo Concurrente',
      'Series Legales de Comprobantes'
    ],
  },
  {
    id: 5,
    title: 'Usuarios y Permisos (RBAC)',
    status: 'completed',
    desc: 'Roles (SuperAdmin, Admin Sucursal, Odontólogo, Recepción, Caja), registro MSPBS y asignación de sucursales.',
    deliverables: [
      'Matriz de Permisos por Rol (RBAC)',
      'Habilitación Sanitaria Registro MSPBS',
      'Asignación Multi-Sucursal Estricta',
      'Restablecimiento Seguro & Auditoría'
    ],
  },
  {
    id: 6,
    title: 'Módulo de Pacientes & Ficha Médica Única',
    status: 'completed',
    desc: 'Ficha médica única para Paraguay con C.I., RUC, teléfono +595, WhatsApp y alertas médicas de anamnesis.',
    deliverables: [
      'Alta y Edición de Paciente (C.I. / RUC / Pasaporte)',
      'Anamnesis & Alertas Críticas (Penicilina, HTA)',
      'Búsqueda Avanzada y Filtros por Sucursal',
      'Historial Multi-Sucursal Visitadas',
      'Enlace Directo a WhatsApp Oficial (+595)'
    ],
  },
  {
    id: 7,
    title: 'Agenda Odontológica & Control de Sillones',
    status: 'completed',
    desc: 'Calendario por sillón dental y sucursal, control de estados (En Sala, En Atención), y prevención algorítmica estricta de doble reserva.',
    deliverables: [
      'Calendario Interactivo Diario y Multidisciplinario',
      'Asignación y Filtros por Sillón Clínico (Dental Chairs)',
      'Bloqueo Concurrente Anti-Solapamiento (Double Booking)',
      'Gestión de Ciclo de Cita (Pendiente, Sala, En Atención, Finalizada)',
      'Recordatorio Rápido Vía WhatsApp (+595)'
    ],
  },
  {
    id: 8,
    title: 'Historia Clínica & Evolución Sanitaria',
    status: 'completed',
    desc: 'Ficha médica confidencial unificada por paciente con diagnósticos, evolución firmada con Registro MSPBS y control RBAC.',
    deliverables: [
      'Registro de Evolución Clínica y Tratamiento Efectuado',
      'Firma Electrónica Médica con Registro Profesional MSPBS',
      'Cumplimiento Ley N° 1682/01 de Secreto Profesional',
      'Prescripciones Farmacológicas e Indicaciones Pos-operatorias',
      'Restricción Estricta para Roles Administrativos (Recepción/Caja)'
    ],
  },
  {
    id: 9,
    title: 'Odontograma Digital Interactivo (FDI)',
    status: 'completed',
    desc: 'Odontograma interactivo anatómico SVG (32 piezas permanentes y 20 temporales) con superficies anatómicas, paleta rápida de estados (caries, obturación, corona, endodoncia, ausente, implante), evoluciones versionadas e índice epidemiológico CPO-D.',
    deliverables: [
      'Visualizador Anatómico SVG/FDI (11-85)',
      'Selección de Superficies Dentales (O, M, D, V, L/P)',
      'Pincel Rápido de Diagnósticos Clínicos',
      'Historial de Evoluciones Versionadas (v1, v2...)',
      'Índice Epidemiológico CPO-D Automático'
    ],
  },
  {
    id: 10,
    title: 'Tratamientos & Catálogo en Guaraníes',
    status: 'completed',
    desc: 'Catálogo de aranceles odontológicos por especialidad, matriz de precios diferenciados por sucursal, planes de tratamiento vinculados a piezas FDI y registro de cobros en PYG.',
    deliverables: [
      'Catálogo por Especialidad con Duración y Precio PYG',
      'Personalización de Precios por Sucursal (Asunción, San Lorenzo, Luque)',
      'Vinculación de Tratamientos a Piezas Dentales FDI',
      'Seguimiento de Estados (Planificado, En Progreso, Completado)',
      'Cobro de Cuotas con Recibo Oficial y Saldo en Guaraníes'
    ],
  },
  {
    id: 11,
    title: 'Presupuestos en Guaraníes (Quotes)',
    status: 'completed',
    desc: 'Generador formal de cotizaciones clínicas en PYG sin decimales, descuentos, membrete oficial, aprobación con auto-creación de plan de tratamiento y envío por WhatsApp.',
    deliverables: [
      'Cotizador de Procedimientos en PYG sin Decimales',
      'Descuentos Porcentuales y Montos Fijos',
      'Documento Imprimible con Membrete y Registro MSPBS',
      'Compartir por WhatsApp Directo al Paciente (+595)',
      'Aprobación con Conversión Automática a Tratamiento'
    ],
  },
  {
    id: 12,
    title: 'Caja Diaria y Pagos (PYG)',
    status: 'completed',
    desc: 'Gestión de caja chica por sucursal, cobros por efectivo, transferencias SIPAP, QR y POS, arqueo y cierre diario con cálculo de sobrantes/faltantes y emisión de recibos oficiales.',
    deliverables: [
      'Apertura de Turno con Fondo Inicial de Cambio (PYG)',
      'Asientos de Ingresos y Egresos (Efectivo, SIPAP, QR, POS)',
      'Recibos Oficiales de Pago con Numeración Secuencial',
      'Arqueo y Cierre con Validación de Saldo Físico vs Teórico',
      'Discriminación de Cobros Bancarios vs Efectivo en Cajón'
    ],
  },
  {
    id: 13,
    title: 'Reportes y Dashboard Adaptativo',
    status: 'completed',
    desc: 'Dashboard dinámico con perspectivas por rol (Directiva, Odontólogos y Recepción), liquidación de comisiones con cálculo de IRP, y consolidación de ingresos por medios de pago (SIPAP, QR y POS).',
    deliverables: [
      'Dashboard Adaptativo por Rol (Admin, Odontólogo, Recepción)',
      'Consolidado Financiero en PYG y Desglose por Sucursal',
      'Distribución de Cobros (SIPAP, QR Bancard, Efectivo, Tarjetas)',
      'Liquidación de Comisiones y Rendimiento Profesional',
      'Exportación Completa a CSV / Excel e Impresión Formal'
    ],
  },
  {
    id: 14,
    title: 'Auditoría Inmutable & Compliance MSPBS',
    status: 'completed',
    desc: 'Libro inmutable de eventos con trazabilidad estricta según Ley N° 1682/01 y normas MSPBS de Paraguay, registro de IPs, timestamps, comparador Before/After y sello de integridad.',
    deliverables: [
      'Visor Forense con Búsqueda Textual y Filtros Múltiples',
      'Trazabilidad de Accesos a Fichas Clínicas Sensibles (MSPBS)',
      'Registro de Direcciones IP Paraguayas y User Agents',
      'Inspector Detallado con Comparador de Estados (Before/After)',
      'Sello Criptográfico SHA-256 y Exportación a CSV'
    ],
  },
  {
    id: 15,
    title: 'Seguridad y Hardening OWASP ASVS',
    status: 'completed',
    desc: 'Auditoría anti-IDOR cross-tenant y cross-branch, 8 vectores de pruebas de penetración automatizadas, simulador interactivo de explotación, cabeceras HTTP defensivas (CSP, HSTS) y token-bucket rate limiter.',
    deliverables: [
      'Batería Automatizada de Pentest (8 Vectores OWASP)',
      'Simulador Interactivo de Explotación IDOR en Tiempo Real',
      'Despliegue de Cabeceras HTTP Defensivas y CSP Estricto',
      'Token-Bucket Rate Limiting (Protección Anti-Fuerza Bruta)',
      'Monitor de Incidentes y Repelido Activo de Amenazas'
    ],
  },
  {
    id: 16,
    title: 'Testing Automatizado (Unitarios, Integración & E2E)',
    status: 'completed',
    desc: 'Suite completa de tests unitarios de moneda PYG, validaciones paraguayas (RUC Módulo 11, CI, Teléfonos), tests de integración multi-tenant y tests End-to-End de flujos clínicos.',
    deliverables: [
      'Tests Unitarios de Finanzas PYG y Redondeo sin Decimales',
      'Validación de RUC con Dígito Verificador Módulo 11 SET/DNIT',
      'Validaciones de Cédulas (CI) y Formato Telefónico Paraguay',
      'Tests de Integración y Aislamiento Multi-Tenant / Sucursales',
      'Tests E2E: Recepción -> Odontograma -> Presupuesto -> Cobro QR'
    ],
  },
  {
    id: 17,
    title: 'Despliegue Vercel, Producción & Go-Live',
    status: 'completed',
    desc: 'Pipeline CI/CD en GitHub Actions, enrutamiento Vercel Edge en región gru1 (São Paulo), cabeceras de seguridad bancarias A+ y checklist de salida a producción para clínicas de Paraguay.',
    deliverables: [
      'Configuración vercel.json con Región gru1 y Compresión',
      'Cabeceras HTTP Defensivas A+ (HSTS Preload 2 Años, CSP)',
      'Pipeline CI/CD en .github/workflows/ci-cd-vercel.yml',
      'Checklist Go-Live Paraguay (MSPBS, e-Kuatia, Bancard)',
      'Monitor de Salud, Latencia en Vivo y Variables de Entorno'
    ],
  },
];

export const RoadmapViewer: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Roadmap de Ejecución Modular (17 Fases)
              </h2>
              <p className="text-xs text-slate-500">
                Progreso actual: 17 de 17 Fases completadas con éxito (100% Roadmap Completo).
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-emerald-600">17 / 17 Fases (100%)</div>
            <div className="w-36 bg-slate-100 rounded-full h-2 mt-1 overflow-hidden">
              <div className="bg-emerald-500 h-full w-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Phases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PHASES.map((phase) => (
          <div
            key={phase.id}
            className={`p-4 rounded-xl border transition-all ${
              phase.status === 'completed'
                ? 'bg-white border-emerald-300 shadow-xs'
                : phase.status === 'current'
                ? 'bg-teal-50/50 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                : 'bg-white border-slate-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-slate-500">
                FASE {String(phase.id).padStart(2, '0')}
              </span>
              {phase.status === 'completed' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" />
                  Completada
                </span>
              )}
              {phase.status === 'current' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white animate-pulse">
                  <Clock className="h-3 w-3" />
                  Siguiente (Fase 4)
                </span>
              )}
              {phase.status === 'pending' && (
                <span className="text-[10px] font-medium text-slate-400">Planificada</span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">{phase.title}</h3>
            <p className="text-xs text-slate-600 mb-3">{phase.desc}</p>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              {phase.deliverables.map((d, idx) => (
                <div key={idx} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
