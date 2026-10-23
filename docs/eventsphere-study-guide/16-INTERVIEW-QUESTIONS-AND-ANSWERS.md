# File 16: Interview Questions and Answers (112 Questions)

This document contains 112 technical interview questions and project-specific answers derived directly from the EventSphere codebase. Questions range from fundamental programming concepts to advanced architectural edge cases, organized across 12 distinct categories.

---

## Category 1: Project Overview & General Architecture (Q1 – Q10)

### Q1: Can you give a 60-second elevator pitch of EventSphere?
> "EventSphere is a full-stack event discovery, real-time seat reservation, and ticketing platform built with React 19, Node.js, Express 5, MongoDB Atlas, and Redis. It solves the high-concurrency overselling problem using a three-tier architecture: transient seat holds in Redis prevent race conditions during a 30-minute checkout window; atomic MongoDB `findOneAndUpdate` updates serialize commits at the database level; and Socket.io broadcasts live seat availability to active clients. Confirmed bookings issue HMAC-SHA256 signed QR tickets verifiable at venue gates, and attendees gain access to exclusive real-time community chat rooms."

### Q2: What are the three user personas in EventSphere and how are their permissions enforced?
> "The personas are `attendee`, `organizer`, and `admin`, defined in `backend/models/user.model.js:23-28`. Attendees can discover events, reserve seats, pay via Stripe or loyalty points, download QR tickets, and chat in confirmed event rooms. Organizers can create events, upload banners to Cloudinary, monitor revenue bar charts, and scan attendee QR codes. Admins have global visibility over all bookings and can permanently delete events. Permissions are enforced via `authorizeRoles(...roles)` middleware in `backend/middlewares/role.middleware.js`."

### Q3: Why is EventSphere architected as a decoupled client-server system instead of a monolith?
> "Decoupling the React Vite SPA from the Express backend allows independent scaling and hosting. The frontend is hosted on Vercel's global Edge CDN for fast initial loads, while the backend runs as a persistent service on Render to maintain long-lived WebSocket connections and background cron workers. They communicate over standard REST and WebSockets with CORS credentials enabled."

### Q4: What happens if the primary MongoDB database connection fails on startup?
> "In `backend/config/db.js:19-27`, `connectDB()` implements an automated fallback mechanism. If the primary cloud connection throws an error, it catches the exception and attempts to connect to a local MongoDB instance at `mongodb://localhost:27017/EventSphere`. If the fallback also fails, it logs an error and exits the process (`process.exit(1)`)."

### Q5: How does EventSphere bootstrap initial data on a fresh deployment?
> "During the boot sequence in `backend/index.js:17`, the server calls `autoSeedEventsIfEmpty()`. It checks if `Event.countDocuments() === 0`. If the collection is empty, it automatically provisions an organizer account (`organizer@eventsphere.com`) and seeds 5 rich sample events across different categories with pre-filled capacities and descriptions."

### Q6: What is the purpose of the `autoMigrateAvailableSeats` script?
> "Legacy events previously tracked seat availability only through `capacity`. When the platform migrated to support explicit seat arrays and atomic decrements, `autoMigrateAvailableSeats()` was introduced (`backend/utils/autoMigrateAvailableSeats.js`). On startup, it backfills `availableSeats = capacity` on any event lacking that field, ensuring backward compatibility."

### Q7: Where are static uploaded assets stored?
> "Event banners and support inquiry proof files are uploaded directly to Cloudinary using `multer.memoryStorage()` and `cloudinary.uploader.upload_stream` via `streamifier` (`backend/utils/cloudinary.js`). Only the resulting secure HTTPS CDN URL is stored in MongoDB."

### Q8: What role does Node-Cron play in the architecture?
> "Node-Cron runs an in-process background worker every 60 seconds (`backend/jobs/holdExpiry.js`). It queries MongoDB for bookings where `status === 'hold'` and `holdExpiresAt <= new Date()`. For each expired record, it cancels the booking, releases the Redis hold, restores inventory in MongoDB, and broadcasts updated availability via Socket.io."

### Q9: How are environment secrets managed between client and server?
> "Client secrets (prefixed with `VITE_` like `VITE_BACKEND_URL`) are bundled into the static assets at build time by Vite. Backend secrets (`ACCESS_TOKEN_SECRET`, `STRIPE_SECRET_KEY`, `QR_SECRET`, `CLOUDINARY_API_SECRET`) are kept strictly server-side in `backend/.env` and are never exposed to the browser."

