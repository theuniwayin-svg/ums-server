import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FollowUpDocument = FollowUp & Document;

export enum FollowUpType {
  CALL = 'Call',
  DOCUMENTS_PENDING = 'Documents Pending',
  PARENT_CALLBACK = 'Parent Callback',
  GENERAL = 'General',
}

@Schema({ timestamps: true })
export class FollowUp {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(FollowUpType), required: true })
  type: string;

  @Prop({ required: true })
  scheduledFor: Date;

  @Prop({ default: '' })
  note: string;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop()
  completedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  completedBy: Types.ObjectId;

  @Prop({ default: false })
  reminderSent: boolean;
}

export const FollowUpSchema = SchemaFactory.createForClass(FollowUp);

FollowUpSchema.index({ leadId: 1, createdAt: -1 });
FollowUpSchema.index({ createdBy: 1, scheduledFor: 1 });
FollowUpSchema.index({ scheduledFor: 1, isCompleted: 1 });
