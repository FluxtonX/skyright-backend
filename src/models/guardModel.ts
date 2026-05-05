import mongoose, { Schema, Document } from 'mongoose';

export interface IGuard extends Document {
  user: mongoose.Types.ObjectId;
  flightCode: string;
  departureDate: Date;
  origin: string;
  destination: string;
  status: 'WATCHING' | 'DISRUPTED' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

const GuardSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    flightCode: { type: String, required: true },
    departureDate: { type: Date, required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    status: { type: String, enum: ['WATCHING', 'DISRUPTED', 'COMPLETED'], default: 'WATCHING' },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IGuard>('Guard', GuardSchema);
