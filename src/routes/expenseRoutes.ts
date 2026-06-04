import express from 'express';
import { 
  createExpense, 
  deleteExpense,
  getExpenseDetails,
  getExpenses, 
  getExpenseMetrics, 
  getExpenseReport,
  updateExpense,
  updateExpenseStatus,
  uploadExpenseReceipt,
} from '../controllers/expenseController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';
import { uploadSingleFile } from '../middlewares/uploadMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, checkPlanAccess('Plus'), createExpense)
  .get(protect, checkPlanAccess('Plus'), getExpenses);

router.get('/metrics', protect, checkPlanAccess('Plus'), getExpenseMetrics);
router.get('/report', protect, checkPlanAccess('Plus'), getExpenseReport);

router.get('/:id', protect, checkPlanAccess('Plus'), getExpenseDetails);
router.patch('/:id', protect, checkPlanAccess('Plus'), updateExpense);
router.delete('/:id', protect, checkPlanAccess('Plus'), deleteExpense);
router.put('/:id/status', protect, updateExpenseStatus);
router.post('/:id/receipt', protect, checkPlanAccess('Plus'), uploadSingleFile('file'), uploadExpenseReceipt);

export default router;