### Q10: What is the primary architectural bottleneck if traffic increases 100x?
> "Socket.io in-memory state. Currently, WebSocket connections and rooms reside in Node process memory. If we scale out to multiple backend containers on Render or AWS, Socket.io cannot broadcast events across instances without deploying the `@socket.io/redis-adapter`."

---

## Category 2: JavaScript, React & State Management (Q11 – Q20)

### Q11: How does React 19 root mounting differ from legacy React 17/18?
> "React 19 uses `createRoot(document.getElementById('root')).render(...)` from `react-dom/client` inside a `<StrictMode>` wrapper (`src/main.jsx:66-74`). This enables the concurrent rendering pipeline and automatic batching of state updates."

### Q12: Why does EventSphere use `React.lazy()` and `<Suspense>` on every route?
> "In `src/main.jsx:12-21`, all 10 page components are imported dynamically via `const Component = lazy(() => import(...))`. This enables route-level code splitting: Vite bundles each page into a separate JavaScript chunk, so visitors only download the code for the specific screen they are viewing, drastically reducing First Contentful Paint (FCP)."

### Q13: How does the Redux Toolkit `authSlice` maintain authentication on page refresh?
> "In `src/store/authslice.js`, the initial state initializes `accessToken: localStorage.getItem('accessToken') || null`. On mount, `src/App.jsx:15-42` checks for this token and executes `getUserProfile(token)` to validate it against the backend, rehydrating the Redux `user` object."

### Q14: Explain the difference between React Context and Redux Toolkit in this project.
> "Redux Toolkit (`src/store/store.js`) manages global, structured, security-sensitive state (`user`, `accessToken`, `status`) with immutable reducers. React Context (`src/Context/SearchContext.jsx`) is used exclusively for lightweight, ephemeral UI state—sharing the `searchTerm` string between the header input and the event catalog without prop drilling."

### Q15: How does `useLiveSeatCount` clean up resources when navigating away?
> "In `src/hooks/useLiveSeatCount.js:125-131`, the `useEffect` cleanup return function emits `socket.emit('unwatchSeats', { eventId })`, calls `socket.disconnect()`, nullifies the socket reference, and clears any active HTTP fallback polling interval (`clearInterval(pollTimerRef.current)`)."

### Q16: How is the 10-column seat grid generated in `SeatMap.jsx`?
> "In `src/Components/SeatMap.jsx:21-28`, given an event capacity $C$, it computes `rows = Math.ceil(C / 10)`. For row $r$ and column $c$, it derives the seat identifier by converting the row index to ASCII (`String.fromCharCode(65 + r)`) and appending `c + 1`, generating labels like `A1`, `B4`, etc."

### Q17: Why does `SeatMap.jsx` use `clsx` and `tailwind-merge` (`twMerge`)?
> "In `src/Components/SeatMap.jsx:6-9`, the `cn()` utility combines `clsx` (for conditional class logic, like applying amber if a seat is held) with `twMerge` (to resolve conflicting Tailwind utility classes cleanly without stylesheet collisions)."

### Q18: What is the purpose of `messagesEndRef.current?.scrollIntoView()` in `Chatbox.jsx`?
> "In `src/Components/Chatbox/Chatbox.jsx:20-22`, a `useEffect` listens to changes in the `messages` array. Whenever a new message arrives or is sent, it triggers a smooth scroll to an empty anchor `div` at the bottom of the container, ensuring the latest chat messages remain visible."

### Q19: How does `Profile.jsx` export tickets to PDF on the client?
> "In `src/Pages/Profile.jsx:127-139`, `handleDownloadPDF()` passes the DOM element `ticket-${bookingId}` to `html2pdf()`. The library uses `html2canvas` to render the DOM node (including the Base64 QR image) into a canvas at $2\times$ scale, and `jsPDF` compiles it into an A4 PDF downloaded directly by the browser."

### Q20: How does `DetailEvent.jsx` prevent double-submission when clicking 'Pay'?
> "In `src/Pages/DetailEvent.jsx:78-80`, `handleBooking()` guards execution with an `isBooking` boolean state flag. If `isBooking` is already true, it returns immediately. It sets `setIsBooking(true)` during API calls and resets it in a `finally` block."

---

## Category 3: Node.js, Express & Runtime (Q21 – Q30)

### Q21: What are the key advantages of running Express 5.1.0 in this project?
> "Express 5 natively handles rejected promises in async middleware and route handlers. In Express 4, unhandled promise rejections in async routes would cause the process to hang or crash unless wrapped in explicit try-catch blocks. Express 5 automatically routes rejected promises directly to our terminal `errorMiddleware`."

