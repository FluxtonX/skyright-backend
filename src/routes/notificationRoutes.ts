import express from 'express';
import {
  getDeviceTokens,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../controllers/notificationController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.route('/devices')
  .get(protect, getDeviceTokens)
  .post(protect, registerDeviceToken)
  .delete(protect, unregisterDeviceToken);

export default router;
