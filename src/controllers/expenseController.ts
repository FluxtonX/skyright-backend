import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Expense from '../models/expenseModel';

// @desc    Log a new expense
// @route   POST /api/expenses
export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { category, vendor, amount, currency, date, receiptUrl, tags, status } = req.body;
    
    const expense = await Expense.create({
      user: req.user._id,
      category,
      vendor,
      amount,
      currency,
      date,
      receiptUrl,
      tags,
      status
    });

    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user expenses with filters
// @route   GET /api/expenses
export const getExpenses = async (req: AuthRequest, res: Response) => {
  try {
    const { status, category } = req.query;
    const query: any = { user: req.user._id };
    
    if (status && status !== 'All') {
      query.status = status;
    }
    if (category) {
      query.category = category;
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get expense metrics for dashboard
// @route   GET /api/expenses/metrics
export const getExpenseMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const expenses = await Expense.find({ user: req.user._id });

    const totalSubmitted = expenses
      .filter(e => e.status !== 'Draft')
      .reduce((sum, e) => sum + e.amount, 0);

    const approved = expenses
      .filter(e => e.status === 'Approved')
      .reduce((sum, e) => sum + e.amount, 0);

    const flaggedCount = expenses.filter(e => e.status === 'Flagged').length;
    
    // Compliant is a mockup percentage for now
    const complianceRate = expenses.length > 0 
      ? Math.round(((expenses.length - flaggedCount) / expenses.length) * 100) 
      : 100;

    res.json({
      totalSubmitted,
      approved,
      flaggedCount,
      complianceRate
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense status
// @route   PUT /api/expenses/:id/status
export const updateExpenseStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status, flagReason } = req.body;
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    expense.status = status || expense.status;
    expense.flagReason = flagReason || expense.flagReason;

    await expense.save();
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