### Q22: Why is the backend configured with `"type": "module"` in `package.json`?
> "In `backend/package.json:5`, `"type": "module"` enables native ECMAScript Modules (ESM). This allows modern `import` and `export` statements throughout the backend rather than legacy CommonJS `require()` and `module.exports`."

### Q23: Why does `app.use(express.json({ limit: "16kb" }))` specify a 16kb limit?
> "In `backend/app.js:46`, body parsers are restricted to 16kb to defend against Denial of Service (DoS) memory exhaustion attacks. If a malicious client attempts to flood the server with megabyte-sized JSON payloads, Express rejects the request with HTTP 413 Payload Too Large before allocating memory."

### Q24: How does `asyncHandler.js` eliminate boilerplate across controllers?
> "In `backend/utils/asyncHandler.js`, it wraps route handlers: `(req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`. This guarantees that any unhandled exception or rejected promise inside a controller is passed automatically to `next(err)`."

### Q25: Why is `express.static("Public")` placed before the router mounts?
> "In `backend/app.js:48`, static middleware is mounted early so requests for static assets (like favicon or local uploads) are served directly from disk without executing route matching or database middleware."

### Q26: How does the server combine Express with Socket.io on the same port?
> "In `backend/index.js:24-25`, the Express app is passed to Node's native `http.createServer(app)`. Socket.io is attached to that same HTTP server instance via `initSocket(server)`. When `server.listen(port)` is called, both HTTP REST traffic and WebSocket upgrade handshakes are handled on the single port."

### Q27: How does `cookie-parser` simplify authentication?
> "In `backend/app.js:49`, `cookieParser()` parses the HTTP `Cookie` header into an object at `req.cookies`. This allows `authMiddleware` to access `req.cookies.accessToken` cleanly without manual string splitting."

### Q28: How does EventSphere handle unhandled exceptions in development vs. production?
> "In `backend/middlewares/error.middleware.js:8`, `stack: process.env.NODE_ENV === 'development' ? err.stack : undefined`. In development, full stack traces are sent to the client for debugging; in production, stack traces are omitted to prevent exposing internal file paths and system information."

### Q29: What happens if `process.env.PORT` is not defined?
> "In `backend/index.js:23`, `const port = process.env.PORT || 5000;`. It gracefully defaults to port 5000 for local development."

### Q30: Why does `backend/constant.js` export `DB_NAME = "EventSphere"`?
> "It centralizes the MongoDB database name so connection strings, scripts, and migration utilities share a single source of truth, preventing accidental connection to arbitrary default databases."

---

## Category 4: REST APIs, Routing & Middleware (Q31 – Q40)

### Q31: What is the exact execution order of middlewares for a request to `POST /api/v1/bookings/create-order/:eventId`?
> "1. `cors()` -> 2. `express.json({ limit: '16kb' })` -> 3. `cookieParser()` -> 4. `bookingLimiter` (rate limiter) -> 5. `authMiddleware` (validates JWT, attaches `req.user`) -> 6. `createOrder` controller -> 7. `errorMiddleware` (if an exception occurs)."

### Q32: Why does `bookingLimiter` skip GET requests?
> "In `backend/app.js:35`, `skip: (req) => req.method === 'GET'`. The booking rate limiter restricts mutations (creating orders and reserving seats) to 5 per minute to prevent seat hoarding bots. However, it exempts GET requests so users refreshing seat availability are never rate-limited."

### Q33: How does `bookingLimiter` prevent the `ERR_ERL_KEY_GEN_IPV6` crash?
> "In `backend/app.js:27-30`, it uses `ipKeyGenerator(req, res)` from `express-rate-limit` combined with `req.user?._id`. Using standard `req.ip` on modern IPv6 connections can trigger key generator errors or improperly throttle entire IPv6 /64 subnets."

### Q34: What is the difference between `/api/v1/events/all-events` and `/api/v1/events/admin/all-events`?
> "In `backend/routes/event.routes.js:12 & 52`, `/all-events` is public and returns only active events (`activeStatus: { $ne: 'cancelled' }`). `/admin/all-events` requires `authorizeRoles('admin')` and returns every event in the database, including cancelled and postponed events."

### Q35: How does `upload.single("image")` handle file uploads in `createEvent`?
> "In `backend/middlewares/multer.middleware.js`, `multer` uses `memoryStorage()`. Instead of writing files to local disk, the uploaded image is stored in memory as a buffer (`req.file.buffer`), which is streamed directly to Cloudinary without creating temporary disk artifacts."

