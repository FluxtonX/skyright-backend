import mongoose, { Schema, Document } from 'mongoose';

export interface IClaim extends Document {
  user: mongoose.Types.ObjectId;
  
  // Step 1: Source
  vaultLinkId?: mongoose.Types.ObjectId;
  sentinelAlertId?: mongoose.Types.ObjectId;
  isDraft: boolean;

  // Step 2: Passenger Details
  passengerName?: string;
  passengerEmail?: string;
  passengerPhone?: string;
  passengerIdNumber?: string;

  // Step 3: Booking Details
  flightCode: string;
  airline: string;
  travelDate?: Date;
  routeFrom?: string;
  routeTo?: string;
  pnr?: string;
  disruptionType: string;

  // Step 4: Documents (Handled by document model relationship or embedded)
  documentsUploaded: boolean;

  // Status & Progress
  resolutionType?: 'Refund' | 'Rebooking' | 'Refund + Compensation';
  status: 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'REJECTED' | 'DRAFT';
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
    vaultLinkId: { type: Schema.Types.ObjectId, ref: 'Document' },
    sentinelAlertId: { type: Schema.Types.ObjectId, ref: 'Alert' },
    isDraft: { type: Boolean, default: true },

    passengerName: { type: String },
    passengerEmail: { type: String },
    passengerPhone: { type: String },
    passengerIdNumber: { type: String },

    flightCode: { type: String, required: true },
    airline: { type: String, required: true },
    travelDate: { type: Date },
    routeFrom: { type: String },
    routeTo: { type: String },
    pnr: { type: String },
    disruptionType: { type: String, required: true },

    documentsUploaded: { type: Boolean, default: false },

    resolutionType: { type: String, enum: ['Refund', 'Rebooking', 'Refund + Compensation'] },
    status: { 
      type: String, 
      enum: ['PENDING', 'IN PROGRESS', 'COMPLETED', 'REJECTED', 'DRAFT'], 
      default: 'DRAFT' 
    },
    currentStep: { type: Number, default: 1 },
    totalSteps: { type: Number, default: 4 },
    progress: { type: Number, default: 0.25 },
    compensationAmount: { type: String, default: '₦0' },
    resolutionText: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IClaim>('Claim', ClaimSchema);
