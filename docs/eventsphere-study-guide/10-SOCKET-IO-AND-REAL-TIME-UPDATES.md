# File 10: Socket.io & Real-Time Updates

This document explores the real-time communications architecture of EventSphere powered by Socket.io. It covers connection handshakes, authentication boundaries, room architectures for public seat watching versus gated community chat, event payloads, and disconnection handling.

---

## 1. Real-Time Architecture Overview

EventSphere utilizes WebSockets (via Socket.io v4) for two distinct operational purposes:

```
+-----------------------------------------------------------------------------------------+
|                                  SOCKET.IO TOPOLOGY                                     |
|                                                                                         |
|  PUBLIC REAL-TIME CHANNEL                        GATED REAL-TIME COMMUNITY              |
|  • Room: `seats:{eventId}`                       • Room: `{eventId}`                    |
|  • Access: Public (Guest or Authenticated)       • Access: Strictly Gated               |
|  • Traffic: One-way server broadcasts            • Requires: Valid JWT + Confirmed      |
|  • Payload: Seat availability, holds, inventory  •           Booking in MongoDB         |
|  • Replaces: High-frequency HTTP polling         • Traffic: Bi-directional chat         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Server Initialization & Handshake Authentication

The Socket.io server is initialized in [backend/socket.js](../../backend/socket.js#L12-L44):

```javascript
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Configurable for production environments
      methods: ["GET", "POST"],
    },
  });

  // Global Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        socket.user = null; // Unauthenticated guest -> Can watch seats, but cannot chat
        return next();
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select("-password -refreshToken");
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      socket.user = null; // Token expired/invalid -> Allow guest seat watching
      next();
    }
  });
  ...
};
```

### Architectural Highlights
- **Permissive Handshake Design**: Instead of rejecting connections without a token (`next(new Error())`), EventSphere sets `socket.user = null` and proceeds. This enables anonymous guests to view live seat availability updates on the homepage and event pages without logging in.
- **Granular Privilege Escalation**: Restricted actions (such as sending messages or joining chat rooms) verify `if (!socket.user)` at the event level.

---

## 3. Room 1: Live Seat Watching (`seats:{eventId}`)

When users view an event page, their browser subscribes to live inventory updates.

```
Client ──[watchSeats: { eventId }]──> Server joins room "seats:{eventId}"
Server ──[seatUpdate: { ... }]──────> Client updates local SeatMap visual state
Client ──[unwatchSeats: { eventId }]─> Server leaves room "seats:{eventId}"
```

### 1. Client Subscription ([backend/socket.js:57-89](../../backend/socket.js#L57-L89))
```javascript
socket.on("watchSeats", async ({ eventId }) => {
  if (!eventId) return;

  const seatRoom = `seats:${eventId}`;
  socket.join(seatRoom);

  try {
    const event = await Event.findById(eventId).select("capacity availableSeats title");
    if (!event) return socket.emit("error", "Event not found");

    const heldSeats = await getTotalHeldSeats(String(eventId));
    const effectiveFreeSeats = Math.max(
      0,
      (event.availableSeats ?? event.capacity) - heldSeats.length
    );

    // Immediately push current state to the new watcher
    socket.emit("seatUpdate", {
      eventId: String(eventId),
      availableSeats: event.availableSeats ?? event.capacity,
      heldSeats,
      effectiveFreeSeats,
      capacity: event.capacity,
      isSoldOut: effectiveFreeSeats === 0,
      fillingFast: effectiveFreeSeats > 0 && effectiveFreeSeats <= event.capacity * 0.2,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    socket.emit("error", "Failed to get seat availability");
  }
});
```

### 2. Server-Side Broadcast Triggers
The server broadcasts to `seats:{eventId}` on four lifecycle events:
1. **Seat Hold Placed**: `createOrder` sets keys in Redis and broadcasts updated `heldSeats`.
2. **Booking Confirmed**: `verifyPayment` clears Redis hold, decrements MongoDB seats, and broadcasts updated `bookedSeats`.
3. **Booking Cancelled**: `cancelBooking` restores seats and broadcasts freed inventory.
4. **Hold Expired**: The 60-second cron job releases abandoned seats and broadcasts updated availability.

---

## 4. Room 2: Attendee Community Chat (`{eventId}`)

EventSphere creates an exclusive community space for confirmed attendees.

### 1. Gated Room Admission ([backend/socket.js:97-125](../../backend/socket.js#L97-L125))
```javascript
socket.on("joinRoom", async ({ eventId }) => {
  // 1. Identity Guard
  if (!socket.user) return socket.emit("error", "Authentication required to join chat");

  try {
    // 2. Database Authorization Guard
    const booking = await Booking.findOne({
      event: eventId,
      user: socket.user._id,
      paymentstatus: "confirmed",
    });

    if (!booking) {
      return socket.emit("error", "Book this event to access the community room");
    }

    // 3. Join Socket.io Room
    socket.join(eventId);
    socket.emit("joined", `You have successfully joined chat for event ${eventId}`);

    // 4. Send Message History (Latest 20 messages)
    const history = await ChatMessage.find({ roomId: eventId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("sender", "name");

    socket.emit("chatHistory", history.reverse());
  } catch (err) {
    socket.emit("error", "Failed to join room");
  }
});
```

### 2. Message Dispatch & Persistence ([backend/socket.js:127-145](../../backend/socket.js#L127-L145))
```javascript
socket.on("sendMessage", async ({ roomId, message }) => {
  if (!socket.user) return socket.emit("error", "Authentication required");
  if (!message?.trim()) return;

  // Security check: Verify the sender is currently inside the room
  const rooms = Array.from(socket.rooms);
  if (!rooms.includes(roomId)) {
    return socket.emit("error", "You are not allowed to send messages to this room");
  }

  // Persist to MongoDB
  const newMessage = await ChatMessage.create({
    roomId,
    sender: socket.user._id,
    message,
  });

  const populatedMsg = await newMessage.populate("sender", "name");
  // Broadcast to all participants in the room
  io.to(roomId).emit("newMessage", populatedMsg);
});
```

---

## 5. Socket Event Reference Table

| Event Name | Direction | Payload Example | Authentication Required? | Description |
| :--- | :---: | :--- | :---: | :--- |
| `watchSeats` | Client -> Server | `{ eventId: "673..." }` | No (Guest allowed) | Subscribes socket to `seats:{eventId}` updates |
| `unwatchSeats` | Client -> Server | `{ eventId: "673..." }` | No | Unsubscribes socket from seat room |
| `seatUpdate` | Server -> Client | `{ availableSeats, heldSeats: ["A1"], effectiveFreeSeats, isSoldOut, fillingFast }` | No | Real-time broadcast of current seat status |
| `joinRoom` | Client -> Server | `{ eventId: "673..." }` | Yes (Confirmed Booking) | Joins attendee community chat |
| `joined` | Server -> Client | `"You have successfully joined chat..."` | Yes | Confirmation of room membership |
| `chatHistory` | Server -> Client | `[{ sender: { name }, message, createdAt }]` | Yes | Array of last 20 messages |
| `sendMessage` | Client -> Server | `{ roomId: "673...", message: "Hello!" }` | Yes | Dispatches a message to room |
| `newMessage` | Server -> Client | `{ _id, sender: { name }, message, createdAt }` | Yes | Broadcasts new message to room |
| `typing` | Client -> Server | `roomId` | Yes | Emits typing notification to room |
| `stopTyping` | Client -> Server | `roomId` | Yes | Clears typing notification in room |
| `leaveRoom` | Client -> Server | `roomId` | Yes | Leaves chat room |

---

## 6. Frontend Integration: Hooks and Components

### 1. `useLiveSeatCount.js` ([src/hooks/useLiveSeatCount.js](../../src/hooks/useLiveSeatCount.js))
- Initializes client socket connection:
  ```javascript
  const socket = io(BACKEND_URL, {
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  ```
- **Resilience Strategy**: If the socket server is unreachable (`connect_error`), it switches to HTTP fallback polling every 30 seconds:
  ```javascript
  socket.on("connect_error", () => {
    isSocketConnected.current = false;
    pollSeatAvailability();
    pollTimerRef.current = setInterval(pollSeatAvailability, 30000);
  });
  ```

### 2. `Chatbox.jsx` ([src/Components/Chatbox/Chatbox.jsx](../../src/Components/Chatbox/Chatbox.jsx))
- Passes JWT access token during connection handshake:
  ```javascript
  const newSocket = io(import.meta.env.VITE_BACKEND_URL, {
    auth: { token },
    transports: ["websocket"],
  });
  ```
- Catches server errors (such as unconfirmed bookings) and renders Toastify alerts:
  ```javascript
  newSocket.on("error", (err) => {
    toast.error(err, { position: "top-right" });
  });
  ```

---

## 7. Scaling WebSockets in Production

In a multi-instance or clustered server environment (such as multiple containers on AWS ECS or Kubernetes), Socket.io requires an external message broker.

```
Instance 1 (Render) <─── Redis Pub/Sub Adapter ───> Instance 2 (Render)
        │                                                    │
     Client A                                             Client B
```

If Client A connects to Server Instance 1 and triggers a seat hold, Instance 1 must emit the `seatUpdate` across all other server instances using the **Socket.io Redis Streams / Pub-Sub Adapter** (`@socket.io/redis-adapter`). Without this adapter, users connected to Instance 2 will not receive real-time updates triggered on Instance 1.

---

## 8. Summary for Technical Interviews

> "EventSphere implements real-time communication using Socket.io v4. The connection handshake uses a permissive authentication middleware that allows anonymous guests to join `seats:{eventId}` rooms to receive live seat updates, while restricting attendee chat rooms (`{eventId}`) to authenticated users with confirmed bookings. The seat-watching architecture eliminates expensive HTTP polling during ticket drops, while the chat subsystem provides message persistence in MongoDB, typing indicators, and message history retrieval. In production, this architecture can be scaled horizontally using the Socket.io Redis Pub/Sub adapter."