### Q36: What HTTP method and status code are used when cancelling a booking?
> "It uses `DELETE /api/v1/bookings/cancel-booking/:bookingid` and returns `200 OK` with the updated booking document (`status: 'cancelled'`) and restored seat metrics."

### Q37: How does `ApiResponse` ensure consistent client consumption?
> "Every controller wraps successful output in `new ApiResponse(statusCode, data, message)`. This guarantees the client always receives a standardized JSON shape: `{ statusCode: Number, data: Any, message: String, success: Boolean }`."

### Q38: Why does `GET /api/v1/events/analytics/:eventid` restrict access to organizers and admins?
> "Event gross revenue and ticket breakdown data is commercially sensitive. In `backend/routes/event.routes.js:33-37`, access is protected by `authMiddleware` and `authorizeRoles('organizer', 'admin')`."

### Q39: What error is returned if an attendee attempts to submit a review for an event that hasn't happened yet?
> "In `backend/controllers/review.controller.js:19-21`, it compares `new Date(event.date) > new Date()`. If the event date is in the future, it throws `ApiError(400, 'You can review only after the event date')`."

### Q40: What happens if a user submits a review for an event they never attended?
> "In `backend/controllers/review.controller.js:24-31`, it queries `Booking.findOne({ event: eventId, user: req.user._id, paymentstatus: 'confirmed' })`. If no confirmed booking exists, it throws `ApiError(403, 'You must have attended the event to review')`."

---

## Category 5: MongoDB, Mongoose & Database Design (Q41 – Q50)

### Q41: Why does `review.model.js` define a compound unique index?
> "In `backend/models/review.model.js:29`, `reviewSchema.index({ user: 1, event: 1 }, { unique: true })`. This guarantees that an attendee can create at most one review per event. Attempting to insert a duplicate throws a MongoDB duplicate key error (E11000)."

### Q42: What is the purpose of the index on `booking.model.js:31-36` (`status` and `holdExpiresAt`)?
> "The background cron worker runs every 60 seconds querying `{ status: 'hold', holdExpiresAt: { $lte: new Date() } }`. Indexing these fields allows MongoDB to locate expired holds via an index scan rather than a full collection scan."

### Q43: How does MongoDB guarantee single-document write atomicity during seat decrements?
> "In `backend/utils/bookingLock.js:24-34`, `Event.findOneAndUpdate` executes an atomic `$push` and `$inc` with `{ bookedSeats: { $nin: seatsArray } }`. MongoDB provides document-level lock atomicity, meaning parallel updates to the same event are serialized, preventing two transactions from pushing the same seat."

### Q44: What is the difference between `capacity` and `availableSeats` on the Event model?
> "In `backend/models/event.model.js:71-83`, `capacity` is the fixed physical size of the venue. `availableSeats` is a dynamic counter decremented upon booking confirmation and incremented upon cancellation."

### Q45: How does `bookedSeats` prevent duplicate seat reservations?
> "`bookedSeats` is an array of strings (e.g. `['A1', 'A2']`). The atomic booking guard uses the `$nin` (Not In) operator. If any candidate seat exists in `bookedSeats`, the query selector fails to match the document and throws HTTP 409 Conflict."

### Q46: Why is `walletPoints` protected with a `min: [0, ...]` validator?
> "In `backend/models/user.model.js:33-37`, `min: [0, 'Wallet points cannot be negative']` prevents balance corruption. If a logic error attempts to deduct more points than the user owns, Mongoose schema validation halts the operation."

### Q47: How does `Review.aggregate` recalculate event average ratings?
> "In `backend/controllers/review.controller.js:42-48`, it executes:
> `Review.aggregate([{ $match: { event: ObjectId(eventId) } }, { $group: { _id: '$event', avgRating: { $avg: '$rating' } } }])`.
> The result updates `Event.avgRating`."

### Q48: Why does `user.controllers.js` use `.select("-password")`?
> "To prevent leaking password hashes in HTTP responses. Even though passwords are encrypted with bcrypt, exposing hashes allows offline dictionary or rainbow table attacks."

### Q49: What is the role of `timestamps: true` on Mongoose schemas?
> "It automatically creates and maintains `createdAt` and `updatedAt` ISO date fields, which are used to sort bookings and order chat history."

### Q50: How does `Event.organizer` establish a relational reference in Mongoose?
> "In `backend/models/event.model.js:28-32`, `organizer: { type: Schema.Types.ObjectId, ref: 'User' }`. This foreign key allows `.populate('organizer', 'name email')` to join user details during event queries."

