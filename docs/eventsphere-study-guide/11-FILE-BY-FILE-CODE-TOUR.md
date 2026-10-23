# File 11: File-by-File Code Tour

This document serves as your guided navigation tour through the EventSphere codebase. Rather than generating a shallow inventory of trivial files, this tour prioritizes the architectural core of the repository. For each file, we explore its responsibility, import/export relationships, execution role, and prerequisite concepts.

---

## 1. Architectural Map of Critical Files

```
c:/Projects/EventSphere/
├── vite.config.js               ──> Frontend build tooling with Tailwind v4 & React plugin
├── src/
│   ├── main.jsx                 ──> React 19 DOM mount, Redux Provider, code-split Router
│   ├── App.jsx                  ──> Application layout shell, token session rehydration
│   ├── hooks/useLiveSeatCount.js──> WebSocket seat availability listener + HTTP fallback
│   ├── Components/
│   │   ├── SeatMap.jsx          ──> 10-column interactive SVG/button seat matrix
│   │   ├── AuthLayout.jsx       ──> Client-side route protection guard
│   │   └── Chatbox/Chatbox.jsx  ──> Floating attendee community chatbox
│   ├── Pages/
│   │   ├── DetailEvent.jsx      ──> Booking checkout dispatch, seat selection, chat
│   │   ├── Profile.jsx          ──> Stripe return verify, ticket QR display, PDF export
│   │   └── Dashboard.jsx        ──> Organizer revenue analytics and Recharts visualizations
│   └── store/authslice.js       ──> Redux Toolkit slice managing session tokens
│
└── backend/
    ├── index.js                 ──> Boot sequence: DB connect, seed, migrations, HTTP/WS listen
    ├── app.js                   ──> Express 5 pipeline, CORS, 16kb limit, rate limiters
    ├── socket.js                ──> Socket.io rooms: seats:{id} (public) vs {id} (gated)
    ├── jobs/holdExpiry.js       ──> Node-Cron 60s background worker releasing expired holds
    ├── models/
    │   ├── user.model.js        ──> Mongoose schema, bcrypt hook, JWT generation methods
    │   ├── event.model.js       ──> Schema, capacity, availableSeats index, bookedSeats
    │   └── booking.model.js     ──> Concurrency status, holdExpiresAt, HMAC QR metadata
    ├── controllers/
    │   └── booking.controller.js──> 3-layer booking flow: Redis hold, DB decrement, QR code
    └── utils/
        ├── redisClient.js       ──> Unified Redis adapter: Upstash REST / ioredis / Map
        ├── seatHold.js          ──> Redis multi-seat hold with rollback on conflict
        └── bookingLock.js       ──> Atomic MongoDB $nin findOneAndUpdate seat lock
```

---

## 2. Root & Frontend Foundation

### 1. `vite.config.js` ([vite.config.js](../../vite.config.js))
- **Responsibility**: Configures Vite 7 bundler with `@vitejs/plugin-react` and `@tailwindcss/vite`.
- **Imports**: `defineConfig` from Vite, `@vitejs/plugin-react`, `@tailwindcss/vite`.
- **Role in Application**: Bundles the client application, executes JSX transformations, and integrates the zero-runtime Tailwind v4 engine.
- **Prerequisite Concepts**: ES Modules, build bundling, Vite development server.

### 2. `src/main.jsx` ([src/main.jsx](../../src/main.jsx))
- **Responsibility**: Application entry point; mounts React 19 to the DOM element `#root`.
- **Imports**: `createRoot`, `Provider` (react-redux), `createBrowserRouter`, `RouterProvider`, `React.lazy`, `Suspense`.
- **Exports**: None (Terminal entry script).
- **Called by**: Loaded directly by `index.html`.
- **Role in Application**: Initializes the Redux store, wraps the tree in `SearchProvider`, and defines the client-side routing tree with lazy-loaded chunk splitting.
- **Prerequisite Concepts**: React Virtual DOM, Code Splitting (`React.lazy`), Client-Side Routing.

### 3. `src/App.jsx` ([src/App.jsx](../../src/App.jsx))
- **Responsibility**: Global layout wrapper and session rehydration manager.
- **Imports**: `useDispatch`, `useSelector`, `Outlet`, `Header`, `Footer`, `getUserProfile`, `setCredentials`.
- **Exports**: `default App`.
- **Imported by**: `src/main.jsx` as the root route element (`path='/' element={<App />}`).
- **Role in Application**: Inspects `localStorage` on boot for an existing access token. If present, calls `/api/v1/users/profile` to restore the user session into Redux.
- **Prerequisite Concepts**: React component lifecycle (`useEffect`), Redux dispatchers.

---

## 3. Frontend State & Custom Hooks

### 1. `src/store/authslice.js` ([src/store/authslice.js](../../src/store/authslice.js))
- **Responsibility**: Manages global authentication status and tokens.
- **Imports**: `createSlice` from `@reduxjs/toolkit`.
- **Exports**: `setCredentials`, `logout`, `default authSlice.reducer`.
- **Imported by**: [src/store/store.js](../../src/store/store.js), [App.jsx](../../src/App.jsx), [Login.jsx](../../src/Components/Login/Login.jsx).
- **Role in Application**: Keeps user profile and access token in memory while synchronizing with `localStorage`.
- **Prerequisite Concepts**: Redux reducers, actions, state immutability via Immer.

