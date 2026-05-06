import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  type: 'Agency' | 'Corporate';
  admin: mongoose.Types.ObjectId;
  subscriptionPlan: 'Agency Pro' | 'Agency Concierge' | 'Enterprise';
  settings: {
    whiteLabel: boolean;
    customWorkflow: boolean;
    apiAccess: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Agency', 'Corporate'], required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionPlan: { 
      type: String, 
      enum: ['Agency Pro', 'Agency Concierge', 'Enterprise'], 
      required: true 
    },
    settings: {
      whiteLabel: { type: Boolean, default: false },
      customWorkflow: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITenant>('Tenant', TenantSchema);
