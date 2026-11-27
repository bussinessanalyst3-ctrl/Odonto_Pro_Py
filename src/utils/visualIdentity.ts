/**
 * Utilidades de identidad visual compartidas para ODONTOPRO ("Dirección A luminosa").
 * Sin lógica de negocio: solo helpers de presentación (iniciales, color por profesional y etiquetas de estado).
 */

export interface ProfessionalColorTheme {
  id: string;
  hex: string;
  dot: string;
  dotClass: string;
  accentBarStyle: { borderLeftColor: string };
  softBgStyle: { backgroundColor: string; borderColor: string };
  textStyle: { color: string };
}

/**
 * 6 tonos serenos para diferenciar profesionales en la agenda sin competir con los colores de estado
 * (oliva = pagado/confirmado, ámbar = pendiente, rojo = cancelado/vencido).
 */
const PROFESSIONAL_PALETTE: ReadonlyArray<{
  id: string;
  hex: string;
  softBg: string;
  softBorder: string;
}> = [
  { id: 'petrol', hex: '#0F5C63', softBg: '#ECF5F5', softBorder: '#B9D9DC' },
  { id: 'indigo', hex: '#4F5D95', softBg: '#F0F2FA', softBorder: '#CBD1E8' },
  { id: 'plum', hex: '#7C4D6B', softBg: '#F7F1F5', softBorder: '#DFC9D7' },
  { id: 'terracotta', hex: '#9E5A4C', softBg: '#F9F2F0', softBorder: '#E5CBC5' },
  { id: 'bronze', hex: '#7A684C', softBg: '#F6F2EA', softBorder: '#E2D7C5' },
  { id: 'steel', hex: '#3B6E8C', softBg: '#EEF4F8', softBorder: '#C4D9E6' },
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getProfessionalColor(
  key: string | null | undefined,
  orderedIds?: string[]
): ProfessionalColorTheme {
  const cleanKey = String(key || '').trim();
  let idx = 0;
  if (cleanKey && orderedIds && orderedIds.length > 0) {
    const found = orderedIds.indexOf(cleanKey);
    idx = found >= 0 ? found % PROFESSIONAL_PALETTE.length : hashString(cleanKey) % PROFESSIONAL_PALETTE.length;
  } else if (cleanKey) {
    idx = hashString(cleanKey) % PROFESSIONAL_PALETTE.length;
  }
  const entry = PROFESSIONAL_PALETTE[idx] || PROFESSIONAL_PALETTE[0];
  return {
    id: entry.id,
    hex: entry.hex,
    dot: entry.hex,
    dotClass: 'inline-block h-2.5 w-2.5 rounded-full shrink-0',
    accentBarStyle: { borderLeftColor: entry.hex },
    softBgStyle: { backgroundColor: entry.softBg, borderColor: entry.softBorder },
    textStyle: { color: entry.hex },
  };
}

const AVATAR_TONES: ReadonlyArray<{ bg: string; text: string; border: string }> = [
  { bg: '#ECF5F5', text: '#0F5C63', border: '#CBE3E5' },
  { bg: '#F6F2EA', text: '#5C4F3A', border: '#E2D7C5' },
  { bg: '#F0F2FA', text: '#3F4B7A', border: '#D4DAF0' },
  { bg: '#F2F0EB', text: '#363B39', border: '#DFDBD1' },
  { bg: '#F7F1F5', text: '#683E58', border: '#E4D2DD' },
];

export function getPatientInitials(firstName?: string | null, lastName?: string | null): string {
  const f = String(firstName || '').trim();
  const l = String(lastName || '').trim();
  if (f && l) {
    return `${f[0]}${l[0]}`.toUpperCase();
  }
  if (f) {
    const parts = f.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return f.slice(0, 2).toUpperCase();
  }
  return 'PA';
}

export function getPatientAvatarStyle(seed?: string | null): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const idx = seed ? hashString(seed) % AVATAR_TONES.length : 0;
  const tone = AVATAR_TONES[idx] || AVATAR_TONES[0];
  return {
    backgroundColor: tone.bg,
    color: tone.text,
    borderColor: tone.border,
  };
}

export type SemanticTone = 'ok' | 'paid' | 'warn' | 'pending' | 'danger' | 'neutral' | 'brand' | 'active';

export interface StatusDisplayMeta {
  label: string;
  tone: SemanticTone;
}

export function getAppointmentStatusMeta(status: string): StatusDisplayMeta {
  switch (String(status || '').toUpperCase()) {
    case 'CONFIRMADA':
      return { label: 'Confirmada', tone: 'ok' };
    case 'FINALIZADA':
      return { label: 'Finalizada', tone: 'ok' };
    case 'EN_ATENCION':
      return { label: 'En atención', tone: 'brand' };
    case 'EN_SALA':
      return { label: 'En sala', tone: 'warn' };
    case 'PENDIENTE':
      return { label: 'Pendiente', tone: 'warn' };
    case 'REPROGRAMADA':
      return { label: 'Reprogramada', tone: 'warn' };
    case 'CANCELADA':
      return { label: 'Cancelada', tone: 'danger' };
    case 'NO_ASISTIO':
      return { label: 'No asistió', tone: 'danger' };
    default:
      return { label: status || 'Sin estado', tone: 'neutral' };
  }
}
