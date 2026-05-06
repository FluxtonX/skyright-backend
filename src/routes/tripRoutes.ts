import express from 'express';
import { createTrip, getUserTrips, getTripDetails } from '../controllers/tripController';
import { protect } from '../middlewares/authMiddleware';
import { checkPlanAccess } from '../middlewares/subscriptionMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, checkPlanAccess('Plus'), createTrip)
  .get(protect, checkPlanAccess('Plus'), getUserTrips);

router.get('/:id', protect, checkPlanAccess('Plus'), getTripDetails);

export default router;
