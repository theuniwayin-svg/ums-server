import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FollowUp, FollowUpDocument } from './schemas/follow-up.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CreateFollowUpDto } from './dto/follow-up.dto';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityActionType } from '../activities/schemas/activity.schema';
import { UserRole } from '../users/schemas/user.schema';
import { buildLeadAccessQuery } from '../../common/utils/lead-access.util';

@Injectable()
export class FollowUpsService {
  constructor(
    @InjectModel(FollowUp.name)
    private followUpModel: Model<FollowUpDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private activitiesService: ActivitiesService,
  ) {}

  private async ensureLeadAccess(leadId: string, user: any) {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN) {
      return;
    }

    const lead = await this.leadModel
      .findOne({ _id: new Types.ObjectId(leadId), ...buildLeadAccessQuery(user) })
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }

  async findByLead(leadId: string, user: any) {
    await this.ensureLeadAccess(leadId, user);

    return this.followUpModel
      .find({ leadId: new Types.ObjectId(leadId) })
      .sort({ scheduledFor: -1 })
      .exec();
  }

  async findPending(user: any) {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const leadQuery =
      user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERADMIN
        ? {}
        : buildLeadAccessQuery(user);

    const accessibleLeadIds = await this.leadModel
      .find(leadQuery)
      .distinct('_id')
      .exec();

    return this.followUpModel
      .find({
        isCompleted: false,
        scheduledFor: { $lte: twentyFourHoursLater },
        leadId: { $in: accessibleLeadIds },
      })
      .populate('leadId', 'studentName phone status')
      .sort({ scheduledFor: 1 })
      .exec();
  }

  async create(
    leadId: string,
    createFollowUpDto: CreateFollowUpDto,
    userId: string,
    userName: string,
    user?: any,
  ) {
    await this.ensureLeadAccess(leadId, user);

    const followUp = await this.followUpModel.create({
      leadId: new Types.ObjectId(leadId),
      createdBy: new Types.ObjectId(userId),
      type: createFollowUpDto.type,
      scheduledFor: new Date(createFollowUpDto.scheduledFor),
      note: createFollowUpDto.note || '',
    });

    // Update embedded followUp on Lead
    await this.leadModel.findByIdAndUpdate(leadId, {
      followUp: {
        scheduledFor: new Date(createFollowUpDto.scheduledFor),
        type: createFollowUpDto.type,
        note: createFollowUpDto.note || '',
        isCompleted: false,
      },
    });

    await this.activitiesService.log({
      leadId,
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.FOLLOW_UP_SCHEDULED,
      newValue: {
        type: createFollowUpDto.type,
        scheduledFor: createFollowUpDto.scheduledFor,
        note: createFollowUpDto.note,
      },
    });

    return followUp;
  }

  async complete(
    leadId: string,
    followUpId: string,
    userId: string,
    userName: string,
    user?: any,
  ) {
    await this.ensureLeadAccess(leadId, user);

    const followUp = await this.followUpModel
      .findByIdAndUpdate(
        followUpId,
        {
          isCompleted: true,
          completedAt: new Date(),
          completedBy: new Types.ObjectId(userId),
        },
        { new: true },
      )
      .exec();

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    // Update embedded follow-up on lead
    await this.leadModel.findByIdAndUpdate(leadId, {
      'followUp.isCompleted': true,
      'followUp.completedAt': new Date(),
      'followUp.completedBy': new Types.ObjectId(userId),
    });

    await this.activitiesService.log({
      leadId,
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.FOLLOW_UP_COMPLETED,
      newValue: { completedAt: new Date() },
    });

    return followUp;
  }
}
