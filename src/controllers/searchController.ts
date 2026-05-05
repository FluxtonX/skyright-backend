import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';
import { getFlightStatus } from '../services/flightService';

// @desc    Global search for flights and cases
// @route   GET /api/search
// @access  Private
export const globalSearch = async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchQuery = query as string;

    // 1. Search in user's claims
    const claims = await Claim.find({
      user: req.user._id,
      $or: [
        { flightCode: { $regex: searchQuery, $options: 'i' } },
        { airline: { $regex: searchQuery, $options: 'i' } },
        { disruptionType: { $regex: searchQuery, $options: 'i' } }
      ]
    });

    // 2. Try to fetch as a flight if it looks like a flight code
    let flight = null;
    if (searchQuery.length >= 3) {
      flight = await getFlightStatus(searchQuery).catch(() => null);
    }

    res.json({
      results: {
        claims,
        flight: flight ? [flight] : [],
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
