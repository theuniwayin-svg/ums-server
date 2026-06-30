import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type LeadDocument = Lead & Document;

export enum LeadSource {
  META_ADS = 'Meta Ads',
  GOOGLE_ADS = 'Google Ads',
  WALK_IN = 'Walk-In',
  REFERRAL = 'Referral',
  WHATSAPP = 'WhatsApp',
  WEBSITE = 'Website',
  OTHER = 'Other',
}

export enum LeadStatus {
  NEW = 'New',
  CALLED = 'Called',
  INTERESTED = 'Interested',
  FOLLOW_UP = 'Follow Up',
  ADMISSION_CONFIRMED = 'Admission Confirmed',
  NOT_INTERESTED = 'Not Interested',
  CLOSED = 'Closed',
}

export enum LeadTemperature {
  HOT = 'Hot',
  WARM = 'Warm',
  COLD = 'Cold',
}

export enum FollowUpType {
  CALL = 'Call',
  DOCUMENTS_PENDING = 'Documents Pending',
  PARENT_CALLBACK = 'Parent Callback',
  GENERAL = 'General',
}

@Schema({ _id: false })
class FollowUpEmbed {
  @Prop()
  scheduledFor: Date;

  @Prop({ type: String, enum: Object.values(FollowUpType) })
  type: string;

  @Prop()
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

const FollowUpEmbedSchema = SchemaFactory.createForClass(FollowUpEmbed);

@Schema({ _id: false })
class LatestNoteEmbed {
  @Prop()
  content: string;

  @Prop()
  createdByName: string;

  @Prop()
  createdAt: Date;
}

const LatestNoteEmbedSchema = SchemaFactory.createForClass(LatestNoteEmbed);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Lead {
  @Prop({ required: true, trim: true })
  studentName: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ sparse: true })
  parentPhone: string;

  @Prop({ lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  city: string;

  @Prop({ trim: true })
  state: string;

  @Prop({ trim: true })
  course: string;

  @Prop({ trim: true })
  preferredCollege: string;

  @Prop({ type: String, enum: Object.values(LeadSource), required: true })
  source: string;

  @Prop({ maxlength: 100 })
  otherSourceDescription: string;

  @Prop({ type: String, enum: Object.values(LeadStatus), default: LeadStatus.NEW })
  status: string;

  @Prop({ type: String, enum: Object.values(LeadTemperature), default: LeadTemperature.WARM })
  temperature: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: FollowUpEmbedSchema })
  followUp: FollowUpEmbed;

  @Prop({ type: LatestNoteEmbedSchema })
  latestNote: LatestNoteEmbed;

  @Prop({ default: 0 })
  version: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

// MongoDB Indexes (do NOT add phone/parentPhone here — already declared via @Prop)
LeadSchema.index({ status: 1 });
LeadSchema.index({ temperature: 1 });
LeadSchema.index({ source: 1 });
LeadSchema.index({ createdBy: 1, createdAt: -1 });
LeadSchema.index({ updatedAt: -1 });
LeadSchema.index({ course: 1 });
LeadSchema.index({ preferredCollege: 1 });
LeadSchema.index({ assignedTo: 1, updatedAt: -1 });
LeadSchema.index({ city: 1, state: 1 });
LeadSchema.index({ 'followUp.scheduledFor': 1 });
LeadSchema.index({ isDeleted: 1, status: 1 });
LeadSchema.index(
  { studentName: 'text', phone: 'text', email: 'text', parentPhone: 'text' },
  { name: 'leads_text_search' },
);

// Exclude soft-deleted leads by default
LeadSchema.pre(/^find/, function (this: any) {
  if (this._conditions && this._conditions.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});
