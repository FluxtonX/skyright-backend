# Auth & Profile API

These APIs are for the Flutter app to integrate after the user signs in with Firebase Auth.

All private requests require:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

## Environment Required

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

Current local setup:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=skyright-e686f.appspot.com
```

## API Endpoints

| Endpoint | Method | Body / Form Data | Purpose |
|---|---|---|---|
| `/api/auth/sync` | POST | none | Creates/updates Firestore user profile from Firebase token and returns profile |
| `/api/auth/profile` | GET | none | Returns current user's profile |
| `/api/auth/profile` | PUT | JSON: `displayName`, `phoneNumber`, optional `photoURL` | Updates editable profile fields |
| `/api/auth/profile/role` | PATCH | JSON: `role` | Sets onboarding/profile role |
| `/api/auth/profile/notifications` | PATCH | JSON: `notificationsEnabled` | Toggles push notification preference |
| `/api/auth/profile/photo` | POST | `multipart/form-data`, field name `photo` | Uploads profile photo to Firebase Storage |
| `/api/auth/profile/photo` | DELETE | none | Deletes profile photo from Firebase Storage |
| `/api/auth/account` | DELETE | none | Deletes Firebase user, Firestore profile, and owned app data |

## Role Values Accepted

```json
["Traveler", "User", "Travel Agency", "Corporate Travel Desk", "Corporate"]
```

Backend maps:

- `Traveler` -> `User`
- `Corporate Travel Desk` -> `Corporate`

`Admin` is intentionally not accepted from mobile profile APIs.

## Firestore Collections

The auth/profile APIs use Firebase services only:

- Firebase Auth verifies identity.
- Firestore stores profile records in `users/{firebaseUid}`.
- Firebase Storage stores profile photos in `profile-photos/{firebaseUid}/...`.

## Related Custom APIs Added

These do not require third-party API access now:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/onboarding` | PATCH | Complete onboarding with role/preferences |
| `/api/auth/onboarding` | GET | Read onboarding completion state for splash/onboarding flow |
| `/api/auth/profile/stats` | GET | Profile counts for trips, cases, vault docs, academy, concierge |
| `/api/auth/profile/settings` | GET | Read settings and alert preferences for profile/settings screen |
| `/api/auth/profile/settings` | PATCH | Update language/currency/marketing/settings and alert preferences |
| `/api/notifications/devices` | GET | List active FCM device tokens |
| `/api/notifications/devices` | POST | Register/update FCM device token |
| `/api/notifications/devices` | DELETE | Deactivate FCM device token |
| `/api/dashboard/activity` | GET | Dashboard recent activity feed |
| `/api/dashboard/modules` | GET | Module lock/unlock status by plan |
| `/api/alerts/watch-flight` | POST | Start watching flight for alerts |
| `/api/alerts/generate-test` | POST | Generate frontend QA test alerts |
| `/api/alerts/read-all` | PATCH | Mark all alerts read |
| `/api/alerts/:id` | DELETE | Delete alert |
| `/api/vault` | POST multipart `file` | Upload Vault document to Firebase Storage and save Firestore metadata |
| `/api/claims/requirements` | GET | Claim required document checklist |
| `/api/claims/from-alert/:alertId` | POST | Create claim from Sentinel alert |
| `/api/claims/from-vault/:documentId` | POST | Create claim from Vault document |
| `/api/claims/:id/submit` | POST | Final claim workflow submit |
| `/api/claims/:id/documents` | POST multipart `file` | Upload claim document to Firebase Storage |
| `/api/claims/:id/documents/:documentId` | DELETE | Delete claim document |
| `/api/expenses/:id` | PATCH | Edit expense |
| `/api/expenses/:id` | DELETE | Delete expense |
| `/api/expenses/:id/receipt` | POST multipart `file` | Upload receipt and attach OCR metadata placeholder |
| `/api/plus/baggage/item/:id` | GET | Baggage detail |
| `/api/plus/baggage/item/:id` | PATCH | Edit baggage |
| `/api/plus/baggage/item/:id` | DELETE | Delete baggage |
| `/api/guard/analyze` | POST | TicketGuard analysis shell using manual/flight data |
| `/api/intelligence/claims/:id/draft-follow-up` | POST | Generate claim follow-up draft without sending email |
| `/api/trips/:id` | PATCH | Edit trip |
| `/api/trips/:id` | DELETE | Delete trip |
| `/api/trips/:id/share` | POST | Generate Trip Visualizer share link/token |
| `/api/alerts/preferences` | GET | Read alert-specific notification preferences |
| `/api/alerts/preferences` | PATCH | Update alert-specific notification preferences |
| `/api/plus/compliance/checklist` | GET | Read saved BorderReady checklist for route/trip |
| `/api/plus/compliance/checklist` | PUT | Save BorderReady checklist progress |
| `/api/claims/estimate` | POST | Estimate claim eligibility/amount from provided disruption facts |
| `/api/claims/:id/escalate` | POST | Escalate an active claim |
| `/api/claims/:id/evidence-packet` | GET | Return claim evidence packet metadata |
| `/api/guard/:id/start-claim` | POST | Create a claim from TicketGuard analysis |
| `/api/trips/:id/insights` | GET | Trip Visualizer risk summary and legend |
| `/api/trips/:id/live-status` | GET | Live tracking state for trip |
| `/api/trips/:id/track-live` | POST | Enable/update trip live tracking |
| `/api/academy/classes` | GET | List Academy classes with user progress |
| `/api/academy/progress` | GET | List current user's Academy progress |
| `/api/academy/classes/:id/progress` | PUT | Save Academy class progress |
| `/api/concierge/status` | GET | Concierge Pass status for profile/pricing cards |
| `/api/concierge/request` | POST | Create Concierge support request |
| `/api/support/requests` | GET | List user support/sales/concierge requests |
| `/api/support/requests` | POST | Create generic support request |
| `/api/sales/demo-request` | POST | Capture pricing/enterprise demo CTA |
| `/api/sales/contact` | POST | Capture sales contact CTA |

## Profile Response

```json
{
  "id": "firebase_uid",
  "firebaseId": "firebase_uid",
  "email": "user@example.com",
  "phoneNumber": "+2348012345678",
  "displayName": "Rahmat Ullah",
  "photoURL": "https://storage.googleapis.com/...",
  "role": "User",
  "plan": "Free",
  "tenantId": null,
  "managedByTenant": false,
  "notificationsEnabled": true,
  "createdAt": "2026-06-03T00:00:00.000Z",
  "onboardingCompleted": true,
  "settings": {},
  "alertPreferences": {},
  "updatedAt": "2026-06-03T00:00:00.000Z"
}
```

## Profile Photo Upload Example

```http
POST /api/auth/profile/photo
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: multipart/form-data

photo=<image file>
```

Rules:

- Field name must be `photo`.
- Only image MIME types are accepted.
- Max upload size is 5 MB.
- Backend uploads to Firebase Storage under `profile-photos/<firebaseUid>/...`.
