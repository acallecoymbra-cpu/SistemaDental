import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { ClinicSettings, PublicClinicInfo } from '@sistema-dental/contracts';
import type { Request } from 'express';
import { CurrentAuth, Public } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { getRequestId } from '../common/request-id';
import { UpdateClinicSettingsDto } from './clinic-settings.dto';
import { ClinicService } from './clinic.service';

/** Datos mínimos para el portal: precio, anticipo y WhatsApp. Sin el QR. */
@Controller('clinic')
export class PublicClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @Public()
  @Get()
  info(): Promise<PublicClinicInfo> {
    return this.clinic.getPublicInfo();
  }
}

/** Panel del dentista: prefijo /admin y SIN @Public(). No hay POST ni DELETE: es una sola fila. */
@Controller('admin/clinic-settings')
export class AdminClinicController {
  constructor(private readonly clinic: ClinicService) {}

  @Get()
  get(): Promise<ClinicSettings> {
    return this.clinic.getSettings();
  }

  @Patch()
  update(
    @Body() dto: UpdateClinicSettingsDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<ClinicSettings> {
    return this.clinic.update(dto, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }
}
