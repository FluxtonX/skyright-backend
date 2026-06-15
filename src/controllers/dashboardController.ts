import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';
import Alert from '../models/alertModel';
import Expense from '../models/expenseModel';
import Trip from '../models/tripModel';

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

// @desc    Get recent cross-module activity for dashboard feed
// @route   GET /api/dashboard/activity
// @access  Private
export const getDashboardActivity = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const [alerts, claims, expenses, trips] = await Promise.all([
      Alert.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
      Claim.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
      Expense.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
      Trip.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
    ]);

    const isReadableTripValue = (value?: string) => {
      if (!value) return false;
      const normalized = String(value).trim().toLowerCase();
      return normalized !== 'unknown' && normalized !== '--';
    };

    const buildTripSubtitle = (item: any) => {
      const origin = isReadableTripValue(item.origin) ? item.origin.trim() : '';
      const destination = isReadableTripValue(item.destination) ? item.destination.trim() : '';
      const departureDate = isReadableTripValue(item.departureDate)
        ? item.departureDate.trim()
        : isReadableTripValue(item.totalDuration)
          ? item.totalDuration.trim()
          : '';

      const route = origin && destination ? `${origin} → ${destination}` : '';
      if (route && departureDate) return `${route} • ${departureDate}`;
      if (route) return route;
      if (departureDate) return departureDate;
      return 'Trip saved';
    };

    const activity = [
      ...alerts.map((item: any) => ({
        id: item._id,
        type: 'alert',
        title: item.eventType || item.title || 'Alert',
        subtitle: item.flightCode || item.message || '',
        createdAt: item.createdAt,
      })),
      ...claims.map((item: any) => ({
        id: item._id,
        type: 'claim',
        title: item.flightCode || 'Claim',
        subtitle: item.status || '',
        createdAt: item.createdAt,
      })),
      ...expenses.map((item: any) => ({
        id: item._id,
        type: 'expense',
        title: item.category || 'Expense',
        subtitle: item.vendor || '',
        createdAt: item.createdAt,
      })),
      ...trips.map((item: any) => ({
        id: item._id,
        type: 'trip',
        title: isReadableTripValue(item.flightNumber)
          ? item.flightNumber.trim()
          : isReadableTripValue(item.tripName)
            ? item.tripName.trim()
            : 'Trip added',
        subtitle: buildTripSubtitle(item),
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 15);

    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get module availability based on current plan
// @route   GET /api/dashboard/modules
// @access  Private
export const getDashboardModules = async (req: AuthRequest, res: Response) => {
  const plan = req.user.plan || 'Free';
  const hasPlus = plan === 'Plus' || plan === 'Concierge Pass' || req.user.role === 'Admin';

  res.json([
    { key: 'sentinel', name: 'Sentinel', available: true, requiredPlan: 'Free' },
    { key: 'ticketGuard', name: 'TicketGuard', available: true, requiredPlan: 'Free' },
    { key: 'borderReady', name: 'BorderReady', available: true, requiredPlan: 'Free' },
    { key: 'resolveFlow', name: 'ResolveFlow', available: true, requiredPlan: 'Free' },
    { key: 'vault', name: 'Document Vault', available: true, requiredPlan: 'Free' },
    { key: 'bagTrack', name: 'BagTrack', available: hasPlus, requiredPlan: 'Plus' },
    { key: 'tripVisualizer', name: 'Trip Visualizer', available: hasPlus, requiredPlan: 'Plus' },
    { key: 'expenseTracker', name: 'Expense Tracker', available: hasPlus, requiredPlan: 'Plus' },
    { key: 'claimSubmission', name: 'Claim Submission', available: hasPlus, requiredPlan: 'Plus' },
    { key: 'claimIntelligence', name: 'Claim Intelligence', available: hasPlus, requiredPlan: 'Plus' },
  ]);
};
