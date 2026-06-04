import express from 'express';
import {
  createTrip,
  deleteTrip,
  enableTripLiveTracking,
  getTripDetails,
  getTripInsights,
  getTripLiveStatus,
  getUserTrips,
  shareTrip,
  updateTrip,
} from '../controllers/tripController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, checkPlanAccess('Plus'), createTrip)
  .get(protect, checkPlanAccess('Plus'), getUserTrips);

router.post('/:id/share', protect, checkPlanAccess('Plus'), shareTrip);
router.get('/:id/insights', protect, checkPlanAccess('Plus'), getTripInsights);
router.get('/:id/live-status', protect, checkPlanAccess('Plus'), getTripLiveStatus);
router.post('/:id/track-live', protect, checkPlanAccess('Plus'), enableTripLiveTracking);
router.get('/:id', protect, checkPlanAccess('Plus'), getTripDetails);
router.patch('/:id', protect, checkPlanAccess('Plus'), updateTrip);
router.delete('/:id', protect, checkPlanAccess('Plus'), deleteTrip);

export default router;
