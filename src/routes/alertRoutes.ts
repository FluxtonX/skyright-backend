import express from 'express';
import {
  deleteAlert,
  getAlertPreferences,
  generateTestAlerts,
  getUserAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  updateAlertPreferences,
  watchFlightForAlerts,
} from '../controllers/alertController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', protect, getUserAlerts);
router.get('/preferences', protect, getAlertPreferences);
router.patch('/preferences', protect, updateAlertPreferences);
router.post('/watch-flight', protect, watchFlightForAlerts);
router.post('/generate-test', protect, generateTestAlerts);
router.patch('/read-all', protect, markAllAlertsAsRead);
router.patch('/:id/read', protect, markAlertAsRead);
router.delete('/:id', protect, deleteAlert);

export default router;
