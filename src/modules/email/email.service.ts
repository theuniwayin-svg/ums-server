import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface FollowUpReminderParams {
  toEmail: string;
  toName: string;
  studentName: string;
  note: string;
  scheduledFor: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend?: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendFollowUpReminder(params: FollowUpReminderParams) {
    if (!this.resend) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { toEmail, toName, studentName, note, scheduledFor } = params;

    const formattedDate = scheduledFor.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    } as any);

    const fromEmail = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'noreply@uniwayin.com',
    );

    try {
      await this.resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject: `⏰ Reminder: Follow up with ${studentName}`,
        text: `Hi ${toName},

This is a reminder to follow up with ${studentName}.

Note: ${note || '(no note)'}
Scheduled: ${formattedDate}

Log in to UMS to complete this follow-up:
https://ums.uniwayin.com/leads

— UMS Automated Reminder`,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #6366f1;">⏰ Follow-up Reminder</h2>
  <p>Hi ${toName},</p>
  <p>This is a reminder to follow up with <strong>${studentName}</strong>.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; background: #f9fafb;">Note</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${note || '<em>(no note)</em>'}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold; background: #f9fafb;">Scheduled</td>
      <td style="padding: 8px; border: 1px solid #e5e7eb;">${formattedDate}</td>
    </tr>
  </table>
  <a href="https://ums.uniwayin.com/leads" 
     style="display: inline-block; background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
    Open UMS →
  </a>
  <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">— UMS Automated Reminder</p>
</div>
        `,
      });

      this.logger.log(`Follow-up reminder sent to ${toEmail} for student ${studentName}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${toEmail}: ${err.message}`);
      throw err;
    }
  }
}
