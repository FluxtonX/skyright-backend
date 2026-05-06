import express from 'express';
import { trackBaggage, getBaggageList, filePIR, getBaggageAnalytics } from '../controllers/baggageController';
import { checkCompliance } from '../controllers/complianceController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Baggage Routes
router.post('/baggage', protect, trackBaggage);
router.get('/baggage', protect, getBaggageList);
router.get('/baggage/analytics', protect, getBaggageAnalytics);
router.put('/baggage/:id/pir', protect, filePIR);

// Compliance Routes
router.get('/compliance/check', protect, checkCompliance);

export default router;
