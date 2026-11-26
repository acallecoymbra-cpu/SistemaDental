import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type {
  PaymentProofReceived,
  PublicAppointmentSummary,
  PublicBooking,
} from '@sistema-dental/contracts';
import type { Request } from 'express';
import { Public } from '../auth/auth.decorators';
import { getRequestId } from '../common/request-id';
import { CreatePublicBookingDto, PublicLookupDto, SubmitPaymentProofDto } from './booking.dto';
import { AppointmentsService } from './appointments.service';
import { PublicLookupService } from './public-lookup.service';

/** Rutas públicas (portal del paciente): reservar y enviar el comprobante. Sin sesión. */
@Controller('appointments')
export class PublicAppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly lookups: PublicLookupService,
  ) {}

  @Public()
  @Post()
  @HttpCode(201)
  book(@Body() dto: CreatePublicBookingDto, @Req() req: Request): Promise<PublicBooking> {
    return this.appointments.createPublicBooking(dto, { requestId: getRequestId(req), ip: req.ip });
  }

  /** «Mis consultas»: nombre + celular; con límite de intentos fallidos. */
  @Public()
  @Post('lookup')
  @HttpCode(200)
  lookup(@Body() dto: PublicLookupDto, @Req() req: Request): Promise<PublicAppointmentSummary[]> {
    return this.lookups.lookup(dto, { requestId: getRequestId(req), ip: req.ip });
  }

  /** El paciente escribe su número de comprobante; el `id` de la reserva hace de llave. */
  @Public()
  @Post(':id/payment-proof')
  @HttpCode(201)
  submitProof(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SubmitPaymentProofDto,
    @Req() req: Request,
  ): Promise<PaymentProofReceived> {
    return this.appointments.submitPaymentProof(id, dto, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }
}
