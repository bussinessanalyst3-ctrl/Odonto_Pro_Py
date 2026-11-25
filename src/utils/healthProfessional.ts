export const NO_PROFESSIONALS_MESSAGE =
  'No hay profesionales cargados. Registre un odontólogo en Equipo y Accesos.';

export interface ProfessionalLikeUser {
  id?: string;
  roleId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  professionalLicense?: string | null;
  status?: string | null;
}

/**
 * Criterio único de profesional de la salud:
 * rol ODONTOLOGO o matrícula profesional (professionalLicense) no vacía.
 */
export function isHealthProfessional(
  user: ProfessionalLikeUser | null | undefined
): boolean {
  if (!user) return false;
  if (user.roleId === 'ODONTOLOGO') return true;
  return (
    typeof user.professionalLicense === 'string' &&
    user.professionalLicense.trim().length > 0
  );
}

/**
 * Devuelve el nombre del usuario anteponiendo "Dr(a)." únicamente si cumple
 * el criterio de profesional de la salud. Para usuarios no profesionales
 * (ej. registros históricos asignados a un admin) devuelve el nombre sin prefijo.
 */
export function formatProfessionalName(
  user: ProfessionalLikeUser | null | undefined,
  options?: { lastNameOnly?: boolean; fallback?: string }
): string {
  const fallback = options?.fallback ?? '';
  if (!user) return fallback;
  const baseName = options?.lastNameOnly
    ? String(user.lastName || user.firstName || '').trim()
    : `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (!baseName) return fallback;
  return isHealthProfessional(user) ? `Dr(a). ${baseName}` : baseName;
}

/**
 * Etiqueta para <option> en selectores de profesional de la salud.
 * Solo agrega la matrícula entre paréntesis cuando existe.
 */
export function formatProfessionalOptionLabel(user: ProfessionalLikeUser): string {
  const name = formatProfessionalName(user);
  const license =
    typeof user.professionalLicense === 'string'
      ? user.professionalLicense.trim()
      : '';
  return license ? `${name} (${license})` : name;
}

/**
 * Filtra únicamente usuarios activos que son profesionales de la salud.
 */
export function getActiveHealthProfessionals<T extends ProfessionalLikeUser>(
  users: T[] | null | undefined
): T[] {
  return (users || []).filter(
    (u) => Boolean(u) && u.status !== 'INACTIVE' && isHealthProfessional(u)
  );
}
