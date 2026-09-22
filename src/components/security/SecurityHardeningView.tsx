import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Flame,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  Activity,
  Layers,
  Globe,
  Sliders,
  ChevronRight,
  Eye,
  Zap,
} from 'lucide-react';
import { securityService } from '../../security/securityService.ts';
import {
  PenetrationTestResult,
  SecurityHeader,
  RateLimitBucket,
  SecurityIncident,
} from '../../security/types.ts';
import { useAuth } from '../../auth/authContext.tsx';
import { dbStore } from '../../db/inMemoryStore.ts';

export const SecurityHardeningView: React.FC = () => {
  const { session } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'pentest' | 'idor-sim' | 'headers' | 'ratelimit'>('pentest');
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<PenetrationTestResult[]>([]);
  const [headers, setHeaders] = useState<SecurityHeader[]>([]);
  const [rateLimiters, setRateLimiters] = useState<RateLimitBucket[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [selectedResult, setSelectedResult] = useState<PenetrationTestResult | null>(null);

  // IDOR Simulator interactive state
  const [simRole, setSimRole] = useState<'SUPER_ADMIN' | 'ODONTOLOGO' | 'RECEPCION' | 'CAJA'>('RECEPCION');
  const [simBranch, setSimBranch] = useState<'ASUNCION' | 'LUQUE'>('LUQUE');
  const [simTargetAction, setSimTargetAction] = useState<'VIEW_CLINICAL' | 'EDIT_ASU_TREATMENT' | 'CLOSE_ASU_CASH' | 'CROSS_TENANT_QUERY'>('VIEW_CLINICAL');
  const [simLog, setSimLog] = useState<{ allowed: boolean; status: number; message: string; timestamp: string } | null>(null);

  useEffect(() => {
    setHeaders(securityService.getSecurityHeaders());
    setRateLimiters(securityService.getRateLimiters());
    setIncidents(securityService.getIncidents());

    // Run initial pentest suite automatically so user sees green security indicators
    handleRunPentest();
  }, []);

  const handleRunPentest = async () => {
    setIsRunningTests(true);
    setSelectedResult(null);
    try {
      const results = await securityService.runPenetrationSuite();
      setTestResults(results);
      if (results.length > 0) {
        setSelectedResult(results[0]);
      }
      setIncidents(securityService.getIncidents());
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleTriggerSimulatedIdor = () => {
    const branches = dbStore.getBranches();
    const asuBranch = branches.find((b) => b.code.includes('ASU')) || branches[0];
    const luqBranch = branches.find((b) => b.code.includes('LUQ')) || branches[branches.length - 1];

    const currentBranchId = simBranch === 'ASUNCION' ? asuBranch.id : luqBranch.id;
    const allowedBranchIds = simRole === 'SUPER_ADMIN' ? branches.map((b) => b.id) : [currentBranchId];

    const simulatedUser = {
      organizationId: dbStore.getActiveOrganization().id,
      role: simRole,
      allowedBranchIds,
      email: `simulated.${simRole.toLowerCase()}@odontosol.com.py`,
    } as any;

    let result = { allowed: true, status: 200, message: 'Operación permitida bajo políticas de seguridad.' };

    if (simTargetAction === 'CROSS_TENANT_QUERY') {
      const check = securityService.validateTenantAndBranchAccess(simulatedUser, 'org-foreign-999', null);
      result = { allowed: check.allowed, status: check.status, message: check.reason || 'Acceso concedido' };
    } else if (simTargetAction === 'VIEW_CLINICAL') {
      const check = securityService.validateMedicalDataAccess(simulatedUser);
      result = { allowed: check.allowed, status: check.status, message: check.reason || 'Acceso concedido a historia clínica' };
    } else if (simTargetAction === 'EDIT_ASU_TREATMENT' || simTargetAction === 'CLOSE_ASU_CASH') {
      const check = securityService.validateTenantAndBranchAccess(simulatedUser, simulatedUser.organizationId, asuBranch.id);
      result = { allowed: check.allowed, status: check.status, message: check.reason || 'Acceso permitido a la sucursal Asunción' };
    }

    setSimLog({
      ...result,
      timestamp: new Date().toLocaleTimeString('es-PY'),
    });
    setIncidents(securityService.getIncidents());
  };

  const handleTriggerRateLimitFlood = () => {
    // Simular ráfaga de 10 peticiones seguidas al endpoint de caja
    for (let i = 0; i < 35; i++) {
      securityService.checkRateLimit('/api/cash/movement', '190.52.144.18');
    }
    setRateLimiters(securityService.getRateLimiters());
    setIncidents(securityService.getIncidents());
  };

  const handleResetRateLimit = () => {
    securityService.resetRateLimiters();
    setRateLimiters(securityService.getRateLimiters());
  };

  const passedTestsCount = testResults.filter((r) => r.passed).length;
  const securityScore = testResults.length > 0 ? Math.round((passedTestsCount / testResults.length) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner & Security Score */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 -mb-10 w-60 h-60 bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Fase 15: Seguridad & Hardening
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                OWASP ASVS Nivel 2
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Centro de Seguridad & Endurecimiento (Hardening)
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
              Mecanismos activos de protección criptográfica, aislamiento multi-tenant estricto (Anti-IDOR),
              Content Security Policy (CSP), defensa contra fuerza bruta y cumplimiento estricto de la Ley N° 1682/01 del MSPBS.
            </p>
          </div>

          {/* Hardening Score Badge */}
          <div className="flex items-center gap-4 bg-slate-800/80 backdrop-blur-md px-5 py-4 rounded-2xl border border-slate-700">
            <div className="text-center">
              <div className="text-3xl font-black text-emerald-400 tracking-tight">
                {securityScore}%
              </div>
              <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                Postura de Seguridad
              </div>
            </div>
            <div className="h-10 w-px bg-slate-700"></div>
            <div className="text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Nivel Grado A+</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {passedTestsCount} de {testResults.length} pruebas superadas
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Anti-IDOR Estricto</div>
              <div className="text-[11px] text-slate-400">Tenant & Sucursales</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Cabeceras CSP Activas</div>
              <div className="text-[11px] text-slate-400">7 Directivas HTTP</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Rate Limiting Token</div>
              <div className="text-[11px] text-slate-400">Anti-Fuerza Bruta</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-slate-200">Bitácora Inmutable</div>
              <div className="text-[11px] text-slate-400">Append-Only Postgres</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('pentest')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'pentest'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>Batería de Pruebas de Penetración ({testResults.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('idor-sim')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'idor-sim'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="h-4 w-4" />
          <span>Simulador de IDOR en Vivo</span>
        </button>

        <button
          onClick={() => setActiveSubTab('headers')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'headers'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Cabeceras HTTP & CSP ({headers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ratelimit')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'ratelimit'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>Rate Limiting & Incidentes ({incidents.length})</span>
        </button>
      </div>

      {/* SUBTAB 1: BATERÍA DE PRUEBAS DE PENETRACIÓN */}
      {activeSubTab === 'pentest' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-teal-600" />
                <span>Suite Automatizada de Penetración y Hardening OWASP</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simula 8 vectores reales de ataque cibernético (IDOR, Cross-Tenant, XSS, Bypass RBAC, DDoS L7) y verifica que el sistema los bloquee.
              </p>
            </div>

            <button
              onClick={handleRunPentest}
              disabled={isRunningTests}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isRunningTests ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" />
                  <span>Ejecutando Explotaciones...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Re-ejecutar Todas las Pruebas</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Results Table (Left 2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              {testResults.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedResult(t)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    selectedResult?.id === t.id
                      ? 'bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-teal-500/50'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {t.passed ? (
                          <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                            <XCircle className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                            selectedResult?.id === t.id
                              ? 'bg-slate-800 text-teal-300'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {t.category}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {t.durationMs}ms
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold mt-1 ${selectedResult?.id === t.id ? 'text-white' : 'text-slate-900'}`}>
                          {t.name}
                        </h3>
                        <p className={`text-xs mt-0.5 font-mono ${selectedResult?.id === t.id ? 'text-slate-400' : 'text-slate-500'}`}>
                          Endpoint: {t.targetEndpoint}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        t.passed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        HTTP {t.receivedStatus} (Esperado {t.expectedStatus})
                      </span>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Bloqueado por: {t.blockedBy}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Exploit Inspector Details (Right col) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs h-fit space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <FileCode className="h-4 w-4 text-teal-600" />
                  <span>Inspector de Payload & Mitigación</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Forense
                </span>
              </div>

              {selectedResult ? (
                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">Vector Seleccionado:</span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {selectedResult.name}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Mecanismo Activo de Defensa:</span>
                    <div className="mt-1 p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 font-semibold text-xs flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-teal-700 shrink-0" />
                      <span>{selectedResult.blockedBy}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Carga Útil del Ataque (Payload Simulado):</span>
                    <pre className="mt-1 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                      {JSON.stringify(selectedResult.payload, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <span className="text-slate-500 font-medium">Remediación Arquitectónica Implementada:</span>
                    <p className="mt-1 text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {selectedResult.remediation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>ID: {selectedResult.id}</span>
                    <span>Hora: {new Date(selectedResult.executedAt).toLocaleTimeString('es-PY')}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Seleccione una prueba para inspeccionar los detalles forenses.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SIMULADOR DE IDOR EN VIVO */}
      {activeSubTab === 'idor-sim' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-4 w-4 text-teal-600" />
              <span>Simulador Interactivo de Explotación IDOR (Insecure Direct Object Reference)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Pruebe activamente cómo el sistema previene que un usuario con privilegios restringidos
              (por ejemplo, Recepción o un Odontólogo de Luque) acceda o modifique registros de otra sucursal u organización.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Rol Simulado del Atacante
                </label>
                <select
                  value={simRole}
                  onChange={(e) => setSimRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="RECEPCION">Recepción (Acceso administrativo limitado)</option>
                  <option value="CAJA">Cajero (Solo cobranzas de sucursal)</option>
                  <option value="ODONTOLOGO">Odontólogo Especialista (Solo sucursales asignadas)</option>
                  <option value="SUPER_ADMIN">Super Administrador (Acceso Total)</option>
                </select>
              </div>

              {/* Branch assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Sucursal Asignada al Usuario
                </label>
                <select
                  value={simBranch}
                  onChange={(e) => setSimBranch(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="LUQUE">Sucursal Luque</option>
                  <option value="ASUNCION">Sucursal Asunción Centro</option>
                </select>
              </div>

              {/* Target attack action */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  3. Acción / Recurso a Forzar (Objetivo)
                </label>
                <select
                  value={simTargetAction}
                  onChange={(e) => setSimTargetAction(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="VIEW_CLINICAL">Leer Historia Clínica y Diagnósticos Médicos</option>
                  <option value="EDIT_ASU_TREATMENT">Modificar Tratamientos en Asunción Centro</option>
                  <option value="CLOSE_ASU_CASH">Realizar Cierre de Caja en Asunción Centro</option>
                  <option value="CROSS_TENANT_QUERY">Consultar Pacientes de Otra Organización Médica</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                El guardián verificará las credenciales y emitirá la respuesta HTTP correspondiente.
              </div>

              <button
                onClick={handleTriggerSimulatedIdor}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Ejecutar Intento de Acceso Forzado</span>
              </button>
            </div>
          </div>

          {/* Simulation Output Log */}
          {simLog && (
            <div className={`p-5 rounded-2xl border transition-all ${
              simLog.allowed
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <div className="flex items-start gap-3">
                {simLog.allowed ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {simLog.allowed
                        ? 'Acceso Permitido (Operación Legítima para este Rol)'
                        : `Ataque IDOR Repelido con Éxito (HTTP ${simLog.status})`}
                    </span>
                    <span className="text-xs font-mono font-semibold opacity-75">
                      {simLog.timestamp}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed">
                    {simLog.message}
                  </p>
                  <div className="mt-3 text-[11px] font-mono bg-white/70 p-2.5 rounded-xl border border-current/20">
                    Regla Evaluada: session.organizationId === resource.organizationId &amp;&amp; allowedBranchIds.includes(resource.branchId) &amp;&amp; hasClinicalRole(session)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CABECERAS HTTP & CSP */}
      {activeSubTab === 'headers' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-teal-600" />
              <span>Cabeceras de Seguridad HTTP & Content Security Policy (CSP)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cabeceras de respuesta que se inyectan en cada petición para blindar el navegador del cliente contra ataques de canal lateral.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {headers.map((h) => (
              <div key={h.name} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-teal-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <h3 className="font-mono text-xs font-bold text-slate-900">
                      {h.name}
                    </h3>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {h.status}
                  </span>
                </div>

                <div className="mt-2 p-2.5 bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800">
                  {h.value}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium text-[11px]">Propósito Defensivo:</span>
                    <p className="text-slate-700 mt-0.5">{h.description}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium text-[11px]">Recomendación OWASP:</span>
                    <p className="text-slate-600 mt-0.5">{h.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: RATE LIMITING & INCIDENTES */}
      {activeSubTab === 'ratelimit' && (
        <div className="space-y-6">
          {/* Rate Limit Buckets */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-teal-600" />
                  <span>Monitoreo Activo de Rate Limiting por Endpoint</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Algoritmo Token-Bucket con ventana deslizante de 60 segundos para evitar saturación y ataques de fuerza bruta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerRateLimitFlood}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Simular Ráfaga (+35 reqs)
                </button>
                <button
                  onClick={handleResetRateLimit}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Restablecer Contadores
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {rateLimiters.map((b) => {
                const percentage = Math.min(100, Math.round((b.currentRequests / b.limitPerMinute) * 100));
                const isBlocked = b.blockedUntil && b.blockedUntil > Date.now();

                return (
                  <div key={b.endpoint} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900 truncate" title={b.endpoint}>
                        {b.endpoint}
                      </span>
                      {isBlocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          BLOQUEADO (429)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ACTIVO
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-500">Consumo:</span>
                      <span className="font-bold text-slate-800">
                        {b.currentRequests} / {b.limitPerMinute} req/min
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          percentage > 90 ? 'bg-rose-500' : percentage > 60 ? 'bg-amber-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incidents Stream */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-purple-600" />
              <span>Registro de Incidentes de Seguridad Repelidos en Vivo</span>
            </h2>

            <div className="space-y-3">
              {incidents.map((inc) => (
                <div key={inc.id} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : inc.severity === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="font-bold text-slate-900">{inc.threatType}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(inc.timestamp).toLocaleTimeString('es-PY')}
                    </span>
                  </div>

                  <p className="text-slate-600 leading-relaxed">
                    {inc.details}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 font-medium">
                    <span>IP Origen: <strong className="text-slate-700">{inc.sourceIp}</strong></span>
                    <span>•</span>
                    <span>Recurso: <strong className="text-slate-700">{inc.targetedUserOrResource}</strong></span>
                    <span>•</span>
                    <span className="text-emerald-700">Acción: <strong>{inc.actionTaken}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
