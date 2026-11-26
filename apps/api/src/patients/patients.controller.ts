import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type {
  AdminPatient,
  ClinicalHistory,
  ClinicalVersion,
  PatientRecord,
  PatientWriteResponse,
  SaveClinicalVersionResponse,
} from '@sistema-dental/contracts';
import type { Request } from 'express';
import { CurrentAuth } from '../auth/auth.decorators';
import type { AuthContext } from '../auth/auth.types';
import { getRequestId } from '../common/request-id';
import { ClinicalHistoryService } from './clinical-history.service';
import { SaveClinicalVersionDto } from './clinical-history.dto';
import { CreatePatientDto, UpdatePatientDto } from './patient.dto';
import { PatientRecordService } from './patient-record.service';
import { PatientsService } from './patients.service';

/**
 * Pacientes del panel: prefijo /admin y SIN @Public(). No hay rutas públicas ni DELETE:
 * los pacientes no se eliminan.
 */
@Controller('admin/patients')
export class AdminPatientsController {
  constructor(
    private readonly patients: PatientsService,
    private readonly records: PatientRecordService,
    private readonly clinical: ClinicalHistoryService,
  ) {}

  @Get()
  search(@Query('q') q?: string): Promise<AdminPatient[]> {
    return this.patients.search(q);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<AdminPatient> {
    return this.patients.get(id);
  }

  /** Ficha completa (T-14). Cada apertura se audita; por eso es una ruta aparte de `:id`. */
  @Get(':id/record')
  record(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<PatientRecord> {
    return this.records.open(id, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }

  /** Historia clínica (T-15): versión vigente y lista de versiones. Se audita la lectura. */
  @Get(':id/clinical-history')
  clinicalHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<ClinicalHistory> {
    return this.clinical.get(id, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }

  @Get(':id/clinical-history/versions/:version')
  clinicalVersion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<ClinicalVersion> {
    return this.clinical.getVersion(id, version, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }

  /** Guarda: crea una versión nueva solo si algo cambió. */
  @Put(':id/clinical-history')
  saveClinicalHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SaveClinicalVersionDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<SaveClinicalVersionResponse> {
    return this.clinical.save(id, dto, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }

  @Post()
  create(
    @Body() dto: CreatePatientDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<PatientWriteResponse> {
    return this.patients.create(dto, auth.user.id, { requestId: getRequestId(req), ip: req.ip });
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: Request,
  ): Promise<PatientWriteResponse> {
    return this.patients.update(id, dto, auth.user.id, {
      requestId: getRequestId(req),
      ip: req.ip,
    });
  }
}
