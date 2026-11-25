import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@sistema-dental/contracts';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { getRequestId } from './request-id';

/**
 * Respuesta de error uniforme y sin detalles internos (B-03).
 * - Errores HTTP esperados (400, 401, 403, 404…): mensaje propio de la excepción.
 * - Cualquier otro error: 500 con mensaje genérico; el detalle solo va al log del servidor,
 *   sin cuerpo de la petición ni cabeceras (pueden contener datos personales o credenciales).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = getRequestId(req);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno. Intente nuevamente más tarde.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object' && 'message' in payload) {
        message = (payload as { message: string | string[] }).message;
      } else {
        message = exception.message;
      }
    }

    if (status >= 500) {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${req.method} ${req.path} → ${status} [${requestId}]`, detail);
      message = 'Error interno. Intente nuevamente más tarde.';
    }

    const body: ApiErrorResponse = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      requestId,
    };
    res.status(status).json(body);
  }
}
