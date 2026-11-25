/** Respuesta de GET /api/v1/health. */
export interface HealthResponse {
  status: 'ok';
  service: 'api';
  database: 'up' | 'down';
  time: string;
}
