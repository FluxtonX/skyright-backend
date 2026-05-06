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
    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
