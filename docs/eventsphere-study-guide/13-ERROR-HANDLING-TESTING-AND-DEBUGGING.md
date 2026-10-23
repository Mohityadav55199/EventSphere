# File 13: Error Handling, Testing & Debugging

This document explores how errors are captured, formatted, and propagated across EventSphere, the reality of the existing testing setup, how to run and debug the application locally, and common runtime failure scenarios.

---

## 1. Error Handling Architecture

EventSphere implements a centralized, uniform error handling pipeline across both frontend and backend.

```
Controller throws ApiError(statusCode, message)
      │
      ▼
asyncHandler catches promise rejection -> passes to next(err)
      │
      ▼
errorMiddleware intercepts err
      │
      ▼
Client receives HTTP { success: false, message, errors, stack? }
      │
      ▼
Axios / React catches error -> ToastContainer displays toast.error(msg)
```

### 1. The `ApiError` Class ([backend/utils/ApiError.js](../../backend/utils/ApiError.js))
Standardizes application exceptions by attaching an HTTP status code and optional error details:
```javascript
class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = [], stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

### 2. Centralized Error Middleware ([backend/middlewares/error.middleware.js](../../backend/middlewares/error.middleware.js))
Placed as the very last middleware in `backend/app.js`:
```javascript
const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: err.success || false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || [],
    // Only expose stack traces in development mode to prevent information leakage
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
```

### 3. HTTP Status Code Taxonomy in EventSphere

| Status Code | Meaning | When EventSphere Emits It | Example Message |
| :---: | :--- | :--- | :--- |
| **`400`** | Bad Request | Missing required fields, invalid QR hash, double check-in | `"All fields are required"`, `"Invalid QR code data"` |
| **`401`** | Unauthorized | Missing JWT token, invalid login credentials | `"Access Token is required"`, `"Incorrect password"` |
| **`403`** | Forbidden | Role mismatch, expired token, non-attendee joining chat | `"Role attendee is not allowed..."`, `"You must have attended the event to review"` |
| **`404`** | Not Found | Target event, user, or booking ID does not exist | `"Event not found"`, `"Booking not found"` |
| **`409`** | Conflict | Concurrency collision on seat hold or atomic decrement | `"One or more of your selected seats have just been booked"` |
| **`429`** | Too Many Requests | Triggered by `express-rate-limit` on auth or booking spam | `"Too many booking attempts. Please wait a moment..."` |
| **`500`** | Server Error | Cloudinary upload failures, unhandled exceptions | `"Failed to Upload Event Image"`, `"Internal Server Error"` |

---

## 2. Reality of Existing Tests [VERIFIED IN CODE]

An audit of the repository reveals the current test status:

### 1. Automated Test Suites (Jest / Mocha / Vitest / Supertest)
- **Status**: **NOT IMPLEMENTED / MISSING**.
- **Evidence**: In `backend/package.json:10`:
  ```json
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  }
  ```
  Neither the root nor the backend package contains Jest, Vitest, Cypress, or Supertest dependencies.

### 2. Manual Concurrency Stress Test Script ([backend/tests/concurrencyTest.js](../../backend/tests/concurrencyTest.js))
The repository includes one standalone concurrency script designed to test parallel booking attempts using Node's native `fetch` and `Promise.allSettled`.

```javascript
// backend/tests/concurrencyTest.js:21-25
const EVENT_ID = "REPLACE_WITH_REAL_EVENT_ID";
const AUTH_TOKEN = "REPLACE_WITH_REAL_JWT_TOKEN";
const SEATS_PER_BOOKING = 2;
const CONCURRENT_USERS = 20;

