import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const AVIATIONSTACK_BASE_URL =
  process.env.AVIATIONSTACK_BASE_URL || 'http://api.aviationstack.com/v1';
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

const normalizeFlightIata = (flightIata: string) =>
  flightIata.trim().toUpperCase().replace(/\s+/g, '');

const getFlightErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (error.code === 'ENOTFOUND') {
      return `Could not resolve Aviationstack host from ${AVIATIONSTACK_BASE_URL}`;
    }

    if (error.code === 'ECONNABORTED') {
      return 'Aviationstack request timed out';
    }

    const providerMessage = error.response?.data?.error?.info || error.response?.data?.message;
    if (providerMessage) return providerMessage;

    if (status === 401 || status === 403) {
      return `Aviationstack rejected the request with status ${status}. Check AVIATIONSTACK_API_KEY, plan access, and AVIATIONSTACK_BASE_URL.`;
    }

    if (status) {
      return `Aviationstack request failed with status ${status}`;
    }

    return error.message;
  }

  return error instanceof Error ? error.message : 'Unknown flight provider error';
};

export const getFlightStatus = async (
  flightIata: string,
  flightDate?: string
): Promise<FlightData | null> => {
  const normalizedFlightIata = normalizeFlightIata(flightIata);

  try {
    // If no API key, return mock data for testing
    if (!API_KEY) {
      console.log('Mock Mode: No Aviationstack API key found. Returning mock data.');
      return getMockFlightData(normalizedFlightIata, flightDate);
    }

    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      timeout: 10000,
      params: {
        access_key: API_KEY,
        flight_iata: normalizedFlightIata,
        ...(flightDate ? { flight_date: flightDate } : {}),
      },
    });

    if (response.data?.error) {
      console.error('Aviationstack API error:', response.data.error);
      throw new Error(response.data.error.info || 'Aviationstack API error');
    }

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }

    return null;
  } catch (error) {
    const message = getFlightErrorMessage(error);
    console.error('Error fetching flight status:', {
      message,
      flightIata: normalizedFlightIata,
      flightDate,
      providerBaseUrl: AVIATIONSTACK_BASE_URL,
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
      contentType: axios.isAxiosError(error)
        ? error.response?.headers?.['content-type']
        : undefined,
    });
    throw new Error(message);
  }
};

const getMockFlightData = (flightIata: string, flightDate?: string): FlightData => {
  return {
    flight_date: flightDate || new Date().toISOString().split('T')[0],
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
