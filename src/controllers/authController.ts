import { Response } from 'express';
import admin from '../config/firebase';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  deleteOwnedUserData,
  deleteUserProfile,
  updateUserProfileFields,
  UserProfile,
  UserRole,
} from '../services/userProfileService';
import {
  deleteFirebaseStorageFile,
  uploadBufferToFirebaseStorage,
} from '../services/storageService';
import Claim from '../models/claimModel';
import Document from '../models/documentModel';
import Trip from '../models/tripModel';

const toProfileResponse = (user: UserProfile) => ({
  id: user.id,
  firebaseId: user.firebaseId,
  email: user.email,
  phoneNumber: user.phoneNumber || '',
  displayName: user.displayName || '',
  photoURL: user.photoURL || '',
  role: user.role,
  plan: user.plan,
  tenantId: user.tenantId || null,
  managedByTenant: user.managedByTenant,
  notificationsEnabled: user.notificationsEnabled,
  onboardingCompleted: user.onboardingCompleted === true,
  settings: user.settings || {},
  alertPreferences: user.alertPreferences || {},
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const roleMap: Record<string, UserRole> = {
  Traveler: 'User',
  User: 'User',
  'Travel Agency': 'Travel Agency',
  'Corporate Travel Desk': 'Corporate',
  Corporate: 'Corporate',
};

const requireUser = (req: AuthRequest, res: Response): UserProfile | null => {
  if (!req.user) {
    res.status(401).json({ message: 'Not authorized' });
    return null;
  }

  return req.user;
};

// @desc    Sync Firebase-authenticated user with Firestore and return profile
// @route   POST /api/auth/sync
// @access  Private
export const syncAuthenticatedUser = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  res.json(toProfileResponse(user));
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  res.json(toProfileResponse(user));
};

// @desc    Update editable profile fields
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { displayName, phoneNumber, photoURL } = req.body;
  const updates: Partial<UserProfile> = {};

  if (displayName !== undefined) {
    updates.displayName = displayName.trim();
  }

  if (phoneNumber !== undefined) {
    updates.phoneNumber = phoneNumber.trim();
  }

  if (photoURL !== undefined) {
    updates.photoURL = photoURL.trim();
  }

  if (req.body.plan !== undefined) {
    updates.plan = req.body.plan.trim();
  }

  const updatedUser = await updateUserProfileFields(user.firebaseId, updates);

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Select or update app role during onboarding/profile setup
// @route   PATCH /api/auth/profile/role
// @access  Private
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const mappedRole = roleMap[req.body.role];

  if (!mappedRole) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const updatedUser = await updateUserProfileFields(user.firebaseId, { role: mappedRole });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Toggle push notification preference
// @route   PATCH /api/auth/profile/notifications
// @access  Private
export const updateNotificationPreference = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const updatedUser = await updateUserProfileFields(user.firebaseId, {
    notificationsEnabled: req.body.notificationsEnabled,
  });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Update FCM Device Token
// @route   POST /api/auth/fcm-token
// @access  Private
export const updateFcmToken = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { fcmToken } = req.body;

  if (!fcmToken || typeof fcmToken !== 'string') {
    return res.status(400).json({ message: 'Valid FCM token is required' });
  }

  const updatedUser = await updateUserProfileFields(user.firebaseId, { fcmToken: fcmToken.trim() });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({ message: 'FCM token updated successfully', fcmToken: updatedUser.fcmToken });
};

// @desc    Complete onboarding with role and initial preferences
// @route   PATCH /api/auth/onboarding
// @access  Private
export const completeOnboarding = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const updates: Partial<UserProfile> & Record<string, any> = {
    onboardingCompleted: true,
    onboardingCompletedAt: new Date().toISOString(),
  };

  if (req.body.role) {
    const mappedRole = roleMap[req.body.role];
    if (!mappedRole) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    updates.role = mappedRole;
  }

  if (req.body.notificationsEnabled !== undefined) {
    updates.notificationsEnabled = req.body.notificationsEnabled;
  }

  if (req.body.displayName !== undefined) {
    updates.displayName = req.body.displayName.trim();
  }

  const updatedUser = await updateUserProfileFields(user.firebaseId, updates);

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Get onboarding completion state for splash/onboarding flow
// @route   GET /api/auth/onboarding
// @access  Private
export const getOnboardingStatus = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  res.json({
    onboardingCompleted: user.onboardingCompleted === true,
    role: user.role,
    displayName: user.displayName || '',
    notificationsEnabled: user.notificationsEnabled,
  });
};

