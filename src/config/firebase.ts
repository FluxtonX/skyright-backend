import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

try {
  admin.initializeApp({
    credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  });
  console.log('Firebase Admin Initialized');
} catch (error) {
  console.warn('Firebase Admin initialization failed. Make sure serviceAccountKey.json is present for production.');
}

export default admin;
