import express from 'express';
import {
  createTrip,
  deleteTrip,
  enableTripLiveTracking,
  getTripDetails,
  getTripInsights,
  getTripLiveStatus,
  getUserTrips,
  lookupFlightForTrip,
  shareTrip,
  updateTrip,
} from '../controllers/tripController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, createTrip)
  .get(protect, getUserTrips);

router.post('/flight-lookup', protect, lookupFlightForTrip);
router.post('/:id/share', protect, shareTrip);
router.get('/:id/insights', protect, getTripInsights);
router.get('/:id/live-status', protect, getTripLiveStatus);
router.post('/:id/track-live', protect, enableTripLiveTracking);
router.get('/:id', protect, getTripDetails);
router.patch('/:id', protect, updateTrip);
router.delete('/:id', protect, deleteTrip);

export default router;
