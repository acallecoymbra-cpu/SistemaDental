import type { ApiErrorResponse } from '@sistema-dental/contracts';

/** Error de la API con los mensajes listos para mostrar al usuario. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
    readonly requestId?: string,
  ) {
    super(messages.join(' '));
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

/**
 * Llamada a la API desde el navegador (componentes 'use client').
 * - Ruta relativa: `/api/v1/...` va al mismo origen y Next la reenvía a la API.
 * - `credentials: 'same-origin'` envía la cookie de sesión.
 * - Si la respuesta no es 2xx, lanza ApiError con el formato único de errores (ADR-011).
 */
export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, ['No se pudo conectar con el servidor. Revise su conexión.']);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data as Partial<ApiErrorResponse> | null;
    const raw = error?.message ?? 'Ocurrió un error inesperado.';
    throw new ApiError(res.status, Array.isArray(raw) ? raw : [raw], error?.requestId);
  }
  return data as T;
}
