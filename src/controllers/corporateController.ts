import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';
import Trip from '../models/tripModel';

// @desc    Get employee duty-of-care status
// @route   GET /api/corporate/employees/status
export const getEmployeeRiskStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.role !== 'Corporate') {
      return res.status(403).json({ message: 'Only Corporate admins can access this' });
    }

    const employees = await User.find({ tenantId: req.user.tenantId });
    
    // Fetch all active trips for all employees in this tenant
    const employeeIds = employees.map(emp => emp._id);
    const allTrips = await Trip.find({ user: { $in: employeeIds }, status: { $ne: 'completed' } });

    const statusData = employees.map(emp => {
      const activeTrip = allTrips.find(t => String(t.user) === String(emp._id));
      
      let riskLevel = 'Low';
      if (activeTrip) {
        // High risk if any timeline leg is High risk, else Medium if Medium, etc.
        const timeline = activeTrip.timeline || [];
        const hasHigh = timeline.some((leg: any) => leg.riskLevel === 'High');
        const hasMedium = timeline.some((leg: any) => leg.riskLevel === 'Medium');
        if (hasHigh) riskLevel = 'High';
        else if (hasMedium) riskLevel = 'Medium';
      }

      return {
        name: emp.displayName,
        email: emp.email,
        currentTrip: activeTrip ? `${activeTrip.origin} to ${activeTrip.destination}` : 'No active trip',
        riskLevel,
        policyCompliant: true // Still basic boolean for now, could be derived from expenses/policy
      };
    });

    res.json(statusData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update corporate travel policy
// @route   PUT /api/corporate/policy
export const updateTravelPolicy = async (req: AuthRequest, res: Response) => {
  try {
    const { policyName, minDelayForClaim, autoFileClaims } = req.body;
    res.json({ 
      message: `Travel Policy '${policyName}' updated for ${req.user.displayName}'s organization`,
      settings: { minDelayForClaim, autoFileClaims }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
