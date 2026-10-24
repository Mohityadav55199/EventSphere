# EventSphere Backend ⚙️

The core REST API & WebSocket engine for **EventSphere** — an enterprise-grade event discovery and booking platform featuring real-time seat holds (BookMyShow concurrency architecture), dual payment gateways (Stripe & Razorpay), HMAC-signed QR ticketing, live community chat, and automated hold-expiry reconciliation.

---

## 🛠️ Architecture & Tech Stack

- **Runtime**: Node.js 20.x, Express.js 5.x
- **Database**: MongoDB Atlas + Mongoose 8.x
- **Real-Time & Concurrency**: Socket.io 4.x, Upstash Redis / Redis (`ioredis`), Node-cron (seat hold reconciliation)
- **Security & Auth**: JWT (Access + Refresh tokens with rotation), bcryptjs, Helmet, Express Rate Limit, HMAC SHA-256 (tickets)
- **Payments**: Stripe SDK & Razorpay SDK (with failure-isolated refund automation)
- **Media & Storage**: Cloudinary, Multer (memory buffer streaming)
- **Validation**: Zod 4.x schemas with strict type coercion

---

## 🔐 Environment Variables Reference

A startup check (`backend/config/env.js`) validates environment variables upon boot and exits immediately with an actionable error if any mandatory secret is missing.

### 🔴 Mandatory Variables (App will exit if missing)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGODB_URI` / `MONGO_URI` | MongoDB Atlas or local connection string | `mongodb+srv://user:pass@cluster.mongodb.net/eventsphere` |
| `ACCESS_TOKEN_SECRET` | Cryptographic secret for short-lived access JWTs | `random_hex_or_passphrase_64_chars` |
| `REFRESH_TOKEN_SECRET` | Cryptographic secret for long-lived refresh JWTs | `random_hex_or_passphrase_64_chars` |

### 🟡 Feature Variables (Recommended for full production capabilities)

| Variable | Target Feature | If Omitted |
| :--- | :--- | :--- |
| `CLIENT_URL` | CORS, payment redirects, and password reset links | Defaults to permissive CORS; defaults to localhost |
| `STRIPE_SECRET_KEY` | Global card payments, Apple Pay, Google Pay | Stripe checkout disabled |
| `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` | UPI, NetBanking, Indian card payments | Razorpay checkout disabled |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Shared Redis seat holds (BookMyShow architecture) | Falls back gracefully to in-memory TTL hold store |
| `QR_SECRET` | HMAC signature for offline ticket verification | QR generation will use unkeyed default hash |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Event banner and photo uploads | Image uploads fail with 500 error |
| `EMAIL_USER` & `SMTP_HOST` | Automated ticket PDF email and password reset | Console logs notification instead of sending |

---

## 🚀 Running Locally

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create .env file from template
cp .env.example .env
# (Edit .env and populate your MongoDB URI and secrets)

# 4. Run automated test suite
npm test

# 5. Start development server
npm run dev
```

---

## 🧪 Automated Testing

EventSphere includes unit tests covering critical security and business logic:
- **Authentication & Tokens**: Valid token verification, expired token rejection (clean 401 for client refresh), tampered token defense.
- **Event Cancellation & Refunds**: Failure-isolated batch processing — one failing payment gateway refund never halts cancellation of remaining bookings; detailed failure summary is recorded.
- **Validation**: Zod schema boundary validation, role-escalation defense (attendees cannot register as admin), multipart string-to-number coercion.
- **Booking & Concurrency**: QR HMAC generation and verification, expired seat hold filtering, tiered pass calculation.

Run tests:
```bash
npm test
```

---

## 🛡️ Production Health & Diagnostics

- `GET /health`: Instant lightweight keep-alive ping for cloud infrastructure (safe for Render 15-minute sleep prevention).
- `GET /health?deep=1`: Deep diagnostic probe pinging MongoDB admin database and Redis. Returns HTTP 200 with latency if all healthy, or HTTP 503 Service Unavailable if the database is unreachable.
