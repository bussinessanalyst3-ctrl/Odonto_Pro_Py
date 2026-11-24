/**
 * Utilidad pura para carga masiva histórica (CSV / planillas de Excel) en ODONTOPRO.
 * - Soporta separador punto y coma (;), coma (,) y tabulador (\t) — ideal para Excel en español/Paraguay.
 * - Acepta fechas YYYY-MM-DD, DD/MM/YYYY o DD-MM-YYYY (siempre normalizadas a YYYY-MM-DD).
 * - Valida montos estrictamente como enteros positivos en Guaraníes (sin centavos).
 * - Sanitiza celdas al generar plantillas o reportes de error para prevenir inyección de fórmulas CSV.
 */

export type HistoricalImportEntity = 'patients' | 'treatments' | 'payments';

export interface ParsedCsvResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  delimiter: string;
}

export interface HistoricalImportTemplate {
  entity: HistoricalImportEntity;
  title: string;
  description: string;
  filename: string;
  columns: Array<{
    key: string;
    label: string;
    required: boolean;
    example: string;
  }>;
  sampleRows: string[][];
}

export const HISTORICAL_IMPORT_TEMPLATES: Record<HistoricalImportEntity, HistoricalImportTemplate> = {
  patients: {
    entity: 'patients',
    title: 'Pacientes Históricos',
    description:
      'Importa fichas de pacientes existentes. Si la C.I./Documento ya existe en la clínica, la fila se omite sin sobrescribir datos.',
    filename: 'Plantilla_ODONTOPRO_Pacientes_Historicos.csv',
    columns: [
      { key: 'nombres', label: 'Nombres', required: true, example: 'María José' },
      { key: 'apellidos', label: 'Apellidos', required: true, example: 'González López' },
      { key: 'documento', label: 'C.I. / Documento', required: true, example: '4521890' },
      { key: 'telefono', label: 'Teléfono / WhatsApp', required: false, example: '+595 981 456 789' },
      { key: 'email', label: 'Email', required: false, example: 'maria.gonzalez@correo.com' },
      { key: 'fecha_nacimiento', label: 'Fecha Nacimiento', required: false, example: '15/08/1990' },
      { key: 'ciudad', label: 'Ciudad', required: false, example: 'Asunción' },
      { key: 'modalidad', label: 'Modalidad (PARTICULAR o PLAN_SEGURO)', required: false, example: 'PARTICULAR' },
      { key: 'alergias', label: 'Alergias', required: false, example: 'Ninguna' },
      { key: 'fecha_alta', label: 'Fecha Alta Histórica', required: false, example: '12/03/2024' },
    ],
    sampleRows: [
      [
        'María José',
        'González López',
        '4521890',
        '+595 981 456 789',
        'maria.gonzalez@correo.com',
        '15/08/1990',
        'Asunción',
        'PARTICULAR',
        'Ninguna',
        '12/03/2024',
      ],
      [
        'Carlos',
        'Benítez Duarte',
        '3890123',
        '+595 971 223 344',
        '',
        '22/11/1985',
        'Encarnación',
        'PARTICULAR',
        'Penicilina',
        '04/06/2024',
      ],
    ],
  },
  treatments: {
    entity: 'treatments',
    title: 'Tratamientos Históricos',
    description:
      'Registra tratamientos realizados en fechas pasadas conservando su precio congelado histórico (no se altera si luego cambia el catálogo).',
    filename: 'Plantilla_ODONTOPRO_Tratamientos_Historicos.csv',
    columns: [
      { key: 'documento_paciente', label: 'C.I. Paciente', required: true, example: '4521890' },
      { key: 'titulo_tratamiento', label: 'Título / Procedimiento', required: true, example: 'Endodoncia Molar (Pieza 36)' },
      { key: 'codigo_servicio', label: 'Código Servicio (opcional)', required: false, example: 'END-01' },
      { key: 'monto_total_gs', label: 'Monto Total (₲)', required: true, example: '650000' },
      { key: 'monto_pagado_gs', label: 'Monto Ya Pagado (₲)', required: false, example: '650000' },
      { key: 'estado', label: 'Estado (PLANIFICADO, EN_PROGRESO, COMPLETADO)', required: false, example: 'COMPLETADO' },
      { key: 'fecha_tratamiento', label: 'Fecha del Tratamiento', required: true, example: '18/05/2024' },
      { key: 'piezas_fdi', label: 'Piezas FDI (separadas por coma)', required: false, example: '36' },
      { key: 'notas', label: 'Notas / Observaciones', required: false, example: 'Carga histórica desde planilla anterior' },
    ],
    sampleRows: [
      [
        '4521890',
        'Endodoncia Molar (Pieza 36)',
        'END-01',
        '650000',
        '650000',
        'COMPLETADO',
        '18/05/2024',
        '36',
        'Finalizado en 2 sesiones',
      ],
      [
        '3890123',
        'Profilaxis y Limpieza Completa',
        '',
        '250000',
        '100000',
        'EN_PROGRESO',
        '20/09/2024',
        '',
        'Saldo pendiente de 150.000 Gs',
      ],
    ],
  },
  payments: {
    entity: 'payments',
    title: 'Cobros Históricos',
    description:
      'Registra recibos y cobros de fechas pasadas vinculados al paciente/tratamiento sin alterar la caja abierta de hoy.',
    filename: 'Plantilla_ODONTOPRO_Cobros_Historicos.csv',
    columns: [
      { key: 'documento_paciente', label: 'C.I. Paciente', required: true, example: '4521890' },
      { key: 'titulo_tratamiento', label: 'Tratamiento Asociado (opcional)', required: false, example: 'Endodoncia Molar (Pieza 36)' },
      { key: 'monto_gs', label: 'Monto Cobrado (₲)', required: true, example: '350000' },
      { key: 'metodo_pago', label: 'Método (EFECTIVO, TRANSFERENCIA, TARJETA_DEBITO, TARJETA_CREDITO, QR_BANCARD)', required: false, example: 'EFECTIVO' },
      { key: 'fecha_cobro', label: 'Fecha del Cobro', required: true, example: '25/05/2024' },
      { key: 'nro_recibo', label: 'N° Recibo Histórico (opcional)', required: false, example: 'HIST-2024-0001' },
      { key: 'notas', label: 'Concepto / Notas', required: false, example: 'Pago cuota 1 histórico' },
    ],
    sampleRows: [
      [
        '4521890',
        'Endodoncia Molar (Pieza 36)',
        '350000',
        'EFECTIVO',
        '25/05/2024',
        'HIST-2024-0001',
        'Cuota 1 cargada desde libro anterior',
      ],
      [
        '3890123',
        'Profilaxis y Limpieza Completa',
        '150000',
        'TRANSFERENCIA',
        '02/10/2024',
        'HIST-2024-0002',
        'Cancelación de saldo histórico',
      ],
    ],
  },
};

