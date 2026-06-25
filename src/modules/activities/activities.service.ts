import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import {
  Activity,
  ActivityDocument,
  ActivityActionType,
} from './schemas/activity.schema';
import { UserRole } from '../users/schemas/user.schema';
import { buildLeadAccessQuery } from '../../common/utils/lead-access.util';

export interface LogActivityParams {
  leadId: string;
  performedBy: string;
  performedByName: string;
  actionType: ActivityActionType;
  fieldChanged?: string;
  previousValue?: unknown;
  newValue?: unknown;
  snapshot?: object;
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name)
    private activityModel: Model<ActivityDocument>,
    @InjectModel(Lead.name)
    private leadModel: Model<LeadDocument>,
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

  async log(params: LogActivityParams): Promise<Activity> {
    return this.activityModel.create({
      leadId: new Types.ObjectId(params.leadId),
      performedBy: new Types.ObjectId(params.performedBy),
      performedByName: params.performedByName,
      actionType: params.actionType,
      fieldChanged: params.fieldChanged,
      previousValue: params.previousValue,
      newValue: params.newValue,
      snapshot: params.snapshot,
    });
  }

  async findByLead(
    leadId: string,
    user: any,
    cursor?: string,
    limit = 20,
  ): Promise<{ data: Activity[]; meta: { nextCursor?: string; hasMore: boolean } }> {
    await this.ensureLeadAccess(leadId, user);

    const query: any = {
      leadId: new Types.ObjectId(leadId),
    };

    if (cursor) {
      query._id = { $lt: new Types.ObjectId(cursor) };
    }

    const activities = await this.activityModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = activities.length > limit;
    const data = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore
      ? (data[data.length - 1] as any)._id.toString()
      : undefined;

    return {
      data,
      meta: { hasMore, nextCursor },
    };
  }
}
