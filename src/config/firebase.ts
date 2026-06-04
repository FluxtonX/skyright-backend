import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

try {
  const appOptions: admin.AppOptions = {
    credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  };

  if (process.env.FIREBASE_STORAGE_BUCKET) {
    appOptions.storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  }

  admin.initializeApp(appOptions);
  console.log('Firebase Admin Initialized');
} catch (error) {
  console.warn('Firebase Admin initialization failed. Make sure serviceAccountKey.json is present for production.');
}

export default admin;