/**
 * Neutraliza inyección de fórmulas en celdas exportadas a CSV (Excel/LibreOffice/Google Sheets).
 */
export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const trimmedStart = raw.replace(/^[\s\uFEFF]+/, '');
  const needsQuoteEscape = /^[=+\-@\t\r]/.test(trimmedStart);
  const safe = needsQuoteEscape ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Genera el contenido CSV con UTF-8 BOM y separador ';' (formato nativo de Excel en español/Paraguay).
 */
export function buildTemplateCsv(entity: HistoricalImportEntity): string {
  const tpl = HISTORICAL_IMPORT_TEMPLATES[entity];
  const headerLine = tpl.columns.map((c) => c.key).join(';');
  const dataLines = tpl.sampleRows.map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(';'));
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}

export function normalizeHeaderKey(header: string): string {
  return String(header || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Detecta automáticamente el delimitador más probable (';', ',', o '\t') mirando la primera línea.
 */
export function detectCsvDelimiter(text: string): string {
  const firstLine = (text.replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim().length > 0) || '');
  const counts: Array<{ delim: string; count: number }> = [
    { delim: ';', count: (firstLine.match(/;/g) || []).length },
    { delim: '\t', count: (firstLine.match(/\t/g) || []).length },
    { delim: ',', count: (firstLine.match(/,/g) || []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delim : ';';
}

/**
 * Parsea texto CSV/TSV respetando comillas dobles, saltos de línea dentro de comillas y separadores.
 */
export function parseCsvText(rawText: string): ParsedCsvResult {
  const cleaned = String(rawText || '').replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(cleaned);

  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    matrix.push(row);
  }

  const nonEmptyRows = matrix.filter((r) => r.some((v) => v.trim().length > 0));
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [], delimiter };
  }

  const headers = nonEmptyRows[0].map(normalizeHeaderKey);
  const rows: Array<Record<string, string>> = [];

  for (let rIdx = 1; rIdx < nonEmptyRows.length; rIdx++) {
    const values = nonEmptyRows[rIdx];
    const record: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      if (!h) return;
      record[h] = String(values[colIdx] ?? '').trim();
    });
    rows.push(record);
  }

  return { headers, rows, delimiter };
}

