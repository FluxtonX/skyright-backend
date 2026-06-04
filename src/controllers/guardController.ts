import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Guard from '../models/guardModel';
import Claim from '../models/claimModel';
import { getFlightStatus } from '../services/flightService';

const buildTicketAnalysis = async (input: any) => {
  const flight = input.flightCode ? await getFlightStatus(input.flightCode).catch(() => null) : null;
  const delayMinutes = flight?.departure?.delay || 0;
  const isCancelled = flight?.flight_status === 'cancelled';
  const isEligible = isCancelled || delayMinutes >= 120;

  return {
    pnr: input.pnr,
    ticketNumber: input.ticketNumber || '',
    airline: input.airline || flight?.airline?.name || '',
    flightCode: input.flightCode || flight?.flight?.iata || '',
    flight,
    fareRules: [
      { rule: 'Refundable with airline-specific cancellation rules', isPositive: true },
      { rule: 'Changes may be allowed before departure depending on fare class', isPositive: true },
      { rule: 'No-show and voluntary cancellation rules require airline confirmation', isPositive: false },
    ],
    claimEligibility: {
      eligible: isEligible,
      reason: isEligible
        ? 'Flight disruption meets the current delay/cancellation threshold used by SkyRight.'
        : 'No qualifying delay/cancellation detected from available data yet.',
      suggestedCompensation: isCancelled ? '45000' : delayMinutes >= 120 ? '30000' : '0',
      currency: 'NGN',
    },
  };
};

// @desc    Register a flight for monitoring
// @route   POST /api/guard
export const registerFlight = async (req: AuthRequest, res: Response) => {
  try {
    const { flightCode, departureDate, origin, destination } = req.body;

    // Production Check: Prevent duplicate monitoring for the same flight on the same day
    const existingGuard = await Guard.findOne({
      user: req.user._id,
      flightCode,
      departureDate: new Date(departureDate),
    });

    if (existingGuard) {
      return res.status(400).json({ message: 'You are already monitoring this flight' });
    }

    const guard = await Guard.create({
      user: req.user._id,
      flightCode,
      departureDate,
      origin,
      destination,
    });

    res.status(201).json(guard);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all monitored flights
// @route   GET /api/guard
export const getMonitoredFlights = async (req: AuthRequest, res: Response) => {
  try {
    const guards = await Guard.find({ user: req.user._id }).sort({ departureDate: 1 });
    res.json(guards);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get monitored/analyzed ticket detail
// @route   GET /api/guard/:id
export const getGuardDetails = async (req: AuthRequest, res: Response) => {
  try {
    const guard = await Guard.findById(req.params.id);

    if (!guard) {
      return res.status(404).json({ message: 'TicketGuard item not found' });
    }

    if (guard.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json(guard);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete monitored/analyzed ticket
// @route   DELETE /api/guard/:id
export const deleteGuard = async (req: AuthRequest, res: Response) => {
  try {
    const guard = await Guard.findById(req.params.id);

    if (!guard) {
      return res.status(404).json({ message: 'TicketGuard item not found' });
    }

    if (guard.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await guard.deleteOne();
    res.json({ message: 'TicketGuard item removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Analyze ticket details from PNR/manual input
// @route   POST /api/guard/analyze
export const analyzeTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { pnr, ticketNumber, airline, flightCode } = req.body;

    if (!pnr && !ticketNumber && !flightCode) {
      return res.status(400).json({ message: 'PNR, ticket number, or flight code is required' });
    }

    const analysis = await buildTicketAnalysis({ pnr, ticketNumber, airline, flightCode });
    const guard = await Guard.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      pnr,
      ticketNumber,
      airline: analysis.airline,
      flightCode: analysis.flightCode,
      analysis,
      status: 'Analyzed',
    });

    res.status(201).json({ id: guard._id, ...analysis });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a claim from a TicketGuard analysis
// @route   POST /api/guard/:id/start-claim
export const startClaimFromGuard = async (req: AuthRequest, res: Response) => {
  try {
    const guard = await Guard.findById(req.params.id);

    if (!guard) {
      return res.status(404).json({ message: 'TicketGuard item not found' });
    }

    if (guard.user !== req.user._id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const claim = await Claim.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      guardId: guard._id,
      flightCode: guard.flightCode || guard.analysis?.flightCode || '',
      airline: guard.airline || guard.analysis?.airline || '',
      disruptionType: req.body.disruptionType || 'Flight disruption',
      passenger: req.body.passenger || {},
      booking: {
        pnr: guard.pnr || '',
        ticketNumber: guard.ticketNumber || '',
        ...(req.body.booking || {}),
      },
      status: 'PENDING',
      currentStep: 1,
      totalSteps: 6,
      progress: 0.16,
      documents: [],
    });

    guard.claimId = claim._id;
    guard.status = 'Claim Started';
    await guard.save();

    res.status(201).json(claim);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
