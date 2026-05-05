import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';
import Alert from '../models/alertModel';

// @desc    Get dashboard summary (counts and totals)
// @route   GET /api/dashboard/summary
// @access  Private
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;

    // Get count of active alerts (unread)
    const activeAlertsCount = await Alert.countDocuments({ user: userId, isRead: false });

    // Get count of active cases (Pending or In Progress)
    const activeCasesCount = await Claim.countDocuments({ 
      user: userId, 
      status: { $in: ['PENDING', 'IN PROGRESS'] } 
    });

    // Get total savings (completed compensation)
    const completedClaims = await Claim.find({ user: userId, status: 'COMPLETED' });
    
    // Simple calculation for savings (stripping ₦ and commas)
    let totalSaved = 0;
    completedClaims.forEach(claim => {
      const amount = parseInt(claim.compensationAmount.replace(/[^0-9]/g, '')) || 0;
      totalSaved += amount;
    });

    res.json({
      alertsCount: activeAlertsCount,
      casesCount: activeCasesCount,
      totalSavings: `₦${totalSaved.toLocaleString()}`,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
