import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  HttpCode,
} from '@nestjs/common';
import type { AdminAppointment, CancelAppointmentResponse } from '@sistema-dental/contracts';
import type { Request } from 'express';
import { CurrentAuth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { getRequestId } from '../common/request-id';
import { AgendaService } from './agenda.service';
import { AppointmentActionsService } from './appointment-actions.service';
import {
  CancelAppointmentDto,
  CompleteAppointmentDto,
  RescheduleAppointmentDto,
} from './booking.dto';

/**
 * Agenda del dentista (T-10): prefijo /admin y SIN @Public(), así el guard global exige sesión.
 * Lectura (T-10) y cambios de estado del dentista (T-11 en adelante).
 */
@Controller('admin/appointments')
export class AdminAppointmentsController {
  constructor(
    private readonly agenda: AgendaService,
    private readonly actions: AppointmentActionsService,
  ) {}

  /** `from` y `to` (AAAA-MM-DD, hora de La Paz, ambos inclusive); `status` y `patient` filtran. */
  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('patient') patient?: string,
    @Query('review') review?: string,
  ): Promise<AdminAppointment[]> {
    return this.agenda.list({ from, to, status, patient, review });
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminAppointment> {
    return this.agenda.get(id);
  }

  /** T-11: confirma el pago de una consulta con comprobante. No hay ruta para rechazarlo. */
  @Post(':id/confirm-payment')
  @HttpCode(200)
  confirmPayment(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminAppointment> {
    return this.actions.confirmPayment(id, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  /** T-13: cancela con motivo y deja en cola el aviso por correo (si el paciente tiene). */
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<CancelAppointmentResponse> {
    return this.actions.cancel(id, dto.reason, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  /** T-12: mueve la consulta a otra franja libre (guarda el antes y el después). */
  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminAppointment> {
    return this.actions.reschedule(id, dto.startsAt, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  /** T-12: marca «no asistió» (solo una confirmada cuya hora ya pasó). */
  @Post(':id/no-show')
  @HttpCode(200)
  noShow(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminAppointment> {
    return this.actions.markNoShow(id, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  /** T-17: cierra la consulta con diagnóstico y costo (solo una confirmada que ya empezó). */
  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CompleteAppointmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminAppointment> {
    return this.actions.complete(id, dto, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }
}
