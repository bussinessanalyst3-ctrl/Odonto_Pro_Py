export const APP_NAME = 'OdontoPro' as const;

export const OFFICIAL_APP_ICON_ID = 'shield' as const;

export const APP_FULL_TITLE = `${APP_NAME} | Sistema de Gestión Odontológica Multi-Sucursal`;

export const APP_DESCRIPTION =
  `${APP_NAME} — Plataforma profesional de gestión clínica odontológica multi-sucursal y multi-tenant.`;


export function resolveOrganizationLegalName(
  org?: { legalName?: string | null; name?: string | null } | null
): string {
  if (!org) return '';
  const candidate = (org.legalName || org.name || '').trim();
  return candidate;
}

export function formatDocumentTitle(legalName?: string | null): string {
  const clean = (legalName || '').trim();
  return clean ? `${APP_NAME} | ${clean}` : APP_NAME;
}

export function getTodayAsuncionISO(): string {
  try {
    const formatted = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Asuncion',
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      return formatted;
    }
  } catch {
    // Fallback below if Intl timeZone is unavailable
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
