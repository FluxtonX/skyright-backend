import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import Trip from '../models/tripModel';
import { getFlightStatus, resolveFlightStatus } from '../services/flightService';

// @desc    Lookup flight details before creating a trip
// @route   POST /api/trips/flight-lookup
export const lookupFlightForTrip = async (req: AuthRequest, res: Response) => {
  try {
    const flightNumber = (req.body.flightNumber || '').trim().toUpperCase();
    const departureDate = (req.body.departureDate || '').trim();

    if (!flightNumber) {
      return res.status(400).json({ message: 'Flight number is required' });
    }

    const flightData = await getFlightStatus(
      flightNumber,
      departureDate || undefined
    );

    if (!flightData) {
      return res.status(404).json({
        message: 'Flight was not found. Check the flight number or enter route details manually.',
      });
    }

    res.json({
      flightNumber: flightData.flight?.iata || flightNumber,
      flightDate: flightData.flight_date || departureDate,
      status: flightData ? resolveFlightStatus(
        flightData.flight_status || 'planned',
        flightData.departure?.delay ?? 0,
        flightData.arrival,
        flightData.departure
      ) : 'planned',
      origin: flightData.departure?.iata || '',
      originAirport: flightData.departure?.airport || '',
      destination: flightData.arrival?.iata || '',
      destinationAirport: flightData.arrival?.airport || '',
      airline: flightData.airline?.name || '',
      departureScheduled: flightData.departure?.scheduled || '',
      arrivalScheduled: flightData.arrival?.scheduled || '',
      departureDelay: flightData.departure?.delay || 0,
      arrivalDelay: flightData.arrival?.delay || 0,
    });
  } catch (error: any) {
    res.status(503).json({
      message: 'Aviationstack is unavailable right now. Enter route details manually or try again later.',
      providerError: error.message,
    });
  }
};