---

## Category 6: Redis, Caching & In-Memory Strategies (Q51 – Q60)

### Q51: Explain EventSphere's unified Redis client architecture.
> "In `backend/utils/redisClient.js`, it implements an adapter pattern:
> 1. If `UPSTASH_REDIS_REST_URL` is set, it wraps `@upstash/redis` (HTTP REST).
> 2. Else if `REDIS_URL` is set, it wraps `ioredis` (TCP connection).
> 3. Otherwise, it falls back to an in-memory JavaScript Map store with `setTimeout` TTL emulation."

### Q52: Why is Upstash REST preferred over standard TCP Redis on Render/Vercel?
> "Serverless and PaaS platforms frequently freeze or restart containers, which severs persistent TCP connections. Upstash REST communicates over stateless HTTPS requests, eliminating connection pooling and timeout issues."

### Q53: What is the Redis key naming convention for seat holds?
> "`seat_hold:{eventId}:{seatId}`. Example: `seat_hold:6732a10b42f1b8a91c:B4`. The value stored is the `userId`."

### Q54: What Redis command is used to ensure a seat hold is atomic?
> "`SET key userId NX EX 1800`. `NX` ensures the key is set **only if it does not already exist**; `EX 1800` sets a 30-minute time-to-live."

### Q55: What happens in `holdSeats()` if a user attempts to lock 3 seats and the 3rd seat fails?
> "In `backend/utils/seatHold.js:63-71`, it triggers a **rollback**: it loops through `successfullyLocked` and executes `redis.del(lockedKey)` for the first 2 seats before returning `{ success: false }`. This ensures holds are all-or-nothing."

### Q56: Why is the seat hold TTL set to 1800 seconds (30 minutes)?
> "Stripe Checkout sessions require a minimum expiration time of 30 minutes (`expires_at`). The Redis hold TTL is aligned with Stripe so the seat reservation and the hosted payment session expire simultaneously."

### Q57: How does `getUserHeldSeats()` retrieve seats held by a specific user?
> "In `backend/utils/seatHold.js:138-156`, it scans keys matching `seat_hold:{eventId}:*`, compares the stored `userId` with the requested user, and extracts the seat ID suffix (e.g. `'B4'`)."

### Q58: What is the difference between `confirmHold()` and `releaseHold()`?
> "`releaseHold()` removes keys from Redis to free seats for other users (used on cancellation or hold failure). `confirmHold()` also deletes keys from Redis because payment is complete and MongoDB becomes the permanent source of truth."

### Q59: How does the in-memory fallback handle key expiration?
> "In `backend/utils/redisClient.js:10-38`, `inMemoryClient` uses a `setTimeout` timer stored in an `inMemoryExpiry` map. When `options.ex` expires, the callback deletes the key from `inMemoryStore`."

### Q60: What are the risks of using the in-memory fallback in production?
> "1. Memory is not shared across multi-process clusters. 2. All active seat holds are lost if the server process restarts."

---

## Category 7: Authentication, Authorization & Security (Q61 – Q70)

### Q61: What payload data is embedded inside the JWT Access Token?
> "In `backend/models/user.model.js:54-64`, the access token contains `{ _id: this._id, name: this.name, email: this.email, role: this.role }`."

### Q62: Why does the Refresh Token contain only the `_id` field?
> "In `backend/models/user.model.js:66-75`, the refresh token's sole responsibility is session renewal. Minimizing payload data reduces token size and limits exposure if intercepted."

### Q63: Why are tokens stored in HTTP-Only cookies?
> "HTTP-Only cookies cannot be accessed by client-side JavaScript (`document.cookie`), mitigating Cross-Site Scripting (XSS) token exfiltration attacks."

### Q64: How does `logoutUser` invalidate tokens?
> "In `backend/controllers/user.controllers.js:86-109`, it executes `User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } })` in MongoDB and clears cookies on the response with `expires: new Date(0)`."

### Q65: What is the purpose of salt rounds in `bcrypt.hash(password, 10)`?
> "Salt rounds determine the computational cost ($2^{10} = 1024$ iterations) of hashing. This deliberate slowness protects against brute-force and dictionary attacks."

### Q66: Explain how HMAC-SHA256 secures event tickets against counterfeiting.
> "In `backend/controllers/booking.controller.js:69-78`, `generateSecureQRCode` generates a signature: `crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex')`. Because only the server knows `QR_SECRET`, attendees cannot forge valid ticket QR codes."

