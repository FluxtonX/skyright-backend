import { Request, Response } from 'express';
import { checkFlightStatus } from '../services/flightService';

/**
 * @desc  Get real-time flight status from Aviationstack
 * @route GET /api/flights/status?flightNumber=EK203&flightDate=2026-06-18
 * @access Public (no auth required so the Flutter app can poll freely)
 *
 * Query params:
 *   flightNumber  — IATA flight code, e.g. "EK203"  (required)
 *   flightDate    — Date string YYYY-MM-DD           (optional, recommended)
 */
export const getFlightStatus = async (req: Request, res: Response) => {
  try {
    const flightNumber = ((req.query.flightNumber as string) || '').trim().toUpperCase();
    const flightDate   = ((req.query.flightDate   as string) || '').trim();

    // ── Validation ────────────────────────────────────────────────────────
    if (!flightNumber) {
      return res.status(400).json({
        message: 'flightNumber query parameter is required (e.g. ?flightNumber=EK203)',
      });
    }

    if (flightDate && !/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
      return res.status(400).json({
        message: 'flightDate must be in YYYY-MM-DD format (e.g. ?flightDate=2026-06-18)',
      });
    }

    // ── Service call ──────────────────────────────────────────────────────
    const result = await checkFlightStatus(flightNumber, flightDate);

    if (!result) {
      return res.status(404).json({
        message: `No flight data found for ${flightNumber}${flightDate ? ` on ${flightDate}` : ''}. ` +
          'Check the flight number or try without a date.',
      });
    }

    return res.json(result);
  } catch (error: any) {
    const message: string = error?.message ?? 'Unknown error fetching flight status';

    // Surface provider errors vs generic server errors
    const isProviderError =
      message.toLowerCase().includes('aviationstack') ||
      message.toLowerCase().includes('rejected the request');

    return res.status(isProviderError ? 503 : 500).json({ message });
  }
};
