import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firebaseId: string;
  email: string;
  phoneNumber?: string;
  displayName?: string;
  photoURL?: string;
  role: 'User' | 'Travel Agency' | 'Corporate' | 'Admin';
  plan: 'Free' | 'Plus' | 'Concierge Pass';
  tenantId?: mongoose.Types.ObjectId;
  managedByTenant: boolean;
  notificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    firebaseId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String },
    displayName: { type: String },
    photoURL: { type: String },
    role: { type: String, enum: ['User', 'Travel Agency', 'Corporate', 'Admin'], default: 'User' },
    plan: { type: String, enum: ['Free', 'Plus', 'Concierge Pass'], default: 'Free' },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
    managedByTenant: { type: Boolean, default: false },
    notificationsEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);
