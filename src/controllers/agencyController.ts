import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import User from '../models/userModel';
import Claim from '../models/claimModel';
import ADM from '../models/admModel';

// @desc    Get all clients managed by the agency
// @route   GET /api/agency/clients
export const getAgencyClients = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.role !== 'Travel Agency') {
      return res.status(403).json({ message: 'Only Agencies can access this' });
    }

    const clients = await User.find({ 
      tenantId: req.user.tenantId, 
      managedByTenant: true 
    });
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all claims from agency clients
// @route   GET /api/agency/claims
export const getAgencyClientClaims = async (req: AuthRequest, res: Response) => {
  try {
    const clients = await User.find({ tenantId: req.user.tenantId }).select('_id');
    const clientIds = clients.map(c => c._id);

    const claims = await Claim.find({ user: { $in: clientIds } }).populate('user', 'displayName email');
    res.json(claims);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resolve ADM (Agency Debit Memo) issues
// @route   POST /api/agency/adm/resolve
export const resolveADM = async (req: AuthRequest, res: Response) => {
  try {
    const { admNumber, resolutionNotes } = req.body;
    
    const adm = await ADM.create({
      admNumber,
      resolutionNotes,
      status: 'In Progress',
      resolvedBy: req.user._id,
      tenantId: req.user.tenantId,
      dateInitiated: new Date().toISOString()
    });

    res.json({ 
      message: `ADM ${admNumber} resolution process initiated`,
      status: adm.status,
      adm
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
