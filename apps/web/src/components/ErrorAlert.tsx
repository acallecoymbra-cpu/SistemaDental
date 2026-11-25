import { ApiError } from '@/lib/api-client';

/** Muestra un error de la API (uno o varios mensajes) y su id para soporte. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }
  const messages =
    error instanceof ApiError ? error.messages : ['Ocurrió un error inesperado. Intente de nuevo.'];
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="alert alert-error" role="alert">
      {messages.length === 1 ? (
        messages[0]
      ) : (
        <ul>
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {requestId ? <small>Código de soporte: {requestId}</small> : null}
    </div>
  );
}
