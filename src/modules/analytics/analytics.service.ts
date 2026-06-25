import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument, LeadStatus, LeadTemperature, LeadSource } from '../leads/schemas/lead.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { FollowUp, FollowUpDocument } from '../follow-ups/schemas/follow-up.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(FollowUp.name) private followUpModel: Model<FollowUpDocument>,
  ) {}

  async getDashboard() {
    const [
      leadsByStatus,
      leadsByTemperature,
      leadsBySource,
      admissionsThisMonth,
      totalActiveLeads,
      pendingFollowUps,
    ] = await Promise.all([
      this.getLeadsByStatus(),
      this.getLeadsByTemperature(),
      this.getLeadsBySource(),
      this.getAdmissionsThisMonth(),
      this.getTotalActiveLeads(),
      this.getPendingFollowUpsCount(),
    ]);

    return {
      leadsByStatus,
      leadsByTemperature,
      leadsBySource,
      admissionsThisMonth,
      totalActiveLeads,
      pendingFollowUps,
    };
  }

  private async getLeadsByStatus() {
    const result = await this.leadModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return result.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getLeadsByTemperature() {
    const result = await this.leadModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$temperature', count: { $sum: 1 } } },
    ]);
    return result.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getLeadsBySource() {
    const result = await this.leadModel.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);
    return result.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getAdmissionsThisMonth() {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    return this.leadModel.countDocuments({
      status: LeadStatus.ADMISSION_CONFIRMED,
      updatedAt: { $gte: start },
    });
  }

  private async getTotalActiveLeads() {
    return this.leadModel.countDocuments({
      isDeleted: { $ne: true },
      status: { $nin: [LeadStatus.CLOSED, LeadStatus.NOT_INTERESTED] },
    });
  }

  private async getPendingFollowUpsCount() {
    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return this.followUpModel.countDocuments({
      isCompleted: false,
      scheduledFor: { $lte: end },
    });
  }

  async getStaffPerformance() {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const result = await this.activityModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek },
        },
      },
      {
        $group: {
          _id: '$performedBy',
          name: { $first: '$performedByName' },
          activitiesThisWeek: { $sum: 1 },
          leadsCreated: {
            $sum: {
              $cond: [{ $eq: ['$actionType', 'LEAD_CREATED'] }, 1, 0],
            },
          },
          admissions: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$actionType', 'STATUS_CHANGED'] },
                    { $eq: ['$newValue', 'Admission Confirmed'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { activitiesThisWeek: -1 } },
    ]);

    return { staff: result };
  }

  async getTrends(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const result = await this.leadModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', count: 1, _id: 0 } },
    ]);

    return { trends: result, period: `${days}d` };
  }
}
