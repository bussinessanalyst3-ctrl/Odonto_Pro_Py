import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Play,
  Database,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { dbStore } from '../../db/inMemoryStore.ts';
import { formatPYG } from '../../db/seeds/paraguay-catalogs.ts';
import {
  buildTemplateCsv,
  HISTORICAL_IMPORT_TEMPLATES,
  HistoricalImportEntity,
  parseCsvText,
} from '../../utils/historicalCsv.ts';
import { hasBackendSession, postAuthoritativeAction } from '../../services/authoritativeApi.ts';

interface HistoricalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEntity?: HistoricalImportEntity;
  onImportCompleted?: (message: string) => void;
}

interface SimulationOutcome {
  rowNumber: number;
  status: 'VALID' | 'SKIPPED' | 'ERROR';
  summary: string;
  reason?: string;
  amountPyg?: number;
}

interface SimulationResult {
  mode: 'dry_run' | 'commit';
  entityType: HistoricalImportEntity;
  branchId: string;
  branchName: string;
  totalRows: number;
  validCount: number;
  skippedCount: number;
  errorCount: number;
  totalAmountPyg: number;
  totalPaidPyg: number;
  willCreatePatients: number;
  willCreateTreatments: number;
  willCreatePayments: number;
  outcomes: SimulationOutcome[];
  outcomesTruncated?: boolean;
  committed?: boolean;
  stateVersion?: number;
  upserts?: Record<string, any[]>;
}

