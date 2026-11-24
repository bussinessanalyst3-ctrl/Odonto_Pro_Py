import { getTodayAsuncionISO } from '../config/appBrand.ts';

export type ReportPeriodPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL' | 'CUSTOM_MONTH';

export interface ReportPeriodFilter {
  preset: ReportPeriodPreset;
  customYear?: number;
  customMonth?: number; // 1..12
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Convierte cualquier fecha (Date, ISO string o YYYY-MM-DD) a fecha calendario YYYY-MM-DD
 * en la zona horaria oficial de Paraguay (America/Asuncion).
 */
export function toAsuncionDateISO(input: Date | string | null | undefined): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (y && m && day) return `${y}-${m}-${day}`;
  } catch {
    // Fallback
  }
  return d.toISOString().slice(0, 10);
}

export function getAsuncionYearMonth(dateIso?: string): { year: number; month: number; day: number } {
  const iso = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : getTodayAsuncionISO();
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m, day: d };
}

export function getPeriodLabel(filter: ReportPeriodFilter, todayIso: string = getTodayAsuncionISO()): string {
  const { year, month } = getAsuncionYearMonth(todayIso);
  switch (filter.preset) {
    case 'TODAY':
      return `Jornada de Hoy (${todayIso})`;
    case 'WEEK':
      return 'Últimos 7 días';
    case 'MONTH':
      return `Mes Actual (${MONTH_NAMES_ES[month - 1]} ${year})`;
    case 'QUARTER': {
      const q = Math.floor((month - 1) / 3) + 1;
      return `Trimestre ${q} (${year})`;
    }
    case 'YEAR':
      return `Año ${year}`;
    case 'CUSTOM_MONTH': {
      const cy = filter.customYear || year;
      const cm = filter.customMonth || month;
      return `${MONTH_NAMES_ES[(cm - 1 + 12) % 12]} ${cy}`;
    }
    case 'ALL':
    default:
      return 'Todo el Historial';
  }
}

function addCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Determina si una fecha (Date, timestamp ISO o YYYY-MM-DD) cae dentro del período filtrado.
 */
export function isDateInReportPeriod(
  rawDate: Date | string | null | undefined,
  filter: ReportPeriodFilter,
  todayIso: string = getTodayAsuncionISO()
): boolean {
  if (filter.preset === 'ALL') return true;
  const dateIso = toAsuncionDateISO(rawDate);
  if (!dateIso) return false;

  const { year: todayY, month: todayM } = getAsuncionYearMonth(todayIso);
  const { year: dY, month: dM } = getAsuncionYearMonth(dateIso);

  switch (filter.preset) {
    case 'TODAY':
      return dateIso === todayIso;
    case 'WEEK': {
      const startWeek = addCalendarDays(todayIso, -6);
      return dateIso >= startWeek && dateIso <= todayIso;
    }
    case 'MONTH':
      return dY === todayY && dM === todayM;
    case 'QUARTER': {
      const todayQ = Math.floor((todayM - 1) / 3);
      const dQ = Math.floor((dM - 1) / 3);
      return dY === todayY && dQ === todayQ;
    }
    case 'YEAR':
      return dY === todayY;
    case 'CUSTOM_MONTH': {
      const targetY = filter.customYear || todayY;
      const targetM = filter.customMonth || todayM;
      return dY === targetY && dM === targetM;
    }
    default:
      return true;
  }
}

export interface RevenueEntry {
  id: string;
  source: 'PAYMENT' | 'CASH_MOVEMENT';
  branchId: string;
  amount: number;
  paymentMethod: string;
  dateIso: string;
  patientId?: string | null;
}

/**
 * Calcula los ingresos efectivos sin doble contabilización:
 * - Incluye todos los `payments` no anulados (status !== 'ANULADO').
 * - Incluye los `cashMovements` de tipo 'INGRESO' SOLO cuando NO están ya vinculados
 *   a un registro de `payments` (vía `payment.cashMovementId`), evitando duplicar cobros.
 */
export function collectUniqueRevenueEntries(params: {
  payments: any[];
  cashMovements: any[];
  cashRegisters: any[];
  branchId?: string;
  period?: ReportPeriodFilter;
  todayIso?: string;
}): RevenueEntry[] {
  const { payments, cashMovements, cashRegisters, branchId, period, todayIso } = params;
  const effectiveToday = todayIso || getTodayAsuncionISO();

  const linkedMovementIds = new Set<string>();
  for (const p of payments || []) {
    if (p.cashMovementId) {
      linkedMovementIds.add(String(p.cashMovementId));
    }
  }

  const registerBranchMap = new Map<string, string>();
  for (const cr of cashRegisters || []) {
    if (cr?.id && cr?.branchId) {
      registerBranchMap.set(cr.id, cr.branchId);
    }
  }

  const entries: RevenueEntry[] = [];

  for (const p of payments || []) {
    if (!p || p.status === 'ANULADO') continue;
    const amt = Math.round(Number(p.amount || 0));
    if (amt <= 0) continue;
    if (branchId && p.branchId !== branchId) continue;
    const dateIso = toAsuncionDateISO(p.createdAt || p.paymentDate);
    if (period && !isDateInReportPeriod(dateIso, period, effectiveToday)) continue;
    entries.push({
      id: p.id,
      source: 'PAYMENT',
      branchId: p.branchId || '',
      amount: amt,
      paymentMethod: p.paymentMethod || 'EFECTIVO',
      dateIso,
      patientId: p.patientId || null,
    });
  }

  for (const m of cashMovements || []) {
    if (!m || m.movementType !== 'INGRESO') continue;
    if (linkedMovementIds.has(String(m.id))) continue;
    const amt = Math.round(Number(m.amount || 0));
    if (amt <= 0) continue;
    const movBranchId = registerBranchMap.get(m.cashRegisterId) || '';
    if (branchId && movBranchId !== branchId) continue;
    const dateIso = toAsuncionDateISO(m.createdAt);
    if (period && !isDateInReportPeriod(dateIso, period, effectiveToday)) continue;
    entries.push({
      id: m.id,
      source: 'CASH_MOVEMENT',
      branchId: movBranchId,
      amount: amt,
      paymentMethod: m.paymentMethod || 'EFECTIVO',
      dateIso,
      patientId: null,
    });
  }

  return entries;
}
