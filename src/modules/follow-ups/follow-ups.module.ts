import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FollowUpsService } from './follow-ups.service';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpReminderService } from './follow-up-reminder.service';
import { FollowUp, FollowUpSchema } from './schemas/follow-up.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { ActivitiesModule } from '../activities/activities.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FollowUp.name, schema: FollowUpSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    ActivitiesModule,
    EmailModule,
  ],
  controllers: [FollowUpsController],
  providers: [FollowUpsService, FollowUpReminderService],
  exports: [FollowUpsService],
})
export class FollowUpsModule {}