### 2. `src/hooks/useLiveSeatCount.js` ([src/hooks/useLiveSeatCount.js](../../src/hooks/useLiveSeatCount.js))
- **Responsibility**: Encapsulates WebSocket seat synchronization logic for an event.
- **Imports**: `useState`, `useEffect`, `useRef`, `useCallback`, `io` from `socket.io-client`.
- **Exports**: `default useLiveSeatCount`.
- **Imported by**: [src/Pages/DetailEvent.jsx](../../src/Pages/DetailEvent.jsx).
- **Role in Application**: Subscribes to `seats:{eventId}`. Parses incoming `seatUpdate` events and falls back to HTTP polling every 30 seconds if the socket disconnects.
- **Prerequisite Concepts**: React custom hooks, WebSockets, socket event listeners, fallback polling.

---

## 4. Key Frontend Components & Pages

### 1. `src/Components/SeatMap.jsx` ([src/Components/SeatMap.jsx](../../src/Components/SeatMap.jsx))
- **Responsibility**: Renders an interactive 10-column seating grid with status-based styling.
- **Exports**: `default SeatMap`.
- **Imported by**: [src/Pages/DetailEvent.jsx](../../src/Pages/DetailEvent.jsx).
- **Role in Application**: Translates linear event capacity into a 2D matrix (`A1`, `B4`), disabling occupied chairs and enabling multi-seat selection (up to 10 seats).
- **Prerequisite Concepts**: Array matrix generation, conditional CSS styling with Tailwind and `clsx`.

### 2. `src/Pages/DetailEvent.jsx` ([src/Pages/DetailEvent.jsx](../../src/Pages/DetailEvent.jsx))
- **Responsibility**: The central event view coordinating ticket selection, pricing, checkout, reviews, and chat.
- **Exports**: `default DetailEvent`.
- **Imported by**: `src/main.jsx` (via `React.lazy`).
- **Role in Application**: Connects `useLiveSeatCount`, `SeatMap`, `Chatbox`, `ReviewCard`, and `createOrder`. Redirects users to Stripe or completes instant wallet purchases.
- **Prerequisite Concepts**: Async data fetching, controlled forms, external redirects.

### 3. `src/Pages/Profile.jsx` ([src/Pages/Profile.jsx](../../src/Pages/Profile.jsx))
- **Responsibility**: Attendee dashboard displaying confirmed bookings, ticket QR codes, and profile settings.
- **Exports**: `default Profile`.
- **Imported by**: `src/main.jsx` (via `React.lazy`).
- **Role in Application**: Parses Stripe redirect query parameters, calls `verifyPayment`, renders confirmed tickets with Base64 QR codes, and compiles tickets to PDF via `html2pdf.js`.
- **Prerequisite Concepts**: URL search params, DOM-to-canvas rendering.

---

## 5. Backend Server Core

### 1. `backend/index.js` ([backend/index.js](../../backend/index.js))
- **Responsibility**: Server entry point and boot coordinator.
- **Imports**: `connectDB`, `dotenv`, `app`, `initSocket`, `http`, `autoSeedEventsIfEmpty`, `startHoldExpiryJob`, `autoMigrateAvailableSeats`.
- **Role in Application**: Connects to MongoDB, runs database seeds and migrations, attaches Socket.io to the HTTP server, starts the hold expiry cron job, and listens on the network port.
- **Prerequisite Concepts**: Node HTTP server, asynchronous startup coordination.

### 2. `backend/app.js` ([backend/app.js](../../backend/app.js))
- **Responsibility**: Assembles the Express 5 application pipeline and registers routers.
- **Imports**: `express`, `cors`, `cookieParser`, `rateLimit`, all 6 routers, `errorMiddleware`.
- **Exports**: `default app`.
- **Imported by**: [backend/index.js](../../backend/index.js).
- **Role in Application**: Configures CORS credentials, 16kb payload parsers, dual rate limiters (`authLimiter`, `bookingLimiter`), mounts routes under `/api/v1/*`, and attaches the global error handler.
- **Prerequisite Concepts**: Express middleware pipeline, HTTP request lifecycle.

### 3. `backend/socket.js` ([backend/socket.js](../../backend/socket.js))
- **Responsibility**: Manages all WebSocket connections, rooms, and real-time events.
- **Imports**: `Server` (socket.io), `jwt`, `User`, `Booking`, `Event`, `ChatMessage`, `getTotalHeldSeats`.
- **Exports**: `initSocket`, `getIO`.
- **Imported by**: [backend/index.js](../../backend/index.js), [booking.controller.js](../../backend/controllers/booking.controller.js), [holdExpiry.js](../../backend/jobs/holdExpiry.js).
- **Role in Application**: Authenticates socket handshakes, manages public seat watching rooms (`seats:{eventId}`) and gated attendee chat rooms (`{eventId}`), and handles message persistence.
- **Prerequisite Concepts**: WebSockets, Socket.io rooms, JWT verification in socket handshakes.

