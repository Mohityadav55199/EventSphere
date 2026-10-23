# File 15: Design Decisions, Trade-offs & Improvements

This document evaluates the architectural design decisions made in EventSphere. It separates verified architectural choices evident in the code from engineering trade-offs and recommended production improvements.

---

## 1. Architectural Decision Analysis

```
+-----------------------------------------------------------------------------------------+
|                               DESIGN DECISION MATRIX                                    |
|                                                                                         |
|  DECISION AREA           CHOICE MADE IN CODE          PRIMARY BENEFIT                   |
|  • Primary Database      MongoDB Atlas (Document)     Flexible ticket & attendee arrays |
|  • Temporary Hold Store  Redis / Upstash (Memory)     High IOPS, sub-ms TTL expiration  |
|  • Real-Time Engine      Socket.io (WebSockets)       Unified seat push & 2-way chat    |
|  • Payment Integration   Stripe Checkout (Hosted)     Zero PCI scope, mobile optimized  |
|  • Ticket Verification   HMAC-SHA256 Signed QR Code   Offline-verifiable, tamper-proof  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Database vs. Cache Responsibilities

### The Decision: Polyglot Persistence (MongoDB + Redis)
- **Why this was chosen**:
  - Temporary seat holds are high-frequency, volatile operations. During flash ticket drops, thousands of users select and unselect seats every second. If every temporary hold resulted in a disk write to MongoDB, database IOPS and transaction log volume would spike dramatically.
  - Redis operates in RAM, allowing atomic key generation (`SET NX EX`) at sub-millisecond latency with automatic TTL expiration.
  - MongoDB acts as the authoritative, durable system of record. Confirmed bookings, user wallet balances, and event catalogs are persisted with ACID document-level guarantees.

### Trade-offs & Alternatives
| Architecture Pattern | Advantages | Disadvantages | Why EventSphere Avoided It |
| :--- | :--- | :--- | :--- |
| **Relational (PostgreSQL / MySQL)** | Strict foreign key constraints and ACID multi-table joins | Slower schema evolution for nested ticket tiers and attendee arrays | Relational locking (`SELECT FOR UPDATE`) can create database-level row contention bottlenecks during seat drops. |
| **Pure Redis (No Mongo)** | Ultra-fast reads and writes across the entire platform | High memory cost, complex querying for analytics and search | Storing historical booking ledgers and PDF generation data entirely in RAM is cost-prohibitive and lacks document query flexibility. |
| **Pure MongoDB (No Redis)** | Single database engine to maintain, zero cache sync complexity | High disk write churn on temporary holds, slow abandoned cart sweeps | Would require constant database polling or background queries to expire unconfirmed holds. |

---

## 3. Concurrency & Seat Consistency Model

### The Decision: Multi-Tier Hybrid Locking (Redis In-Memory + MongoDB Atomic $nin)
- **How it works**:
  1. *Pessimistic Hold (Redis)*: A user reserving seat `A1` places a 30-minute lock in Redis (`seat_hold:eventId:A1`), immediately blocking other users from selecting it.
  2. *Optimistic Guard (MongoDB)*: When payment completes, `atomicDecrementSeats` executes `Event.findOneAndUpdate({ bookedSeats: { $nin: ["A1"] } })`.
- **Trade-offs & Concurrency Analysis**:
  - *Distributed Transactions (Two-Phase Commit)*: Requires heavy two-phase locking protocols across database nodes, reducing write throughput. EventSphere's hybrid approach decouples the checkout wait time (held in Redis) from the database commit (a single atomic MongoDB instruction).

---

## 4. Payment Verification: Client Redirect vs. Webhook

### Current Implementation: Client-Driven Verification
- In `backend/controllers/booking.controller.js:274-381` and `src/Pages/Profile.jsx:21-59`, payment confirmation is initiated when Stripe redirects the browser back to `/profile?session_id=...`.
- **Why this may have been chosen**:
  - Simple, synchronous implementation that does not require exposing local endpoints via tunneling tools (like ngrok) during local development.

### Trade-offs & Critical Vulnerability
```
CRITICAL EDGE CASE (Network Drop / Browser Close):
User enters card details on Stripe ──> Stripe charges card ──> User closes browser immediately
                                                                      │
                                                        Client NEVER reaches /profile!
                                                                      │
                                                        verifyPayment is NEVER called!
                                                                      │
                                                Hold expires in 30 mins -> Cron cancels booking!
                                                RESULT: User was charged, but ticket was cancelled!
