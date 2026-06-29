import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { getFlightStatus } from '../services/flightService';
import axios from 'axios';
import Trip from '../models/tripModel';

// @desc    Get active issues for a flight
// @route   GET /api/issues/flight/:iata
// @access  Private
export const getFlightDisruptions = async (req: AuthRequest, res: Response) => {
  try {
    const flightIata = req.params.iata as string;
    const flightData = await getFlightStatus(flightIata);

    if (!flightData) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    // Logic to determine if there's a disruption
    const departureDelay = flightData.departure.delay || 0;
    const isCancelled = flightData.flight_status === 'cancelled';
    
    let issue = null;

    if (isCancelled) {
      issue = {
        type: 'CRITICAL',
        title: 'Flight Cancelled',
        description: `Your flight ${flightIata} from ${flightData.departure.airport} has been cancelled.`,
        rights: 'Full refund or rebooking + compensation up to ₦45,000.',
      };
    } else if (departureDelay > 120) { // More than 2 hours
      issue = {
        type: 'HIGH',
        title: `${departureDelay / 60} Hour Delay`,
        description: `Departure delayed from ${flightData.departure.scheduled} to ${flightData.departure.estimated}.`,
        rights: 'Refreshments + compensation up to ₦30,000.',
      };
    }

    res.json({
      flight: flightData,
      activeIssue: issue,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get nearby flights for Sentinel Map
// @route   GET /api/issues/map
export const getNearbyFlights = async (req: AuthRequest, res: Response) => {
  try {
    const activeTrips = await Trip.find({ user: req.user._id, status: { $ne: 'completed' } });
    
    const mapFlights = activeTrips.map((trip: any) => ({
      id: trip._id,
      lat: 6.5244 + (Math.random() * 2 - 1),
      lng: 3.3792 + (Math.random() * 2 - 1),
      flight: trip.flightNumber || trip.tripName || 'Unknown',
      status: trip.status || 'active',
      origin: trip.origin,
      destination: trip.destination
    }));
    
    res.json(mapFlights);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

