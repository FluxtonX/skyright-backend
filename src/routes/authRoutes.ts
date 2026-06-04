import express from 'express';
import { body } from 'express-validator';
import {
  completeOnboarding,
  deleteCurrentAccount,
  deleteProfilePhoto,
  getOnboardingStatus,
  getProfileSettings,
  getProfileStats,
  getUserProfile,
  syncAuthenticatedUser,
  updateNotificationPreference,
  updateProfileSettings,
  updateUserProfile,
  updateUserRole,
  uploadProfilePhoto,
} from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware';
import { uploadProfilePhoto as uploadProfilePhotoMiddleware } from '../middlewares/uploadMiddleware';
import { validateRequest } from '../middlewares/validatorMiddleware';

const router = express.Router();

router.post('/sync', protect, syncAuthenticatedUser);
router.get('/onboarding', protect, getOnboardingStatus);
router.patch(
  '/onboarding',
  protect,
  [
    body('role')
      .optional()
      .isIn(['Traveler', 'User', 'Travel Agency', 'Corporate Travel Desk', 'Corporate'])
      .withMessage('Invalid role'),
    body('notificationsEnabled')
      .optional()
      .isBoolean()
      .withMessage('notificationsEnabled must be a boolean'),
    body('displayName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 80 })
      .withMessage('Display name must be 1-80 characters'),
  ],
  validateRequest,
  completeOnboarding
);

router.route('/profile')
  .get(protect, getUserProfile)
  .put(
    protect,
    [
      body('displayName')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1, max: 80 })
        .withMessage('Display name must be 1-80 characters'),
      body('phoneNumber')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 30 })
        .withMessage('Phone number must be 30 characters or fewer'),
      body('photoURL')
        .optional()
        .isURL()
        .withMessage('Photo URL must be a valid URL'),
    ],
    validateRequest,
    updateUserProfile
  );

router.get('/profile/stats', protect, getProfileStats);
router.get('/profile/settings', protect, getProfileSettings);
router.patch('/profile/settings', protect, updateProfileSettings);

router.patch(
  '/profile/role',
  protect,
  [
    body('role')
      .isIn(['Traveler', 'User', 'Travel Agency', 'Corporate Travel Desk', 'Corporate'])
      .withMessage('Invalid role'),
  ],
  validateRequest,
  updateUserRole
);

router.patch(
  '/profile/notifications',
  protect,
  [
    body('notificationsEnabled')
      .isBoolean()
      .withMessage('notificationsEnabled must be a boolean'),
  ],
  validateRequest,
  updateNotificationPreference
);

router.post('/profile/photo', protect, uploadProfilePhotoMiddleware, uploadProfilePhoto);
router.delete('/profile/photo', protect, deleteProfilePhoto);
router.delete('/account', protect, deleteCurrentAccount);

export default router;
