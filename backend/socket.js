// socket.js
import { Server } from "socket.io";
import ChatMessage from "./models/chatMessage.model.js";
import jwt from "jsonwebtoken";
import User from "./models/user.model.js";
import Booking from "./models/booking.model.js";
import Event from "./models/event.model.js";
import { getTotalHeldSeats } from "./utils/seatHold.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Change in production
      methods: ["GET", "POST"],
    },
  });

  // Authenticate socket connection
  io.use(async (socket, next) => {
    try {
      // Allow unauthenticated connections for public seat watching
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        socket.user = null; // unauthenticated — can only watch seats
        return next();
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select("-password -refreshToken");
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      next();
    } catch (err) {
      // Token invalid but allow connection for seat watching
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    if (socket.user) {
      console.log(`✅ User connected: ${socket.user.name}`);
    } else {
      console.log(`👤 Guest connected (seat watcher): ${socket.id}`);
    }

    // ── CONCURRENCY: Watch live seat count for an event ───────────────────────
    // Any client (logged in or not) can subscribe to a seats room for live updates.
    // The booking controller's emitSeatUpdate() broadcasts here after every
    // hold / release / confirm / expiry.
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
          (event.availableSeats ?? event.capacity) - heldSeats
        );

        // Immediately send current state to the new watcher
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

        console.log(`👁️  Socket ${socket.id} watching seats for event ${eventId}`);
      } catch (err) {
        socket.emit("error", "Failed to get seat availability");
      }
    });

    // Stop watching seats for an event
    socket.on("unwatchSeats", ({ eventId }) => {
      socket.leave(`seats:${eventId}`);
    });

    // ── Chat: Join event community room (requires confirmed booking) ────────────
    socket.on("joinRoom", async ({ eventId }) => {
      if (!socket.user) return socket.emit("error", "Authentication required to join chat");

      try {
        const booking = await Booking.findOne({
          event: eventId,
          user: socket.user._id,
          paymentstatus: "confirmed",
        });

        if (!booking) {
          return socket.emit("error", "Book this event to access the community room");
        }

        socket.join(eventId);
        socket.emit("joined", `You have successfully joined chat for event ${eventId}`);
        console.log(`💬 User ${socket.user._id} joined room: ${eventId}`);

        const history = await ChatMessage.find({ roomId: eventId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate("sender", "name");

        socket.emit("chatHistory", history.reverse());
      } catch (err) {
        console.error(err);
        socket.emit("error", "Failed to join room");
      }
    });

    socket.on("sendMessage", async ({ roomId, message }) => {
      if (!socket.user) return socket.emit("error", "Authentication required");
      if (!message?.trim()) return;

      const rooms = Array.from(socket.rooms);
      if (!rooms.includes(roomId)) {
        return socket.emit("error", "You are not allowed to send messages to this room");
      }

      const newMessage = await ChatMessage.create({
        roomId,
        sender: socket.user._id,
        message,
      });

      const populatedMsg = await newMessage.populate("sender", "name");
      io.to(roomId).emit("newMessage", populatedMsg);
    });

    socket.on("leaveRoom", (roomId) => {
      socket.leave(roomId);
      if (socket.user) console.log(`User ${socket.user.name} left room: ${roomId}`);
    });

    socket.on("typing", (roomId) => {
      if (socket.user) socket.to(roomId).emit("typing", socket.user.name);
    });

    socket.on("stopTyping", (roomId) => {
      socket.to(roomId).emit("stopTyping");
    });

    socket.on("disconnect", () => {
      if (socket.user) console.log(`User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
