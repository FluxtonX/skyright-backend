import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Trip from '../models/tripModel';

// @desc    Create a new trip journey
// @route   POST /api/trips
export const createTrip = async (req: AuthRequest, res: Response) => {
  try {
    const { tripName, origin, destination, totalDuration, stops, timeline } = req.body;

    // Risk Engine Logic: Automatically calculate risk based on layover duration
    const processedTimeline = timeline.map((leg: any) => {
      if (!leg.isFlight && leg.duration) {
        const minutes = parseInt(leg.duration);
        if (minutes < 60) {
          leg.riskLevel = 'Medium';
          leg.riskColor = '#FFC229';
          leg.info = 'Tight connection - monitor for delays';
        } else if (minutes < 45) {
          leg.riskLevel = 'High';
          leg.riskColor = '#EF4444';
          leg.info = 'High risk of missing connection';
        }
      }
      return leg;
    });

    const trip = await Trip.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      tripName,
      origin,
      destination,
      totalDuration,
      stops,
      timeline: processedTimeline
    });

    res.status(201).json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all user trips
// @route   GET /api/trips
export const getUserTrips = async (req: AuthRequest, res: Response) => {
  try {
    const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(trips);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single trip with live risk analysis
// @route   GET /api/trips/:id
export const getTripDetails = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }
    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get route/risk insight summary for Trip Visualizer
// @route   GET /api/trips/:id/insights
export const getTripInsights = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const timeline = trip.timeline || [];
    const highRiskSegments = timeline.filter((item: any) => item.riskLevel === 'High');
    const mediumRiskSegments = timeline.filter((item: any) => item.riskLevel === 'Medium');

    res.json({
      tripId: trip._id,
      overallRisk: highRiskSegments.length ? 'High' : mediumRiskSegments.length ? 'Medium' : 'Low',
      highRiskSegments: highRiskSegments.length,
      mediumRiskSegments: mediumRiskSegments.length,
      recommendations: [
        ...(highRiskSegments.length ? ['Review tight or high-risk connections before departure.'] : []),
        ...(mediumRiskSegments.length ? ['Monitor medium-risk segments for gate and timing updates.'] : []),
        'Keep travel documents and claim evidence in the Vault.',
      ],
      legend: [
        { key: 'Low', color: '#10B981', description: 'No immediate action needed' },
        { key: 'Medium', color: '#FFC229', description: 'Monitor closely' },
        { key: 'High', color: '#EF4444', description: 'Action recommended' },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current live tracking state for a trip
// @route   GET /api/trips/:id/live-status
export const getTripLiveStatus = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json({
      tripId: trip._id,
      trackingEnabled: trip.trackingEnabled === true,
      status: trip.status || 'planned',
      lastCheckedAt: trip.lastTrackedAt || null,
      nextCheckAt: trip.trackingEnabled ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      providerStatus: 'pending-third-party-flight-api',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Enable or update live trip tracking
// @route   POST /api/trips/:id/track-live
export const enableTripLiveTracking = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    trip.trackingEnabled = req.body.enabled !== false;
    trip.lastTrackedAt = new Date().toISOString();
    await trip.save();

    res.json({
      tripId: trip._id,
      trackingEnabled: trip.trackingEnabled,
      lastCheckedAt: trip.lastTrackedAt,
      providerStatus: 'pending-third-party-flight-api',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update trip
// @route   PATCH /api/trips/:id
export const updateTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const fields = ['tripName', 'origin', 'destination', 'totalDuration', 'stops', 'timeline', 'status'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        trip[field] = req.body[field];
      }
    });

    await trip.save();
    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete trip
// @route   DELETE /api/trips/:id
export const deleteTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await trip.deleteOne();
    res.json({ message: 'Trip removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate or return a share token/link for a trip
// @route   POST /api/trips/:id/share
export const shareTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!trip.shareToken) {
      trip.shareToken = Math.random().toString(36).slice(2, 14);
      trip.isShared = true;
      await trip.save();
    }

    res.json({
      tripId: trip._id,
      shareToken: trip.shareToken,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips/share/${trip.shareToken}`,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
