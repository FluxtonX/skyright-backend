import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Claim from '../models/claimModel';

// @desc    Submit a new claim
// @route   POST /api/claims
// @access  Private
export const submitClaim = async (req: AuthRequest, res: Response) => {
  try {
    const { flightCode, airline, disruptionType } = req.body;

    const claim = await Claim.create({
      user: req.user._id,
      flightCode,
      airline,
      disruptionType,
      status: 'PENDING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0.16,
    });

    res.status(201).json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user claims
// @route   GET /api/claims
// @access  Private
export const getUserClaims = async (req: AuthRequest, res: Response) => {
  try {
    const claims = await Claim.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(claims);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update claim status/step
// @route   PATCH /api/claims/:id
// @access  Private
export const updateClaim = async (req: AuthRequest, res: Response) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (claim) {
      if (claim.user.toString() !== req.user._id.toString()) {
        return res.status(401).json({ message: 'User not authorized' });
      }

      // State Machine Logic: Prevent downgrading from COMPLETED or REJECTED
      if (claim.status === 'COMPLETED' || claim.status === 'REJECTED') {
        return res.status(400).json({ message: `Cannot update a ${claim.status.toLowerCase()} claim` });
      }

      claim.currentStep = req.body.currentStep || claim.currentStep;
      claim.status = req.body.status || claim.status;
      claim.compensationAmount = req.body.compensationAmount || claim.compensationAmount;
      claim.resolutionType = req.body.resolutionType || claim.resolutionType;
      
      // Update progress automatically
      claim.progress = claim.currentStep / claim.totalSteps;

      const updatedClaim = await claim.save();
      res.json(updatedClaim);
    } else {
      res.status(404).json({ message: 'Claim not found' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
