import 'server-only';

/**
 * Llamada a la API desde el servidor de Next (componentes de servidor), solo para
 * datos PÚBLICOS: aquí no hay cookie de sesión. Devuelve null si la API no responde,
 * para que la página se muestre igual con un aviso.
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

export async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    // Sin caché: un cambio del dentista se ve en el portal en la siguiente visita.
    const res = await fetch(`${API_URL}/api/v1${path}`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
