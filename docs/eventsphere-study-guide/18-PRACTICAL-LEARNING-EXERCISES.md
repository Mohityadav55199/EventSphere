# File 18: Practical Learning Exercises

This document provides structured, hands-on engineering exercises designed to build mastery over the EventSphere codebase. Exercises are divided into four difficulty tiers, progressing from code navigation to advanced concurrency simulation and system design challenges.

---

## Tier 1: Beginner Exercises (Code Tracing & Navigation)

### Exercise 1: Trace the Redux Auth Flow on Boot
- **Objective**: Understand how the client stays logged in when the browser is refreshed.
- **Task**:
  1. Open [src/App.jsx](../../src/App.jsx#L15-L42).
  2. Follow the `useEffect` execution:
     - Where does it pull the token from first?
     - What API call is made if a token exists?
     - What Redux action is dispatched when the user profile returns?
  3. Open [src/store/authslice.js](../../src/store/authslice.js). Identify how `setCredentials` updates both state and `localStorage`.
- **Expected Observation**: Even if Redux memory state resets on F5 refresh, `localStorage.getItem("accessToken")` preserves the token, allowing `App.jsx` to re-fetch the user and restore Redux credentials seamlessly.

---

### Exercise 2: Verify the Automated Database Seeder
- **Objective**: Understand how EventSphere boots with demo events without manual database inserts.
- **Task**:
  1. Open [backend/index.js](../../backend/index.js#L14-L18).
  2. Locate `await autoSeedEventsIfEmpty()`.
  3. Open [backend/utils/autoSeed.js](../../backend/utils/autoSeed.js).
  4. Inspect the condition that checks whether seeding is necessary.
- **Questions to Answer**:
  - What query checks if the database is empty? (`Event.countDocuments() === 0`).
  - What role is assigned to the seeded user? (`organizer`).
  - How many events are created in the seed array? (5 events).

---

### Exercise 3: Inspect Client Route Guards
- **Objective**: Learn how React Router prevents unauthenticated users from accessing protected views.
- **Task**:
  1. Open [src/main.jsx](../../src/main.jsx#L36-L61).
  2. Locate the route definitions for `/login`, `/dashboard`, and `/create-event`.
  3. Notice how `/login` specifies `<Protected authenication={false}>`, while `/dashboard` specifies `<Protected authenication={true}>`.
  4. Open [src/Components/AuthLayout.jsx](../../src/Components/AuthLayout.jsx).
- **Questions to Answer**:
  - What happens if a logged-in user (`authStatus = true`) attempts to navigate to `/login`? (Redirected to `/`).
  - What happens if an unauthenticated user (`authStatus = false`) attempts to access `/create-event`? (Redirected to `/login`).

---

## Tier 2: Intermediate Exercises (Endpoints, Formats & Bug Hunting)

### Exercise 4: Query the Public Seat Availability Endpoint
- **Objective**: Test that seat availability works without authentication.
- **Task**:
  1. Start the backend locally (`cd backend && npm run dev`).
  2. Open your terminal and run curl or use Postman:
     ```bash
     # Replace with a real Event ObjectId from your seeded DB
     curl -X GET http://localhost:5000/api/v1/bookings/seat-availability/6732a10b42f1b8a91c
     ```
- **Expected Observation**:
  The server returns HTTP 200 with the JSON shape:
  ```json
  {
    "statusCode": 200,
    "data": {
      "capacity": 50,
      "availableSeats": 50,
      "bookedSeats": [],
      "heldSeats": [],
      "effectiveFreeSeats": 50,
      "isSoldOut": false,
      "fillingFast": false
    },
    "message": "Seat availability fetched",
    "success": true
  }
  ```

---

### Exercise 5: Audit the Image Buffer Bug in `updateEvent`
- **Objective**: Locate an unhandled exception in the event controller.
- **Task**:
  1. Open [backend/controllers/event.controller.js:103-131](../../backend/controllers/event.controller.js#L103-L131).
  2. Examine line 110:
     ```javascript
     if (req.file.buffer) {
     ```
  3. Trace what happens if an organizer submits a `PATCH /api/v1/events/update-event/:id` updating only the `title` or `Price` without uploading a new image file.
- **Expected Observation**: When no file is uploaded via Multer, `req.file` is `undefined`. Accessing `.buffer` on undefined throws an unhandled `TypeError: Cannot read properties of undefined (reading 'buffer')`.
- **Engineering Fix**:
  ```javascript
  if (req.file && req.file.buffer) { ... }
  ```

---

### Exercise 6: Fix the `concurrencyTest.js` Request Discrepancy
- **Objective**: Repair the existing stress test script so it matches current controller validation.
- **Task**:
  1. Open [backend/tests/concurrencyTest.js:36-39](../../backend/tests/concurrencyTest.js#L36-L39).
  2. Observe the request body being sent:
     ```javascript
     body: JSON.stringify({
       seatsBooked: SEATS_PER_BOOKING,
       ticketTier: "Standard Pass",
     })
     ```
  3. Open [backend/controllers/booking.controller.js:85-87](../../backend/controllers/booking.controller.js#L85-L87) to see what the controller expects:
     ```javascript
     if (!eventId || !Array.isArray(selectedSeats) || selectedSeats.length < 1) {
       throw new ApiError(400, "Event ID and an array of selected seats are required");
     }
     ```
  4. Modify `concurrencyTest.js` in a scratch file to send:
     ```javascript
     body: JSON.stringify({
       selectedSeats: ["A1", "A2"],
       ticketTier: "Standard Pass",
     })
     ```

---

## Tier 3: Advanced Concurrency & Concurrency Simulations

### Exercise 7: Run a Real 20-User Concurrency Race Test
- **Objective**: Observe Layer 1 (Redis) and Layer 2 (MongoDB) rejecting duplicate bookings with HTTP 409 Conflict.
- **Prerequisites**: Backend running locally with MongoDB connected.
- **Step 1**: Register a test user and obtain a JWT access token via `POST /api/v1/users/login`.
- **Step 2**: Grab an active Event ID from `GET /api/v1/events/all-events`.
- **Step 3**: Configure the scratch concurrency test script with `EVENT_ID`, `AUTH_TOKEN`, and `selectedSeats: ["B4"]`.
- **Step 4**: Execute the script:
  ```bash
  node backend/tests/concurrencyTest.js
  ```
- **Expected Results Output**:
  ```
  🚀 EventSphere Concurrency Stress Test
  ────────────────────────────────────────────────────────────
    ✅ User 1: SUCCESS (142ms)
    🔒 User 2: CONFLICT — Seat B4 is currently reserved by someone else. (145ms)
    🔒 User 3: CONFLICT — Seat B4 is currently reserved by someone else. (147ms)
    ...
    🔒 User 20: CONFLICT — Seat B4 is currently reserved by someone else. (180ms)
  ────────────────────────────────────────────────────────────
  📊 Results:
     ✅ Successful bookings: 1 (1 seats held)
     🔒 Properly rejected (409 Conflict): 19
     ❌ Errors: 0
  ✅ PASS: All requests handled deterministically
  ```

---

### Exercise 8: Audit & Fix the Seat Hold Expiry Worker Discrepancy
- **Objective**: Identify a signature mismatch between the background worker and the booking lock utility.
- **Task**:
  1. Open [backend/jobs/holdExpiry.js:83-85](../../backend/jobs/holdExpiry.js#L83-L85).
  2. Notice how the cron job invokes `atomicRestoreSeats`:
     ```javascript
     const event = await Event.findById(booking.event).select("capacity");
     await atomicRestoreSeats(booking.event, booking.seatsBooked, event?.capacity);
     ```
  3. Open [backend/utils/bookingLock.js:59-69](../../backend/utils/bookingLock.js#L59-L69) and inspect the function signature:
     ```javascript
     async function atomicRestoreSeats(eventId, seatsArray) {
       if (!seatsArray || seatsArray.length === 0) return;
       const filter = { _id: eventId };
       const update = { 
         $pullAll: { bookedSeats: seatsArray },
         $inc: { availableSeats: seatsArray.length }
       };
       return await Event.findOneAndUpdate(filter, update, { new: true });
     }
     ```
- **Analysis**:
  - `holdExpiry.js` passes `booking.seatsBooked` (a Number like `2`) as the second argument.
  - `atomicRestoreSeats` treats the second argument as an array (`seatsArray`), evaluating `seatsArray.length` (which is `undefined`).
  - As a result, `$inc: { availableSeats: undefined }` fails to increment the counter properly, and `$pullAll` receives a number instead of an array.
- **The Solution**: Update `backend/jobs/holdExpiry.js:84` to pass `booking.selectedSeats`:
  ```javascript
  await atomicRestoreSeats(booking.event, booking.selectedSeats);
  ```

---

## Tier 4: Architectural Whiteboarding Challenges (Interview Mocks)

### Challenge 1: Redesign Payment Confirmation with Stripe Webhooks
- **Prompt**:
  > *"Right now, EventSphere verifies payments when the browser redirects to `/profile?session_id=...`. If the attendee's phone dies after paying on Stripe, the ticket is lost. How would you redesign this using Webhooks?"*
- **Solution Blueprint**:
  1. Register a webhook route in Express: `POST /api/v1/bookings/stripe-webhook`.
  2. Configure `express.raw({ type: "application/json" })` for that route to preserve the raw payload buffer.
  3. Verify the signature:
     ```javascript
     const event = stripe.webhooks.constructEvent(
       req.body,
       req.headers["stripe-signature"],
       process.env.STRIPE_WEBHOOK_SECRET
     );
     ```
  4. Listen for event `checkout.session.completed`.
  5. Extract `session.metadata.bookingId` and execute `confirmHold()`, `atomicDecrementSeats()`, and `generateSecureQRCode()` asynchronously on the server.
  6. Return `res.json({ received: true })` within 2 seconds to satisfy Stripe's delivery retry threshold.

---

### Challenge 2: Scale Real-Time Seat Updates to 100,000 Concurrent Users
- **Prompt**:
  > *"If EventSphere is deployed across 10 Docker containers behind an AWS Application Load Balancer, how do you ensure an event emitted on Container 1 reaches a user connected to Container 10?"*
- **Solution Blueprint**:
  1. Deploy a central Redis cluster.
  2. Install `@socket.io/redis-adapter` on the Express backend.
  3. Bind the adapter during Socket initialization:
     ```javascript
     import { createAdapter } from "@socket.io/redis-adapter";
     import { createClient } from "redis";

     const pubClient = createClient({ url: process.env.REDIS_URL });
     const subClient = pubClient.duplicate();
     await Promise.all([pubClient.connect(), subClient.connect()]);

     io.adapter(createAdapter(pubClient, subClient));
     ```
  4. When Container 1 calls `io.to("seats:101").emit("seatUpdate", ...)`, the adapter publishes the payload to Redis Pub/Sub channel `socket.io#seats:101#`. Containers 2 through 10 receive the message from Redis and broadcast it to their locally connected WebSocket clients.

---

### Challenge 3: Replace Cron Polling with Redis Keyspace Notifications
- **Prompt**:
  > *"The 60-second cron job creates up to a 60-second delay between when a seat hold expires in Redis and when the seat becomes available in MongoDB. How can we make seat recycling instantaneous?"*
- **Solution Blueprint**:
  1. Enable expired event notifications on Redis: `CONFIG SET notify-keyspace-events Ex`.
  2. Create a dedicated Redis subscriber client in Node:
     ```javascript
     const sub = redisClient.duplicate();
     sub.subscribe("__keyevent@0__:expired");
     sub.on("message", async (channel, expiredKey) => {
       // Check if key matches seat_hold:{eventId}:{seatId}
       if (expiredKey.startsWith("seat_hold:")) {
         const [, eventId, seatId] = expiredKey.split(":");
         await handleInstantSeatExpiry(eventId, seatId);
       }
     });
     ```
  3. Inside `handleInstantSeatExpiry`, atomically pull `seatId` from MongoDB and broadcast `seatUpdate` via Socket.io immediately.
  4. Keep the cron job as a low-frequency secondary backup (e.g. running hourly) to catch network anomalies.
