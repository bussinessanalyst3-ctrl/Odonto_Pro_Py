/**
 * Configuración centralizada de endpoints de API para despliegues locales,
 * Vercel, Netlify, Cloud Run y dominios distribuidos.
 */
export const getApiBaseUrl = (): string => {
  // 1. Variable de entorno Vite en cliente web (ej. Vercel -> Backend URL)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) {
    return String((import.meta as any).env.VITE_API_URL).trim().replace(/\/$/, '');
  }

  // 2. Variable en entorno Node.js / SSR
  if (typeof process !== 'undefined' && process.env?.API_BASE_URL) {
    return String(process.env.API_BASE_URL).trim().replace(/\/$/, '');
  }

  // 3. Mismo origen (Same-Origin) por defecto
  return '';
};
