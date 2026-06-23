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
      if (
        flightDate &&
        response.data.error.code === 'function_access_restricted'
      ) {
        console.warn(
          'Aviationstack plan does not allow flight_date filtering. Retrying without flight_date.',
          { flightIata: normalizedFlightIata, flightDate }
        );

        const retryResponse = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
          timeout: 10000,
          params: {
            access_key: API_KEY,
            flight_iata: normalizedFlightIata,
          },
        });

        if (retryResponse.data?.error) {
          console.error('Aviationstack retry API error:', retryResponse.data.error);
          throw new Error(
            retryResponse.data.error.info ||
              retryResponse.data.error.message ||
              'Aviationstack API error'
          );
        }

        if (
          retryResponse.data &&
          retryResponse.data.data &&
          retryResponse.data.data.length > 0
        ) {
          return retryResponse.data.data[0];
        }

        return null;
      }

      console.error('Aviationstack API error:', response.data.error);
      throw new Error(
        response.data.error.info ||
          response.data.error.message ||
          'Aviationstack API error'
      );
    }

    if (response.data && response.data.data && response.data.data.length > 0) {
      return response.data.data[0];
    }

    return null;
  } catch (error) {
    if (
      flightDate &&
      axios.isAxiosError(error) &&
      error.response?.data?.error?.code === 'function_access_restricted'
    ) {
      console.warn(
        'Aviationstack plan does not allow flight_date filtering. Retrying without flight_date.',
        { flightIata: normalizedFlightIata, flightDate }
      );

      try {
        const retryResponse = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
          timeout: 10000,
          params: {
            access_key: API_KEY,
            flight_iata: normalizedFlightIata,
          },
        });

        if (retryResponse.data?.error) {
          console.error('Aviationstack retry API error:', retryResponse.data.error);
          throw new Error(
            retryResponse.data.error.info ||
              retryResponse.data.error.message ||
              'Aviationstack API error'
          );
        }

        if (
          retryResponse.data &&
          retryResponse.data.data &&
          retryResponse.data.data.length > 0
        ) {
          return retryResponse.data.data[0];
        }

        return null;
      } catch (retryError) {
        const retryMessage = getFlightErrorMessage(retryError);
        console.error('Error fetching flight status without date filter:', {
          message: retryMessage,
          flightIata: normalizedFlightIata,
          providerBaseUrl: AVIATIONSTACK_BASE_URL,
          status: axios.isAxiosError(retryError)
            ? retryError.response?.status
            : undefined,
        });
        throw new Error(retryMessage);
      }
    }

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
  };
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

export const checkFlightStatus = async (
  flightNumber: string,
  flightDate: string
): Promise<FlightStatusResult | null> => {
  const normalizedFlight = normalizeFlightIata(flightNumber);

  // ── Mock mode (no API key) ──────────────────────────────────────────────
  if (!API_KEY) {
    console.log('[checkFlightStatus] Mock mode — no API key configured.');
    const mock = getMockFlightData(normalizedFlight, flightDate);
    return buildFlightStatusResult(normalizedFlight, mock);
  }

  // ── Live Aviationstack call ─────────────────────────────────────────────
  try {
    const params: Record<string, string> = {
      access_key: API_KEY,
      flight_iata: normalizedFlight,
    };

    // Attach flight_date only if the plan supports it; we fall back gracefully
    if (flightDate) params.flight_date = flightDate;

    const response = await axios.get(`${AVIATIONSTACK_BASE_URL}/flights`, {
      timeout: 10000,
      params,
    });

    // Handle Aviationstack-level errors embedded in a 200 response
    if (response.data?.error) {
      const errCode = response.data.error.code as string | undefined;

      // Free plan doesn't support flight_date — retry without it
      if (flightDate && errCode === 'function_access_restricted') {
        console.warn(
          '[checkFlightStatus] Plan does not support flight_date. Retrying without it.',
          { flightNumber: normalizedFlight, flightDate }
        );
        return checkFlightStatus(normalizedFlight, ''); // retry sans date
      }

      throw new Error(
        response.data.error.info ||
          response.data.error.message ||
          'Aviationstack API error'
      );
    }

    const flights: FlightData[] = response.data?.data ?? [];

    if (!flights.length) return null;

    // Filter by flight_date when provided (YYYY-MM-DD match)
    const match = flightDate
      ? flights.find((f) => f.flight_date === flightDate) ?? flights[0]
      : flights[0];

    return buildFlightStatusResult(normalizedFlight, match);
  } catch (error) {
    // Free plan restriction raised as an axios error — retry without date
    if (
      flightDate &&
      axios.isAxiosError(error) &&
      error.response?.data?.error?.code === 'function_access_restricted'
    ) {
      console.warn(
        '[checkFlightStatus] Caught plan restriction. Retrying without flight_date.',
        { flightNumber: normalizedFlight, flightDate }
      );
      return checkFlightStatus(normalizedFlight, '');
    }

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
  const trimmed = iso.trim();
  if (!trimmed) return NaN;

  // ── (a) offset already present ────────────────────────────────────────────
  if (/[+-]\d{2}:\d{2}$/.test(trimmed) || trimmed.endsWith('Z')) {
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
  data: FlightData
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
    flightDate: data.flight_date,
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

    for (const trip of activeTrips) {
      try {
        const flightData = await checkFlightStatus(trip.flightNumber, trip.departureDate);
        if (!flightData) continue;

        const isDelayed = flightData.status === 'delayed' || flightData.status === 'active_delayed' || flightData.delayMinutes > 15;
        const isCancelled = flightData.status === 'cancelled';

        if (isDelayed || isCancelled) {
          const priority = isCancelled ? 'CRITICAL' : 'HIGH';
          const eventType = isCancelled ? 'CANCELLATION' : 'DELAY';
          const message = isCancelled 
            ? `Flight ${flightData.flightNumber} (${flightData.airline.name}) has been cancelled.` 
            : `Flight ${flightData.flightNumber} (${flightData.airline.name}) is delayed by ${flightData.delayMinutes} minutes.`;

          // Ensure we don't spam the same alert. For simplicity, we create a new alert,
          // but a better approach would be to check if an identical unread alert exists.
          const existingAlerts = await AlertModel.find({ 
            userId: trip.userId, 
            flightCode: flightData.flightNumber, 
            eventType: eventType 
          }).sort({ createdAt: -1 }).limit(1);

          let shouldCreate = true;
          if (existingAlerts.length > 0) {
            // Check if we already alerted about this specific flight delay today
            const lastAlert = existingAlerts[0];
            const hoursSinceLastAlert = (Date.now() - new Date(lastAlert.createdAt).getTime()) / (1000 * 60 * 60);
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

            // Send Push Notification via FCM
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
      } catch (err) {
        console.error(`[monitorFlightsAndCreateAlerts] Failed to process trip ${trip.id}:`, err);
      }
    }
    console.log('[monitorFlightsAndCreateAlerts] Completed Sentinel cron job.');
  } catch (error) {
    console.error('[monitorFlightsAndCreateAlerts] Cron job failed:', error);
  }
};
