import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NoteDocument = Note & Document;

@Schema({ timestamps: true })
export class Note {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true })
  createdByName: string;

  @Prop({ required: true, maxlength: 2000 })
  content: string;
}

export const NoteSchema = SchemaFactory.createForClass(Note);

NoteSchema.index({ leadId: 1, createdAt: -1 });
