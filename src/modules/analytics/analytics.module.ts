import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { FollowUp, FollowUpSchema } from '../follow-ups/schemas/follow-up.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lead.name, schema: LeadSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: FollowUp.name, schema: FollowUpSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
