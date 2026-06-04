import express from 'express';
import {
  getDashboardActivity,
  getDashboardModules,
  getDashboardSummary,
} from '../controllers/dashboardController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/summary', protect, getDashboardSummary);
router.get('/activity', protect, getDashboardActivity);
router.get('/modules', protect, getDashboardModules);

export default router;