// @desc    Create a new trip journey
// @route   POST /api/trips
export const createTrip = async (req: AuthRequest, res: Response) => {
  try {
    const {
      tripName,
      flightNumber,
      origin,
      destination,
      departureDate,
      bookingReference,
      totalDuration,
      status,
      stops,
      timeline = [],
    } = req.body;

    const resolvedFlightNumber = (flightNumber || tripName || '').trim().toUpperCase();
    const resolvedDepartureDate = (departureDate || totalDuration || '').trim();

    if (!resolvedFlightNumber || !resolvedDepartureDate) {
      return res.status(400).json({
        message: 'Flight number and departure date are required',
      });
    }

    let flightLookupError = '';
    const flightData = await getFlightStatus(resolvedFlightNumber, resolvedDepartureDate)
      .catch((error) => {
        flightLookupError = error instanceof Error ? error.message : 'Flight provider lookup failed';
        console.error('Create trip flight lookup failed:', {
          message: flightLookupError,
          flightNumber: resolvedFlightNumber,
          departureDate: resolvedDepartureDate,
        });
        return null;
      });
    const resolvedOrigin = flightData?.departure?.iata || origin?.trim().toUpperCase();
    const resolvedDestination = flightData?.arrival?.iata || destination?.trim().toUpperCase();

    if (!resolvedOrigin || !resolvedDestination) {
      const providerRejectedRequest = flightLookupError.includes('rejected the request');
      return res.status(flightLookupError ? 503 : 400).json({
        message: flightLookupError
          ? providerRejectedRequest
            ? 'Aviationstack rejected this request. Check your API key, subscription plan, and base URL, or enter origin and destination manually to save this flight without provider data.'
            : 'Aviationstack is unavailable right now. Enter origin and destination manually to save this flight, or try again later.'
          : 'Flight was not found. Enter origin and destination manually to save this flight.',
        providerError: flightLookupError || undefined,
      });
    }
    const resolvedStatus = status || (flightData ? resolveFlightStatus(
      flightData.flight_status || 'planned',
      flightData.departure?.delay ?? 0,
      flightData.arrival,
      flightData.departure
    ) : 'planned');
    const resolvedTimeline = flightData
      ? [
          {
            isFlight: true,
            airlineCode: flightData.airline?.iata || '',
            from: resolvedOrigin,
            to: resolvedDestination,
            fromTime: flightData.departure?.scheduled || '',
            toTime: flightData.arrival?.scheduled || '',
            date: flightData.flight_date || resolvedDepartureDate,
            delayProb: flightData.departure?.delay ? `${flightData.departure.delay} min delay` : 'On time',
            activeAlerts: flightData.departure?.delay || flightData.arrival?.delay ? 1 : 0,
            riskLevel:
              flightData.flight_status === 'cancelled' ||
              (flightData.departure?.delay || 0) >= 120
                ? 'High'
                : (flightData.departure?.delay || 0) > 0
                  ? 'Medium'
                  : 'Low',
            riskColor:
              flightData.flight_status === 'cancelled' ||
              (flightData.departure?.delay || 0) >= 120
                ? '#EF4444'
                : (flightData.departure?.delay || 0) > 0
                  ? '#FFC229'
                  : '#10B981',
            info:
              flightData.flight_status === 'cancelled'
                ? 'Flight cancelled'
                : flightData.departure?.delay
                  ? `Departure delayed by ${flightData.departure.delay} minutes`
                  : 'Flight found and monitoring enabled',
          },
        ]
      : timeline;

    // Risk Engine Logic: Automatically calculate risk based on layover duration
    const processedTimeline = resolvedTimeline.map((leg: any) => {
      if (!leg.isFlight && leg.duration) {
        const minutes = parseInt(leg.duration);
        if (minutes < 60) {
          leg.riskLevel = 'Medium';
          leg.riskColor = '#FFC229';
          leg.info = 'Tight connection - monitor for delays';
        } else if (minutes < 45) {
          leg.riskLevel = 'High';
          leg.riskColor = '#EF4444';
          leg.info = 'High risk of missing connection';
        }
      }
      return leg;
    });

    const trip = await Trip.create({
      user: req.user._id,
      userId: req.user.firebaseId,
      tripName: resolvedFlightNumber,
      flightNumber: resolvedFlightNumber,
      origin: resolvedOrigin,
      destination: resolvedDestination,
      departureDate: flightData?.flight_date || resolvedDepartureDate,
      bookingReference: bookingReference?.trim() || null,
      totalDuration: totalDuration || null,
      stops: stops || 0,
      timeline: processedTimeline,
      status: resolvedStatus,
      trackingEnabled: Boolean(flightData),
      lastTrackedAt: flightData ? new Date().toISOString() : undefined,
    });

    res.status(201).json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all user trips
// @route   GET /api/trips
export const getUserTrips = async (req: AuthRequest, res: Response) => {
  try {
    const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    // Dynamically override status to 'landed' if the arrival time has passed
    // This ensures pixel-perfect real-time updates even before the cron job runs
    const dynamicTrips = trips.map((trip: any) => {
      const tripObj = trip.toObject();
      if (['active', 'active_delayed', 'scheduled', 'delayed'].includes(tripObj.status?.toLowerCase())) {
        if (tripObj.timeline && tripObj.timeline.length > 0) {
          const lastLeg = tripObj.timeline[tripObj.timeline.length - 1];
          if (lastLeg.toTime) {
            let timeStr = lastLeg.toTime;
            if (timeStr.endsWith('+00:00')) {
              timeStr = timeStr.substring(0, timeStr.length - 6);
            } else if (timeStr.endsWith('Z')) {
              timeStr = timeStr.substring(0, timeStr.length - 1);
            }
            const arrivalTimeLocalMs = new Date(timeStr).getTime();
            if (!isNaN(arrivalTimeLocalMs) && Date.now() > arrivalTimeLocalMs) {
              tripObj.status = 'landed';
            }
          }
        }
      }
      return tripObj;
    });

    res.json(dynamicTrips);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single trip with live risk analysis
// @route   GET /api/trips/:id
export const getTripDetails = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const tripObj = trip.toObject();
    
    if (['active', 'active_delayed', 'scheduled', 'delayed'].includes(tripObj.status?.toLowerCase())) {
      if (tripObj.timeline && tripObj.timeline.length > 0) {
        const lastLeg = tripObj.timeline[tripObj.timeline.length - 1];
        if (lastLeg.toTime) {
          // AviationStack bug: they return LOCAL times but append +00:00
          // e.g., 19:30 local time is sent as "2026-07-09T19:30:00+00:00"
          // We must strip +00:00 so JS parses it as a naive local time,
          // then compare it against the current local time.
          let timeStr = lastLeg.toTime;
          if (timeStr.endsWith('+00:00')) {
            timeStr = timeStr.substring(0, timeStr.length - 6);
          } else if (timeStr.endsWith('Z')) {
            timeStr = timeStr.substring(0, timeStr.length - 1);
          }
          
          const arrivalTimeLocalMs = new Date(timeStr).getTime();
          const nowLocalMs = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getTime(); // Assuming PKT for this demo, or we can just use the server's local time if it matches.
          // Since the user is in +05:00 and testing locally, the server's local time might be the same.
          // To be perfectly safe, let's just use the server's local time offset or assume the user's timezone.
          // Wait, Date() parses naive strings as the server's local time. So arrivalTimeLocalMs is in the server's timezone.
          // nowLocalMs should also be in the server's timezone. Date.now() works perfectly if both are evaluated in the same timezone context.
          
          if (!isNaN(arrivalTimeLocalMs) && Date.now() > arrivalTimeLocalMs) {
            tripObj.status = 'landed';
          }
        }
      }
    }

    res.json(tripObj);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get route/risk insight summary for Trip Visualizer
// @route   GET /api/trips/:id/insights
export const getTripInsights = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const timeline = trip.timeline || [];
    const highRiskSegments = timeline.filter((item: any) => item.riskLevel === 'High');
    const mediumRiskSegments = timeline.filter((item: any) => item.riskLevel === 'Medium');

    res.json({
      tripId: trip._id,
      overallRisk: highRiskSegments.length ? 'High' : mediumRiskSegments.length ? 'Medium' : 'Low',
      highRiskSegments: highRiskSegments.length,
      mediumRiskSegments: mediumRiskSegments.length,
      recommendations: [
        ...(highRiskSegments.length ? ['Review tight or high-risk connections before departure.'] : []),
        ...(mediumRiskSegments.length ? ['Monitor medium-risk segments for gate and timing updates.'] : []),
        'Keep travel documents and claim evidence in the Vault.',
      ],
      legend: [
        { key: 'Low', color: '#10B981', description: 'No immediate action needed' },
        { key: 'Medium', color: '#FFC229', description: 'Monitor closely' },
        { key: 'High', color: '#EF4444', description: 'Action recommended' },
      ],
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current live tracking state for a trip
// @route   GET /api/trips/:id/live-status
export const getTripLiveStatus = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    res.json({
      tripId: trip._id,
      trackingEnabled: trip.trackingEnabled === true,
      status: trip.status || 'planned',
      lastCheckedAt: trip.lastTrackedAt || null,
      nextCheckAt: trip.trackingEnabled ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      providerStatus: 'pending-third-party-flight-api',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Enable or update live trip tracking
// @route   POST /api/trips/:id/track-live
export const enableTripLiveTracking = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    trip.trackingEnabled = req.body.enabled !== false;
    trip.lastTrackedAt = new Date().toISOString();
    await trip.save();

    res.json({
      tripId: trip._id,
      trackingEnabled: trip.trackingEnabled,
      lastCheckedAt: trip.lastTrackedAt,
      providerStatus: 'pending-third-party-flight-api',
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update trip
// @route   PATCH /api/trips/:id
export const updateTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const fields = [
      'tripName',
      'flightNumber',
      'origin',
      'destination',
      'departureDate',
      'bookingReference',
      'totalDuration',
      'stops',
      'timeline',
      'trackingEnabled',
      'status',
    ];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        trip[field] = req.body[field];
      }
    });

    await trip.save();
    res.json(trip);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete trip
// @route   DELETE /api/trips/:id
export const deleteTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await trip.deleteOne();
    res.json({ message: 'Trip removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate or return a share token/link for a trip
// @route   POST /api/trips/:id/share
export const shareTrip = async (req: AuthRequest, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (String(trip.user) !== String(req.user._id)) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    if (!trip.shareToken) {
      trip.shareToken = Math.random().toString(36).slice(2, 14);
      trip.isShared = true;
      await trip.save();
    }

    res.json({
      tripId: trip._id,
      shareToken: trip.shareToken,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips/share/${trip.shareToken}`,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
