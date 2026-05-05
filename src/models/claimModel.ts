import mongoose, { Schema, Document } from 'mongoose';

export interface IClaim extends Document {
  user: mongoose.Types.ObjectId;
  flightCode: string;
  airline: string;
  disruptionType: string;
  resolutionType?: 'Refund' | 'Rebooking' | 'Refund + Compensation';
  status: 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'REJECTED';
  currentStep: number;
  totalSteps: number;
  progress: number;
  compensationAmount: string;
  resolutionText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClaimSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    flightCode: { type: String, required: true },
    airline: { type: String, required: true },
    disruptionType: { type: String, required: true },
    resolutionType: { type: String, enum: ['Refund', 'Rebooking', 'Refund + Compensation'] },
    status: { type: String, enum: ['PENDING', 'IN PROGRESS', 'COMPLETED', 'REJECTED'], default: 'PENDING' },
    currentStep: { type: Number, default: 1 },
    totalSteps: { type: Number, default: 6 },
    progress: { type: Number, default: 0.16 }, // Default for step 1
    compensationAmount: { type: String, default: '₦0' },
    resolutionText: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IClaim>('Claim', ClaimSchema);
