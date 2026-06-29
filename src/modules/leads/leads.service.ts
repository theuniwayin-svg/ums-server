import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Lead, LeadDocument, LeadSource, LeadStatus, LeadTemperature } from './schemas/lead.schema';
import {
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
  UpdateLeadTemperatureDto,
  BulkUpdateLeadDto,
  BulkAssignLeadDto,
  DuplicateOverrideDto,
  LeadFiltersDto,
} from './dto/lead.dto';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityActionType } from '../activities/schemas/activity.schema';
import { AuditService } from '../audit/audit.service';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { buildLeadAccessQuery, isPrivilegedUser } from '../../common/utils/lead-access.util';

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private activitiesService: ActivitiesService,
    private auditService: AuditService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async findAccessibleLeadOrThrow(id: string, user: any) {
    const lead = await this.leadModel
      .findOne({ _id: new Types.ObjectId(id), ...buildLeadAccessQuery(user) })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('assignedTo', 'name email role')
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  private async updateSingleField(
    id: string,
    updateData: Record<string, unknown>,
    userId: string,
    userName: string,
    user?: any,
  ) {
    const currentLead = await this.leadModel
      .findOne({ _id: new Types.ObjectId(id), version: updateData.version as number })
      .exec();

    if (!currentLead) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'This lead was updated by someone else. Please refresh and try again.',
      });
    }

    const changedField = Object.keys(updateData).find((field) => field !== 'version');
    if (!changedField) {
      return currentLead;
    }

    const newValue = updateData[changedField];
    const previousValue = (currentLead as any)[changedField];

    if (JSON.stringify(previousValue) === JSON.stringify(newValue)) {
      return currentLead;
    }

    const updatedLead = await this.leadModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), version: updateData.version as number },
        {
          $set: {
            [changedField]: newValue,
            updatedBy: new Types.ObjectId(userId),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .exec();

    if (!updatedLead) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'This lead was updated by someone else. Please refresh and try again.',
      });
    }

    const actionType =
      changedField === 'status'
        ? ActivityActionType.STATUS_CHANGED
        : changedField === 'temperature'
          ? ActivityActionType.TEMPERATURE_CHANGED
          : ActivityActionType.LEAD_UPDATED;

    await this.activitiesService.log({
      leadId: id,
      performedBy: userId,
      performedByName: userName,
      actionType,
      fieldChanged: changedField,
      previousValue,
      newValue,
      snapshot: {
        changedField,
        previousValue,
        newValue,
      },
    });

    this.eventEmitter.emit('lead.updated', {
      lead: updatedLead,
      changes: { [changedField]: newValue },
      updatedBy: userId,
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'LEAD_UPDATED',
      metadata: {
        leadId: id,
        changedFields: [changedField],
      },
    });

    return updatedLead;
  }

  async create(
    createLeadDto: CreateLeadDto,
    userId: string,
    userName: string,
  ) {
    // Q6: Require otherSourceDescription when source = Other
    if (
      createLeadDto.source === LeadSource.OTHER &&
      !createLeadDto.otherSourceDescription?.trim()
    ) {
      throw new BadRequestException({
        code: 'OTHER_SOURCE_REQUIRED',
        message:
          'Please describe the lead source when "Other" is selected',
      });
    }

    // Pre-check for duplicate phone (check only last 10 digits)
    const rawPhone = createLeadDto.phone.replace(/\D/g, '');
    const last10Phone = rawPhone.slice(-10);

    const existingByPhone = await this.leadModel
      .findOne({ phone: { $regex: new RegExp(`${last10Phone}$`) } })
      .select('_id studentName')
      .exec();

    if (existingByPhone) {
      throw new ConflictException({
        code: 'DUPLICATE_PHONE',
        message: 'A lead with this phone number already exists',
        details: {
          existingLeadId: existingByPhone._id.toString(),
          existingLeadName: (existingByPhone as any).studentName,
        },
      });
    }

    if (createLeadDto.parentPhone) {
      const rawParentPhone = createLeadDto.parentPhone.replace(/\D/g, '');
      const last10Parent = rawParentPhone.slice(-10);

      const existingByParentPhone = await this.leadModel
        .findOne({ parentPhone: { $regex: new RegExp(`${last10Parent}$`) } })
        .select('_id studentName')
        .exec();

      if (existingByParentPhone) {
        throw new ConflictException({
          code: 'DUPLICATE_PARENT_PHONE',
          message: 'A lead with this parent phone already exists',
          details: {
            existingLeadId: existingByParentPhone._id.toString(),
            existingLeadName: (existingByParentPhone as any).studentName,
          },
        });
      }
    }

    let lead: LeadDocument;
    try {
      lead = await this.leadModel.create({
        ...createLeadDto,
        createdBy: new Types.ObjectId(userId),
        assignedTo: new Types.ObjectId(userId),
        status: createLeadDto.status || LeadStatus.NEW,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException({
          code: 'DUPLICATE_PHONE',
          message: 'A lead with this phone number already exists',
          details: { keyPattern: err.keyPattern },
        });
      }
      throw err;
    }

    // Log creation activity
    await this.activitiesService.log({
      leadId: lead._id.toString(),
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.LEAD_CREATED,
      snapshot: lead.toObject(),
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'LEAD_CREATED',
      metadata: {
        leadId: lead._id.toString(),
        studentName: lead.studentName,
      },
    });

    this.eventEmitter.emit('lead.created', { lead, createdBy: userId });

    return lead;
  }

  async findAll(filters: LeadFiltersDto, user?: any) {
    const {
      status,
      temperature,
      source,
      createdBy,
      assignedTo,
      q,
      city,
      course,
      preferredCollege,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      order = 'desc',
    } = filters;

    const query: any = { ...buildLeadAccessQuery(user) };

    if (status) query.status = status;
    if (temperature) query.temperature = temperature;
    if (source) query.source = source;
    if (createdBy) query.createdBy = new Types.ObjectId(createdBy);
    if (assignedTo && assignedTo !== 'undefined' && assignedTo !== 'null' && assignedTo.trim() !== '') {
      if (!isPrivilegedUser(user)) {
        throw new ForbiddenException('Assigned-to filter is admin only');
      }

      if (assignedTo === 'unassigned') {
        query.assignedTo = null;
      } else {
        query.assignedTo = new Types.ObjectId(assignedTo);
      }
    }
    if (city) query.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (course) query.course = new RegExp(course.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (preferredCollege) {
      query.preferredCollege = new RegExp(
        preferredCollege.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }

    if (q && q.trim().length >= 1) {
      const escapedQuery = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedQuery, 'i');
      query.$or = [
        { studentName: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { parentPhone: searchRegex },
        { course: searchRegex },
        { preferredCollege: searchRegex },
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions: any = { [sortBy]: sortOrder };
    const skip = (page - 1) * limit;

    try {
      const [data, total] = await Promise.all([
        this.leadModel
          .find(query)
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email')
          .populate('assignedTo', 'name email role')
          .sort(sortOptions)
          .skip(skip)
          .limit(Number(limit))
          .exec(),
        this.leadModel.countDocuments(query),
      ]);

      return {
        data,
        meta: { total, page: Number(page), limit: Number(limit) },
      };
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      if (err.name === 'CastError') {
        throw new InternalServerErrorException('Data integrity error or invalid query format: ' + err.message);
      }
      throw err;
    }
  }

  async findById(id: string, user?: any) {
    return this.findAccessibleLeadOrThrow(id, user);
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    userId: string,
    userName: string,
    user?: any,
  ) {
    if (user) {
      await this.findAccessibleLeadOrThrow(id, user);
    }

    const { version, ...updateData } = updateLeadDto;

    // Sanitize assignedTo: empty string must become null (not an invalid ObjectId)
    if ('assignedTo' in updateData) {
      const raw = (updateData as any).assignedTo;
      if (!raw || raw === '') {
        (updateData as any).assignedTo = null;
      }
    }

    if ((updateData as any).assignedTo !== undefined && !isPrivilegedUser(user)) {
      throw new ForbiddenException('Only admins can reassign leads');
    }

    // Get current state for activity diff
    const currentLead = await this.leadModel
      .findOne({ _id: new Types.ObjectId(id), version })
      .exec();

    if (!currentLead) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'This lead was updated by someone else. Please refresh and try again.',
      });
    }

    const effectiveChanges = Object.entries(updateLeadDto).filter(
      ([field, value]) =>
        field !== 'version' &&
        JSON.stringify((currentLead as any)[field]) !== JSON.stringify(value),
    );

    if (effectiveChanges.length === 0) {
      return currentLead;
    }

    // Build $set and $unset separately so null assignedTo properly clears the field
    const setFields: Record<string, unknown> = { updatedBy: new Types.ObjectId(userId) };
    const unsetFields: Record<string, unknown> = {};

    for (const [field, value] of Object.entries(updateData)) {
      if (value === null && field === 'assignedTo') {
        unsetFields[field] = '';
      } else {
        setFields[field] = value;
      }
    }

    const mongoUpdate: Record<string, unknown> = {
      $set: setFields,
      $inc: { version: 1 },
    };
    if (Object.keys(unsetFields).length > 0) {
      mongoUpdate.$unset = unsetFields;
    }

    let updatedLead;
    try {
      updatedLead = await this.leadModel
        .findOneAndUpdate(
          { _id: new Types.ObjectId(id), version },
          mongoUpdate,
          { new: true },
        )
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .exec();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException({
          code: 'DUPLICATE_PHONE',
          message: 'A lead with this phone number already exists',
          details: { keyPattern: err.keyPattern },
        });
      }
      throw err;
    }

    if (!updatedLead) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message:
          'This lead was updated by someone else. Please refresh and try again.',
      });
    }

    // Log one activity per changed field so lead information updates remain readable.
    const changedFields = effectiveChanges.map(([field]) => field);

    for (const [field, newValue] of effectiveChanges) {
      const previousValue = (currentLead as any)[field];
      let activityPreviousValue: unknown = previousValue;
      let activityNewValue: unknown = newValue;

      if (field === 'assignedTo') {
        const previousAssigneeId = previousValue?.toString?.() || previousValue;
        const nextAssigneeId = newValue?.toString?.() || newValue;

        const [previousAssignee, nextAssignee] = await Promise.all([
          previousAssigneeId
            ? this.userModel.findById(previousAssigneeId).select('name').exec()
            : Promise.resolve(null),
          nextAssigneeId
            ? this.userModel.findById(nextAssigneeId).select('name').exec()
            : Promise.resolve(null),
        ]);

        activityPreviousValue = previousAssignee?.name || previousAssigneeId || null;
        activityNewValue = nextAssignee?.name || nextAssigneeId || 'Unassigned';
      }

      await this.activitiesService.log({
        leadId: id,
        performedBy: userId,
        performedByName: userName,
        actionType: ActivityActionType.LEAD_UPDATED,
        fieldChanged: field,
        previousValue: activityPreviousValue,
        newValue: activityNewValue,
        snapshot: {
          changedField: field,
          previousValue: activityPreviousValue,
          newValue: activityNewValue,
        },
      });
    }

    this.eventEmitter.emit('lead.updated', {
      lead: updatedLead,
      changes: updateData,
      updatedBy: userId,
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'LEAD_UPDATED',
      metadata: {
        leadId: id,
        changedFields,
      },
    });

    return updatedLead;
  }

  async updateStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    userId: string,
    userName: string,
    user?: any,
  ) {
    if (user) {
      await this.findAccessibleLeadOrThrow(id, user);
    }

    return this.updateSingleField(
      id,
      { version: dto.version, status: dto.status },
      userId,
      userName,
      user,
    );
  }

  async updateTemperature(
    id: string,
    dto: UpdateLeadTemperatureDto,
    userId: string,
    userName: string,
    user?: any,
  ) {
    if (user) {
      await this.findAccessibleLeadOrThrow(id, user);
    }

    return this.updateSingleField(
      id,
      { version: dto.version, temperature: dto.temperature },
      userId,
      userName,
      user,
    );
  }

  async softDelete(id: string, userId: string, userName: string, user?: any) {
    const lead = await this.leadModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), ...buildLeadAccessQuery(user) },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            status: LeadStatus.CLOSED,
            updatedBy: new Types.ObjectId(userId),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    await this.activitiesService.log({
      leadId: id,
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.LEAD_DELETED,
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'LEAD_DELETED',
      metadata: { leadId: id },
    });

    this.eventEmitter.emit('lead.closed', { lead, closedBy: userId });

    return lead;
  }

  async closeLead(id: string, userId: string, userName: string, user?: any) {
    const lead = await this.leadModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), ...buildLeadAccessQuery(user) },
        {
          $set: {
            status: LeadStatus.CLOSED,
            isDeleted: true,
            deletedAt: new Date(),
            updatedBy: new Types.ObjectId(userId),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    await this.activitiesService.log({
      leadId: id,
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.LEAD_CLOSED,
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'LEAD_CLOSED',
      metadata: { leadId: id },
    });

    return lead;
  }

  async overrideDuplicate(
    duplicateLeadId: string,
    createLeadDto: CreateLeadDto,
    overrideDto: DuplicateOverrideDto,
    userId: string,
    userName: string,
    userRole: string,
  ) {
    // Create lead despite duplicate
    let lead: LeadDocument;
    try {
      lead = await this.leadModel.create({
        ...createLeadDto,
        createdBy: new Types.ObjectId(userId),
        assignedTo: isPrivilegedUser({ role: userRole })
          ? undefined
          : new Types.ObjectId(userId),
        status: createLeadDto.status || LeadStatus.NEW,
      });
    } catch (err: any) {
      if (err.code === 11000) {
        // Create with modified phone if exact duplicate
        throw new ConflictException({
          code: 'DUPLICATE_CANNOT_OVERRIDE',
          message: 'Cannot create exact duplicate even with override',
        });
      }
      throw err;
    }

    // Log override activity
    await this.activitiesService.log({
      leadId: lead._id.toString(),
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.DUPLICATE_OVERRIDE,
      snapshot: {
        reason: overrideDto.reason,
        duplicateLeadId,
        overriddenBy: userId,
      },
    });

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'DUPLICATE_OVERRIDE',
      metadata: {
        leadId: lead._id.toString(),
        duplicateLeadId,
      },
    });

    return lead;
  }

  async bulkAssign(
    bulkDto: BulkAssignLeadDto,
    userId: string,
    userName: string,
  ) {
    const { leadIds, assignedTo } = bulkDto;

    if (leadIds.length > 100) {
      throw new BadRequestException('Cannot assign more than 100 leads at once');
    }

    // Handle unassign (assignedTo is null/empty)
    const isUnassign = !assignedTo || assignedTo === '';

    if (!isUnassign) {
      const staff = await this.userModel
        .findOne({ _id: new Types.ObjectId(assignedTo), isActive: true })
        .select('name email role')
        .exec();

      if (!staff) {
        throw new BadRequestException('Assigned user not found or inactive');
      }

      if (![UserRole.ADMIN, UserRole.STAFF].includes(staff.role as UserRole)) {
        throw new BadRequestException('Leads can only be assigned to staff or admin users');
      }
    }

    const results = { updated: 0, failed: 0, errors: [] as any[] };

    for (const leadId of leadIds) {
      try {
        const lead = await this.leadModel.findById(leadId).exec();
        if (!lead) {
          results.failed++;
          results.errors.push({ leadId, error: 'Lead not found' });
          continue;
        }

        if (isUnassign) {
          await this.leadModel.findByIdAndUpdate(leadId, {
            $unset: { assignedTo: '' },
            $set: { updatedBy: new Types.ObjectId(userId) },
            $inc: { version: 1 },
          });
        } else {
          await this.leadModel.findByIdAndUpdate(leadId, {
            $set: {
              assignedTo: new Types.ObjectId(assignedTo),
              updatedBy: new Types.ObjectId(userId),
            },
            $inc: { version: 1 },
          });
        }

        await this.activitiesService.log({
          leadId,
          performedBy: userId,
          performedByName: userName,
          actionType: ActivityActionType.FIELD_UPDATED,
          fieldChanged: 'assignedTo',
          previousValue: (lead as any).assignedTo?.toString?.() || null,
          newValue: isUnassign ? null : assignedTo,
        });

        results.updated++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ leadId, error: err.message });
      }
    }

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: isUnassign ? 'LEADS_UNASSIGNED' : 'LEADS_ASSIGNED',
      metadata: {
        leadIds,
        assignedTo: isUnassign ? null : assignedTo,
        results,
      },
    });

    return results;
  }

  async getSuggestions(field: 'course' | 'preferredCollege', q: string) {
    const allowedFields = ['course', 'preferredCollege'];
    if (!allowedFields.includes(field)) {
      throw new BadRequestException('Invalid field for suggestions');
    }

    const regex = new RegExp(q, 'i');
    const suggestions = await this.leadModel
      .distinct(field as string, { [field]: regex })
      .exec();

    return { suggestions: suggestions.slice(0, 10) };
  }

  async bulkUpdate(
    bulkDto: BulkUpdateLeadDto,
    userId: string,
    userName: string,
  ) {
    const { leadIds, action, value } = bulkDto;

    if (!['status', 'temperature'].includes(action)) {
      throw new BadRequestException('Action must be "status" or "temperature"');
    }

    // Validate value against the appropriate enum
    const validStatuses = Object.values(LeadStatus);
    const validTemperatures = Object.values(LeadTemperature);

    if (action === 'status' && !validStatuses.includes(value as LeadStatus)) {
      throw new BadRequestException(
        `Invalid status value. Must be one of: ${validStatuses.join(', ')}`,
      );
    }
    if (action === 'temperature' && !validTemperatures.includes(value as LeadTemperature)) {
      throw new BadRequestException(
        `Invalid temperature value. Must be one of: ${validTemperatures.join(', ')}`,
      );
    }

    if (leadIds.length > 100) {
      throw new BadRequestException('Cannot update more than 100 leads at once');
    }

    const results = { updated: 0, failed: 0, errors: [] as any[] };

    for (const leadId of leadIds) {
      try {
        const lead = await this.leadModel.findById(leadId).exec();
        if (!lead) {
          results.failed++;
          results.errors.push({ leadId, error: 'Lead not found' });
          continue;
        }

        const update: any = { updatedBy: new Types.ObjectId(userId) };
        update[action] = value;

        await this.leadModel.findByIdAndUpdate(leadId, {
          $set: update,
          $inc: { version: 1 },
        });

        const actionType =
          action === 'status'
            ? ActivityActionType.STATUS_CHANGED
            : ActivityActionType.TEMPERATURE_CHANGED;

        await this.activitiesService.log({
          leadId,
          performedBy: userId,
          performedByName: userName,
          actionType,
          fieldChanged: action,
          previousValue: (lead as any)[action],
          newValue: value,
        });

        results.updated++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ leadId, error: err.message });
      }
    }

    await this.auditService.log({
      performedBy: userId,
      performedByName: userName,
      action: 'BULK_UPDATE',
      metadata: { leadIds, action, value, results },
    });

    return results;
  }

  async exportLeads(filters: LeadFiltersDto, user?: any) {
    const query: any = { ...buildLeadAccessQuery(user) };
    if (filters.status) query.status = filters.status;
    if (filters.temperature) query.temperature = filters.temperature;
    if (filters.source) query.source = filters.source;
    if (filters.preferredCollege) {
      query.preferredCollege = new RegExp(
        filters.preferredCollege.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
    }

    const leads = await this.leadModel
      .find(query)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10000)
      .exec();

    if (user) {
      await this.auditService.log({
        performedBy: user._id.toString(),
        performedByName: user.name,
        action: 'LEADS_EXPORTED',
        metadata: {
          filters,
          count: leads.length,
        },
      });
    }

    return leads;
  }
}
