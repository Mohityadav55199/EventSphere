# File 12: End-to-End Feature Traces

This document traces seven end-to-end features through EventSphere. For each trace, we follow the execution path from the user's initial interaction in the browser, through frontend components and HTTP/WebSocket transports, into Express middleware and controllers, down to Redis and MongoDB, and back to the client interface.

---

## 1. Trace 1: User Registration & Session Rehydration

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee (Browser)
    participant Form as SignUp.jsx
    participant API as user.routes.js (/register)
    participant Ctrl as user.controllers.js (registerUser)
    participant Model as user.model.js (pre-save)
    participant DB as MongoDB Atlas
    participant Redux as Redux authSlice

    User->>Form: Fills name, email, password & submits
    Form->>API: POST /api/v1/users/register { name, email, password }
    API->>Ctrl: asyncHandler(registerUser)
    Ctrl->>DB: User.findOne({ email })
    DB-->>Ctrl: Returns null (Email available)
    
    Ctrl->>Model: User.create({ name, email, password })
    Note over Model: Pre-save hook hashes password with bcrypt (10 rounds)
    Model->>DB: Saves user document with bcrypt hash
    
    Ctrl->>Model: genearteAccessToken() & refreshAccessToken()
    Model-->>Ctrl: Returns signed JWT access & refresh tokens
    Ctrl->>DB: User.updateOne({ refreshToken })
    
    Ctrl-->>Form: 201 Created { user, accessToken, refreshToken }
    Form->>Redux: dispatch(setCredentials({ user, accessToken }))
    Form->>User: Redirects to / and displays user avatar in Header
```

### Code Execution Breakdown
1. **Frontend Dispatch**: In [src/Components/Signup/SignUp.jsx:32](../../src/Components/Signup/SignUp.jsx#L32), the user submits credentials. `registerUser()` calls `axiosInstance.post("/api/v1/users/register")`.
2. **Backend Validation & Hashing**: In [backend/controllers/user.controllers.js:23-50](../../backend/controllers/user.controllers.js#L23-L50), `registerUser` verifies non-empty fields and checks email uniqueness. `User.create()` triggers the Mongoose pre-save hook in [backend/models/user.model.js:43-47](../../backend/models/user.model.js#L43-L47) which hashes the password using `bcrypt.hash(password, 10)`.
3. **Token Generation**: Controller invokes `user.genearteAccessToken()` (1-day expiry) and `user.refreshAccessToken()` (10-day expiry), stores the refresh token in MongoDB, and returns the user object (excluding the password) with status 201.
4. **Client Rehydration**: The response payload triggers `dispatch(setCredentials(...))` in [src/store/authslice.js:15](../../src/store/authslice.js#L15), writing the access token to `localStorage` and updating Redux state so the header immediately displays the user's initial.

---

## 2. Trace 2: Live Seat Watching on Event Page

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee (Browser)
    participant Page as DetailEvent.jsx
    participant Hook as useLiveSeatCount.js
    participant SocketServer as backend/socket.js
    participant Redis as Unified Redis
    participant DB as MongoDB Atlas

    User->>Page: Navigates to /events/673...
    Page->>DB: GET /api/v1/events/event/:id
    DB-->>Page: Event details (capacity: 50, Price: 500)
    
    Page->>Hook: useLiveSeatCount("673...")
    Hook->>SocketServer: io.connect() & emit("watchSeats", { eventId: "673..." })
    
    SocketServer->>SocketServer: socket.join("seats:673...")
    SocketServer->>DB: Event.findById("673...").select("capacity availableSeats")
    SocketServer->>Redis: getTotalHeldSeats("673...")
    Redis-->>SocketServer: Returns held seats array (e.g. ["A1", "A2"])
    
    SocketServer-->>Hook: emit("seatUpdate", { availableSeats: 48, heldSeats: ["A1","A2"], effectiveFreeSeats: 46 })
    Hook-->>Page: seatData updated -> SeatMap highlights A1, A2 as "In Cart" (amber)
```

