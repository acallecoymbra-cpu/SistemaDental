import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AvailabilityInterval, AvailableSlotsResponse } from '@sistema-dental/contracts';
import type { Request } from 'express';
import { CurrentAuth, Public } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { getRequestId } from '../common/request-id';
import {
  CreateAvailabilityIntervalDto,
  UpdateAvailabilityIntervalDto,
} from './availability-interval.dto';
import { AvailabilityService } from './availability.service';

/** Ruta pública (portal del paciente): solo franjas libres de una fecha, sin datos de nadie. */
@Controller('availability')
export class PublicAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Public()
  @Get('slots')
  slots(@Query('date') date?: string): Promise<AvailableSlotsResponse> {
    return this.availability.listSlots(typeof date === 'string' ? date : '');
  }
}

/** Franjas libres para el dentista (T-12): incluye las de hoy que aún no empezaron. */
@Controller('admin/availability-slots')
export class AdminAvailabilitySlotsController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  slots(@Query('date') date?: string): Promise<AvailableSlotsResponse> {
    return this.availability.listSlots(typeof date === 'string' ? date : '', {
      includeToday: true,
    });
  }
}

/** Rutas del panel del dentista: prefijo /admin y SIN @Public(), así el guard global exige sesión. */
@Controller('admin/availability-intervals')
export class AdminAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  list(): Promise<AvailabilityInterval[]> {
    return this.availability.list();
  }

  @Post()
  create(
    @Body() dto: CreateAvailabilityIntervalDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AvailabilityInterval> {
    return this.availability.create(dto, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateAvailabilityIntervalDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<AvailabilityInterval> {
    return this.availability.update(id, dto, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<void> {
    return this.availability.remove(id, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }
}
