# 🚀 SkyRight API Documentation

Welcome to the SkyRight Backend API documentation. This guide is designed to help Flutter developers integrate the mobile app with the backend services.

## 🔑 Authentication
All private routes require a **Firebase ID Token** passed in the Authorization header.
**Header:** `Authorization: Bearer <FIREBASE_ID_TOKEN>`

---

## 👤 User & Profile
### 1. Get Profile
Fetch the current logged-in user's profile details.
- **Endpoint:** `GET /api/auth/profile`
- **Access:** Private
- **Response (200 OK):**
```json
{
  "_id": "60d...",
  "firebaseId": "uid_123",
  "email": "user@example.com",
  "displayName": "Rahmat Ullah",
  "role": "User",
  "plan": "Free",
  "notificationsEnabled": true
}
```

### 2. Update Profile
Update user settings or profile details.
- **Endpoint:** `PUT /api/auth/profile`
- **Access:** Private
- **Body:**
```json
{
  "displayName": "New Name",
  "notificationsEnabled": false,
  "role": "Travel Agency"
}
```

---

## 📊 Dashboard
### 1. Get Summary
Fetch aggregated data for the dashboard summary cards.
- **Endpoint:** `GET /api/dashboard/summary`
- **Access:** Private
- **Response (200 OK):**
```json
{
  "alertsCount": 3,
  "casesCount": 2,
  "totalSavings": "₦2,400,000"
}
```

---

## ✈️ Flight Monitoring (Sentinel)
### 1. Get Flight Disruption Status
Check if a specific flight has any active disruptions (Delays/Cancellations).
- **Endpoint:** `GET /api/issues/flight/:iata`
- **Access:** Private
- **Response (200 OK):**
```json
{
  "flight": { "flight_status": "active", "departure": { "delay": 120 } },
  "activeIssue": {
    "type": "HIGH",
    "title": "2 Hour Delay",
    "description": "Departure delayed from ... to ...",
    "rights": "Refreshments + compensation up to ₦30,000."
  }
}
```

---

## 🔔 Alerts
### 1. Get All Alerts
Fetch all disruptions and notifications for the user.
- **Endpoint:** `GET /api/alerts`
- **Access:** Private
- **Response (200 OK):**
```json
[
  {
    "_id": "60d...",
    "flightCode": "W3 205",
    "priority": "CRITICAL",
    "eventType": "Flight Cancelled",
    "isRead": false
  }
]
```

### 2. Mark Alert as Read
- **Endpoint:** `PATCH /api/alerts/:id/read`
- **Access:** Private

---

## 📂 Document Vault
### 1. Upload Document & Process OCR
Upload a document and automatically extract metadata via OCR.
- **Endpoint:** `POST /api/vault/upload`
- **Access:** Private
- **Body:**
```json
{
  "name": "My Passport",
  "type": "Passport",
  "fileUrl": "https://storage.link/file.jpg"
}
```

### 2. Get All Documents
- **Endpoint:** `GET /api/vault`
- **Access:** Private

### 3. Delete Document
- **Endpoint:** `DELETE /api/vault/:id`
- **Access:** Private

---

## ⚖️ Claims (ResolveFlow)
### 1. Submit New Claim
Start a compensation claim process.
- **Endpoint:** `POST /api/claims`
- **Access:** Private
- **Body:**
```json
{
  "flightCode": "W3 205",
  "airline": "Air Peace",
  "disruptionType": "Flight Cancellation"
}
```

### 2. Get User Claims
Fetch all active and completed claims.
- **Endpoint:** `GET /api/claims`
- **Access:** Private

### 3. Update Claim Progress
Update the current step or status of a claim.
- **Endpoint:** `PATCH /api/claims/:id`
- **Access:** Private
- **Body:**
```json
{
  "currentStep": 3,
  "status": "IN PROGRESS",
  "compensationAmount": "₦45,000"
}
```

---

## 💳 Payments & Subscriptions (Traveler Plus)
### 1. Start Subscription
Initialize a payment for upgrading to the Plus plan.
- **Endpoint:** `POST /api/payments/subscribe`
- **Access:** Private
- **Response (200 OK):**
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "reference": "ref_123..."
}
```

### 2. Verify Payment
Manually verify a transaction after the user returns from the payment gateway.
- **Endpoint:** `POST /api/payments/verify`
- **Access:** Private
- **Body:**
```json
{
  "reference": "ref_123..."
}
```

### 3. Webhook (Internal)
Automatic upgrade on payment success.
- **Endpoint:** `POST /api/payments/webhook`
- **Access:** Public (Paystack)

---

## 🔍 Search
### 1. Global Search
Search for cases (claims) and live flight data simultaneously.
- **Endpoint:** `GET /api/search?query=W3205`
- **Access:** Private
- **Response (200 OK):**
```json
{
  "results": {
    "claims": [...],
    "flight": [...]
  }
}
```

