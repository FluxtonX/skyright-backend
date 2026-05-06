import express from 'express';
import { 
  createExpense, 
  getExpenses, 
  getExpenseMetrics, 
  updateExpenseStatus 
} from '../controllers/expenseController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, checkPlanAccess('Plus'), createExpense)
  .get(protect, checkPlanAccess('Plus'), getExpenses);

router.get('/metrics', protect, checkPlanAccess('Plus'), getExpenseMetrics);

router.put('/:id/status', protect, updateExpenseStatus);

export default router;
