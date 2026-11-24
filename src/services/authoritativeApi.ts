import { getApiBaseUrl } from '../config/apiConfig.ts';
import { dbStore } from '../db/inMemoryStore.ts';

export function hasBackendSession(): boolean {
  return Boolean(dbStore.getSessionToken() || dbStore.getBackendActorContext());
}

export async function requestAuthoritativeAction<T = any>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT',
  body: Record<string, any>
): Promise<T> {
  await dbStore.flushPendingSync();
  const baseUrl = getApiBaseUrl();
  const token = dbStore.getSessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token && !token.startsWith('httpOnly_')) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409) {
      void dbStore.syncFromServer();
    }
    throw new Error(payload?.error || `Error ${res.status} al procesar la operación.`);
  }

  return payload as T;
}

export async function postAuthoritativeAction<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  return requestAuthoritativeAction<T>(path, 'POST', body);
}

export async function patchAuthoritativeAction<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  return requestAuthoritativeAction<T>(path, 'PATCH', body);
}

export async function putAuthoritativeAction<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  return requestAuthoritativeAction<T>(path, 'PUT', body);
}
