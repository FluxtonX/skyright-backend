import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';
import Document from '../models/documentModel';
import SearchHistory from '../models/searchHistoryModel';
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
    await SearchHistory.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      query: searchQuery,
    });

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

// @desc    Search suggestions for dashboard search bar
// @route   GET /api/search/suggestions
export const getSearchSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const query = String(req.query.query || '').trim();

    if (!query) {
      return res.json([]);
    }

    const [claims, documents] = await Promise.all([
      Claim.find({
        user: req.user._id,
        $or: [
          { flightCode: { $regex: query, $options: 'i' } },
          { airline: { $regex: query, $options: 'i' } },
          { disruptionType: { $regex: query, $options: 'i' } },
        ],
      }).limit(5),
      Document.find({
        user: req.user._id,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { type: { $regex: query, $options: 'i' } },
        ],
      }).limit(5),
    ]);

    const suggestions = [
      ...claims.map((claim: any) => ({
        type: 'claim',
        id: claim._id,
        label: claim.flightCode || claim.airline || 'Claim',
        subtitle: claim.disruptionType || claim.status || '',
      })),
      ...documents.map((document: any) => ({
        type: 'document',
        id: document._id,
        label: document.name || 'Document',
        subtitle: document.type || '',
      })),
    ];

    if (/^[A-Z0-9]{2,}\s?\d{2,}$/i.test(query)) {
      suggestions.unshift({
        type: 'flight',
        id: query.toUpperCase(),
        label: query.toUpperCase(),
        subtitle: 'Search flight status',
      });
    }

    res.json(suggestions.slice(0, 10));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Recent searches for current user
// @route   GET /api/search/recent
export const getRecentSearches = async (req: AuthRequest, res: Response) => {
  try {
    const searches = await SearchHistory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json(searches);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear recent searches for current user
// @route   DELETE /api/search/recent
export const clearRecentSearches = async (req: AuthRequest, res: Response) => {
  try {
    const result = await SearchHistory.deleteMany({ user: req.user._id });
    res.json({ message: 'Recent searches cleared', deletedCount: result.deletedCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
