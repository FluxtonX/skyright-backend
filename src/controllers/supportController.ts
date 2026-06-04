import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import SupportRequest from '../models/supportRequestModel';

const createRequest = async (req: AuthRequest, res: Response, type: string) => {
  const request = await SupportRequest.create({
    user: req.user._id,
    userId: req.user.firebaseId,
    type,
    status: 'OPEN',
    priority: req.body.priority || 'NORMAL',
    subject: req.body.subject || req.body.message || type,
    message: req.body.message || '',
    payload: req.body.payload || {},
    contactEmail: req.body.contactEmail || req.user.email,
    contactPhone: req.body.contactPhone || req.user.phoneNumber || '',
  });

  res.status(201).json(request);
};

// @desc    Create a generic support/contact request
// @route   POST /api/support/requests
export const createSupportRequest = async (req: AuthRequest, res: Response) => {
  await createRequest(req, res, req.body.type || 'support');
};

// @desc    List support/concierge/sales requests for current user
// @route   GET /api/support/requests
export const getSupportRequests = async (req: AuthRequest, res: Response) => {
  const requests = await SupportRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(requests);
};

// @desc    Create Concierge Pass support request
// @route   POST /api/concierge/request
export const createConciergeRequest = async (req: AuthRequest, res: Response) => {
  await createRequest(req, res, 'concierge');
};

// @desc    Get Concierge Pass status for profile/plans screen
// @route   GET /api/concierge/status
export const getConciergeStatus = async (req: AuthRequest, res: Response) => {
  const activeRequests = await SupportRequest.countDocuments({
    user: req.user._id,
    type: 'concierge',
    status: { $in: ['OPEN', 'IN_PROGRESS'] },
  });

  res.json({
    enabled: req.user.plan === 'Concierge Pass',
    status: req.user.plan === 'Concierge Pass' ? 'active' : 'inactive',
    activeRequests,
    supportLevel: req.user.plan === 'Concierge Pass' ? 'priority' : 'standard',
  });
};

// @desc    Capture demo/contact/sales CTA from pricing or enterprise cards
// @route   POST /api/sales/demo-request
export const createDemoRequest = async (req: AuthRequest, res: Response) => {
  await createRequest(req, res, 'sales-demo');
};

// @desc    Capture sales contact CTA
// @route   POST /api/sales/contact
export const createSalesContact = async (req: AuthRequest, res: Response) => {
  await createRequest(req, res, 'sales-contact');
};
