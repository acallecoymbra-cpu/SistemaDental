import { Module } from '@nestjs/common';
import { AdminClinicController, PublicClinicController } from './clinic.controller';
import { ClinicService } from './clinic.service';

@Module({
  controllers: [PublicClinicController, AdminClinicController],
  providers: [ClinicService],
  exports: [ClinicService],
})
export class ClinicModule {}
