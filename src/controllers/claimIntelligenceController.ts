import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';

// @desc    Get global claim intelligence metrics
// @route   GET /api/intelligence/global
export const getGlobalIntelligence = async (req: AuthRequest, res: Response) => {
  try {
    // In production, these would be calculated from the entire database
    // Mocking based on frontend requirements for now
    res.json({
      successRate: '92%',
      avgResolution: '11.4 days',
      totalRecovered: '₦2.4M',
      activeClaims: 24,
      overdueClaims: 3
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get performance intelligence for airlines
// @route   GET /api/intelligence/airlines
export const getAirlinePerformance = async (req: AuthRequest, res: Response) => {
  try {
    const performance = [
      { name: 'Air Peace', rating: 'Fair', response: '14.2 days', success: '55%', totalRecovered: '₦620K' },
      { name: 'Ibom Air', rating: 'Excellent', response: '8.5 days', success: '100%', totalRecovered: '₦240K' },
      { name: 'Emirates', rating: 'Excellent', response: '7.2 days', success: '100%', totalRecovered: '₦540K' },
      { name: 'British Airways', rating: 'Excellent', response: '9.5 days', success: '100%', totalRecovered: '₦500K' },
    ];
    res.json(performance);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get AI strategist recommendations
// @route   GET /api/intelligence/recommendations
export const getAIRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      primaryAdvice: 'Based on airline response patterns, we recommend following up on W3 205 within 48 hours.',
      context: 'Air Peace typically responds better to polite but firm second follow-ups.'
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