### Q67: What prevents an attendee from checking in twice with the same ticket?
> "In `backend/middlewares/qrScan.middleware.js:32-37`, the check-in middleware verifies `if (booking.checkedIn) throw new ApiError(400, 'User already checked in')`. Once admitted, `checkedIn` is set to `true`."

### Q68: How does `authorizeRoles` restrict endpoint access?
> "In `backend/middlewares/role.middleware.js`, it checks `if (!roles.includes(req.user.role)) throw new ApiError(403)`. Unauthorized roles are rejected before the controller executes."

### Q69: What is the risk of using string equality `hash !== expectedHash` in `qrScan.middleware.js`?
> "Standard `!==` comparisons can be vulnerable to timing attacks because evaluation halts at the first mismatched byte. Using `crypto.timingSafeEqual` is the recommended production alternative."

### Q70: How does `authMiddleware` support both browser and non-browser API clients?
> "In `backend/middlewares/auth.middleware.js:7`, it checks `req.cookies?.accessToken || req.header('Authorization')?.replace('Bearer ', '')`. It accepts either cookie credentials or `Bearer` headers."

---

## Category 8: Concurrency, Race Conditions & Seat Holds (Q71 – Q80)

### Q71: Explain the 3-Layer Concurrency Model in EventSphere.
> "Layer 1: Redis `SET NX EX` provides transient in-memory locks with automatic 30-minute expiration. Layer 2: MongoDB `findOneAndUpdate` with a `$nin` guard ensures atomic, race-proof writes at the database level. Layer 3: Socket.io broadcasts inventory changes to all connected browsers."

### Q72: What is the exact MongoDB query that guarantees no two users book the same seat?
> "In `backend/utils/bookingLock.js:24-34`:
> `Event.findOneAndUpdate({ _id: eventId, bookedSeats: { $nin: seatsArray } }, { $push: { bookedSeats: { $each: seatsArray } }, $inc: { availableSeats: -seatsArray.length } })`."

### Q73: Why does `atomicDecrementSeats` throw HTTP 409 instead of 400?
> "HTTP 409 Conflict specifically indicates that the request could not be processed due to a conflict with the current state of the resource (i.e., someone else reserved the seat moments prior)."

### Q74: What is the role of `holdExpiresAt` on the Booking model?
> "When an order is created, `holdExpiresAt` is set to `Date.now() + 1800 * 1000`. The 60-second cron job uses this index to query and release abandoned bookings."

### Q75: What happens if an attendee closes their browser tab during Stripe checkout?
> "The Redis seat hold expires after 30 minutes. Concurrently, the Node-Cron job (`holdExpiry.js`) identifies the expired booking, sets its status to `expired`, deletes any lingering Redis keys, restores seats in MongoDB, and broadcasts updated availability via Socket.io."

### Q76: Explain the bug in `holdExpiry.js:84` regarding seat restoration.
> "The cron worker calls `atomicRestoreSeats(booking.event, booking.seatsBooked)`. However, `atomicRestoreSeats` expects an array of seat strings (`seatsArray`) to execute `$pullAll: { bookedSeats: seatsArray }`. Passing a number causes `seatsArray.length` to be undefined. It should pass `booking.selectedSeats`."

### Q77: Why does `holdSeats()` pre-check keys with `redis.mget()` before setting locks?
> "In `backend/utils/seatHold.js:36-41`, `mget` executes a fast multi-key read. If any seat is already owned by someone else, it aborts before attempting to acquire locks, reducing write operations."

### Q78: Can a user refresh their own seat hold before it expires?
> "Yes. In `backend/utils/seatHold.js:54-59`, if `redis.set NX` fails because the key exists, it inspects the owner. If `owner === userId`, it refreshes the 30-minute expiration."

### Q79: How does `effectiveFreeSeats` differ from `availableSeats`?
> "`availableSeats` counts only permanently confirmed bookings against capacity. `effectiveFreeSeats` subtracts active Redis holds: `effectiveFreeSeats = Math.max(0, availableSeats - heldSeats.length)`."

### Q80: How does EventSphere notify other attendees that a seat is currently in someone's cart?
> "Immediately after setting Redis holds in `createOrder`, the controller calls `emitSeatUpdate(eventId)`. Socket.io pushes the updated `heldSeats` array to room `seats:{eventId}`, turning those chairs amber in all connected browsers."

---

## Category 9: Payments, Wallet Cashback & Idempotency (Q81 – Q88)