/**
 * Parsea fecha flexible: YYYY-MM-DD, DD/MM/YYYY o DD-MM-YYYY -> YYYY-MM-DD (validando calendario real).
 */
export function parseFlexibleDateISO(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  let y = 0;
  let m = 0;
  let d = 0;

  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  const latamMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s.*)?$/);

  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
  } else if (latamMatch) {
    d = Number(latamMatch[1]);
    m = Number(latamMatch[2]);
    y = Number(latamMatch[3]);
  } else {
    return null;
  }

  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  ) {
    return null;
  }

  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parsea monto en Guaraníes aceptando separadores de miles ('.' o ' ') y prefijo Gs./₲.
 * Rechaza decimales o valores negativos.
 */
export function parseHistoricalPygAmount(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const s = String(raw ?? '').trim();
  if (!s) {
    return { ok: false, error: 'Monto vacío.' };
  }

  const cleaned = s.replace(/^(gs\.?|₲|pyg)\s*/i, '').replace(/\s+/g, '');
  if (cleaned.startsWith('-')) {
    return { ok: false, error: 'El monto no puede ser negativo.' };
  }

  // Si trae coma decimal con centavos (ej: 150000,50) rechazar — en PYG no existen centavos
  if (/,\d{1,2}$/.test(cleaned)) {
    return { ok: false, error: 'En Guaraníes (PYG) no se permiten centavos ni decimales.' };
  }

  // Si trae punto decimal tipo 150000.50 (1 o 2 dígitos después del único punto), rechazar
  if (/^\d+\.\d{1,2}$/.test(cleaned)) {
    return { ok: false, error: 'En Guaraníes (PYG) no se permiten decimales (use solo enteros).' };
  }

  // Quitar separadores de miles (ej: 350.000 o 1,250,000)
  const digitsOnly = cleaned.replace(/[.,]/g, '');
  if (!/^\d+$/.test(digitsOnly)) {
    return { ok: false, error: `Formato de monto inválido: "${s}".` };
  }

  const num = Number(digitsOnly);
  if (!Number.isSafeInteger(num) || num < 0) {
    return { ok: false, error: `Monto fuera de rango válido: "${s}".` };
  }
  return { ok: true, value: num };
}

export function normalizePaymentMethod(raw: unknown): 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'QR_BANCARD' | 'CHEQUE' {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!s || s.includes('EFECT') || s === 'CASH') return 'EFECTIVO';
  if (s.includes('QR')) return 'QR_BANCARD';
  if (s.includes('DEBIT')) return 'TARJETA_DEBITO';
  if (s.includes('CREDIT') || s.includes('TARJ')) return 'TARJETA_CREDITO';
  if (s.includes('TRANSF') || s.includes('SIPAP') || s.includes('BANC')) return 'TRANSFERENCIA';
  if (s.includes('CHEQ')) return 'CHEQUE';
  return 'EFECTIVO';
}

export function normalizeTreatmentStatus(raw: unknown): 'PLANIFICADO' | 'EN_PROGRESO' | 'COMPLETADO' | 'SUSPENDIDO' | 'CANCELADO' {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (s.includes('COMPLET') || s.includes('FINALIZ') || s.includes('TERMIN')) return 'COMPLETADO';
  if (s.includes('PROGRES') || s.includes('CURSO') || s.includes('ACTIVO')) return 'EN_PROGRESO';
  if (s.includes('SUSPEND')) return 'SUSPENDIDO';
  if (s.includes('CANCEL') || s.includes('ANUL')) return 'CANCELADO';
  if (s.includes('PLAN')) return 'PLANIFICADO';
  return 'COMPLETADO';
}
