import express from 'express';
import { 
  getCompliance, 
  getBaggage, 
  getWeather 
} from '../controllers/plusController';
import { 
  trackBaggage, 
  getBaggageList, 
  filePIR, 
  getBaggageAnalytics 
} from '../controllers/baggageController';
import { checkCompliance } from '../controllers/complianceController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';

const router = express.Router();

// Legacy / Support Routes
router.get('/compliance', protect, getCompliance);
router.get('/baggage/:tag', protect, getBaggage);
router.get('/weather/:airport', protect, getWeather);

// Elite Baggage Routes
router.post('/baggage/track', protect, checkPlanAccess('Plus'), trackBaggage);
router.get('/baggage/list', protect, checkPlanAccess('Plus'), getBaggageList);
router.get('/baggage/analytics', protect, checkPlanAccess('Plus'), getBaggageAnalytics);
router.put('/baggage/:id/pir', protect, checkPlanAccess('Plus'), filePIR);

// Elite Compliance Routes
router.get('/compliance/check', protect, checkPlanAccess('Plus'), checkCompliance);

export default router;
