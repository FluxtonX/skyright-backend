import express from 'express';
import { registerFlight, getMonitoredFlights } from '../controllers/guardController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/')
  .post(protect, registerFlight)
  .get(protect, getMonitoredFlights);

export default router;
