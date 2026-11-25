import { Module } from '@nestjs/common';
import { AdminTreatmentsController, PublicTreatmentsController } from './treatments.controller';
import { TreatmentsService } from './treatments.service';

@Module({
  controllers: [PublicTreatmentsController, AdminTreatmentsController],
  providers: [TreatmentsService],
})
export class TreatmentsModule {}
