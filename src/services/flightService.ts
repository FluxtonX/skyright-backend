import axios from 'axios';
import dotenv from 'dotenv';

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
    actual: string;         // set once the flight has actually landed
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

// ── Delay threshold ───────────────────────────────────────────────────────────
// A delay must exceed this many minutes before we consider it "significant"
// and override the raw Aviationstack status.
const SIGNIFICANT_DELAY_MINUTES = 15;

/**
 * resolveEstimatedLanding
 *
 * Aviationstack can be slow to flip a flight from "active" → "landed".
 * We compare the current UTC wall-clock time against the best available
 * arrival time (actual > estimated > scheduled) and, when now is past that
 * time, mark the flight as "landed_estimated" so the frontend mirrors
 * Flightradar24 behaviour.
 *
 * Priority order for the reference arrival time:
 *   1. arrival.actual     — most accurate, set once wheels are down
 *   2. arrival.estimated  — gate estimate, updated during flight
 *   3. arrival.scheduled  — original schedule
 *
 * The arrival.timezone (IANA string) is used ONLY as a fallback when the
 * ISO timestamp has no embedded UTC offset.  Modern Aviationstack responses
 * always include the offset, so the Intl path is rarely hit in practice.
 *
 * Only overrides statuses that imply the flight is still airborne:
 *   active | active_delayed | scheduled | delayed
 */
const resolveEstimatedLanding = (
  rawStatus: string,
  arrivalData: FlightData['arrival']
): string | null => {
  const status = rawStatus.toLowerCase();

  // Only consider statuses where the aircraft could still be airborne
  const candidateStatuses = new Set(['active', 'active_delayed', 'scheduled', 'delayed']);
  if (!candidateStatuses.has(status)) return null;

  // Pick the best arrival timestamp (most → least accurate)
  const arrivalIso =
    arrivalData?.actual?.trim() ||
    arrivalData?.estimated?.trim() ||
    arrivalData?.scheduled?.trim();

  if (!arrivalIso) return null;

  // Parse: ISO strings with an embedded UTC offset (e.g. "+05:30") are
  // handled directly by Date.parse().  When the string is offset-naive we
  // fall back to interpreting it in the destination timezone via Intl.
  let arrivalUtcMs: number;

  const hasOffset = /[+-]\d{2}:\d{2}$/.test(arrivalIso) || arrivalIso.endsWith('Z');

  if (hasOffset) {
    arrivalUtcMs = Date.parse(arrivalIso);
  } else {
    // No UTC offset — interpret the local time in the destination timezone
    const tz = arrivalData?.timezone;
    if (!tz) {
      // No timezone info at all: fall back to treating it as UTC
      arrivalUtcMs = Date.parse(arrivalIso + 'Z');
    } else {
      try {
        // Use Intl to find the UTC offset at that moment in the destination tz
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        }).formatToParts(new Date(arrivalIso + 'Z'));

        const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
        const localDateStr =
          `${get('year')}-${get('month')}-${get('day')}` +
          `T${get('hour')}:${get('minute')}:${get('second')}`;

        // Offset = UTC interpreted time  − local interpreted time
        const utcMs   = Date.parse(arrivalIso + 'Z');
        const localMs = Date.parse(localDateStr + 'Z');
        const offsetMs = utcMs - localMs;

        arrivalUtcMs = Date.parse(arrivalIso + 'Z') + offsetMs;
      } catch {
        // Malformed timezone string — treat as UTC
        arrivalUtcMs = Date.parse(arrivalIso + 'Z');
      }
    }
  }

  if (isNaN(arrivalUtcMs)) return null;

  const nowMs = Date.now();

  if (nowMs > arrivalUtcMs) {
    console.log(
      `[resolveEstimatedLanding] Overriding "${rawStatus}" → "landed_estimated"`,
      { arrivalIso, nowUtc: new Date(nowMs).toISOString() }
    );
    return 'landed_estimated';
  }

  return null; // not past arrival time yet — leave status unchanged
};

/**
 * resolveFlightStatus
 *
 * Applies all business-rule overrides in priority order:
 *
 *  Priority | Condition                                     | Result
 * ----------|-----------------------------------------------|------------------
 *  1 (high) | now > best arrival time & airborne status     | "landed_estimated"
 *  2        | active/scheduled + departure.delay > 15 min   | "active_delayed" / "delayed"
 *  3 (low)  | none of the above                             | raw status (unchanged)
 */
const resolveFlightStatus = (
  rawStatus: string,
  delayMinutes: number,
  arrivalData: FlightData['arrival']
): string => {
  // ── Priority 1: estimated landing ───────────────────────────────────────
  const landedEstimated = resolveEstimatedLanding(rawStatus, arrivalData);
  if (landedEstimated) return landedEstimated;

  // ── Priority 2: significant departure delay ──────────────────────────────
  const status = rawStatus.toLowerCase();
  const hasSignificantDelay = delayMinutes > SIGNIFICANT_DELAY_MINUTES;

  if (hasSignificantDelay) {
    if (status === 'active')    return 'active_delayed'; // airborne but late
    if (status === 'scheduled') return 'delayed';        // not departed yet
  }

  // ── Priority 3: pass through unchanged ──────────────────────────────────
  return rawStatus;
};

// ── Helper: map a raw FlightData into a clean FlightStatusResult ────────────
const buildFlightStatusResult = (
  flightNumber: string,
  data: FlightData
): FlightStatusResult => {
  const delayMinutes = data.departure?.delay ?? 0;

  // Pass arrival data so resolveFlightStatus can run the landing-time check
  const resolvedStatus = resolveFlightStatus(
    data.flight_status,
    delayMinutes,
    data.arrival
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
