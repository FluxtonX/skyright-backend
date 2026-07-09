import { Request, Response } from 'express';
import { checkFlightStatus, getLiveFlightPosition } from '../services/flightService';
import { AuthRequest } from '../middlewares/authMiddleware';
import AlertModel from '../models/alertModel';
import admin from '../config/firebase';
import { getUserProfileByFirebaseId } from '../services/userProfileService';

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

/**
 * @desc  Manually trigger a flight alert to test FCM push notifications
 * @route POST /api/flights/mock-alert
 * @access Private
 */
export const triggerMockFlightAlert = async (req: AuthRequest, res: Response) => {
  try {
    // For local QA, allow passing userId in body if protect middleware is bypassed
    const targetUserId = req.user?.firebaseId || req.body.userId;
    if (!targetUserId) {
      return res.status(401).json({ message: 'Not authorized: Must provide a Bearer token or pass "userId" in the request body for local QA testing.' });
    }

    const flightNumber = req.body.flightNumber || 'TEST123';
    const delayMinutes = req.body.delayMinutes || 60;
    const isCancelled = req.body.isCancelled || false;
    
    const priority = isCancelled ? 'CRITICAL' : 'HIGH';
    const eventType = isCancelled ? 'CANCELLATION' : 'DELAY';
    const message = isCancelled
      ? `Flight ${flightNumber} (Mock Airline) has been cancelled.`
      : `Flight ${flightNumber} (Mock Airline) is delayed by ${delayMinutes} minutes.`;

    // 1. Create alert in DB
    await AlertModel.create({
      userId: targetUserId,
      flightCode: flightNumber,
      airline: 'Mock Airline',
      priority: priority,
      eventType: eventType,
      message: message,
      isRead: false,
      source: 'Mock QA Trigger',
    });

    // 2. Send Push Notification via FCM
    let notificationSent: boolean | string = false;
    const userProfile = await getUserProfileByFirebaseId(targetUserId);
    
    // Check if user passed a token manually for testing, otherwise use DB token
    const targetToken = req.body.fcmTokenOverride || userProfile?.fcmToken;
    
    if (targetToken) {
      const payload = {
        token: targetToken,
        notification: {
          title: `Flight Alert: ${flightNumber} ${isCancelled ? 'Cancelled' : 'Delayed'}`,
          body: message,
        },
        data: {
          flightNumber: flightNumber,
          eventType: eventType,
        },
      };
      
      try {
        await admin.messaging().send(payload);
        notificationSent = true;
        console.log(`[QA Test] Sent actual FCM push notification to token ${targetToken.substring(0, 15)}...`);
      } catch (err: any) {
        console.error(`[QA Test] Failed to send actual FCM: ${err.message}`);
        notificationSent = "failed";
      }
    } else {
      console.warn(`[QA Test] No FCM token found. Bypassing FCM send and mocking success for QA report.`);
      notificationSent = "mocked_success (No Token)";
    }

    res.json({ 
      message: 'Mock flight alert triggered successfully.', 
      notificationSent,
      fcmTokenUsed: targetToken || 'NONE_MOCKED',
      alertDetails: { flightNumber, delayMinutes, isCancelled }
    });
  } catch (error: any) {
    console.error('[QA Test] Trigger mock alert error:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc  Get real-time live position (lat/lng/speed/altitude) of a flight
 * @route GET /api/flights/live-position?flightNumber=SV727&flightDate=2026-07-09
 * @access Public
 */
export const getLivePosition = async (req: Request, res: Response) => {
  try {
    const flightNumber = ((req.query.flightNumber as string) || '').trim().toUpperCase();
    const flightDate   = ((req.query.flightDate   as string) || '').trim();

    if (!flightNumber) {
      return res.status(400).json({
        message: 'flightNumber query parameter is required (e.g. ?flightNumber=SV727)',
      });
    }

    const result = await getLiveFlightPosition(flightNumber, flightDate || undefined);

    if (!result) {
      return res.status(404).json({
        message: `No flight data found for ${flightNumber}${flightDate ? ` on ${flightDate}` : ''}.`,
      });
    }

    return res.json(result);
  } catch (error: any) {
    const message: string = error?.message ?? 'Unknown error fetching live position';
    const isProviderError =
      message.toLowerCase().includes('aviationstack') ||
      message.toLowerCase().includes('rejected the request');

    return res.status(isProviderError ? 503 : 500).json({ message });
  }
};
