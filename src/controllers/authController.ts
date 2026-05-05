import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.displayName = req.body.displayName || user.displayName;
    user.photoURL = req.body.photoURL || user.photoURL;
    user.notificationsEnabled = req.body.notificationsEnabled !== undefined ? req.body.notificationsEnabled : user.notificationsEnabled;
    user.role = req.body.role || user.role;

    const updatedUser = await user.save();
    res.json(updatedUser);
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};
