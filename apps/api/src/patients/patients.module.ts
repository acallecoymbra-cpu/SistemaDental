import { Module } from '@nestjs/common';
import { ClinicalHistoryService } from './clinical-history.service';
import { AdminPatientsController } from './patients.controller';
import { PatientRecordService } from './patient-record.service';
import { PatientsService } from './patients.service';

@Module({
  controllers: [AdminPatientsController],
  providers: [PatientsService, PatientRecordService, ClinicalHistoryService],
  exports: [PatientsService],
})
export class PatientsModule {}
