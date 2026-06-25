import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FollowUp, FollowUpDocument } from './schemas/follow-up.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class FollowUpReminderService {
  private readonly logger = new Logger(FollowUpReminderService.name);

  constructor(
    @InjectModel(FollowUp.name)
    private followUpModel: Model<FollowUpDocument>,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendDueReminders() {
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

    this.logger.log(`Checking for due follow-up reminders (due before ${inOneHour.toISOString()})`);

    const dueFollowUps = await this.followUpModel
      .find({
        scheduledFor: { $gte: now, $lte: inOneHour },
        isCompleted: false,
        reminderSent: { $ne: true },
      })
      .populate('createdBy', 'email name')
      .populate('leadId', 'studentName')
      .exec();

    this.logger.log(`Found ${dueFollowUps.length} due reminders`);

    for (const followUp of dueFollowUps) {
      const user = followUp.createdBy as any;
      const lead = followUp.leadId as any;

      if (!user?.email || !lead?.studentName) {
        this.logger.warn(`Missing user/lead data for follow-up ${followUp._id}`);
        continue;
      }

      try {
        await this.emailService.sendFollowUpReminder({
          toEmail: user.email,
          toName: user.name,
          studentName: lead.studentName,
          note: followUp.note,
          scheduledFor: followUp.scheduledFor,
        });

        await this.followUpModel.updateOne(
          { _id: followUp._id },
          { reminderSent: true },
        );

        this.logger.log(`Reminder sent for follow-up ${followUp._id}`);
      } catch (err: any) {
        this.logger.error(
          `Failed to send reminder for follow-up ${followUp._id}: ${err.message}`,
        );
      }
    }
  }
}
