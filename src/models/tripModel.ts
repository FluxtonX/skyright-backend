import mongoose, { Schema, Document } from 'mongoose';

export interface ITripLeg extends Document {
  isFlight: boolean;
  title: string;
  subtitle?: string;
  route?: string;
  departureTime?: string;
  duration: string;
  arrivalTime?: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  riskColor: string;
  info: string;
  terminal?: string;
}

export interface ITrip extends Document {
  user: mongoose.Types.ObjectId;
  tripName: string;
  origin: string;
  destination: string;
  status: 'On Time' | 'Delayed' | 'Cancelled';
  totalDuration: string;
  stops: number;
  timeline: ITripLeg[];
  createdAt: Date;
  updatedAt: Date;
}

const TripLegSchema: Schema = new Schema({
  isFlight: { type: Boolean, required: true },
  title: { type: String, required: true },
  subtitle: { type: String },
  route: { type: String },
  departureTime: { type: String },
  duration: { type: String, required: true },
  arrivalTime: { type: String },
  riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  riskColor: { type: String },
  info: { type: String, required: true },
  terminal: { type: String },
});

const TripSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tripName: { type: String, required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    status: { type: String, default: 'On Time' },
    totalDuration: { type: String, required: true },
    stops: { type: Number, default: 0 },
    timeline: [TripLegSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITrip>('Trip', TripSchema);
