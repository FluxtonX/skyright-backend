import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Alert from '../models/alertModel';

// @desc    Get user alerts
// @route   GET /api/alerts
// @access  Private
export const getUserAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const alerts = await Alert.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Alert.countDocuments({ user: req.user._id });

    res.json({
      alerts,
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark alert as read
// @route   PATCH /api/alerts/:id/read
// @access  Private
export const markAlertAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (alert) {
      if (alert.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      alert.isRead = true;
      const updatedAlert = await alert.save();
      res.json(updatedAlert);
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
