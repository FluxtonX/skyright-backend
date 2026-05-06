import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';

// @desc    Get employee duty-of-care status
// @route   GET /api/corporate/employees/status
export const getEmployeeRiskStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.role !== 'Corporate') {
      return res.status(403).json({ message: 'Only Corporate admins can access this' });
    }

    const employees = await User.find({ tenantId: req.user.tenantId });
    
    // Mock risk logic: Assigning risk based on dummy travel data
    const statusData = employees.map(emp => ({
      name: emp.displayName,
      email: emp.email,
      currentTrip: 'London (LHR)',
      riskLevel: Math.random() > 0.7 ? 'Medium' : 'Low',
      policyCompliant: true
    }));

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
