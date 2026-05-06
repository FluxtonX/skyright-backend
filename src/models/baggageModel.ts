import mongoose, { Schema, Document } from 'mongoose';

export interface IBaggage extends Document {
  user: mongoose.Types.ObjectId;
  tagNumber: string;
  status: 'In Transit' | 'Collected' | 'Needs Attention' | 'Delayed' | 'Lost' | 'Damaged';
  flightNumber: string;
  route: string;
  currentLocation: string;
  lastUpdate: Date;
  eta?: string;
  pirFiled: boolean;
  pirReference?: string;
  bagDescription?: string;
  incidentType?: 'Delayed' | 'Lost' | 'Damaged';
  createdAt: Date;
}

const BaggageSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tagNumber: { type: String, required: true, unique: true },
    status: { 
      type: String, 
      enum: ['In Transit', 'Collected', 'Needs Attention', 'Delayed', 'Lost', 'Damaged'],
      default: 'In Transit'
    },
    flightNumber: { type: String, required: true },
    route: { type: String, required: true },
    currentLocation: { type: String, required: true },
    lastUpdate: { type: Date, default: Date.now },
    eta: { type: String },
    pirFiled: { type: Boolean, default: false },
    pirReference: { type: String },
    bagDescription: { type: String },
    incidentType: { type: String, enum: ['Delayed', 'Lost', 'Damaged'] },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IBaggage>('Baggage', BaggageSchema);
