import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  user: mongoose.Types.ObjectId;
  category: string;
  vendor: string;
  amount: number;
  currency: string;
  date: Date;
  receiptUrl?: string;
  tags: string[];
  status: 'Draft' | 'Submitted' | 'Approved' | 'Flagged';
  flagReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    vendor: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },
    date: { type: Date, default: Date.now },
    receiptUrl: { type: String },
    tags: [{ type: String }],
    status: { 
      type: String, 
      enum: ['Draft', 'Submitted', 'Approved', 'Flagged'], 
      default: 'Draft' 
    },
    flagReason: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
