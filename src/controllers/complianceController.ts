import { Response, Request } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import ComplianceChecklist from '../models/complianceChecklistModel';
import { getTravelRequirements } from '../services/extraServices';

// @desc    Check travel compliance for a specific route
// @route   GET /api/compliance/check
export const checkCompliance = async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.query;

    const originStr = String(origin || 'LOS');
    const destinationStr = String(destination || 'LHR');
    const sherpaReqs = await getTravelRequirements(originStr, destinationStr);

    let documents = [];
    let checklist = [];

    if (sherpaReqs.requirements && Array.isArray(sherpaReqs.requirements)) {
      documents = sherpaReqs.requirements.map((req: any) => ({
        title: req.type || 'Travel Document',
        subtitle: req.info || 'Required for entry',
        isCompleted: false,
        isWarning: req.type === 'Visa'
      }));
      checklist = sherpaReqs.requirements.map((req: any) => ({
        title: `Obtain ${req.type || 'Document'}`,
        isDone: false
      }));
    } else {
      documents = [
        { title: 'Valid Passport', subtitle: '6+ months validity required', isCompleted: true },
        { title: 'Travel Authorization', subtitle: sherpaReqs.message || 'Standard Requirements apply', isCompleted: false, isWarning: true },
      ];
      checklist = [
        { title: 'Passport valid for 6+ months', isDone: true },
        { title: 'Review entry requirements', isDone: false },
      ];
    }

    const requirements = {
      route: `${originStr} ✈ ${destinationStr}`,
      documents,
      checklist,
      progress: 50,
      actionRequired: 'Please review and complete the pending travel requirements before your trip.'
    };

    res.json(requirements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get saved BorderReady checklist for a route/trip
// @route   GET /api/plus/compliance/checklist
export const getComplianceChecklist = async (req: AuthRequest, res: Response) => {
  const { tripId, origin, destination } = req.query;
  const filter: Record<string, any> = { user: req.user._id };

  if (tripId) {
    filter.tripId = tripId;
  } else if (origin || destination) {
    filter.origin = origin || '';
    filter.destination = destination || '';
  }

  const checklist = await ComplianceChecklist.findOne(filter);

  res.json(checklist || {
    user: req.user._id,
    userId: req.user.firebaseId,
    tripId: tripId || null,
    origin: origin || '',
    destination: destination || '',
    items: [],
    progress: 0,
  });
};

// @desc    Save BorderReady checklist state
// @route   PUT /api/plus/compliance/checklist
export const saveComplianceChecklist = async (req: AuthRequest, res: Response) => {
  const { tripId, origin, destination, items = [] } = req.body;
  const completedCount = items.filter((item: any) => item.isDone === true || item.completed === true).length;
  const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const filter: Record<string, any> = { user: req.user._id };

  if (tripId) {
    filter.tripId = tripId;
  } else {
    filter.origin = origin || '';
    filter.destination = destination || '';
  }

  const existing = await ComplianceChecklist.findOne(filter);

  if (existing) {
    existing.origin = origin || existing.origin || '';
    existing.destination = destination || existing.destination || '';
    existing.items = items;
    existing.progress = progress;
    await existing.save();
    return res.json(existing);
  }

  const checklist = await ComplianceChecklist.create({
    user: req.user._id,
    userId: req.user.firebaseId,
    tripId: tripId || null,
    origin: origin || '',
    destination: destination || '',
    items,
    progress,
  });

  res.status(201).json(checklist);
};