export const HistoricalImportModal: React.FC<HistoricalImportModalProps> = ({
  isOpen,
  onClose,
  defaultEntity = 'patients',
  onImportCompleted,
}) => {
  const branches = dbStore.getBranches();
  const [entityType, setEntityType] = useState<HistoricalImportEntity>(defaultEntity);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntityType(defaultEntity);
      setSelectedBranchId((prev) => prev || dbStore.getBranches()[0]?.id || '');
      setErrorMsg(null);
      setSuccessMsg(null);
      setSimulation(null);
    }
  }, [isOpen, defaultEntity]);

  if (!isOpen) return null;

  const template = HISTORICAL_IMPORT_TEMPLATES[entityType];

  const handleEntityChange = (next: HistoricalImportEntity) => {
    setEntityType(next);
    setRawCsvText('');
    setFileName('');
    setParsedRows([]);
    setSimulation(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleDownloadTemplate = () => {
    const csv = buildTemplateCsv(entityType);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', template.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvInput = (text: string, sourceName = '') => {
    setRawCsvText(text);
    setFileName(sourceName);
    setSimulation(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }
    const parsed = parseCsvText(text);
    setParsedRows(parsed.rows);
    if (parsed.rows.length === 0) {
      setErrorMsg('El archivo no contiene filas de datos debajo de la cabecera.');
    } else if (parsed.rows.length > 1000) {
      setErrorMsg(`Se detectaron ${parsed.rows.length} filas. El máximo permitido por lote es 1.000 filas.`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('El archivo supera el límite de 5 MB. Divídalo en partes más pequeñas.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleCsvInput(String(reader.result || ''), file.name);
    };
    reader.onerror = () => {
      setErrorMsg('No se pudo leer el archivo seleccionado.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const runImportRequest = async (mode: 'dry_run' | 'commit') => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!hasBackendSession()) {
      setErrorMsg('Inicie sesión conectado al servidor para ejecutar la carga masiva histórica.');
      return;
    }
    if (parsedRows.length === 0) {
      setErrorMsg('Primero cargue un archivo CSV o pegue filas desde Excel.');
      return;
    }
    if (parsedRows.length > 1000) {
      setErrorMsg('El lote supera el límite de 1.000 filas por operación.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await postAuthoritativeAction<SimulationResult>('/api/historical-import', {
        entityType,
        mode,
        branchId: selectedBranchId || undefined,
        rows: parsedRows,
      });

      setSimulation(result);

      if (mode === 'commit' && result.committed) {
        if (result.upserts) {
          dbStore.applyAuthoritativeSync(result.upserts, result.stateVersion);
        } else {
          await dbStore.syncFromServer();
        }
        const msg = `Carga histórica guardada: ${result.validCount} registro(s) importado(s) en ${result.branchName} (${result.skippedCount} omitido(s), ${result.errorCount} con error).`;
        setSuccessMsg(msg);
        onImportCompleted?.(msg);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo procesar la planilla histórica.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold tracking-tight">
                Carga Masiva Histórica (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Importá registros de años anteriores con simulación previa. Nunca sobrescribe datos existentes ni altera la caja de hoy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto text-xs">
          {/* Paso 1: Tipo de carga y sucursal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['patients', 'treatments', 'payments'] as HistoricalImportEntity[]).map((key) => {
              const t = HISTORICAL_IMPORT_TEMPLATES[key];
              const active = entityType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleEntityChange(key)}
                  className={`p-3.5 rounded-2xl border text-left transition-all ${
                    active
                      ? 'bg-teal-50 border-teal-500 text-teal-950 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">{t.title}</div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">{t.description}</div>
                </button>
              );
            })}
          </div>

          {/* Sucursal + Descarga de plantilla */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Building2 className="h-4 w-4 text-teal-700 shrink-0" />
              <label htmlFor="hist-import-branch" className="font-bold text-slate-800">
                Sucursal destino:
              </label>
              <select
                id="hist-import-branch"
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  setSimulation(null);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 rounded-xl font-bold inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar Plantilla Excel (.csv)</span>
            </button>
          </div>

          {/* Guía de columnas esperadas */}
          <div className="p-3.5 bg-teal-50/50 border border-teal-200/80 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-teal-900">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              <span>Columnas de la planilla ({template.title}) — Orden recomendado:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {template.columns.map((c) => (
                <span
                  key={c.key}
                  className={`px-2 py-0.5 rounded-md font-mono text-[11px] border ${
                    c.required
                      ? 'bg-teal-100/80 text-teal-900 border-teal-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  {c.key}
                  {c.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-600">
              Orden sugerido si cargás todo desde cero: <strong>1) Pacientes</strong> → <strong>2) Tratamientos</strong> → <strong>3) Cobros</strong>. En Excel guardá como <em>CSV UTF-8 (delimitado por comas o punto y coma)</em> o pegá directamente las filas abajo.
            </p>
          </div>

          {/* Paso 2: Subir archivo o pegar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-bold text-slate-800">
                Subir archivo CSV o pegar filas desde Excel:
              </label>
              <label className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors self-start">
                <Upload className="h-3.5 w-3.5" />
                <span>{fileName ? `Archivo: ${fileName}` : 'Elegir archivo .csv'}</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={5}
              value={rawCsvText}
              onChange={(e) => handleCsvInput(e.target.value, '')}
              placeholder={`Pegá aquí el contenido copiado desde Excel (incluyendo la primera fila con los nombres de columnas) o subí un archivo .csv...\nEjemplo cabecera: ${template.columns.map((c) => c.key).join(';')}`}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            {parsedRows.length > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Filas detectadas listas para validar: <strong className="text-slate-900">{parsedRows.length}</strong> (máximo 1.000 por lote)
                </span>
                <button
                  type="button"
                  onClick={() => handleCsvInput('', '')}
                  className="text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Limpiar planilla
                </button>
              </div>
            )}
          </div>

          {/* Alertas */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-2 font-medium">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-start gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Paso 3: Resultado de Simulación / Vista Previa */}
          {simulation && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  {simulation.committed
                    ? 'Resumen de Carga Guardada'
                    : 'Resultado de Simulación (Vista Previa — Todavía NO se guardó nada)'}
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    simulation.committed
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  {simulation.committed ? 'GUARDADO EN BASE DE DATOS' : 'MODO SIMULACIÓN'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-semibold text-emerald-700">Válidos a importar</div>
                  <div className="text-xl font-black text-emerald-900">{simulation.validCount}</div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] font-semibold text-amber-700">Omitidos (ya existen)</div>
                  <div className="text-xl font-black text-amber-900">{simulation.skippedCount}</div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                  <div className="text-[11px] font-semibold text-rose-700">Con error</div>
                  <div className="text-xl font-black text-rose-900">{simulation.errorCount}</div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-600">Monto total lote</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {simulation.totalAmountPyg > 0 ? formatPYG(simulation.totalAmountPyg) : '—'}
                  </div>
                </div>
              </div>

              {/* Detalle fila por fila */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Fila</th>
                      <th className="py-2 px-3">Estado</th>
                      <th className="py-2 px-3">Registro</th>
                      <th className="py-2 px-3">Detalle / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulation.outcomes.map((o) => (
                      <tr key={`${o.rowNumber}-${o.summary}`} className="bg-white">
                        <td className="py-2 px-3 font-mono text-slate-500">#{o.rowNumber}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {o.status === 'VALID' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              VÁLIDO
                            </span>
                          ) : o.status === 'SKIPPED' ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              OMITIDO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                              ERROR
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{o.summary}</td>
                        <td className="py-2 px-3 text-slate-600">{o.reason || 'Listo para importar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {simulation.outcomesTruncated && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Mostrando las primeras 200 filas del detalle. Los totales incluyen el lote completo.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isProcessing || parsedRows.length === 0}
              onClick={() => runImportRequest('dry_run')}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isProcessing ? 'Analizando...' : '1. Simular y Validar (sin guardar)'}</span>
            </button>

            <button
              type="button"
              disabled={
                isProcessing ||
                !simulation ||
                simulation.committed ||
                simulation.validCount === 0
              }
              onClick={() => runImportRequest('commit')}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Database className="h-3.5 w-3.5" />
              <span>
                {isProcessing
                  ? 'Importando...'
                  : `2. Confirmar e Importar (${simulation?.validCount ?? 0})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
