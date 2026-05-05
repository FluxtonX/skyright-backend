import express from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { body } from 'express-validator';
import { validateRequest } from '../middlewares/validatorMiddleware';

const router = express.Router();

router.route('/profile')
  .get(protect, getUserProfile)
  .put(
    protect, 
    [
      body('displayName').optional().isString().withMessage('Name must be a string'),
      body('role').optional().isIn(['User', 'Travel Agency', 'Admin']).withMessage('Invalid role'),
      body('notificationsEnabled').optional().isBoolean().withMessage('Must be boolean')
    ],
    validateRequest,
    updateUserProfile
  );

export default router;
