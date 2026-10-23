# File 17: Quick Revision & Technical Glossary

This document serves as your high-density revision sheet and comprehensive technical glossary. Review this document 30 minutes before your interview to refresh key architectural concepts, business rules, formulas, and terminology.

---

## 1. EventSphere Architecture in 60 Seconds

```
+-----------------------------------------------------------------------------------------+
|                                  SYSTEM AT A GLANCE                                     |
|                                                                                         |
|  CLIENT:     React 19 (Vite) SPA • Redux Toolkit (Auth) • Tailwind v4 • Recharts        |
|  TRANSPORT:  Axios (REST with Cookies) + Socket.io-client (WebSockets)                  |
|  SERVER:     Node.js 20 • Express 5.1.0 • Rate Limiters • node-cron (60s worker)        |
|  CACHE:      Redis (Upstash REST / ioredis / Map) — 30-min seat holds (SET NX EX)       |
|  DATABASE:   MongoDB Atlas (Mongoose ODM) — Single-document atomic updates ($nin)       |
|  SECURITY:   Dual JWT (Cookies) • Bcrypt (10 rounds) • HMAC-SHA256 signed QR codes     |
|  PAYMENTS:   Stripe Checkout Hosted Sessions + 5% Loyalty Wallet Cashback               |
|  HOSTING:    Render (Node/WebSockets Backend) + Vercel (Static SPA Frontend)            |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Core Business Rules & Formulas

### 1. Concurrency & Seat Availability
- **Hold TTL**: 1800 seconds (30 minutes) matching Stripe Checkout `expires_at`.
- **Seat Availability Formula**:
  $$\text{Effective Free Seats} = \max(0, \text{AvailableSeats} - \text{HeldSeats.length})$$
- **Seat Map Matrix**: 10 columns per row. Row letter derived via $\text{String.fromCharCode}(65 + r)$, column number $c + 1$.
- **Max Booking Limit**: 10 seats per booking transaction.

### 2. Financials & Loyalty Economics
- **Cashback Rate**: 5% of gross card payment credited as wallet points:
  $$\text{Earned Points} = \left\lfloor \frac{\text{Amount Paid}}{20} \right\rfloor$$
- **Wallet Point Value**: 1 point = ₹1 (or 1 currency unit) direct discount.
- **Coupon Codes**:
  - `SPHERE20`: 20% discount.
  - `WELCOME10`: 10% discount.
  - `FESTIVAL50`: 50% discount.

### 3. Permissions & Access Control
- **Community Chat Access**: Requires verified MongoDB booking with `paymentstatus: "confirmed"`.
- **Post-Event Reviews**: Requires verified attendance (`paymentstatus: "confirmed"`) **AND** the current time must be after the event date (`new Date(event.date) < new Date()`).
- **Review Constraint**: Maximum of one review per user per event (enforced by compound unique index `{ user: 1, event: 1 }`).
- **Gate Check-In**: Single-use admission. Cryptographically validates HMAC-SHA256 signature and flips `checkedIn: true`. Subsequent scans fail with HTTP 400.

---

## 3. High-Frequency Interview Cheat Sheet

| Question Theme | Core Concept to Mention | Exact Code Reference |
| :--- | :--- | :--- |
| **How do you prevent double-booking?** | "3-Layer model: Redis `SET NX EX` transient hold, MongoDB atomic `findOneAndUpdate` with `$nin` guard, and Socket.io broadcasts." | [bookingLock.js](../../backend/utils/bookingLock.js#L24-L34)<br>[seatHold.js](../../backend/utils/seatHold.js#L46-L71) |
| **How do you handle abandoned carts?** | "A 60-second Node-Cron background worker queries expired holds (`holdExpiresAt <= now`), cancels the booking, and restores seats." | [holdExpiry.js](../../backend/jobs/holdExpiry.js#L49-L105) |
| **How are tickets secured against counterfeiting?** | "HMAC-SHA256 signature generated over a randomized payload string (`bookingId:randomHex`) using server secret `QR_SECRET`." | [booking.controller.js](../../backend/controllers/booking.controller.js#L69-L78) |
| **Why polyglot persistence?** | "Redis in RAM absorbs high-frequency seat hold churn with native TTLs, protecting MongoDB disk IOPS for permanent ledgers." | [redisClient.js](../../backend/utils/redisClient.js) |
| **How does authentication work?** | "Dual-token JWT. Short-lived access token (1d) and long-lived refresh token (10d) stored in HTTP-Only, secure cookies." | [user.model.js](../../backend/models/user.model.js#L53-L75) |
| **Why Express 5 over Express 4?** | "Native handling of rejected promises in async middleware without requiring manual try-catch wrappers around controllers." | [app.js](../../backend/app.js) |
| **Why Render for backend, Vercel for frontend?** | "Render supports long-lived WebSocket connections and cron workers; Vercel provides global Edge CDN caching for static SPAs." | [README.md](../../README.md#L14-L56) |

---

## 4. Technical Glossary

### A
- **ACID**: Atomicity, Consistency, Isolation, Durability. Set of properties guaranteeing database transaction reliability. EventSphere achieves document-level atomicity via MongoDB operators.
- **ApiError**: Custom error class in `backend/utils/ApiError.js` extending standard `Error` with HTTP status codes and uniform JSON formatting.
- **ApiResponse**: Response wrapper class in `backend/utils/ApiResponse.js` standardizing success payloads into `{ statusCode, data, message, success }`.
- **asyncHandler**: Higher-order function in `backend/utils/asyncHandler.js` wrapping async Express routes to forward rejected promises to `next(err)`.
- **Atomic Operation**: An operation that completes in its entirety or not at all, with no observable intermediate states (e.g., MongoDB `$push` or Redis `SET NX`).

### B
- **Bcrypt**: Adaptive cryptographic key derivation function used in `backend/models/user.model.js` to hash passwords with salt round factor 10.
- **Bi-directional Communication**: Full-duplex communication channel where both client and server can transmit messages simultaneously over a single connection (WebSockets).

### C
- **CORS (Cross-Origin Resource Sharing)**: Security mechanism using HTTP headers to tell browsers whether requests from other origins are permitted. EventSphere sets `origin: true` and `credentials: true`.
- **Compound Unique Index**: A database index spanning multiple fields enforcing distinctness across combinations (e.g., `{ user: 1, event: 1 }` on Reviews).
- **Concurrency**: The execution of multiple computations simultaneously. In EventSphere, multiple attendees attempting to reserve the same seat concurrently.

### D
- **Distributed Lock**: A concurrency primitive ensuring mutual exclusion across multiple compute nodes (implemented via Redis `SET NX EX`).
- **Dual-Token Authentication**: Architecture pairing short-lived access tokens (authentication) with long-lived refresh tokens (session renewal).

### E
- **Effective Free Seats**: Dynamic metric calculating genuinely purchasable seats by subtracting active Redis holds from database availability.
- **Express 5**: The latest major release of Express.js featuring native promise error propagation in middleware.

### H
- **HMAC (Hash-based Message Authentication Code)**: Cryptographic signature combining a cryptographic hash function (SHA-256) with a secret key (`QR_SECRET`) to verify ticket integrity.
- **Hot Module Replacement (HMR)**: Tooling capability in Vite that exchanges, adds, or removes modules in running React code without full page reloads.

### I
- **Idempotency**: An API property where making the same request multiple times produces the exact same outcome as a single request.
- **ioredis**: Robust, feature-rich Redis client library for Node.js utilizing TCP connections.

### J
- **JWT (JSON Web Token)**: Compact, URL-safe means of representing claims between two parties, digitally signed using secrets.

### M
- **Mongoose ODM**: Object Data Modeling library for MongoDB providing schema enforcement, validation, and lifecycle middleware hooks.
- **Multer Memory Storage**: Storage engine holding uploaded files in RAM as Buffers rather than writing to disk.

### N
- **Node-Cron**: Pure JavaScript scheduled task runner used for the 60-second abandoned seat hold cleanup job.

### P
- **Polyglot Persistence**: The practice of using different database engines to handle different data storage needs within a single application (MongoDB for documents, Redis for locks).

### R
- **RBAC (Role-Based Access Control)**: Restricting system access to authorized users based on designated roles (`attendee`, `organizer`, `admin`).
- **Redux Toolkit (RTK)**: Standardized toolset for efficient Redux development, providing `createSlice` and automatic Immer immutability.

### S
- **Socket.io**: Event-driven library enabling low-latency, bidirectional, real-time communication between browser and server.
- **Stripe Checkout**: Pre-built, hosted payment page optimized for conversion and compliant with PCI-DSS standards.

### T
- **Time-to-Live (TTL)**: Expiration timer attached to cache keys in Redis (1800 seconds in EventSphere).

### U
- **Upstash Redis**: Serverless Redis database accessed over HTTP REST APIs, avoiding persistent TCP socket requirements.

### V
- **Vite**: Modern frontend build tool leveraging browser-native ES modules for instant server start.

---

## 5. Five-Minute Pre-Interview Checklist

Before your interview, review this rapid checklist:

1. [ ] **Pitch**: Memorize Question 1 in [16-INTERVIEW-QUESTIONS-AND-ANSWERS.md](./16-INTERVIEW-QUESTIONS-AND-ANSWERS.md).
2. [ ] **3-Layer Concurrency**:
   - Layer 1: Redis `SET NX EX` (30m TTL in RAM) with batch rollback.
   - Layer 2: MongoDB `findOneAndUpdate({ bookedSeats: { $nin: seats } })`.
   - Layer 3: Socket.io `emitSeatUpdate` real-time broadcasts.
3. [ ] **Ticket Security**: HMAC-SHA256 signature over `bookingId:randomHex` checked at gate with single-use `checkedIn: true`.
4. [ ] **Identified Nuance / Gap to Impress Interviewer**:
   - Point out that `holdExpiry.js:84` passes a number instead of an array of seat strings to `atomicRestoreSeats`.
   - Explain why client-redirect payment verification should be upgraded to asynchronous Stripe Webhooks.
5. [ ] **Stack Summary**: React 19, Vite, Tailwind v4, Redux Toolkit, Node 20, Express 5, MongoDB Atlas, Redis (Upstash/ioredis), Socket.io, Stripe, Cloudinary.
