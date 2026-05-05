import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const AVIATIONSTACK_BASE_URL = 'http://api.aviationstack.com/v1';
const API_KEY = process.env.AVIATIONSTACK_API_KEY;

export interface FlightData {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number;
    scheduled: string;
    estimated: string;
  };
  arrival: {
    airport: string;
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number;
    scheduled: string;
    estimated: string;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
  };
}

export const getFlightStatus = async (flightIata: string): Promise<FlightData | null> => {
  try {
    // If no API key, return mock data for testing
    if (!API_KEY) {
      console.log('Mock Mode: No Aviationstack API key found. Returning mock data.');
      return getMockFlightData(flightIata);
    }

    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      params: {
        access_key: API_KEY,
        flight_iata: flightIata,
      },
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching flight status:', error);
    throw new Error('Failed to fetch flight data');
  }
};

const getMockFlightData = (flightIata: string): FlightData => {
  return {
    flight_date: new Date().toISOString().split('T')[0],
    flight_status: 'active',
    departure: {
      airport: 'Lagos International',
      timezone: 'Africa/Lagos',
      iata: 'LOS',
      icao: 'DNMM',
      terminal: '1',
      gate: 'B12',
      delay: 120,
      scheduled: '2026-05-05T14:00:00+00:00',
      estimated: '2026-05-05T16:00:00+00:00',
    },
    arrival: {
      airport: 'Abuja International',
      iata: 'ABV',
      icao: 'DNAA',
      terminal: 'D',
      gate: '4',
      delay: 120,
      scheduled: '2026-05-05T15:15:00+00:00',
      estimated: '2026-05-05T17:15:00+00:00',
    },
    airline: {
      name: 'Air Peace',
      iata: 'P4',
      icao: 'APK',
    },
    flight: {
      number: flightIata.replace(/[^0-9]/g, ''),
      iata: flightIata,
      icao: flightIata,
    },
  };
};