// @desc    Get profile/settings screen preferences
// @route   GET /api/auth/profile/settings
// @access  Private
export const getProfileSettings = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  res.json({
    notificationsEnabled: user.notificationsEnabled,
    settings: {
      language: 'en',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      marketingEmails: false,
      ...user.settings,
    },
    alertPreferences: {
      flightDisruptions: true,
      claimUpdates: true,
      documentReminders: true,
      baggageUpdates: true,
      weatherWarnings: true,
      ...user.alertPreferences,
    },
  });
};

// @desc    Update profile/settings screen preferences
// @route   PATCH /api/auth/profile/settings
// @access  Private
export const updateProfileSettings = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const updates: Record<string, any> = {};

  if (req.body.notificationsEnabled !== undefined) {
    updates.notificationsEnabled = Boolean(req.body.notificationsEnabled);
  }

  if (req.body.settings && typeof req.body.settings === 'object') {
    updates.settings = {
      ...(user.settings || {}),
      ...req.body.settings,
    };
  }

  if (req.body.alertPreferences && typeof req.body.alertPreferences === 'object') {
    updates.alertPreferences = {
      ...(user.alertPreferences || {}),
      ...req.body.alertPreferences,
    };
  }

  const updatedUser = await updateUserProfileFields(user.firebaseId, updates);

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Get profile statistics for profile screen
// @route   GET /api/auth/profile/stats
// @access  Private
export const getProfileStats = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const [claims, documents, trips] = await Promise.all([
    Claim.find({ user: user._id }),
    Document.find({ user: user._id }),
    Trip.find({ user: user._id }),
  ]);
  const usage = user.settings?.monthlyUsage || {};
  const isPaidPlan = user.plan === 'Plus' || user.plan === 'Concierge Pass' || user.role === 'Admin';

  res.json({
    savedTrips: trips.length,
    caseVaultItems: documents.length,
    savedCases: claims.length,
    academyClasses: 0,
    conciergeActive: user.plan === 'Concierge Pass',
    flightsMonitored: usage.flightsMonitored ?? trips.length,
    flightsMonitoredMax: usage.flightsMonitoredMax ?? (isPaidPlan ? 999 : 2),
    claimsFiled: usage.claimsFiled ?? claims.length,
    claimsFiledMax: usage.claimsFiledMax ?? (isPaidPlan ? 999 : 1),
    aiComplaintLetters: usage.aiComplaintLetters ?? 0,
    aiComplaintLettersMax: usage.aiComplaintLettersMax ?? (isPaidPlan ? 999 : 1),
    aiAssistantQuestions: usage.aiAssistantQuestions ?? 0,
    aiAssistantQuestionsMax: usage.aiAssistantQuestionsMax ?? (isPaidPlan ? 999 : 5),
    documentUploads: usage.documentUploads ?? documents.length,
    documentUploadsMax: usage.documentUploadsMax ?? (isPaidPlan ? 999 : 5),
  });
};

// @desc    Upload profile photo to Firebase Storage
// @route   POST /api/auth/profile/photo
// @access  Private
export const uploadProfilePhoto = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  if (!req.file) {
    return res.status(400).json({ message: 'Profile photo is required. Use multipart field "photo".' });
  }

  const storedFile = await uploadBufferToFirebaseStorage(req.file, 'profile-photos', user.firebaseId);
  const updatedUser = await updateUserProfileFields(user.firebaseId, {
    photoURL: storedFile.url,
    photoStoragePath: storedFile.path,
  });

  await deleteFirebaseStorageFile(user.photoStoragePath);

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.status(201).json(toProfileResponse(updatedUser));
};

// @desc    Remove profile photo from Firebase Storage and user profile
// @route   DELETE /api/auth/profile/photo
// @access  Private
export const deleteProfilePhoto = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  await deleteFirebaseStorageFile(user.photoStoragePath);
  const updatedUser = await updateUserProfileFields(user.firebaseId, {
    photoURL: '',
    photoStoragePath: '',
  });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(toProfileResponse(updatedUser));
};

// @desc    Delete current Firebase account and owned Firestore/Storage data
// @route   DELETE /api/auth/account
// @access  Private
export const deleteCurrentAccount = async (req: AuthRequest, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  await deleteOwnedUserData(user.firebaseId);
  await deleteFirebaseStorageFile(user.photoStoragePath);
  await deleteUserProfile(user.firebaseId);

  try {
    await admin.auth().deleteUser(user.firebaseId);
  } catch (error: any) {
    if (error?.code !== 'auth/user-not-found') {
      throw error;
    }
  }

  res.json({ message: 'Account deleted successfully' });
};
