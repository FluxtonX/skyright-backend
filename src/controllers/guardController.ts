import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Guard from '../models/guardModel';

// @desc    Register a flight for monitoring
// @route   POST /api/guard
export const registerFlight = async (req: AuthRequest, res: Response) => {
  try {
    const { flightCode, departureDate, origin, destination } = req.body;

    // Production Check: Prevent duplicate monitoring for the same flight on the same day
    const existingGuard = await Guard.findOne({
      user: req.user._id,
      flightCode,
      departureDate: new Date(departureDate),
    });

    if (existingGuard) {
      return res.status(400).json({ message: 'You are already monitoring this flight' });
    }

    const guard = await Guard.create({
      user: req.user._id,
      flightCode,
      departureDate,
      origin,
      destination,
    });

    res.status(201).json(guard);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all monitored flights
// @route   GET /api/guard
export const getMonitoredFlights = async (req: AuthRequest, res: Response) => {
  try {
    const guards = await Guard.find({ user: req.user._id }).sort({ departureDate: 1 });
    res.json(guards);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