```

### Recommended Improvement
Implement a dedicated Stripe Webhook listener on the backend:
```javascript
// Recommended: backend/routes/booking.router.js
bookingRouter.post(
  "/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await processVerifiedPayment(session);
    }
    res.json({ received: true });
  }
);
```
**Advantage**: Asynchronous server-to-server confirmation. Even if the user closes their browser, Stripe's servers guarantee delivery of the payment notification.

---

## 5. Real-Time Architecture: Socket.io vs. Server-Sent Events (SSE)

### The Decision: Socket.io for Both Inventory & Chat
- **Why Socket.io was chosen**:
  - EventSphere requires **bi-directional communication** for attendee community chat (client sends messages, server broadcasts to room).
  - Rather than running two separate real-time protocols (SSE for one-way seat metrics + WebSockets for chat), Socket.io provides a single, unified protocol.
- **Trade-offs**:
  - *SSE*: Simpler HTTP-based streaming protocol with automatic browser reconnection. However, SSE is strictly one-way (server-to-client) and cannot handle live chat messaging without secondary HTTP POST requests.
  - *WebSockets (Raw)*: Lacks built-in room abstractions and automatic HTTP long-polling fallback, requiring custom connection management code.

---

## 6. Authentication: Dual JWT in HTTP-Only Cookies vs. LocalStorage

### The Decision: Dual Tokens via Cookies and Bearer Headers
- In `backend/controllers/user.controllers.js:71-75`, access and refresh tokens are attached as `httpOnly` and `secure` cookies while also returning the token string in the JSON payload for `localStorage` backup.
- **Trade-offs**:
  - *LocalStorage Only*: Highly vulnerable to Cross-Site Scripting (XSS). Any malicious third-party script injected into the client can read `localStorage.getItem("accessToken")` and exfiltrate credentials.
  - *HTTP-Only Cookies*: Inaccessible to client JavaScript, mitigating XSS token theft. However, it requires explicit CORS configuration (`credentials: true`) and protects against Cross-Site Request Forgery (CSRF). EventSphere achieves defense-in-depth by requiring cookies or standard Bearer headers.

---

## 7. Scalability Bottlenecks & Roadmap

To scale EventSphere to handle national concert tours with millions of concurrent requests, address three architectural bottlenecks:

```
+-----------------------------------------------------------------------------------------+
|                                SCALING ROADMAP                                          |
|                                                                                         |
|  1. MULTI-INSTANCE SOCKET CLUSTERING                                                    |
|     Bottleneck: In-memory Socket.io server cannot broadcast across multiple containers. |
|     Solution: Deploy @socket.io/redis-adapter to sync events via Redis Pub/Sub.         |
|                                                                                         |
|  2. INSTANT SEAT RELEASE (KEYS-PACE NOTIFICATIONS)                                      |
|     Bottleneck: 60-second cron job introduces up to 60s delay before recycling seats.   |
|     Solution: Subscribe to Redis Keyspace Expiry events (__keyevent@0__:expired).       |
|                                                                                         |
|  3. READ REPLICA DECOUPLING                                                             |
|     Bottleneck: Public catalog queries compete with booking write operations.           |
|     Solution: Route all GET /api/v1/events to read-only MongoDB secondary nodes.        |
+-----------------------------------------------------------------------------------------+
```

---

## 8. Summary for Technical Interviews

> "EventSphere balances performance, developer velocity, and consistency through deliberate architectural choices. We chose polyglot persistence—pairing MongoDB Atlas for rich document hierarchies with Redis for in-memory seat holds—to prevent disk write churn during flash sales. For concurrency, we employ a hybrid strategy: pessimistic Redis holds with multi-seat rollback protect the checkout phase, while atomic MongoDB `$nin` operators serialize commits at the database level. In discussing trade-offs, I would highlight our client-side payment verification as a critical area for improvement: transitioning to asynchronous Stripe Webhooks with signature validation will eliminate edge cases where users close their browsers before redirecting."
