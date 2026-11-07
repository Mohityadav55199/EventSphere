# EventSphere 🎉
### Production-Grade Full-Stack Event Discovery, Concurrency Ticketing & Community Platform

[![Build & Tests](https://github.com/Mohityadav55199/EventSphere/actions/workflows/ci.yml/badge.svg)](https://github.com/Mohityadav55199/EventSphere/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](https://opensource.org/licenses/MIT)
[![Production Ready](https://img.shields.io/badge/Status-Complete%20%26%20Production%20Ready-emerald.svg)](#)

> **Live Application**: [https://event-sphere-lemon-nu.vercel.app](https://event-sphere-lemon-nu.vercel.app)  
> **Production API Gateway**: [https://eventsphere-backend-nhzy.onrender.com](https://eventsphere-backend-nhzy.onrender.com)

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
- **Interactive Sandbox Demo Gateway (development only)**: Outside production, unconfigured keys fall back to a simulated checkout. In production a missing or failing gateway fails the checkout and releases the seats, so a bad env var can never hand out free tickets.
- **Server-Side Payment Verification**: Prices, coupons, wallet points and seats are computed and stored when the order is created. `verify-payment` only receives the booking ID plus gateway proof (Stripe session fetched from Stripe, Razorpay HMAC signature) and ignores any price or discount sent by the browser.
- **Idempotent Stripe Webhooks**: `POST /api/v1/webhooks/stripe` verifies the signature over the raw body, claims each event ID in a unique-indexed collection (redeliveries are no-ops), and confirms tickets even if the user closes the tab. Late payments after a hold expires are refunded automatically.
- **Dynamic Price Breakdown**: Real-time pricing engine that computes base price, promo code discounts (`-₹couponDiscount`), and wallet cashback points (`-₹pointsDiscount`), dynamically switching the action to `Confirm Free Reservation` when 100% covered.
- **Failure-Isolated Batch Refunds**: Organizer event cancellations execute refunds per booking independently with structured error isolation. One user's banking failure never aborts remaining refunds.

### 3. 🎫 Vector PDF Admission Passes with Cryptographic HMAC QR
- **Direct Vector PDF Generation**: Replaced fragile DOM screen-scraping with native `jsPDF` vector generation (`src/utils/ticketPdf.js`). Generates crisp, high-resolution admission passes without stylesheet conflicts or modern CSS color crashes.
- **Cryptographic Offline Verification**: Each ticket embeds an HMAC-SHA256 signature generated over `bookingId:secret`. Event organizers can scan tickets offline via the in-app QR scanner to verify validity instantly.
- **Calendar & Pass Integration**: 1-click Google Calendar event sync and instant PDF download directly from the user profile.

### 4. 📊 Organizer Analytics (single aggregation query)
- `GET /api/v1/events/analytics/overview?days=30` returns totals, **revenue per day** (gaps zero-filled for the chart), revenue by ticket tier and per-event numbers from **one MongoDB `$facet` aggregation**. The dashboard used to send one request per event.
- Only the organizer's own events are counted (admins see all), and per-event analytics are now restricted to the event's organizer.

### 5. 🎨 Organizer Studio & Modern Glassmorphic UI
- **Redesigned Event Creator**: Modern, responsive form with sections for General Details, Date & Location (with Google Maps venue link validation), Ticketing & Capacity, and drag-and-drop poster upload with live thumbnail preview.
- **Independent Search Architecture**: Header navigation search and lower event filter inputs operate with isolated state, preventing race conditions or premature "No matching events" popups.
- **Universal Dark & Light Themes**: Cohesive HSL/Tailwind tokens with smooth theme switching and persistent preferences.

### 6. 🔍 Database Performance & Security Hardening
- **MongoDB Compound & Text Indexes**:
  - `Booking`: `{ user: 1, createdAt: -1 }`, `{ status: 1, holdExpiresAt: 1 }`, `{ event: 1, status: 1, createdAt: -1 }`, and a **unique partial index** `{ event: 1, selectedSeats: 1 }` (only where `status: "confirmed"`) so the database itself refuses to sell one seat twice, even if application code were bypassed.
  - `Event`: `{ activeStatus: 1, date: 1 }`, `{ organizer: 1 }`, and full-text index on `{ title: "text", description: "text", location: "text" }`.
- **Measured, not guessed**: `npm run explain` seeds 30k events and 150k bookings and compares each hot query with and without its index (`explain("executionStats")`). Typical local result:

  | Query | Docs scanned (no index → index) | Time (no index → index) |
  |---|---|---|
  | Public events list, page of 20 | 30,000 → 20 | ~100-200 ms → ~10 ms |
  | Full-text search, specific term | 30,000 → 1 | ~170 ms → ~9 ms |
  | My bookings, newest first | 150,000 → ~70 | ~300 ms → ~4 ms |
  | Organizer dashboard bookings | 150,000 → ~600 | ~330 ms → ~30 ms |

  *(In-memory MongoDB on a laptop; absolute times vary, the scanned-document counts are what matter.)*
- **Non-blocking Redis access**: seat holds are looked up with cursor-based `SCAN` instead of `KEYS`, which would block Redis for every other client as the keyspace grows.
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
STRIPE_WEBHOOK_SECRET=whsec_...   # endpoint: /api/v1/webhooks/stripe
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
QR_SECRET=your_ticket_hmac_secret
DEMO_MODE=true                # public demo: keep seeded demo events in the future
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

**41 automated tests** (20 unit + 21 integration). Integration tests run the real Express app against a real in-memory MongoDB (`mongodb-memory-server`) through HTTP (`supertest`), so they exercise routing, auth, validation, Mongo atomic updates and the Redis-fallback hold logic together. They run in CI on every push.

```bash
cd backend
npm test            # unit + integration
npm run loadtest    # concurrency load test (see below)
npm run explain     # index vs no-index query comparison
```

| Suite | What it proves |
|---|---|
| `concurrency.test.js` | 50 users racing for one seat: exactly 1 succeeds, 49 get 409. 40 users picking overlapping seats never double-sell. Triple-click cancel restores seats once. |
| `payments.test.js` | Forged payment IDs are rejected; client-sent price/discount is ignored; users cannot confirm each other's bookings; simulated payments are refused in production; coupons never drain the wallet; webhook signature, idempotency, amount-mismatch and expiry handling. |
| `checkin.test.js` | Only the event's organizer can scan; tampered, cancelled or repeated tickets are rejected with correct status codes. |
| `analytics.test.js` | Organizer overview counts only own confirmed bookings; other organizers get 403; the unique partial index rejects a second confirmed booking for the same seat. |
| `ratelimit.test.js` | Booking rate limit is per user, not per IP. |
| `tests/unit/*` | Validation schemas, auth middleware, QR signing, refund isolation, env/CORS/secret rules. |

### Concurrency load test

`npm run loadtest` starts the app on a random port, then 300 users fire booking requests for 30 seats (100 requests in flight). Typical local result:

```
Responses by status: { '201': 30, '409': 270 }     # exactly 30 seats sold, 270 clean conflicts
Latency  p50 590 ms | p95 2029 ms | p99 2189 ms     # in-memory Mongo, single Node process, laptop
PASS  no seat sold twice
PASS  availableSeats == capacity - booked
PASS  no 5xx responses
```

Tune with `USERS`, `SEATS`, `CONCURRENCY` env vars. Numbers vary by machine; the invariants must always pass.

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

2. **Install dependencies**:
   ```bash
   # Install root and client dependencies
   npm install

   # Install backend dependencies
   cd backend && npm install && cd ..
   ```

3. **Launch Frontend & Backend Concurrently**:
   ```bash
   # From project root - starts both Vite client (:5173) and Express backend (:5000)
   npm run dev
   ```

   *Alternatively, run them individually:*
   - Client only: `npm run dev:client`
   - Backend only: `npm run dev:server`

4. **Access the application**: Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
