import express from 'express';
import { getFlightStatus, triggerMockFlightAlert, getLivePosition } from '../controllers/flightController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

/**
 * GET /api/flights/status?flightNumber=EK203&flightDate=2026-06-18
 *
 * Returns:
 * {
 *   flightNumber: "EK203",
 *   flightDate:   "2026-06-18",
 *   status:       "active" | "scheduled" | "delayed" | "cancelled" | "landed",
 *   delayMinutes: 0,
 *   departure:    { airport, iata, terminal, gate, scheduled, estimated },
 *   arrival:      { airport, iata, terminal, gate, scheduled, estimated },
 *   airline:      { name, iata }
 * }
 */
router.get('/status', getFlightStatus);
router.get('/live-position', getLivePosition);

// QA Test Endpoint
router.post('/mock-alert', triggerMockFlightAlert);

export default router;
