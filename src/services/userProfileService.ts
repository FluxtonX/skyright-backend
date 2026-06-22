import admin from '../config/firebase';

export type UserRole = 'User' | 'Travel Agency' | 'Corporate' | 'Admin';
export type UserPlan = 'Free' | 'Plus' | 'Concierge Pass';

export interface UserProfile {
  id: string;
  _id: string;
  firebaseId: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  photoURL: string;
  photoStoragePath?: string;
  role: UserRole;
  plan: UserPlan;
  tenantId?: string | null;
  managedByTenant: boolean;
  notificationsEnabled: boolean;
  onboardingCompleted?: boolean;
  settings?: Record<string, any>;
  alertPreferences?: Record<string, any>;
  fcmToken?: string;
  lastLoginAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

const USERS_COLLECTION = 'users';
// Lazy getter — avoids crash when Firebase failed to initialize at startup
const getDb = () => admin.firestore();

const toDate = (value: any): Date | null => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  return value instanceof Date ? value : new Date(value);
};

const toProfile = (firebaseId: string, data: FirebaseFirestore.DocumentData): UserProfile => ({
  id: firebaseId,
  _id: firebaseId,
  firebaseId,
  email: data.email || '',
  phoneNumber: data.phoneNumber || '',
  displayName: data.displayName || '',
  photoURL: data.photoURL || '',
  photoStoragePath: data.photoStoragePath,
  role: data.role || 'User',
  plan: data.plan || 'Free',
  tenantId: data.tenantId || null,
  managedByTenant: data.managedByTenant || false,
  notificationsEnabled: data.notificationsEnabled !== false,
  onboardingCompleted: data.onboardingCompleted === true,
  settings: data.settings || {},
  alertPreferences: data.alertPreferences || {},
  fcmToken: data.fcmToken,
  lastLoginAt: toDate(data.lastLoginAt),
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

export const getUserProfileByFirebaseId = async (firebaseId: string): Promise<UserProfile | null> => {
  const snapshot = await getDb().collection(USERS_COLLECTION).doc(firebaseId).get();

  if (!snapshot.exists) {
    return null;
  }

  return toProfile(firebaseId, snapshot.data() || {});
};

export const upsertUserFromFirebaseToken = async (decodedToken: admin.auth.DecodedIdToken): Promise<UserProfile> => {
  const firebaseId = decodedToken.uid;
  const userRef = getDb().collection(USERS_COLLECTION).doc(firebaseId);
  const snapshot = await userRef.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!snapshot.exists) {
    await userRef.set({
      firebaseId,
      email: decodedToken.email || '',
      phoneNumber: decodedToken.phone_number || '',
      displayName: decodedToken.name || '',
      photoURL: decodedToken.picture || '',
      role: 'User',
      plan: 'Free',
      managedByTenant: false,
      notificationsEnabled: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await userRef.set(
      {
        email: decodedToken.email || snapshot.data()?.email || '',
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  const updatedSnapshot = await userRef.get();
  return toProfile(firebaseId, updatedSnapshot.data() || {});
};

export const updateUserProfileFields = async (
  firebaseId: string,
  updates: Partial<UserProfile> & Record<string, any>
): Promise<UserProfile | null> => {
  const userRef = getDb().collection(USERS_COLLECTION).doc(firebaseId);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    return null;
  }

  await userRef.set(
    {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const updatedSnapshot = await userRef.get();
  return toProfile(firebaseId, updatedSnapshot.data() || {});
};

export const deleteUserProfile = async (firebaseId: string) => {
  await getDb().collection(USERS_COLLECTION).doc(firebaseId).delete();
};

const deleteQueryBatch = async (query: FirebaseFirestore.Query) => {
  const snapshot = await query.limit(400).get();

  if (snapshot.empty) {
    return;
  }

  const batch = getDb().batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  if (snapshot.size === 400) {
    await deleteQueryBatch(query);
  }
};

export const deleteOwnedUserData = async (firebaseId: string) => {
  const ownedCollections = [
    'alerts',
    'baggage',
    'claims',
    'documents',
    'expenses',
    'guards',
    'trips',
  ];

  for (const collectionName of ownedCollections) {
    await deleteQueryBatch(getDb().collection(collectionName).where('userId', '==', firebaseId));
    await deleteQueryBatch(getDb().collection(collectionName).where('firebaseId', '==', firebaseId));
  }
};
