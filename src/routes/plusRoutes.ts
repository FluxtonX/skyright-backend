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
  getBaggageAnalytics,
  getBaggageDetails,
  updateBaggage,
  deleteBaggage,
  uploadBaggagePhoto,
  deleteBaggagePhoto,
} from '../controllers/baggageController';
import {
  checkCompliance,
  getComplianceChecklist,
  saveComplianceChecklist,
} from '../controllers/complianceController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';
import { uploadSingleFile } from '../middlewares/uploadMiddleware';

const router = express.Router();

// Legacy / Support Routes
router.get('/compliance', protect, getCompliance);
router.get('/baggage/:tag', protect, getBaggage);
router.get('/weather/:airport', protect, getWeather);

// Elite Baggage Routes
router.post('/baggage/track', protect, checkPlanAccess('Plus'), trackBaggage);
router.get('/baggage/list', protect, checkPlanAccess('Plus'), getBaggageList);
router.get('/baggage/analytics', protect, checkPlanAccess('Plus'), getBaggageAnalytics);
router.get('/baggage/item/:id', protect, checkPlanAccess('Plus'), getBaggageDetails);
router.patch('/baggage/item/:id', protect, checkPlanAccess('Plus'), updateBaggage);
router.delete('/baggage/item/:id', protect, checkPlanAccess('Plus'), deleteBaggage);
router.post('/baggage/item/:id/photos', protect, checkPlanAccess('Plus'), uploadSingleFile('file'), uploadBaggagePhoto);
router.delete('/baggage/item/:id/photos/:photoId', protect, checkPlanAccess('Plus'), deleteBaggagePhoto);
router.put('/baggage/:id/pir', protect, checkPlanAccess('Plus'), filePIR);

// Elite Compliance Routes
router.get('/compliance/check', protect, checkPlanAccess('Plus'), checkCompliance);
router.get('/compliance/checklist', protect, checkPlanAccess('Plus'), getComplianceChecklist);
router.put('/compliance/checklist', protect, checkPlanAccess('Plus'), saveComplianceChecklist);

export default router;