### Q81: How does EventSphere calculate loyalty wallet cashback?
> "In `backend/controllers/booking.controller.js:355`, `earnedPoints = Math.floor(amountPaid / 20)`. This provides 5% cashback (1 point per 20 currency units paid)."

### Q82: What coupons are verified in `booking.controller.js` and what are their discounts?
> "`SPHERE20` provides 20% off; `WELCOME10` provides 10% off; `FESTIVAL50` provides 50% off (`backend/controllers/booking.controller.js:129-134`)."

### Q83: What happens when an order is discounted to 0 using wallet points?
> "In `backend/controllers/booking.controller.js:144-191`, if `amountToPay <= 0`, the Stripe flow is bypassed entirely. The server confirms the Redis hold, atomically decrements MongoDB seats, deducts wallet points, generates the QR ticket, and returns HTTP 201 immediately."

### Q84: How are Stripe Checkout amounts formatted?
> "In `backend/controllers/booking.controller.js:222`, `unit_amount: Math.round(amountToPay * 100)`. Stripe requires values in the smallest currency unit (e.g., paise for INR, cents for USD)."

### Q85: What is the primary weakness of client-driven payment verification?
> "In `src/Pages/Profile.jsx`, payment verification occurs when Stripe redirects the browser back to `/profile?session_id=...`. If the attendee closes the tab before the redirect completes, the backend is never notified, leaving the order in `hold` until the cron worker expires it."

### Q86: How would you make payment confirmation resilient against network drops?
> "Implement an asynchronous Stripe Webhook endpoint (`/api/v1/bookings/stripe-webhook`) listening for `checkout.session.completed` events and validating signatures with `stripe.webhooks.constructEvent()`."

### Q87: How does `cancelEvent` handle refunds for existing bookings?
> "In `backend/controllers/event.controller.js:187-204`, it marks all child bookings as `cancelled`. For bookings with a `razorpayPaymentId`, it calls `razorpay.payments.refund()`."

### Q88: What metadata does EventSphere embed inside Stripe Checkout sessions?
> "In `backend/controllers/booking.controller.js:230-237`, metadata includes: `bookingId`, `eventId`, `selectedSeats` (stringified array), `discount`, `ticketTier`, and `ticketPrice`."

---

## Category 10: Socket.IO & Real-Time WebSockets (Q89 – Q96)

### Q89: How does Socket.io authenticate incoming WebSocket connections?
> "In `backend/socket.js:21-44`, `io.use()` checks `socket.handshake.auth?.token` or `socket.handshake.headers.authorization`. If valid, it decodes the JWT and attaches `socket.user`. If missing, it sets `socket.user = null` to allow anonymous seat watching."

### Q90: What is the purpose of the `seats:{eventId}` room?
> "It is a public room where active browsers watch live inventory metrics. When any user holds, books, cancels, or expires a seat, the server emits `seatUpdate` to this room."

### Q91: What security check is required before a user can join room `{eventId}`?
> "In `backend/socket.js:101-109`, `joinRoom` queries `Booking.findOne({ event: eventId, user: socket.user._id, paymentstatus: 'confirmed' })`. If the user has not purchased a ticket, the socket receives an error event and is denied entry."

### Q92: What data is sent to the client upon successfully joining the chat room?
> "In `backend/socket.js:115-120`, the server queries the 20 most recent messages from `ChatMessage` sorted chronologically, populates the sender's name, and emits `chatHistory`."

### Q93: How are typing indicators implemented?
> "The client emits `typing(roomId)` on input change. The server broadcasts `socket.to(roomId).emit('typing', socket.user.name)`. After 3 seconds of inactivity, the client emits `stopTyping(roomId)` (`backend/socket.js:151-157`)."

### Q94: How does `sendMessage` verify room membership?
> "In `backend/socket.js:131-134`, `Array.from(socket.rooms).includes(roomId)`. If the socket is not an active member of that room, it rejects the message."

### Q95: What happens if a WebSocket disconnects on the client during checkout?
> "The client-side `useLiveSeatCount` hook detects `connect_error` or `disconnect` and falls back to HTTP polling against `/api/v1/bookings/seat-availability/:eventId` every 30 seconds (`src/hooks/useLiveSeatCount.js:111-116`)."

### Q96: How would you scale EventSphere's WebSockets across multiple server nodes?
> "Deploy `@socket.io/redis-adapter`. Whenever an instance emits an event, the adapter publishes it to Redis Pub/Sub, broadcasting the message across all connected server instances."

---

## Category 11: Testing, Error Handling & Debugging (Q97 – Q104)

