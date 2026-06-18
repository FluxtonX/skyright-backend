import axios from 'axios';
import dotenv from 'dotenv';
import admin from '../src/config/firebase';
import Trip from '../src/models/tripModel';
import User from '../src/models/userModel';

dotenv.config();

const SEED_SOURCE = 'today-active-flight-seed';
const AVIATIONSTACK_BASE_URL =
  process.env.AVIATIONSTACK_BASE_URL || 'https://api.aviationstack.com/v1';
const API_KEY = process.env.AVIATIONSTACK_API_KEY;

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
};

const printUsageAndExit = () => {
  console.error(
    [
      'Usage:',
      '  npm run seed:today-flights -- --firebase-id=<logged-in-firebase-uid>',
      '  npm run seed:today-flights -- --email=<logged-in-user-email>',
      '',
      'Optional:',
      '  --limit=5',
      '',
      'This script is development-only and refuses to run with NODE_ENV=production.',
    ].join('\n')
  );
  process.exit(1);
};

const toAirportCode = (value?: string) => String(value || '').trim().toUpperCase();

const getRiskLevel = (flight: any) => {
  const departureDelay = Number(flight.departure?.delay || 0);
  const arrivalDelay = Number(flight.arrival?.delay || 0);
  const maxDelay = Math.max(departureDelay, arrivalDelay);

  if (flight.flight_status === 'cancelled' || maxDelay >= 120) return 'High';
  if (maxDelay > 0) return 'Medium';
  return 'Low';
};

const getRiskColor = (riskLevel: string) => {
  if (riskLevel === 'High') return '#EF4444';
  if (riskLevel === 'Medium') return '#FFC229';
  return '#10B981';
};

const fetchTodayActiveFlights = async (limit: number) => {
  if (!API_KEY) {
    throw new Error('AVIATIONSTACK_API_KEY is required.');
  }

  const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
    timeout: 15000,
    params: {
      access_key: API_KEY,
      flight_status: 'active',
      limit,
    },
  });

  if (response.data?.error) {
    throw new Error(
      response.data.error.info ||
        response.data.error.message ||
        'Aviationstack API error'
    );
  }

  return (response.data?.data || []).filter((flight: any) => {
    return (
      flight.flight?.iata &&
      toAirportCode(flight.departure?.iata) &&
      toAirportCode(flight.arrival?.iata)
    );
  });
};

const main = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed today active flights in production.');
  }

  const firebaseId = getArgValue('firebase-id');
  const email = getArgValue('email');
  const limit = Math.max(1, Math.min(Number(getArgValue('limit') || 5), 10));

  if (!firebaseId && !email) {
    printUsageAndExit();
  }

  const user = firebaseId
    ? await User.findById(firebaseId)
    : await User.findOne({ email });

  if (!user) {
    throw new Error(
      `User not found. Log in once first so the backend creates the user profile. Lookup: ${
        firebaseId ? `firebase-id=${firebaseId}` : `email=${email}`
      }`
    );
  }

  const userId = user._id;
  const userFirebaseId = user.firebaseId || user.id || userId;
  const flights = await fetchTodayActiveFlights(limit);

  if (!flights.length) {
    throw new Error('Aviationstack returned no active flights with usable route data.');
  }

  await Trip.deleteMany({ user: userId, source: SEED_SOURCE });

  const createdTrips = await Promise.all(
    flights.slice(0, limit).map((flight: any) => {
      const flightNumber = String(flight.flight.iata).toUpperCase();
      const origin = toAirportCode(flight.departure.iata);
      const destination = toAirportCode(flight.arrival.iata);
      const departureDelay = Number(flight.departure?.delay || 0);
      const arrivalDelay = Number(flight.arrival?.delay || 0);
      const riskLevel = getRiskLevel(flight);

      return Trip.create({
        user: userId,
        userId: userFirebaseId,
        tripName: flightNumber,
        flightNumber,
        origin,
        destination,
        departureDate: flight.flight_date || new Date().toISOString().split('T')[0],
        bookingReference: `LIVE-${flightNumber}`,
        totalDuration: flight.flight_date || new Date().toISOString().split('T')[0],
        stops: 0,
        status: flight.flight_status || 'active',
        trackingEnabled: true,
        lastTrackedAt: new Date().toISOString(),
        airline: flight.airline?.name || '',
        source: SEED_SOURCE,
        timeline: [
          {
            isFlight: true,
            airlineCode: flight.airline?.iata || '',
            from: origin,
            to: destination,
            fromTime: flight.departure?.scheduled || '',
            toTime: flight.arrival?.scheduled || '',
            date: flight.flight_date || '',
            delayProb:
              departureDelay || arrivalDelay
                ? `${Math.max(departureDelay, arrivalDelay)} min delay`
                : 'Live active',
            activeAlerts: departureDelay || arrivalDelay ? 1 : 0,
            riskLevel,
            riskColor: getRiskColor(riskLevel),
            info: `${flight.airline?.name || 'Airline'} ${flightNumber} is ${flight.flight_status || 'active'}`,
          },
        ],
      });
    })
  );

  console.log('Seeded today active flights:', {
    user: userId,
    firebaseId: userFirebaseId,
    email: user.email || '',
    count: createdTrips.length,
    flights: createdTrips.map((trip: any) => ({
      flightNumber: trip.flightNumber,
      route: `${trip.origin} -> ${trip.destination}`,
      date: trip.departureDate,
      status: trip.status,
    })),
  });
};

main()
  .catch((error) => {
    console.error('Today active flight seed failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await admin.app().delete().catch(() => undefined);
  });
