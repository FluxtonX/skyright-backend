import express from 'express';
import { getUserAlerts, markAlertAsRead } from '../controllers/alertController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', protect, getUserAlerts);
router.patch('/:id/read', protect, markAlertAsRead);

export default router;
