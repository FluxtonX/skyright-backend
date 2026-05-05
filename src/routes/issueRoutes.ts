import express from 'express';
import { getFlightDisruptions, getNearbyFlights } from '../controllers/issueController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/map', protect, getNearbyFlights);
router.get('/flight/:iata', protect, getFlightDisruptions);

export default router;
