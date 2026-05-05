import express from 'express';
import { startSubscription, verifySubscription, handleWebhook, startStripeSubscription } from '../controllers/paymentController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/subscribe', protect, startSubscription);
router.post('/stripe/subscribe', protect, startStripeSubscription);
router.post('/verify', protect, verifySubscription);
router.post('/webhook', handleWebhook); // Public for Paystack

export default router;
