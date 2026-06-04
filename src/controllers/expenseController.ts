import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Expense from '../models/expenseModel';
import { processDocumentOCR } from '../services/ocrService';
import { uploadBufferToFirebaseStorage } from '../services/storageService';

// @desc    Log a new expense
// @route   POST /api/expenses
export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { category, vendor, amount, currency, date, receiptUrl, tags, status } = req.body;
    
    const expense = await Expense.create({
      user: req.user._id,
      userId: req.user.firebaseId,
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

// @desc    Upload receipt for an expense
// @route   POST /api/expenses/:id/receipt
export const uploadExpenseReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required. Use multipart field "file".' });
    }

    const storedFile = await uploadBufferToFirebaseStorage(
      req.file,
      `expense-receipts/${expense._id}`,
      req.user.firebaseId
    );

    const ocrData = await processDocumentOCR(storedFile.url, 'Receipt');

    expense.receiptUrl = storedFile.url;
    expense.receiptStoragePath = storedFile.path;
    expense.receiptOcrData = ocrData;
    await expense.save();

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

// @desc    Get one expense
// @route   GET /api/expenses/:id
export const getExpenseDetails = async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(expense);
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

// @desc    Get expense report summary
// @route   GET /api/expenses/report
export const getExpenseReport = async (req: AuthRequest, res: Response) => {
  try {
    const expenses = await Expense.find({ user: req.user._id });
    const byCategory = expenses.reduce((acc: Record<string, number>, expense: any) => {
      const category = expense.category || 'Other';
      acc[category] = (acc[category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    const total = expenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);

    res.json({
      total,
      count: expenses.length,
      byCategory,
      currency: expenses[0]?.currency || 'NGN',
      generatedAt: new Date().toISOString(),
      expenses,
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

    if (expense.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    expense.status = status || expense.status;
    expense.flagReason = flagReason || expense.flagReason;

    await expense.save();
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense fields
// @route   PATCH /api/expenses/:id
export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const fields = ['category', 'vendor', 'amount', 'currency', 'date', 'receiptUrl', 'tags', 'status', 'flagReason'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    });

    await expense.save();
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
export const deleteExpense = async (req: AuthRequest, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await expense.deleteOne();
    res.json({ message: 'Expense removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