### Q97: What tests currently exist in the EventSphere repository?
> "The repository contains a standalone concurrency script at `backend/tests/concurrencyTest.js`. There are currently no automated unit, integration, or end-to-end test suites configured in `package.json`."

### Q98: What bug currently prevents `concurrencyTest.js` from running successfully?
> "The script sends `{ seatsBooked: 2 }`, but the backend controller strictly requires `{ selectedSeats: ['A1', 'A2'] }`. Running the script as-is produces HTTP 400 Bad Request instead of testing concurrency."

### Q99: How does `concurrencyTest.js` simulate 20 simultaneous users?
> "It maps an array of 20 user requests and executes `Promise.allSettled(promises)`, firing all 20 HTTP POST requests concurrently."

### Q100: How do you inspect active seat holds in Redis from the terminal?
> "Connect via `redis-cli` and run `KEYS seat_hold:*` to view active locks. Run `GET seat_hold:<eventId>:<seatId>` to check the holding user, and `TTL seat_hold:<eventId>:<seatId>` to check remaining seconds."

### Q101: What causes `Cannot read properties of undefined (reading 'buffer')` in `event.controller.js`?
> "In `updateEvent` (`backend/controllers/event.controller.js:110`), the code accesses `req.file.buffer` without checking `if (req.file)`. Updating event text without attaching an image triggers a TypeError."

### Q102: How do you verify WebSocket frames in Google Chrome?
> "Open DevTools -> Network -> filter by **WS** -> select the socket connection -> open the **Messages** tab to view raw Socket.io frames (e.g. `42['seatUpdate', {...}]`)."

### Q103: How does `errorMiddleware` ensure security in production?
> "In `backend/middlewares/error.middleware.js:8`, `stack: process.env.NODE_ENV === 'development' ? err.stack : undefined`. Stack traces are omitted in production to avoid exposing server file structures and dependency versions."

### Q104: What testing stack would you recommend adding to EventSphere?
> "Vitest for fast frontend unit testing, Supertest for Express API integration testing, and Playwright for end-to-end checkout and seat selection testing."

---

## Category 12: System Design, Trade-offs & Scaling (Q105 – Q112)

### Q105: Why did EventSphere choose MongoDB over PostgreSQL?
> "MongoDB provides native document arrays (`bookedSeats: [String]`, `attendees: [{ user, ticketsBooked }]`), allowing atomic array pushes and checks (`$nin`) without complex multi-table joins or relational lock contention."

### Q106: What are the trade-offs of using Redis for temporary holds instead of MongoDB?
> "Redis holds avoid high disk write churn on MongoDB during ticket drops and handle TTL expiration automatically. The trade-off is cache invalidation complexity and managing a secondary datastore."

### Q107: How would you scale EventSphere to handle a 50,000-seat stadium ticket drop?
> "1. Deploy the Socket.io Redis adapter across multiple Node instances. 2. Shard the MongoDB cluster by `eventId`. 3. Cache static event metadata on Cloudflare CDN. 4. Pre-populate seat inventories in Redis bitfields or sets."

### Q108: Why is a 60-second cron job used for hold expiry instead of Redis Keyspace Notifications?
> "Cron polling requires zero Redis configuration and works seamlessly with the in-memory fallback. In production, Redis Keyspace Notifications (`notify-keyspace-events Ex`) provide instant, event-driven cleanup without the 60-second polling delay."

### Q109: What is the risk of using `origin: true` in CORS configuration?
> "In `backend/app.js:40`, `origin: true` mirrors whatever origin the client provides, allowing any third-party domain to make credentialed requests if not restricted. In production, it should be locked down to `process.env.CLIENT_URL`."

### Q110: Why does `vercel.json` contain a rewrite rule to `index.html`?
> "Vite builds a client-side Single Page Application. Without the rewrite rule, direct browser requests to deep routes like `/events/123` or `/profile` return 404 errors from Vercel's static file server."

### Q111: How does EventSphere achieve idempotency in payment processing?
> "The pending booking document is created once in `createOrder` with a unique `_id` stored in the Stripe session metadata. When `verifyPayment` runs, it updates the existing booking document rather than creating duplicates."

### Q112: If you could refactor one architectural component in EventSphere, what would it be?
> "Migrate payment confirmation from the client-side redirect in `Profile.jsx` to an asynchronous Stripe Webhook handler with cryptographic signature verification (`stripe.webhooks.constructEvent`), ensuring guaranteed payment processing even if the user drops connection after paying."
