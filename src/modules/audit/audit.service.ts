import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface CreateAuditLogParams {
  performedBy: string;
  performedByName: string;
  action: string;
  metadata?: object;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(params: CreateAuditLogParams): Promise<AuditLog> {
    return this.auditLogModel.create({
      performedBy: new Types.ObjectId(params.performedBy),
      performedByName: params.performedByName,
      action: params.action,
      metadata: params.metadata,
    });
  }

  async findAll(page = 1, limit = 20, action?: string) {
    const query: any = {};
    if (action) query.action = action;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditLogModel.countDocuments(query),
    ]);

    return {
      data,
      meta: { total, page, limit },
    };
  }
}
