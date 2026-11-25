/** Forma única de toda respuesta de error de la API (B-03). */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  /** Mensaje para mostrar; en errores de validación, una lista de mensajes por campo. */
  message: string | string[];
  /** Id de la petición, para buscarla en los logs del servidor. */
  requestId: string;
}
