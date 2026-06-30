import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Note, NoteDocument } from './schemas/note.schema';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { ActivitiesService } from '../activities/activities.service';
import { ActivityActionType } from '../activities/schemas/activity.schema';
import { UserRole } from '../users/schemas/user.schema';
import { buildLeadAccessQuery } from '../../common/utils/lead-access.util';

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private noteModel: Model<NoteDocument>,
    @InjectModel('Lead') private leadModel: Model<any>,
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
    return this.noteModel
      .find({ leadId: new Types.ObjectId(leadId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(
    leadId: string,
    createNoteDto: CreateNoteDto,
    userId: string,
    userName: string,
    user?: any,
  ) {
    await this.ensureLeadAccess(leadId, user);

    // Sanitize content — strip any HTML tags
    // Strip HTML tags safely — limit tag length to prevent ReDoS
    const sanitizedContent = createNoteDto.content
      .replace(/<[^<>]{0,500}>/g, '')
      .replace(/[<>]/g, '')
      .trim();

    const note = await this.noteModel.create({
      leadId: new Types.ObjectId(leadId),
      createdBy: new Types.ObjectId(userId),
      createdByName: userName,
      content: sanitizedContent,
    });

    // Bump lead's updatedAt and store the latest note snapshot so the lead
    // rises to the top of the table and the mobile card can show the snippet.
    await this.leadModel.findByIdAndUpdate(leadId, {
      $set: {
        updatedAt: new Date(),
        latestNote: {
          content: sanitizedContent,
          createdByName: userName,
          createdAt: note.createdAt,
        },
      },
    });

    await this.activitiesService.log({
      leadId,
      performedBy: userId,
      performedByName: userName,
      actionType: ActivityActionType.NOTE_ADDED,
      newValue: sanitizedContent,
    });

    return note;
  }

  async update(
    leadId: string,
    noteId: string,
    updateNoteDto: UpdateNoteDto,
    userId: string,
    userRole: string,
    user?: any,
  ) {
    await this.ensureLeadAccess(leadId, user);

    const note = await this.noteModel.findById(noteId).exec();
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Only creator or admin can edit
    if (
      note.createdBy.toString() !== userId &&
      !['admin', 'superadmin'].includes(userRole)
    ) {
      throw new ForbiddenException('You can only edit your own notes');
    }

    const sanitizedContent = updateNoteDto.content
      .replace(/<[^<>]{0,500}>/g, '')
      .replace(/[<>]/g, '')
      .trim();

    return this.noteModel
      .findByIdAndUpdate(
        noteId,
        { content: sanitizedContent },
        { new: true },
      )
      .exec();
  }

  async remove(noteId: string, userId: string, userRole: string, user?: any) {
    const note = await this.noteModel.findById(noteId).exec();
    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.ensureLeadAccess(note.leadId.toString(), user);

    if (
      note.createdBy.toString() !== userId &&
      !['admin', 'superadmin'].includes(userRole)
    ) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.noteModel.findByIdAndDelete(noteId).exec();
    return { deleted: true };
  }
}