// Fires 20 simultaneous requests to create-order
const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => attemptBooking(i + 1));
const results = await Promise.allSettled(promises);
```

### Verified Code Discrepancy in `concurrencyTest.js`
> In `backend/tests/concurrencyTest.js:36-39`, the test payload sends:
> ```json
> { "seatsBooked": 2, "ticketTier": "Standard Pass" }
> ```
> However, `backend/controllers/booking.controller.js:85` strictly enforces:
> ```javascript
> if (!eventId || !Array.isArray(selectedSeats) || selectedSeats.length < 1) {
>   throw new ApiError(400, "Event ID and an array of selected seats are required");
> }
> ```
> Because `selectedSeats` is omitted, running `concurrencyTest.js` against the current backend will cause **all 20 requests to fail with HTTP 400 Bad Request** rather than testing concurrency.
> **Fix**: Update `concurrencyTest.js` to send `{ selectedSeats: ["A1", "A2"] }`.

---

## 3. How to Run EventSphere Locally

### 1. Prerequisites
- **Node.js**: v20.x or higher.
- **MongoDB**: Either a local MongoDB instance running on port 27017 or a free MongoDB Atlas URI.
- **Redis (Optional)**: Upstash REST credentials or local Redis on port 6379. If omitted, the in-memory fallback engages automatically.

### 2. Backend Boot
```bash
cd backend
npm install
# Create backend/.env with MONGODB_URI and JWT secrets
npm run dev
# Starts server via nodemon on http://localhost:5000
```

### 3. Frontend Boot
```bash
# In the repository root
npm install
npm run dev
# Starts Vite dev server on http://localhost:5173
```

---

## 4. Debugging Playbook

### 1. Debugging Frontend State & Real-Time Sync
- **Redux DevTools**: Inspect the `auth` slice to verify whether `status: true`, `accessToken`, and `user` are populated after login.
- **Network Tab (Fetch/XHR)**: Inspect `/api/v1/bookings/create-order/:id`. Check response headers for `Set-Cookie` and response bodies for `checkoutUrl`.
- **WebSocket Inspection**: Open Chrome DevTools -> **Network** -> filter by **WS**.
  - Select the connection to `ws://localhost:5000/socket.io/?...`.
  - Click the **Messages** tab.
  - Verify that `42["watchSeats",{"eventId":"..."}]` is sent and `42["seatUpdate",{...}]` is received.

### 2. Debugging Backend & Concurrency
- **Inspect Redis In-Memory Holds**:
  If using `redis-cli` or Upstash Console:
  ```bash
  # List all active seat holds
  KEYS seat_hold:*

  # Inspect who is holding seat B4 for event 673...
  GET seat_hold:6732a10b42f1b8a91c:B4

  # Check remaining TTL in seconds
  TTL seat_hold:6732a10b42f1b8a91c:B4
  ```
- **Inspect MongoDB Direct State**:
  In MongoDB Compass or `mongosh`:
  ```javascript
  // Check booked seats array
  db.events.findOne({ _id: ObjectId("673...") }, { bookedSeats: 1, availableSeats: 1, capacity: 1 });

  // Check active holds awaiting payment
  db.bookings.find({ status: "hold" }, { selectedSeats: 1, holdExpiresAt: 1, user: 1 });
  ```

---

## 5. Common Runtime Failures & Solutions

### 1. `Cannot read properties of undefined (reading 'buffer')`
- **Location**: `backend/controllers/event.controller.js:110` (`updateEvent`) and `contact.controller.js:13`.
- **Cause**: The code accesses `req.file.buffer` directly without first checking `if (req.file)`. If a user updates event text without attaching a new image file, this uncaught TypeError occurs.
- **Resolution**: Guard with `if (req.file && req.file.buffer)`.

### 2. `razorpay is not defined`
- **Location**: `backend/controllers/event.controller.js:194` (`cancelEvent`).
- **Cause**: When an organizer cancels an event with bookings, the refund logic invokes `razorpay.payments.refund(...)`, but `razorpay` was never imported at the top of `event.controller.js`.
- **Resolution**: Import Razorpay or initialize the client inside `cancelEvent` using dynamic `await import("razorpay")` as done in `booking.controller.js:419`.

### 3. ERR_ERL_KEY_GEN_IPV6 Rate Limiter Crash
- **Location**: `backend/app.js:27-30`.
- **Resolution Already Implemented**: The code explicitly uses `ipKeyGenerator(req, res)` from `express-rate-limit` to normalize IPv6 subnets, preventing node crashes on modern dual-stack networks.

---

## 6. Recommended Test Suites to Implement

To elevate EventSphere to enterprise production quality, the following automated test suites should be added:

```
tests/
├── unit/
│   ├── seatHold.test.js       -> Unit test Redis hold, multi-seat rollback, and TTL expiry
│   └── bookingLock.test.js    -> Test MongoDB $nin findOneAndUpdate with mock collections
├── integration/
│   ├── auth.test.js           -> Supertest: /register, /login, /refresh-token, cookie issuance
│   └── booking.test.js        -> Supertest: End-to-end /create-order and /verify-payment cycle
└── e2e/
    └── checkout.spec.js       -> Playwright: Click seat -> Redirect Stripe -> View QR ticket
```

---

## 7. Summary for Technical Interviews

> "EventSphere implements centralized error handling using a custom `ApiError` class, an `asyncHandler` wrapper for async routes, and a terminal `errorMiddleware` that serializes uniform JSON responses. For testing, the codebase currently features a standalone concurrency stress script (`concurrencyTest.js`) executing 20 simultaneous seat reservation requests to verify HTTP 409 rejection. In interviews, I can explain how to debug the system end-to-end: inspecting WebSocket frames in the DevTools Network tab, monitoring Redis `KEYS seat_hold:*` and `TTL` values, and auditing MongoDB atomic `$nin` array operations in Compass. I can also identify real code edge cases—such as missing null guards on `req.file` during partial updates."
