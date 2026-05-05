import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  type: 'Passport' | 'ID Card' | 'Boarding Pass' | 'Ticket' | 'Other';
  fileUrl: string;
  ocrData?: any;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['Passport', 'ID Card', 'Boarding Pass', 'Ticket', 'Other'], 
      default: 'Other' 
    },
    fileUrl: { type: String, required: true },
    ocrData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IDocument>('Document', DocumentSchema);
