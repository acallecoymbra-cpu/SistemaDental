import { Module } from '@nestjs/common';
import {
  AdminAvailabilityController,
  AdminAvailabilitySlotsController,
  PublicAvailabilityController,
} from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  controllers: [
    PublicAvailabilityController,
    AdminAvailabilityController,
    AdminAvailabilitySlotsController,
  ],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
