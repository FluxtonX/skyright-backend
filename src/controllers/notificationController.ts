import { Response } from 'express';
import admin from '../config/firebase';
import { AuthRequest } from '../middlewares/authMiddleware';

const db = admin.firestore();

// @desc    Register/update a Firebase Cloud Messaging device token
// @route   POST /api/notifications/devices
export const registerDeviceToken = async (req: AuthRequest, res: Response) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Device token is required' });
    }

    const docId = `${req.user.firebaseId}_${token}`;
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('notificationDevices').doc(docId).set(
      {
        userId: req.user.firebaseId,
        token,
        platform: platform || 'unknown',
        active: true,
        lastSeenAt: now,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true }
    );

    res.status(201).json({ message: 'Device token registered' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove/deactivate a Firebase Cloud Messaging device token
// @route   DELETE /api/notifications/devices
export const unregisterDeviceToken = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Device token is required' });
    }

    const docId = `${req.user.firebaseId}_${token}`;
    await db.collection('notificationDevices').doc(docId).set(
      {
        active: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.json({ message: 'Device token unregistered' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List current user's registered devices
// @route   GET /api/notifications/devices
export const getDeviceTokens = async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await db
      .collection('notificationDevices')
      .where('userId', '==', req.user.firebaseId)
      .where('active', '==', true)
      .get();

    res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
