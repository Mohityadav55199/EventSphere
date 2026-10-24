# EventSphere 🎉
### Production-Grade Full-Stack Event Discovery, Concurrency Ticketing & Community Platform

EventSphere is a modern full-stack web application built to replicate high-concurrency event ticketing systems (like BookMyShow and Eventbrite). It features real-time seat reservation holds using Redis, dual payment gateways (Stripe & Razorpay) with failure-isolated batch refunds, HMAC-signed ticket QR generation with scanner verification, server-side text search and pagination, and live community chat rooms.

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
       │  - Compound Query Indexes │                                               │  - Real-Time Seat Counters│
       │  - Text Search Indices    │                                               │  - Pub/Sub Socket Updates │
       └───────────────────────────┘                                               └───────────────────────────┘
```

---

## 🚀 Key Features

### 1. 🎟️ High-Concurrency Ticket Reservation (BookMyShow Architecture)
- **Problem**: In popular events, multiple users attempt to purchase the exact same seat simultaneously.
- **Solution**: Two-phase reservation lifecycle:
  1. **Hold Phase (`status: "hold"`)**: When a user selects a seat and enters checkout, seats are temporarily locked in Redis with a 10-minute TTL. Other users immediately see these seats marked as "In Checkout" in real time via Socket.io.
  2. **Confirm Phase (`status: "confirmed"`)**: Upon successful payment verification (Stripe webhook or Razorpay HMAC verification), seat deductions become permanent in MongoDB.
  3. **Auto-Reconciliation Cron Job**: If a user abandons checkout or payment fails, an automated background cron (`node-cron`) inspects expired holds and restores seat availability without requiring manual intervention.

### 2. 💸 Dual Payment Gateways & Failure-Isolated Refunds
- Integrated **Stripe** (Cards, Apple Pay, Google Pay) and **Razorpay** (UPI, PhonePe, NetBanking).
- **Failure-Isolated Organizer Cancellations**: When an organizer cancels an event with hundreds of attendees, EventSphere executes refunds for each booking independently with dedicated error capturing. A payment failure on one user's account never aborts the rest, recording a structured summary of succeeded and failed refund IDs for manual review.

### 3. 🔍 Server-Side Text Search & MongoDB Indexes
- **High-Performance Compound Indexes**:
  - `Booking`: `{ user: 1, createdAt: -1 }` (optimized for "My Bookings" queries), `{ status: 1, holdExpiresAt: 1 }` (optimized for the background hold-expiry cleanup job), and `{ event: 1, status: 1 }`.
  - `Event`: `{ activeStatus: 1, date: 1 }` (public upcoming events), `{ organizer: 1 }` (dashboard views), and a weighted full-text index on `{ title: "text", description: "text", location: "text" }`.
- **Search & Filter API**: `/all-events?q=...&category=...` combines text matching with pagination and category filtering directly in the database.

### 4. 🛡️ Enterprise Security & Auth Flow
- **Token Rotation**: Short-lived Access Tokens paired with secure `httpOnly` Refresh Tokens.
- **Clean 401 Interceptors**: Unified 401 status handling prevents client-side token refresh loops. Multiple simultaneous 401 requests share a single refresh execution promise.
- **Security Headers & Logging**: Powered by `helmet`, strict CORS policies, proxy trust configuration (`app.set("trust proxy", 1)`), IP rate limiting for auth and seat hold endpoints, and failed login audit logging.
- **HMAC SHA-256 Ticket QR Verification**: Each ticket contains an unforgeable cryptographic signature verifying ticket authenticity offline without exposing database IDs.

### 5. 🎨 Frontend Resilience & UX Polish
- **Real-Time Server Status**: Polls `/health` to detect free-tier cloud instance cold starts and database reconnect states, informing users with informative status alerts instead of infinite loading spinners.
- **React Error Boundary & 404 Routing**: Prevents page-blanking runtime exceptions with friendly retry options.
- **Skeleton Loaders**: Polished skeleton loading states on Home, Profile, and Event Details.
- **Google Calendar Sync & Wishlist**: One-click "Add to Google Calendar" links on booked tickets and event pages, with instant local-storage-backed event saving (wishlist).
- **Universal Dark Mode**: Seamless dark theme toggle with CSS variable remapping across all pages.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite 7, Tailwind CSS v4, Redux Toolkit, React Router v7, Framer Motion, Lucide Icons, Axios, Socket.io-client |
| **Backend** | Node.js 20, Express 5, MongoDB Atlas, Mongoose 8, Upstash Redis, ioredis, Socket.io, Node-cron |
| **Payments** | Stripe SDK, Razorpay SDK |
| **Media & Files** | Cloudinary, Multer, html2pdf.js, qrcode |
| **CI / CD** | GitHub Actions, Node `--test` automated test runner, ESLint |

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

# Optional Feature Integrations
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

## 🚀 Deployment Guide

### Backend Deployment (Render)
1. In Render, create a new **Web Service** pointing to your repository.
2. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
3. Add environment variables listed above.

### Frontend Deployment (Vercel)
1. In Vercel, import the repository.
2. Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add `VITE_BACKEND_URL` and `VITE_STRIPE_PUBLIC_KEY`.

---

## 🧪 Running Automated Tests

Run the backend unit test suite:
```bash
cd backend
npm test
```
The CI pipeline automatically runs these tests on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`).

---

## 💡 Interview Defense & Key Talking Points

When presenting EventSphere in an interview, focus on these design choices:
1. **Concurrency Handling**: Explain how Redis holds prevent double-booking during traffic spikes, and how the `node-cron` job reconciles abandoned checkouts.
2. **Resilience & Fault Isolation**: Explain the `cancelEvent` refactor where `Promise` wrapping and per-booking error catching prevents third-party payment gateway failures from interrupting other attendees' refunds.
3. **Database Index Optimization**: Explain why compound indexes `{ status: 1, holdExpiresAt: 1 }` and `{ user: 1, createdAt: -1 }` convert full collection scans into sub-millisecond index lookups.
4. **Auth Interceptor Design**: Discuss token rotation and how your Axios response interceptor queues concurrent requests during a 401 refresh to prevent duplicate refresh calls.
