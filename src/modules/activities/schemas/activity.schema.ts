import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ActivityDocument = Activity & Document;

export enum ActivityActionType {
  LEAD_CREATED = 'LEAD_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  TEMPERATURE_CHANGED = 'TEMPERATURE_CHANGED',
  FIELD_UPDATED = 'FIELD_UPDATED',
  NOTE_ADDED = 'NOTE_ADDED',
  FOLLOW_UP_SCHEDULED = 'FOLLOW_UP_SCHEDULED',
  FOLLOW_UP_COMPLETED = 'FOLLOW_UP_COMPLETED',
  LEAD_UPDATED = 'LEAD_UPDATED',
  DUPLICATE_OVERRIDE = 'DUPLICATE_OVERRIDE',
  LEAD_CLOSED = 'LEAD_CLOSED',
  LEAD_DELETED = 'LEAD_DELETED',
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Activity {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  performedBy: Types.ObjectId;

  @Prop({ required: true })
  performedByName: string;

  @Prop({ type: String, enum: Object.values(ActivityActionType), required: true })
  actionType: string;

  @Prop()
  fieldChanged: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  previousValue: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed })
  newValue: unknown;

  @Prop({ type: MongooseSchema.Types.Mixed })
  snapshot: object;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// Immutability guard — activities cannot be updated
ActivitySchema.pre('save', function (this: any) {
  if (!this.isNew) {
    throw new Error('Activity documents are immutable and cannot be updated');
  }
});

// Prevent findOneAndUpdate on activities
ActivitySchema.pre('findOneAndUpdate', function (this: any) {
  throw new Error('Activity documents are immutable');
});

// Indexes
ActivitySchema.index({ leadId: 1, createdAt: -1 });
ActivitySchema.index({ performedBy: 1, createdAt: -1 });
