import express from 'express';
import {
  analyzeTicket,
  deleteGuard,
  getGuardDetails,
  getMonitoredFlights,
  registerFlight,
  startClaimFromGuard,
} from '../controllers/guardController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.post('/analyze', protect, analyzeTicket);

router.route('/')
  .post(protect, registerFlight)
  .get(protect, getMonitoredFlights);

router.post('/:id/start-claim', protect, startClaimFromGuard);
router.get('/:id', protect, getGuardDetails);
router.delete('/:id', protect, deleteGuard);

export default router;
