import express from 'express';
import {
  cancelSubscription,
  changeSubscriptionPlan,
  getCurrentSubscription,
  getPlans,
} from '../controllers/subscriptionController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/plans', protect, getPlans);
router.get('/subscription/current', protect, getCurrentSubscription);
router.post('/subscription/change-plan', protect, changeSubscriptionPlan);
router.post('/subscription/cancel', protect, cancelSubscription);

export default router;
