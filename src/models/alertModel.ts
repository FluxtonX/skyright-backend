import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  user: mongoose.Types.ObjectId;
  flightCode: string;
  airline: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  eventType: string;
  eventDescription: string;
  rightsDescription: string;
  iconType: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    flightCode: { type: String, required: true },
    airline: { type: String, required: true },
    priority: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'LOW' },
    eventType: { type: String, required: true },
    eventDescription: { type: String, required: true },
    rightsDescription: { type: String, required: true },
    iconType: { type: String, default: 'notifications' },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IAlert>('Alert', AlertSchema);