---

## 6. Backend Data Models

### 1. `backend/models/user.model.js` ([backend/models/user.model.js](../../backend/models/user.model.js))
- **Responsibility**: User data schema, password hashing, and token signing.
- **Role in Application**: Defines fields (`name`, `email`, `password`, `role`, `walletPoints`), executes bcrypt pre-save hashing, and issues access/refresh tokens.
- **Prerequisite Concepts**: Mongoose schemas, password salting, JWT signing.

### 2. `backend/models/event.model.js` ([backend/models/event.model.js](../../backend/models/event.model.js))
- **Responsibility**: Event definition and physical seat inventory tracking.
- **Role in Application**: Stores venue coordinates, ticket tiers, hero images, `capacity`, `availableSeats`, and the `bookedSeats` string array.
- **Prerequisite Concepts**: Mongoose arrays, indexes, subdocument schemas.

### 3. `backend/models/booking.model.js` ([backend/models/booking.model.js](../../backend/models/booking.model.js))
- **Responsibility**: Ledger record for seat reservations, payments, and ticket QR codes.
- **Role in Application**: Tracks concurrency lifecycle (`status: "hold" | "confirmed" | "cancelled" | "expired"`), `holdExpiresAt` timestamp, payment IDs, and cryptographic QR payload hashes.
- **Prerequisite Concepts**: Foreign key references (`ObjectId`), date indexing for cron queries.

---

## 7. Controllers, Concurrency Utilities & Background Workers

### 1. `backend/controllers/booking.controller.js` ([backend/controllers/booking.controller.js](../../backend/controllers/booking.controller.js))
- **Responsibility**: Orchestrates the 3-layer booking flow.
- **Exports**: `createOrder`, `verifyPayment`, `getMyBookings`, `cancelBooking`, `getAllBookings`, `getEventBookings`, `getSeatAvailability`.
- **Imported by**: [backend/routes/booking.router.js](../../backend/routes/booking.router.js).
- **Role in Application**: Coordinates Redis holds, discount calculations, Stripe session creation, atomic MongoDB seat decrements, loyalty cashback rewards, HMAC QR generation, and Socket.io broadcasts.
- **Prerequisite Concepts**: Distributed locks, Stripe Checkout API, HMAC hashing.

### 2. `backend/utils/seatHold.js` ([backend/utils/seatHold.js](../../backend/utils/seatHold.js))
- **Responsibility**: Manages in-memory Redis seat holds.
- **Exports**: `holdSeats`, `releaseHold`, `confirmHold`, `getTotalHeldSeats`, `getUserHeldSeats`.
- **Role in Application**: Sets `seat_hold:{eventId}:{seatId}` keys with 30-minute TTLs using `redis.set NX EX`. Features automatic rollback if a batch reservation fails midway.
- **Prerequisite Concepts**: Redis `SET NX EX`, distributed locking, cache rollback.

### 3. `backend/utils/bookingLock.js` ([backend/utils/bookingLock.js](../../backend/utils/bookingLock.js))
- **Responsibility**: Executes atomic MongoDB seat reservations and restorations.
- **Exports**: `atomicDecrementSeats`, `atomicRestoreSeats`.
- **Role in Application**: Calls `Event.findOneAndUpdate` with `{ bookedSeats: { $nin: seatsArray } }`. Ensures double-bookings are rejected at the database level.
- **Prerequisite Concepts**: MongoDB document-level write atomicity, array update operators (`$push`, `$pullAll`).

### 4. `backend/jobs/holdExpiry.js` ([backend/jobs/holdExpiry.js](../../backend/jobs/holdExpiry.js))
- **Responsibility**: Background cron worker that recycles abandoned seats.
- **Exports**: `startHoldExpiryJob`, `processExpiredHolds`.
- **Imported by**: [backend/index.js](../../backend/index.js).
- **Role in Application**: Runs every 60 seconds. Queries for expired holds (`holdExpiresAt <= now`), marks bookings expired, deletes Redis keys, restores seats in MongoDB, and broadcasts updates via Socket.io.
- **Prerequisite Concepts**: Background cron scheduling, scheduled cleanup workers.

---

## 8. Summary for Technical Interviews

> "EventSphere's codebase is structured around high cohesion and clear separation of concerns. On the frontend, `App.jsx` handles session restoration, `main.jsx` configures lazy-loaded routing, and `DetailEvent.jsx` coordinates the interactive `SeatMap` with the `useLiveSeatCount` socket hook. On the backend, `index.js` bootstraps database connections and workers, `app.js` establishes an Express 5 pipeline with rate limiting, and `booking.controller.js` coordinates three specialized modules: `seatHold.js` for Redis in-memory locks, `bookingLock.js` for atomic MongoDB updates, and `socket.js` for real-time broadcasts. Abandoned carts are cleaned up every 60 seconds by `holdExpiry.js`."
