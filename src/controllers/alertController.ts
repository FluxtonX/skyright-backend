import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Alert from '../models/alertModel';
import Guard from '../models/guardModel';
import { updateUserProfileFields } from '../services/userProfileService';

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

// @desc    Get alert notification preferences
// @route   GET /api/alerts/preferences
// @access  Private
export const getAlertPreferences = async (req: AuthRequest, res: Response) => {
  res.json({
    flightDisruptions: true,
    claimUpdates: true,
    documentReminders: true,
    baggageUpdates: true,
    weatherWarnings: true,
    ...(req.user.alertPreferences || {}),
  });
};

// @desc    Update alert notification preferences
// @route   PATCH /api/alerts/preferences
// @access  Private
export const updateAlertPreferences = async (req: AuthRequest, res: Response) => {
  const updatedUser = await updateUserProfileFields(req.user.firebaseId, {
    alertPreferences: {
      ...(req.user.alertPreferences || {}),
      ...req.body,
    },
  });

  res.json(updatedUser?.alertPreferences || {});
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

// @desc    Register a flight watch and create initial alert item
// @route   POST /api/alerts/watch-flight
// @access  Private
export const watchFlightForAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const { flightCode, airline, departureDate, origin, destination } = req.body;

    if (!flightCode) {
      return res.status(400).json({ message: 'flightCode is required' });
    }

    const guard = await Guard.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      flightCode,
      airline,
      departureDate,
      origin,
      destination,
      status: 'Monitoring',
    });

    const alert = await Alert.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      flightCode,
      airline,
      priority: 'INFO',
      eventType: 'Monitoring Started',
      message: `Monitoring started for ${flightCode}`,
      isRead: false,
      source: 'watch-flight',
      guardId: guard._id,
    });

    res.status(201).json({ guard, alert });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create test alerts for Flutter/dev QA
// @route   POST /api/alerts/generate-test
// @access  Private
export const generateTestAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const seedAlerts = [
      {
        flightCode: 'W3 205',
        airline: 'Air Peace',
        priority: 'CRITICAL',
        eventType: 'Flight Cancelled',
        message: 'Your flight W3 205 has been cancelled.',
      },
      {
        flightCode: 'AA 301',
        airline: 'Arik Air',
        priority: 'HIGH',
        eventType: '4 Hour Delay',
        message: 'Your flight AA 301 is delayed by 4 hours.',
      },
      {
        flightCode: 'EK 783',
        airline: 'Emirates',
        priority: 'INFO',
        eventType: 'Gate Change',
        message: 'Gate changed from D12 to D18.',
      },
    ];

    const alerts = [];
    for (const item of seedAlerts) {
      alerts.push(await Alert.create({
        user: req.user._id,
        userId: req.user.firebaseId,
        ...item,
        isRead: false,
        source: 'test',
      }));
    }

    res.status(201).json(alerts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete/clear a single alert
// @route   DELETE /api/alerts/:id
// @access  Private
export const deleteAlert = async (req: AuthRequest, res: Response) => {
  try {
    const alert = await Alert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await alert.deleteOne();
    res.json({ message: 'Alert removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all alerts as read
// @route   PATCH /api/alerts/read-all
// @access  Private
export const markAllAlertsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await Alert.find({ user: req.user._id });

    for (const alert of alerts) {
      alert.isRead = true;
      await alert.save();
    }

    res.json({ message: 'All alerts marked as read', updatedCount: alerts.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
