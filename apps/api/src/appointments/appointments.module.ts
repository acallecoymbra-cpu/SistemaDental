import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { EmailOutboxJob } from './email-outbox.job';
import { EmailOutboxService } from './email-outbox.service';
import { HoldExpirationJob } from './hold-expiration.job';
import { AdminAppointmentsController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { PublicAppointmentsController } from './appointments.controller';
import { Mailer, UnconfiguredMailer } from '../mail/mailer';
import { AppointmentActionsService } from './appointment-actions.service';
import { AppointmentHoldsService } from './appointment-holds.service';
import { AppointmentsService } from './appointments.service';
import { PublicLookupService } from './public-lookup.service';

@Module({
  imports: [PatientsModule],
  controllers: [PublicAppointmentsController, AdminAppointmentsController],
  providers: [
    AppointmentsService,
    PublicLookupService,
    AgendaService,
    AppointmentActionsService,
    AppointmentHoldsService,
    HoldExpirationJob,
    EmailOutboxService,
    EmailOutboxJob,
    { provide: Mailer, useClass: UnconfiguredMailer },
  ],
})
export class AppointmentsModule {}
