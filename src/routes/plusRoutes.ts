import express from 'express';
import { getCompliance, getBaggage, getWeather } from '../controllers/plusController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/compliance', protect, getCompliance);
router.get('/baggage/:tag', protect, getBaggage);
router.get('/weather/:airport', protect, getWeather);

export default router;
