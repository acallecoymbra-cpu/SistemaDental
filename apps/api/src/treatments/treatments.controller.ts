import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { AdminTreatment, PublicTreatment } from '@sistema-dental/contracts';
import type { Request } from 'express';
import { CurrentAuth, Public } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { getRequestId } from '../common/request-id';
import { CreateTreatmentDto, UpdateTreatmentDto } from './treatment.dto';
import { TreatmentsService } from './treatments.service';

/**
 * Rutas públicas (portal del paciente). @Public() porque, por defecto, TODA ruta
 * exige sesión (B-04). Devuelven solo datos mínimos de tratamientos activos.
 */
@Controller('treatments')
export class PublicTreatmentsController {
  constructor(private readonly treatments: TreatmentsService) {}

  @Public()
  @Get()
  list(): Promise<PublicTreatment[]> {
    return this.treatments.listPublic();
  }
}

/**
 * Rutas del panel del dentista: prefijo /admin y SIN @Public(), así el guard
 * global exige sesión. No hay DELETE: desactivar es PATCH { active: false }.
 */
@Controller('admin/treatments')
export class AdminTreatmentsController {
  constructor(private readonly treatments: TreatmentsService) {}

  @Get()
  list(): Promise<AdminTreatment[]> {
    return this.treatments.listAdmin();
  }

  @Post()
  create(
    @Body() dto: CreateTreatmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminTreatment> {
    return this.treatments.create(dto, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTreatmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AdminTreatment> {
    return this.treatments.update(id, dto, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }
}