### Code Execution Breakdown
1. **Hook Mounting**: On entering [src/Pages/DetailEvent.jsx:31](../../src/Pages/DetailEvent.jsx#L31), `useLiveSeatCount(id)` executes inside [src/hooks/useLiveSeatCount.js](../../src/hooks/useLiveSeatCount.js).
2. **WebSocket Handshake**: Connects to the server, passing optional auth headers. In [backend/socket.js:21-44](../../backend/socket.js#L21-L44), `io.use()` verifies identity or defaults `socket.user = null` for anonymous seat watchers.
3. **Room Subscription**: Hook emits `watchSeats({ eventId })`. The server joins the socket to `seats:${eventId}`, inspects Redis via `getTotalHeldSeats()`, calculates `effectiveFreeSeats`, and emits back an immediate `seatUpdate` snapshot ([backend/socket.js:57-89](../../backend/socket.js#L57-L89)).
4. **UI State Render**: The hook updates state, causing [src/Components/SeatMap.jsx](../../src/Components/SeatMap.jsx) to disable seats in `heldSeats` and color them amber.

---

## 3. Trace 3: High-Concurrency Seat Selection & Race Condition

What happens when two users click "Checkout" for the exact same seat (`B4`) at the exact same millisecond?

```mermaid
sequenceDiagram
    autonumber
    actor A as User A (Browser)
    actor B as User B (Browser)
    participant API as Express API Server
    participant Redis as Unified Redis Client
    participant Mongo as MongoDB Atlas
    participant Socket as Socket.io Server

    Note over A,B: Simultaneous checkout click on seat B4
    A->>API: POST /create-order/:id { selectedSeats: ["B4"] }
    B->>API: POST /create-order/:id { selectedSeats: ["B4"] }

    Note over API,Redis: Redis single-threaded event loop processes User A first
    API->>Redis: User A: set seat_hold:eventId:B4 userA NX EX 1800
    Redis-->>API: Returns "OK" (Key created successfully)

    Note over API,Redis: Redis processes User B immediately after
    API->>Redis: User B: set seat_hold:eventId:B4 userB NX EX 1800
    Redis-->>API: Returns null (Key already exists!)

    API-->>B: 409 Conflict ("Seat B4 is currently reserved by someone else.")
    Note over B: Browser shows error toast: "Seat B4 is currently reserved"

    API->>Mongo: User A: Booking.create({ status: "hold", holdExpiresAt: now+30m })
    API->>Socket: emitSeatUpdate (heldSeats: ["B4"])
    Socket-->>B: Socket updates SeatMap: Seat B4 immediately turns amber!
    API-->>A: 200 OK { checkoutUrl: "https://checkout.stripe.com/..." }
```

### Code Execution Breakdown
1. **Parallel Requests**: User A and User B submit `POST /api/v1/bookings/create-order/:id` with `selectedSeats: ["B4"]`.
2. **Atomic In-Memory Check**: In [backend/utils/seatHold.js:46-71](../../backend/utils/seatHold.js#L46-L71), `holdSeats()` calls `redis.set(key, userId, { nx: true, ex: 1800 })`.
3. **Deterministic Separation**: Redis evaluates commands sequentially. User A's command executes first, finds no key, writes `userA`, and returns `"OK"`. User B's command evaluates a fraction of a millisecond later, sees the key exists, and returns `null`.
4. **Conflict Handling**: User B's loop enters line 65, executes rollback cleanup (if multi-seat), and returns `{ success: false, reason: "Seat B4 is currently reserved" }`. In [backend/controllers/booking.controller.js:108-110](../../backend/controllers/booking.controller.js#L108-L110), this throws `ApiError(409)`, returning HTTP 409 Conflict.
5. **Real-time Sync**: User A's order triggers `emitSeatUpdate(eventId)`, broadcasting the new hold across WebSockets so User B's seat map turns amber in real time.

---

## 4. Trace 4: Stripe Payment & Ticket Confirmation

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee (Browser)
    participant Stripe as Stripe Hosted Checkout
    participant Profile as Profile.jsx
    participant API as booking.router.js (/verify-payment)
    participant Ctrl as booking.controller.js (verifyPayment)
    participant Redis as Redis Cache
    participant Mongo as MongoDB Atlas
    participant Socket as Socket.io Server

    User->>Stripe: Completes card payment on Stripe Checkout
    Stripe-->>User: Redirects to /profile?session_id=cs_test_123&booking_id=673...
    
    Profile->>Profile: Reads query params & clears URL immediately
    Profile->>API: POST /api/v1/bookings/verify-payment { stripe_session_id, bookingId, selectedSeats }
    
    API->>Ctrl: asyncHandler(verifyPayment)
    Ctrl->>Redis: confirmHold(eventId, userId, ["B4"]) -> del key
    
    Ctrl->>Mongo: Event.findOneAndUpdate({ _id: eventId, bookedSeats: { $nin: ["B4"] } }, { $push: { bookedSeats: "B4" } })
    Note over Mongo: Atomic DB guard guarantees seat is permanently occupied
    
    Ctrl->>Mongo: Booking.updateOne({ _id: bookingId }, { status: "confirmed", paymentstatus: "confirmed" })
    Ctrl->>Ctrl: generateSecureQRCode(booking) (HMAC-SHA256 signature)
    Ctrl->>Mongo: Booking.save() (Saves Base64 QR code Data URL)
    
    Ctrl->>Mongo: User.updateOne({ _id: userId }, { $inc: { walletPoints: cashback } })
    Ctrl->>Socket: emitSeatUpdate (bookedSeats: ["B4"])
    
    Ctrl-->>Profile: 201 Created { booking, earnedPoints, remainingPoints }
    Profile-->>User: Displays confirmed ticket with QR code and PDF Download button
```

### Code Execution Breakdown
1. **Hosted Payment**: Attendee completes card authorization on Stripe. Stripe redirects browser to `${CLIENT_URL}/profile?session_id={CHECKOUT_SESSION_ID}...` ([booking.controller.js:238](../../backend/controllers/booking.controller.js#L238)).
2. **Client Redirection Catch**: In [src/Pages/Profile.jsx:22-59](../../src/Pages/Profile.jsx#L22-L59), `useEffect` catches `session_id`, clears search parameters via `setSearchParams({})` to prevent duplicate submissions on page refresh, and posts to `/verify-payment`.
3. **Atomic MongoDB Lock**: In [backend/utils/bookingLock.js:24-34](../../backend/utils/bookingLock.js#L24-L34), `atomicDecrementSeats` executes `$push: { bookedSeats: { $each: seatsArray } }` with a conditional filter `{ bookedSeats: { $nin: seatsArray } }`.
4. **Cryptographic Ticket Signing**: In [backend/controllers/booking.controller.js:69-78](../../backend/controllers/booking.controller.js#L69-L78), `generateSecureQRCode` generates an HMAC-SHA256 signature over `bookingId:randomHex` using `QR_SECRET` and saves the Base64 PNG data URL to `booking.qrCode`.
5. **Cashback Credit**: Awards 5% cashback in wallet points: `earnedPoints = Math.floor(amountPaid / 20)` ([booking.controller.js:355](../../backend/controllers/booking.controller.js#L355)).

---

## 5. Trace 5: Gate Check-In & Anti-Fraud Scan

```mermaid
sequenceDiagram
    autonumber
    actor Usher as Organizer / Gate Usher
    participant Scanner as Scanner Device
    participant API as booking.router.js (/checkin)
    participant Mid as qrScan.middleware.js
    participant DB as MongoDB Atlas

    Usher->>Scanner: Scans attendee's QR ticket at venue entrance
    Scanner->>API: POST /api/v1/bookings/checkin { payload, hash } (Auth: Bearer OrganizerToken)
    
    API->>Mid: qrScanMiddleware
    Mid->>Mid: Recompute expectedHash = HMAC-SHA256(payload, QR_SECRET)
    
    alt Tampered QR Code (hash !== expectedHash)
        Mid-->>Scanner: 400 Bad Request ("Invalid QR code data")
        Scanner-->>Usher: Red Alert: FORGED / TAMPERED TICKET
    else Cryptographic Signature Valid
        Mid->>DB: Booking.findById(bookingId)
        alt Ticket Already Checked In (booking.checkedIn === true)
            Mid-->>Scanner: 400 Bad Request ("User already checked in")
            Scanner-->>Usher: Red Alert: DUPLICATE ENTRY ATTEMPT
        else Valid First-Time Admission
            Mid->>DB: Booking.updateOne({ _id: bookingId }, { checkedIn: true })
            Mid-->>Scanner: 200 OK { booking, message: "Check-in successful" }
            Scanner-->>Usher: Green Screen: ATTENDEE ADMITTED
        end
    end
```

### Code Execution Breakdown
1. **Scanner Dispatch**: The scanner decodes the JSON payload from the attendee's ticket: `{ payload: "6732...:a1f8...", hash: "7f83..." }` and submits a POST request to `/api/v1/bookings/checkin`.
2. **Cryptographic Integrity Check**: In [backend/middlewares/qrScan.middleware.js:15-22](../../backend/middlewares/qrScan.middleware.js#L15-L22), the server computes an HMAC-SHA256 digest over `payload` using the server's private `process.env.QR_SECRET`. If the result does not match `hash`, it rejects the request immediately.
3. **Single-Use Check**: Fetches the booking document and checks `if (booking.checkedIn)`. If true, it throws `ApiError(400, "User already checked in")`, preventing ticket sharing or duplicate entry.
4. **Admission**: Sets `booking.checkedIn = true`, commits to MongoDB, and returns HTTP 200.

---

## 6. Trace 6: Gated Attendee Community Chat

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Confirmed Attendee
    participant ChatUI as Chatbox.jsx
    participant SocketServer as backend/socket.js
    participant DB as MongoDB Atlas

    Attendee->>ChatUI: Clicks floating chat icon on Event Page
    ChatUI->>SocketServer: io.connect({ auth: { token } })
    SocketServer-->>ChatUI: Connection accepted
    
    ChatUI->>SocketServer: emit("joinRoom", { eventId: "673..." })
    SocketServer->>DB: Booking.findOne({ event: "673...", user: socket.user._id, paymentstatus: "confirmed" })
    
    alt Attendee has NOT purchased a ticket
        DB-->>SocketServer: Returns null
        SocketServer-->>ChatUI: emit("error", "Book this event to access the community room")
        ChatUI-->>Attendee: Toast error: "Book this event to access the community room"
    else Attendee has confirmed booking
        DB-->>SocketServer: Returns confirmed booking document
        SocketServer->>SocketServer: socket.join("673...")
        SocketServer->>DB: ChatMessage.find({ roomId: "673..." }).sort({ createdAt: -1 }).limit(20)
        DB-->>SocketServer: Recent 20 messages
        SocketServer-->>ChatUI: emit("chatHistory", messages.reverse())
        
        Attendee->>ChatUI: Types message & clicks Send
        ChatUI->>SocketServer: emit("sendMessage", { roomId: "673...", message: "See you there!" })
        SocketServer->>DB: ChatMessage.create({ roomId, sender, message })
        SocketServer-->>SocketServer: io.to("673...").emit("newMessage", populatedMsg)
        SocketServer-->>ChatUI: New message appended to chat stream
    end
```

### Code Execution Breakdown
1. **Chat Activation**: Attendee opens `<ChatBox eventId={id} />` in [src/Components/Chatbox/Chatbox.jsx](../../src/Components/Chatbox/Chatbox.jsx).
2. **Access Verification**: In [backend/socket.js:97-125](../../backend/socket.js#L97-L125), `socket.on("joinRoom")` executes a MongoDB query verifying that a confirmed booking exists for that user and event.
3. **Rejection or History Injection**: Unconfirmed users receive an `error` event. Confirmed ticket holders join the room and receive the previous 20 messages via `chatHistory`.
4. **Message Broadcasting**: On `sendMessage`, the server verifies room membership, saves the document to MongoDB, and broadcasts `newMessage` to all connected attendees in the room.

---

## 7. Trace 7: Hold Expiration & Background Recycling

```mermaid
sequenceDiagram
    autonumber
    participant Cron as node-cron Worker (holdExpiry.js)
    participant Mongo as MongoDB Atlas
    participant Redis as Redis Cache
    participant Socket as Socket.io Server
    actor Watcher as Active Browser (Attendee)

    Note over Cron: Executes every 60 seconds (* * * * *)
    Cron->>Mongo: Booking.find({ status: "hold", holdExpiresAt: { $lte: new Date() } })
    Mongo-->>Cron: Returns 1 expired booking (User abandoned checkout 31m ago)
    
    Cron->>Mongo: Booking.findByIdAndUpdate(id, { status: "expired", paymentstatus: "cancelled" })
    Cron->>Redis: releaseHold(eventId, userId) -> del seat_hold keys
    Cron->>Mongo: atomicRestoreSeats(eventId, seatsBooked)
    
    Cron->>Socket: emitSeatUpdate(eventId)
    Socket-->>Watcher: emit("seatUpdate", { effectiveFreeSeats: incremented })
    Note over Watcher: Abandoned seat turns from amber back to emerald (Available)
```

### Code Execution Breakdown
1. **Cron Trigger**: In [backend/jobs/holdExpiry.js:111-115](../../backend/jobs/holdExpiry.js#L111-L115), `cron.schedule("* * * * *", processExpiredHolds)` fires every minute.
2. **Expired Hold Query**: Queries `Booking` documents where `status == "hold"` and `holdExpiresAt <= new Date()` utilizing the index on `holdExpiresAt`.
3. **Resource Restoration**:
   - Marks booking `status = "expired"`.
   - Calls `releaseHold()` to delete Redis keys.
   - Calls `atomicRestoreSeats()` to restore inventory.
4. **Live Inventory Repopulation**: Dispatches `emitSeatUpdate(eventId)` across Socket.io so browsing attendees instantly see the returned seats become clickable again.

---

## 8. Summary for Technical Interviews

> "EventSphere coordinates transactions across multiple synchronized layers. For example, during seat reservations, a client submission executes an atomic Redis `SET NX EX` hold with rollback on partial failures, writes a pending booking document with a 30-minute expiration, and generates a synchronized Stripe session. Following checkout, client verification confirms the hold, triggers a MongoDB atomic `$nin` push operation to prevent database-level double bookings, issues an HMAC-SHA256 signed QR ticket, and credits loyalty cashback. If a checkout is abandoned, a 60-second cron job recycles the seats, and Socket.io broadcasts the freed inventory back to all active browsers."
