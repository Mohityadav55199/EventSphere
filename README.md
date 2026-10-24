# EventSphere 🎉
### Production-Grade Full-Stack Event Discovery, Concurrency Ticketing & Community Platform

[![Build & Tests](https://github.com/Mohityadav55199/EventSphere/actions/workflows/ci.yml/badge.svg)](https://github.com/Mohityadav55199/EventSphere/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](https://opensource.org/licenses/MIT)
[![Production Ready](https://img.shields.io/badge/Status-Complete%20%26%20Production%20Ready-emerald.svg)](#)

> **Live Application**: [https://event-sphere-lemon-nu.vercel.app](https://event-sphere-lemon-nu.vercel.app)  
> **Production API Gateway**: [https://eventsphere-backend-zfcj.onrender.com](https://eventsphere-backend-zfcj.onrender.com)

EventSphere is an enterprise-grade full-stack event discovery, reservation, and community ticketing system built to replicate high-concurrency architectures (such as BookMyShow and Eventbrite). It features a multi-tiered seat reservation lifecycle with Redis distributed holds, dual payment gateways (Stripe & Razorpay) with interactive sandbox simulator, failure-isolated batch refunds, vector-rendered HMAC cryptographic QR ticket passes, server-side full-text search with MongoDB compound indexes, and real-time attendee community chat via WebSockets.

---

## 🏗️ System Architecture & Engineering Highlights

```
                                      ┌──────────────────────────────────────────┐
                                      │        React 19 + Vite Frontend          │
                                      │   (Redux Toolkit, Tailwind v4, Axios)    │
                                      └────────────────────┬─────────────────────┘
                                                           │
                                        HTTPS REST & WSS   │   JWT Auth + Interceptors
                                                           ▼
                                      ┌──────────────────────────────────────────┐
                                      │         Express 5.x API Gateway          │
                                      │   (Helmet, Rate Limits, Error Handlers)  │
                                      └─────────────┬──────────────┬─────────────┘
                                                    │              │
                     ┌──────────────────────────────┘              └─────────────────────────────┐
                     ▼                                                                           ▼
       ┌───────────────────────────┐                                               ┌───────────────────────────┐
       │   MongoDB Atlas Cluster   │                                               │    Upstash Redis Cache    │
       │  - Booking & Event Models │                                               │  - Live 10-Min Seat Holds │
       │  - Compound Query Indexes │                                               │  - In-Memory Fallback     │
       │  - Full-Text Search Index │                                               │  - Real-Time Seat Sync    │
       └───────────────────────────┘                                               └───────────────────────────┘
```

---

## 🚀 Key Features & Capabilities

### 1. 🎟️ High-Concurrency Seat Hold & Concurrency Control
- **Problem**: Popular event launches trigger traffic spikes where multiple concurrent requests attempt to purchase the exact same seat.
- **Solution**: Multi-layer distributed reservation architecture:
  1. **Layer 1 (Hold Phase)**: When an attendee selects a seat, seats are reserved in Upstash Redis with a 10-minute TTL. The API features a connectivity probe with an automatic in-memory fallback adapter for extreme resilience.
  2. **Layer 2 (Atomic Decrement)**: Upon payment verification, seat reservations transition to permanent MongoDB documents via atomic updates.
  3. **Layer 3 (WebSocket Broadcast)**: Concurrent users instantly see held seats update in real time via Socket.io without polling.
  4. **Auto-Reconciliation Cron Job**: A scheduled background job (`node-cron`) inspects expired holds every minute and automatically frees abandoned seats.

### 2. 💳 Multi-Gateway Checkout & Interactive Sandbox Simulator
- **Dual Payment Gateways**: Native support for **Stripe** (Cards, Apple Pay, Google Pay) and **Razorpay** (UPI, PhonePe, GPay, NetBanking).
- **Interactive Sandbox Demo Gateway**: When operating in demo/preview mode or when keys are unconfigured, EventSphere presents an interactive modal requiring explicit user confirmation before simulating payments.
- **Dynamic Price Breakdown**: Real-time pricing engine that computes base price, promo code discounts (`-₹couponDiscount`), and wallet cashback points (`-₹pointsDiscount`), dynamically switching the action to `Confirm Free Reservation` when 100% covered.
- **Failure-Isolated Batch Refunds**: Organizer event cancellations execute refunds per booking independently with structured error isolation. One user's banking failure never aborts remaining refunds.

### 3. 🎫 Vector PDF Admission Passes with Cryptographic HMAC QR
- **Direct Vector PDF Generation**: Replaced fragile DOM screen-scraping with native `jsPDF` vector generation (`src/utils/ticketPdf.js`). Generates crisp, high-resolution admission passes without stylesheet conflicts or modern CSS color crashes.
- **Cryptographic Offline Verification**: Each ticket embeds an HMAC-SHA256 signature generated over `bookingId:secret`. Event organizers can scan tickets offline via the in-app QR scanner to verify validity instantly.
- **Calendar & Pass Integration**: 1-click Google Calendar event sync and instant PDF download directly from the user profile.

### 4. 🎨 Organizer Studio & Modern Glassmorphic UI
- **Redesigned Event Creator**: Modern, responsive form with sections for General Details, Date & Location (with Google Maps venue link validation), Ticketing & Capacity, and drag-and-drop poster upload with live thumbnail preview.
- **Independent Search Architecture**: Header navigation search and lower event filter inputs operate with isolated state, preventing race conditions or premature "No matching events" popups.
- **Universal Dark & Light Themes**: Cohesive HSL/Tailwind tokens with smooth theme switching and persistent preferences.

### 5. 🔍 Database Performance & Security Hardening
- **MongoDB Compound & Text Indexes**:
  - `Booking`: `{ user: 1, createdAt: -1 }`, `{ status: 1, holdExpiresAt: 1 }`, and `{ event: 1, status: 1 }`.
  - `Event`: `{ activeStatus: 1, date: 1 }`, `{ organizer: 1 }`, and full-text index on `{ title: "text", description: "text", location: "text" }`.
- **JWT Authentication with Silent Refresh**: Short-lived access tokens paired with `httpOnly` refresh tokens and shared-promise Axios interceptors that prevent redundant refresh calls.
- **Security Headers & Audit Trails**: Hardened with `helmet`, IP rate limiting on authentication and checkout endpoints, proxy trust (`app.set("trust proxy", 1)`), and failed login logging.

---

## 🛠️ Complete Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, Redux Toolkit, React Router v7, Framer Motion, Lucide Icons, Axios, Socket.io-client |
| **Backend** | Node.js 20, Express 5, MongoDB Atlas, Mongoose 8, Upstash Redis REST, ioredis, Socket.io, Node-cron |
| **Payments** | Stripe SDK, Razorpay SDK, Interactive Sandbox Simulator |
| **Documents & Media** | jsPDF (Vector PDF Tickets), Cloudinary (Image CDN), Multer, qrcode (HMAC QR codes) |
| **Quality & CI/CD** | Node `--test` runner, ESLint (0 errors, 0 warnings), GitHub Actions |

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/eventsphere
ACCESS_TOKEN_SECRET=your_super_secret_access_key_64_chars
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_64_chars
REFRESH_TOKEN_EXPIRY=10d
CLIENT_URL=http://localhost:5173

# Optional Integrations
STRIPE_SECRET_KEY=sk_test_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
QR_SECRET=your_ticket_hmac_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Frontend (`.env`)

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

---

## 🧪 Testing & Quality Verification

EventSphere includes an automated unit test suite verifying security, token refresh, seat hold expiry, HMAC signing, and refund isolation:

```bash
# Run backend test suite
cd backend
npm test
```

### Test Suite Summary:
```
✔ missing token is 401
✔ expired token is 401 so the client refreshes instead of seeing 403
✔ tampered token is 401
✔ valid token attaches the user
✔ HMAC ticket QR code generation and verification
✔ seat hold expiry condition identifies abandoned checkouts
✔ booking pricing accurately calculates seat count and tiered pricing
✔ one failed refund does not stop the other bookings from being cancelled
✔ only the organizer can cancel their event
✔ register rejects self-signup as admin
✔ register accepts organizer and normalizes email
✔ register rejects short password and bad email
✔ login requires email and password
✔ createEvent coerces multipart string fields
✔ idParam rejects non-ObjectId values
✔ validate middleware forwards a 400 ApiError and replaces body on success

ℹ pass 16 | fail 0 | duration ~1.3s
```

```bash
# Verify frontend build & linting
npm run lint    # 0 errors, 0 warnings
npm run build   # Production bundle built in ~18s
```

---

## 🚀 Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Mohityadav55199/EventSphere.git
   cd EventSphere
   ```

2. **Setup and launch backend**:
   ```bash
   cd backend
   npm install
   # Configure backend/.env
   npm run dev
   ```

3. **Setup and launch client**:
   ```bash
   # From project root
   npm install
   # Configure .env
   npm run dev
   ```

4. **Access the application**: Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
