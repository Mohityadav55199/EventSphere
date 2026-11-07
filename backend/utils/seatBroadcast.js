import Event from "../models/event.model.js";
import { getTotalHeldSeats } from "./seatHold.js";

// Pushes the current seat state of an event to everyone watching it over Socket.io.
// Non-critical: a failed emit must never fail the booking flow.
export async function emitSeatUpdate(eventId) {
  try {
    const { getIO } = await import("../socket.js");
    const io = getIO();
    const event = await Event.findById(eventId).select("availableSeats capacity bookedSeats");
    const heldSeats = await getTotalHeldSeats(String(eventId)); // array of seat IDs

    io.to(`seats:${eventId}`).emit("seatUpdate", {
      eventId: String(eventId),
      availableSeats: event?.availableSeats ?? 0,
      bookedSeats: event?.bookedSeats || [],
      heldSeats: heldSeats || [],
      capacity: event?.capacity ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // socket may not be initialised (tests) or the event may be gone
  }
}
