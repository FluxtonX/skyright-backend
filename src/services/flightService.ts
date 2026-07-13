import axios from 'axios';
import dotenv from 'dotenv';
import admin from '../config/firebase';
import Trip from '../models/tripModel';
import AlertModel from '../models/alertModel';
import { getUserProfileByFirebaseId } from './userProfileService';

dotenv.config();

const AVIATIONSTACK_BASE_URL =
  process.env.AVIATIONSTACK_BASE_URL || 'https://api.aviationstack.com/v1';
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
    timezone: string;       // IANA tz string, e.g. "America/New_York"
    iata: string;
    icao: string;
    terminal: string;
    gate: string;
    delay: number;
    scheduled: string;
    estimated: string;
    actual?: string;         // set once the flight has actually landed
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
  live?: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  } | null;
}

const normalizeFlightIata = (flightIata: string) =>
  flightIata.trim().toUpperCase().replace(/\s+/g, '');

const extractBestFlightMatch = (
  flights: FlightData[],
  requestedIata: string,
  requestedDate?: string
): FlightData | null => {
  if (!flights || flights.length === 0) return null;

  // Ensure we only look at flights matching the requested IATA
  const matches = flights.filter(
    (f) => f.flight?.iata && f.flight.iata.toUpperCase() === requestedIata.toUpperCase()
  );

  if (matches.length === 0) return null;

  // If we have a requested date, try an exact match first
  if (requestedDate) {
    const exactDate = matches.find((f) => f.flight_date === requestedDate);
    if (exactDate) return exactDate;
  }

  // If no date or no exact date match, find the most relevant flight
  // Order of preference: active > scheduled > others
  const statusPriority: Record<string, number> = {
    active: 1,
    active_delayed: 2,
    scheduled: 3,
    delayed: 4,
    incident: 5,
    diverted: 6,
    landed: 7,
    landed_estimated: 8,
    cancelled: 9,
  };

  return matches.sort((a, b) => {
    const pA = statusPriority[a.flight_status?.toLowerCase()] || 99;
    const pB = statusPriority[b.flight_status?.toLowerCase()] || 99;
    
    if (pA !== pB) return pA - pB;
    
    // Fallback: newest flight date first
    return new Date(b.flight_date || 0).getTime() - new Date(a.flight_date || 0).getTime();
  })[0];
};

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
      },
    });

    if (response.data?.error) {
      console.error('Aviationstack API error:', response.data.error);
      throw new Error(
        response.data.error.info ||
          response.data.error.message ||
          'Aviationstack API error'
      );
    }

    if (response.data?.data) {
      return extractBestFlightMatch(response.data.data, normalizedFlightIata, flightDate);
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
  // Mock times use LOCAL airport times with the correct UTC offset already embedded.
  // e.g. "+05:00" for PKT (Karachi), "+01:00" for WAT (Lagos).
  // The frontend extracts the HH:mm component directly — do NOT use +00:00 here
  // unless the airport's local timezone is genuinely UTC, as that would display
  // UTC time on screen instead of the correct local airport time.
  return {
    flight_date: flightDate || new Date().toISOString().split('T')[0],
    flight_status: 'active',
    departure: {
      airport: 'Jinnah International Airport',
      timezone: 'Asia/Karachi',
      iata: 'KHI',
      icao: 'OPKC',
      terminal: '1',
      gate: 'B12',
      delay: 120,
      scheduled: '2026-05-05T14:00:00+05:00',
      estimated: '2026-05-05T16:00:00+05:00',
    },
    arrival: {
      airport: 'Allama Iqbal International Airport',
      timezone: 'Asia/Karachi',
      iata: 'LHE',
      icao: 'OPLA',
      terminal: 'D',
      gate: '4',
      delay: 120,
      scheduled: '2026-05-05T15:15:00+05:00',
      estimated: '2026-05-05T17:15:00+05:00',
    },
    airline: {
      name: 'Pakistan International Airlines',
      iata: 'PK',
      icao: 'PIA',
    },
    flight: {
      number: flightIata.replace(/[^0-9]/g, ''),
      iata: flightIata,
      icao: flightIata,
    },
    live: {
      updated: new Date().toISOString(),
      latitude: 29.8, // Midpoint between KHI and LHE
      longitude: 70.5,
      altitude: 10972, // ~36,000 ft in meters
      direction: 45.0,
      speed_horizontal: 853,
      speed_vertical: 0,
      is_ground: false,
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// getLiveFlightPosition — real-time aircraft position for the Live Tracker map
// Returns lat/lng/altitude/speed when airborne, or null fields when on ground
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveFlightPosition {
  flightNumber: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  direction: number | null;
  isGround: boolean;
  updated: string | null;
  origin: string;
  destination: string;
  originAirport: string;
  destinationAirport: string;
  departureTime: string;
  arrivalTime: string;
  airline: string;
}

export const getLiveFlightPosition = async (
  flightNumber: string,
  flightDate?: string
): Promise<LiveFlightPosition | null> => {
  const normalizedFlight = normalizeFlightIata(flightNumber);

  try {
    let flightData: FlightData | null;

    if (!API_KEY) {
      console.log('[getLiveFlightPosition] Mock mode — no API key.');
      flightData = getMockFlightData(normalizedFlight, flightDate);
    } else {
      const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
        timeout: 10000,
        params: {
          access_key: API_KEY,
          flight_iata: normalizedFlight,
        },
      });

      if (response.data?.error) {
        throw new Error(
          response.data.error.info ||
            response.data.error.message ||
            'Aviationstack API error'
        );
      }

      flightData = extractBestFlightMatch(
        response.data?.data ?? [],
        normalizedFlight,
        flightDate
      );
    }

    if (!flightData) return null;

    const live = flightData.live;

    return {
      flightNumber: flightData.flight?.iata || normalizedFlight,
      status: flightData.flight_status || 'unknown',
      latitude: live?.latitude ?? null,
      longitude: live?.longitude ?? null,
      altitude: live ? Math.round(live.altitude * 3.28084) : null, // meters → feet
      speed: live ? Math.round(live.speed_horizontal) : null,
      direction: live?.direction ?? null,
      isGround: live?.is_ground ?? true,
      updated: live?.updated ?? null,
      origin: flightData.departure?.iata || '',
      destination: flightData.arrival?.iata || '',
      originAirport: flightData.departure?.airport || '',
      destinationAirport: flightData.arrival?.airport || '',
      departureTime: flightData.departure?.scheduled || '',
      arrivalTime: flightData.arrival?.scheduled || '',
      airline: flightData.airline?.name || '',
    };
  } catch (error) {
    const message = getFlightErrorMessage(error);
    console.error('[getLiveFlightPosition] Error:', {
      message,
      flightNumber: normalizedFlight,
      flightDate,
    });
    throw new Error(message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// checkFlightStatus — dedicated flight-status lookup for /api/flights/status
// Calls Aviationstack, filters results by flight_date, and returns a clean
// structured response: { status, delayMinutes, departure, arrival, airline }
// ─────────────────────────────────────────────────────────────────────────────

export interface FlightStatusResult {
  flightNumber: string;
  flightDate: string;
  status: string;
  delayMinutes: number;
  departure: {
    airport: string;
    iata: string;
    terminal: string | null;
    gate: string | null;
    scheduled: string;
    estimated: string;
  };
  arrival: {
    airport: string;
    iata: string;
    terminal: string | null;
    gate: string | null;
    scheduled: string;
    estimated: string;
  };
  airline: {
    name: string;
    iata: string;
  };
}

interface CacheEntry {
  data: FlightStatusResult | null;
  timestamp: number;
}
const flightCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins

export const checkFlightStatus = async (
  flightNumber: string,
  flightDate: string
): Promise<FlightStatusResult | null> => {
  const normalizedFlight = normalizeFlightIata(flightNumber);
  const cacheKey = `${normalizedFlight}_${flightDate}`;

  const cached = flightCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[checkFlightStatus] Returning cached data for ${cacheKey}`);
    return cached.data;
  }

  // ── Mock mode (no API key) ──────────────────────────────────────────────
  if (!API_KEY) {
    console.log('[checkFlightStatus] Mock mode — no API key configured.');
    const mock = getMockFlightData(normalizedFlight, flightDate);
    const result = buildFlightStatusResult(normalizedFlight, mock, flightDate);
    flightCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  // ── Live Aviationstack call ─────────────────────────────────────────────
  try {
    const params: Record<string, string> = {
      access_key: API_KEY,
      flight_iata: normalizedFlight,
    };

    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      timeout: 10000,
      params,
    });

    if (response.data?.error) {
      throw new Error(
        response.data.error.info ||
          response.data.error.message ||
          'Aviationstack API error'
      );
    }

    const flights: FlightData[] = response.data?.data ?? [];

    const match = extractBestFlightMatch(flights, normalizedFlight, flightDate);
    if (!match) {
      flightCache.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    }

    const result = buildFlightStatusResult(normalizedFlight, match, flightDate);
    flightCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {

    const message = getFlightErrorMessage(error);
    console.error('[checkFlightStatus] Error:', {
      message,
      flightNumber: normalizedFlight,
      flightDate,
      providerBaseUrl: AVIATIONSTACK_BASE_URL,
    });
    throw new Error(message);
  }
};

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minutes of delay before an "active" or "scheduled" status gets a delay tag. */
const SIGNIFICANT_DELAY_MINUTES = 15;

/**
 * Minutes PAST the reference arrival timestamp before we declare the flight
 * landed.  Smaller buffers for more precise timestamps.
 *
 *  • actual    → 5 min   confirmed wheels-down, very precise
 *  • estimated → 15 min  gate estimate, updated en-route
 *  • scheduled → 20 min  least accurate — wait longer before overriding
 */
const LANDED_ACTUAL_BUFFER_MIN    =  5;
const LANDED_ESTIMATED_BUFFER_MIN = 15;
const LANDED_SCHEDULED_BUFFER_MIN = 20;

// ─────────────────────────────────────────────────────────────────────────────
// isoToUtcMs
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Converts an ISO-8601 datetime string to a UTC millisecond timestamp.
 *
 * Three cases are handled:
 *   (a) Offset already embedded ("+05:00" / "Z") → Date.parse() directly.
 *   (b) Offset-naive string + IANA timezone supplied → Intl inversion.
 *   (c) Offset-naive string + no timezone → treat as UTC (safe fallback).
 *
 * The Intl inversion (case b) works as follows:
 *   1. Parse the naive string as if it were UTC  → naiveAsUtcMs.
 *   2. Format that instant in the target timezone to get the local wall-clock
 *      reading at that UTC instant                → localAtNaiveUtcMs.
 *   3. offsetMs = naiveAsUtcMs − localAtNaiveUtcMs
 *      (positive for UTC+N e.g. +05:00 Asia/Karachi, negative for UTC-N).
 *   4. trueUtcMs = naiveAsUtcMs − offsetMs
 *
 * The old code incorrectly *added* offsetMs, causing a sign flip for UTC+
 * timezones.  This version always subtracts.
 *
 * Returns NaN on any parse failure so callers can guard with isNaN().
 */
const isoToUtcMs = (iso: string, ianaTimezone?: string): number => {
  let trimmed = iso.trim();
  if (!trimmed) return NaN;

  // FIX: Aviationstack often returns local time but incorrectly appends +00:00 or Z.
  // E.g. "2026-07-03T18:00:00+00:00" for 6:00 PM in Asia/Karachi.
  // If we leave +00:00, Date.parse treats it as UTC, pushing it hours into the future.
  // We must strip +00:00 or Z so it's treated as a naive local string, which our
  // IANA timezone inversion logic below will correctly convert to true UTC.
  if (trimmed.endsWith('+00:00')) {
    trimmed = trimmed.substring(0, trimmed.length - 6);
  } else if (trimmed.endsWith('Z')) {
    trimmed = trimmed.substring(0, trimmed.length - 1);
  }

  // ── (a) offset already present (and not +00:00 stripped above) ────────────
  if (/[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return Date.parse(trimmed);
  }

  // ── (b) naive datetime + IANA tz ─────────────────────────────────────────
  if (ianaTimezone) {
    try {
      const naiveAsUtcMs = Date.parse(trimmed + 'Z');
      if (isNaN(naiveAsUtcMs)) return NaN;

      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: ianaTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(new Date(naiveAsUtcMs));

      const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
      const localAtNaiveUtcMs = Date.parse(
        `${get('year')}-${get('month')}-${get('day')}` +
        `T${get('hour')}:${get('minute')}:${get('second')}Z`
      );

      const offsetMs = naiveAsUtcMs - localAtNaiveUtcMs; // e.g. +18_000_000 for UTC+5
      return naiveAsUtcMs - offsetMs;                     // subtract to undo shift
    } catch {
      // Malformed IANA string — fall through to (c)
    }
  }

  // ── (c) no timezone info — treat as UTC ───────────────────────────────────
  return Date.parse(trimmed + 'Z');
};

// ─────────────────────────────────────────────────────────────────────────────
// resolveEstimatedLanding
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Determines whether a flight that Aviationstack still marks as airborne
 * should be overridden to a landed state based on wall-clock time.
 *
 * Return values:
 *   "landed"           — arrival.actual is set (confirmed wheels-down) AND
 *                        now > actual + LANDED_ACTUAL_BUFFER_MIN (5 min).
 *   "landed_estimated" — no confirmed actual; now > estimated/scheduled +
 *                        their respective buffer.
 *   null               — not past the arrival window yet; no override.
 *
 * Only fires for airborne statuses: active | active_delayed | scheduled | delayed.
 * Statuses already set to "landed", "cancelled", etc. are left untouched.
 */
const resolveEstimatedLanding = (
  rawStatus: string,
  arrivalData: FlightData['arrival']
): string | null => {
  const status = rawStatus.toLowerCase();

  // Guard: only override statuses that imply the aircraft is still airborne
  const airborneStatuses = new Set(['active', 'active_delayed', 'scheduled', 'delayed']);
  if (!airborneStatuses.has(status)) return null;

  const tz = arrivalData?.timezone; // IANA string, e.g. "Asia/Karachi"

  // ── Tier 1: confirmed actual landing time ─────────────────────────────────
  const actualIso = arrivalData?.actual?.trim();
  if (actualIso) {
    const actualUtcMs = isoToUtcMs(actualIso, tz);
    if (!isNaN(actualUtcMs) && Date.now() > actualUtcMs + LANDED_ACTUAL_BUFFER_MIN * 60_000) {
      console.log('[resolveEstimatedLanding] actual arrival time passed → "landed"', {
        actualIso,
        bufferMin: LANDED_ACTUAL_BUFFER_MIN,
        nowUtc: new Date().toISOString(),
      });
      return 'landed';
    }
  }

  // ── Tier 2: estimated or scheduled arrival time ───────────────────────────
  const estimatedIso = arrivalData?.estimated?.trim();
  const scheduledIso = arrivalData?.scheduled?.trim();
  const useEstimated = !!estimatedIso;             // prefer estimated over scheduled
  const refIso       = estimatedIso || scheduledIso;

  if (!refIso) return null;

  const refUtcMs = isoToUtcMs(refIso, tz);
  if (isNaN(refUtcMs)) return null;

  const bufferMs = (useEstimated ? LANDED_ESTIMATED_BUFFER_MIN : LANDED_SCHEDULED_BUFFER_MIN) * 60_000;

  if (Date.now() > refUtcMs + bufferMs) {
    console.log(
      `[resolveEstimatedLanding] ${useEstimated ? 'estimated' : 'scheduled'} arrival time passed → "landed_estimated"`,
      {
        refIso,
        bufferMin: useEstimated ? LANDED_ESTIMATED_BUFFER_MIN : LANDED_SCHEDULED_BUFFER_MIN,
        nowUtc: new Date().toISOString(),
      }
    );
    return 'landed_estimated';
  }

  return null; // not past arrival window — leave status unchanged
};

// ─────────────────────────────────────────────────────────────────────────────
// resolvePrematureActive
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Determines whether Aviationstack has prematurely marked a flight as "active"
 * before it has even reached its departure time.
 *
 * Return values:
 *   "scheduled" — if the status is active but now < departure time.
 *   null        — if it's genuinely active or not active.
 */
const resolvePrematureActive = (
  rawStatus: string,
  departureData: FlightData['departure']
): string | null => {
  const status = rawStatus.toLowerCase();

  // Only consider active statuses
  if (status !== 'active' && status !== 'active_delayed') return null;

  const tz = departureData?.timezone;
  const estimatedIso = departureData?.estimated?.trim();
  const scheduledIso = departureData?.scheduled?.trim();
  const refIso       = estimatedIso || scheduledIso;

  if (!refIso) return null;

  const refUtcMs = isoToUtcMs(refIso, tz);
  if (isNaN(refUtcMs)) return null;

  if (Date.now() < refUtcMs) {
    console.log(
      `[resolvePrematureActive] active but current time is before departure → "scheduled"`,
      { refIso, nowUtc: new Date().toISOString() }
    );
    return 'scheduled';
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// resolveOverdueScheduled
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Determines whether Aviationstack is lagging and a "scheduled" flight 
 * has actually already passed its departure time.
 *
 * Return values:
 *   "active" — if the status is scheduled/planned but now > departure time + 10 mins.
 *   null     — otherwise.
 */
const resolveOverdueScheduled = (
  rawStatus: string,
  departureData: FlightData['departure']
): string | null => {
  const status = rawStatus.toLowerCase();

  if (status !== 'scheduled' && status !== 'planned') return null;

  const tz = departureData?.timezone;
  const estimatedIso = departureData?.estimated?.trim();
  const scheduledIso = departureData?.scheduled?.trim();
  const refIso       = estimatedIso || scheduledIso;

  if (!refIso) return null;

  const refUtcMs = isoToUtcMs(refIso, tz);
  if (isNaN(refUtcMs)) return null;

  // Override to 'active' if current time is > 10 mins past departure
  if (Date.now() > refUtcMs + 10 * 60_000) {
    console.log(
      `[resolveOverdueScheduled] scheduled departure time passed by 10m → "active"`,
      { refIso, nowUtc: new Date().toISOString() }
    );
    return 'active';
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// resolveFlightStatus
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Applies all business-rule overrides in strict priority order:
 *
 *  Pri | Condition                                          | Output
 * -----|----------------------------------------------------|----------------------
 *  1a  | arrival.actual set  + now > actual   + 5 min      | "landed"
 *  1b  | no actual, estimated + now > estimated + 15 min   | "landed_estimated"
 *  1c  | no actual/estimated  + now > scheduled + 20 min   | "landed_estimated"
 *  2   | active + now < departure time                     | "scheduled"
 *  3   | departure.delay > 15 min + active/scheduled       | "active_delayed" / "delayed"
 *  4   | none of the above                                 | rawStatus unchanged
 */
const resolveFlightStatus = (
  rawStatus: string,
  delayMinutes: number,
  arrivalData: FlightData['arrival'],
  departureData: FlightData['departure']
): string => {
  // ── Priority 1: landing-time check always wins ────────────────────────────
  const landedOverride = resolveEstimatedLanding(rawStatus, arrivalData);
  if (landedOverride) return landedOverride;

  // ── Priority 2: premature active check ────────────────────────────────────
  const prematureOverride = resolvePrematureActive(rawStatus, departureData);
  if (prematureOverride) rawStatus = prematureOverride;

  // ── Priority 2.5: overdue scheduled check (Aviationstack lag) ─────────────
  const overdueOverride = resolveOverdueScheduled(rawStatus, departureData);
  if (overdueOverride) rawStatus = overdueOverride;

  // ── Priority 3: significant departure delay ───────────────────────────────
  const status = rawStatus.toLowerCase();
  if (delayMinutes > SIGNIFICANT_DELAY_MINUTES) {
    if (status === 'active')    return 'active_delayed';
    if (status === 'scheduled') return 'delayed';
  }

  // ── Priority 4: pass through ──────────────────────────────────────────────
  return rawStatus;
};

// ── Helper: map a raw FlightData into a clean FlightStatusResult ────────────
const buildFlightStatusResult = (
  flightNumber: string,
  data: FlightData,
  requestedDate?: string
): FlightStatusResult => {
  const delayMinutes = data.departure?.delay ?? 0;

  // Pass arrival and departure data so resolveFlightStatus can run checks
  const resolvedStatus = resolveFlightStatus(
    data.flight_status,
    delayMinutes,
    data.arrival,
    data.departure
  );

  return {
    flightNumber,
    flightDate: requestedDate || data.flight_date,
    status: resolvedStatus,
    delayMinutes,
    departure: {
      airport: data.departure?.airport ?? '',
      iata: data.departure?.iata ?? '',
      terminal: data.departure?.terminal ?? null,
      gate: data.departure?.gate ?? null,
      scheduled: data.departure?.scheduled ?? '',
      estimated: data.departure?.estimated ?? '',
    },
    arrival: {
      airport: data.arrival?.airport ?? '',
      iata: data.arrival?.iata ?? '',
      terminal: data.arrival?.terminal ?? null,
      gate: data.arrival?.gate ?? null,
      scheduled: data.arrival?.scheduled ?? '',
      estimated: data.arrival?.estimated ?? '',
    },
    airline: {
      name: data.airline?.name ?? '',
      iata: data.airline?.iata ?? '',
    },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// monitorFlightsAndCreateAlerts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cron job handler to fetch all actively tracked trips, check their live status,
 * and generate Sentinel alerts in Firestore if there are significant delays or cancellations.
 */
export const monitorFlightsAndCreateAlerts = async () => {
  console.log('[monitorFlightsAndCreateAlerts] Starting Sentinel cron job...');
  try {
    const activeTrips = await Trip.find({ trackingEnabled: true });
    console.log(`[monitorFlightsAndCreateAlerts] Found ${activeTrips.length} active trips to monitor.`);

    // 1. Group by flight (Deduplication)
    const tripsByFlight = new Map<string, typeof activeTrips>();
    for (const trip of activeTrips) {
      const key = `${trip.flightNumber}_${trip.departureDate}`;
      if (!tripsByFlight.has(key)) tripsByFlight.set(key, []);
      tripsByFlight.get(key)!.push(trip);
    }

    const now = Date.now();

    for (const [key, tripsGroup] of tripsByFlight.entries()) {
      try {
        const representativeTrip = tripsGroup[0];

        // 2. Smart Polling
        const flightUtcMs = isoToUtcMs(representativeTrip.departureDate);
        const msUntilFlight = isNaN(flightUtcMs) ? 0 : flightUtcMs - now;
        const hoursUntilFlight = msUntilFlight / (1000 * 60 * 60);

        let lastTrackedMs = 0;
        for (const t of tripsGroup) {
           if (t.lastTrackedAt) {
              const ms = new Date(t.lastTrackedAt).getTime();
              if (!isNaN(ms) && ms > lastTrackedMs) lastTrackedMs = ms;
           }
        }
        const hoursSinceLastTracked = (now - lastTrackedMs) / (1000 * 60 * 60);

        if (hoursUntilFlight > 48 && hoursSinceLastTracked < 24) {
          console.log(`[monitorFlightsAndCreateAlerts] Skipping ${key} (Flight > 48h away, polled < 24h ago)`);
          continue;
        }
        if (hoursUntilFlight > 24 && hoursUntilFlight <= 48 && hoursSinceLastTracked < 6) {
          console.log(`[monitorFlightsAndCreateAlerts] Skipping ${key} (Flight 24-48h away, polled < 6h ago)`);
          continue;
        }

        const flightData = await checkFlightStatus(representativeTrip.flightNumber, representativeTrip.departureDate);
        
        // Update lastTrackedAt
        for (const trip of tripsGroup) {
           trip.lastTrackedAt = new Date().toISOString();
           await trip.save();
        }

        if (!flightData) continue;

        // 3. Auto-Disable Tracking for landed/cancelled flights
        if (flightData.status === 'landed' || flightData.status === 'cancelled') {
           console.log(`[monitorFlightsAndCreateAlerts] Flight ${key} is ${flightData.status}. Disabling tracking.`);
           for (const trip of tripsGroup) {
              trip.trackingEnabled = false;
              trip.status = flightData.status;
              await trip.save();
           }
        }

        const isDelayed = flightData.status === 'delayed' || flightData.status === 'active_delayed' || flightData.delayMinutes > 15;
        const isCancelled = flightData.status === 'cancelled';

        if (isDelayed || isCancelled) {
          const priority = isCancelled ? 'CRITICAL' : 'HIGH';
          const eventType = isCancelled ? 'CANCELLATION' : 'DELAY';
          const message = isCancelled 
            ? `Flight ${flightData.flightNumber} (${flightData.airline.name}) has been cancelled.` 
            : `Flight ${flightData.flightNumber} (${flightData.airline.name}) is delayed by ${flightData.delayMinutes} minutes.`;

          for (const trip of tripsGroup) {
            const existingAlerts = await AlertModel.find({ 
              userId: trip.userId, 
              flightCode: flightData.flightNumber, 
              eventType: eventType 
            }).sort({ createdAt: -1 }).limit(1);

            let shouldCreate = true;
            if (existingAlerts.length > 0) {
              const lastAlert = existingAlerts[0];
              const hoursSinceLastAlert = (now - new Date(lastAlert.createdAt).getTime()) / (1000 * 60 * 60);
              if (hoursSinceLastAlert < 2) {
                 shouldCreate = false; // Debounce alerts
              }
            }

            if (shouldCreate) {
              await AlertModel.create({
                userId: trip.userId,
                flightCode: flightData.flightNumber,
                airline: flightData.airline.name,
                priority: priority,
                eventType: eventType,
                message: message,
                isRead: false,
                source: 'Sentinel Cron',
              });
              console.log(`[monitorFlightsAndCreateAlerts] Created ${eventType} alert for user ${trip.userId} (Flight: ${flightData.flightNumber})`);

              try {
                const userProfile = await getUserProfileByFirebaseId(trip.userId);
                if (userProfile && userProfile.fcmToken) {
                  const payload = {
                    token: userProfile.fcmToken,
                    notification: {
                      title: `Flight Alert: ${flightData.flightNumber} ${isCancelled ? 'Cancelled' : 'Delayed'}`,
                      body: message,
                    },
                    data: {
                      flightNumber: flightData.flightNumber,
                      eventType: eventType,
                    },
                  };
                  await admin.messaging().send(payload);
                  console.log(`[monitorFlightsAndCreateAlerts] Sent FCM push notification to user ${trip.userId}`);
                }
              } catch (fcmError) {
                console.error(`[monitorFlightsAndCreateAlerts] Failed to send FCM push notification to user ${trip.userId}:`, fcmError);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[monitorFlightsAndCreateAlerts] Failed to process flight group ${key}:`, err);
      }
    }
    console.log('[monitorFlightsAndCreateAlerts] Completed Sentinel cron job.');
  } catch (error) {
    console.error('[monitorFlightsAndCreateAlerts] Cron job failed:', error);
  }
};
