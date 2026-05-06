import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Baggage from '../models/baggageModel';

// @desc    Track a new bag (Scan/Manual)
// @route   POST /api/baggage
export const trackBaggage = async (req: AuthRequest, res: Response) => {
  try {
    const { tagNumber, flightNumber, route, currentLocation, eta } = req.body;
    const baggage = await Baggage.create({
      user: req.user._id,
      tagNumber,
      flightNumber,
      route,
      currentLocation,
      eta
    });
    res.status(201).json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user baggage tracking
// @route   GET /api/baggage
export const getBaggageList = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const query: any = { user: req.user._id };
    if (status && status !== 'All Bags') {
      query.status = status;
    }
    const bags = await Baggage.find(query).sort({ updatedAt: -1 });
    res.json(bags);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    File a PIR (Property Irregularity Report)
// @route   PUT /api/baggage/:id/pir
export const filePIR = async (req: AuthRequest, res: Response) => {
  try {
    const { bagDescription, incidentType } = req.body;
    const baggage = await Baggage.findById(req.params.id);
    if (!baggage) return res.status(404).json({ message: 'Baggage not found' });

    baggage.pirFiled = true;
    baggage.pirReference = `PIR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    baggage.bagDescription = bagDescription;
    baggage.incidentType = incidentType;
    baggage.status = incidentType; // Update status to Delayed/Lost/Damaged

    await baggage.save();
    res.json(baggage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get baggage analytics (Incidents, Recovery, etc.)
// @route   GET /api/baggage/analytics
export const getBaggageAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const bags = await Baggage.find({ user: req.user._id });
    const incidents = bags.filter(b => b.pirFiled).length;
    
    res.json({
      totalIncidents: incidents,
      compensationRecovered: '₦325K', // Mocked until payment integration for claims is fully tied
      avgResponseTime: '2.8 days',
      activeAirlines: 12,
      airportRankings: [
        { name: 'Murtala Muhammed (LOS)', incidents: 4 },
        { name: 'Nnamdi Azikiwe (ABV)', incidents: 2 },
      ]
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
