/**
 * holdExpiry.js — Cron job to clean up expired seat holds
 *
 * Runs every 60 seconds. Finds Booking documents that have:
 *   - status: "hold"
 *   - holdExpiresAt: in the past
 *
 * For each expired hold:
 *   1. Marks the booking status = "expired"
 *   2. Atomically restores seats in MongoDB (availableSeats += seatsBooked)
 *   3. Broadcasts seatUpdate via Socket.io so live seat counters update
 *
 * This is the safety net that handles users who:
 *   - Opened Stripe checkout but closed the browser tab
 *   - Lost internet mid-payment
 *   - Abandoned checkout without cancelling
 */

import cron from "node-cron";
import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import { atomicRestoreSeats } from "../utils/bookingLock.js";
import { releaseHold } from "../utils/seatHold.js";
import { getTotalHeldSeats } from "../utils/seatHold.js";

// Helper: emit seat update to watching clients
async function emitSeatUpdate(eventId) {
  try {
    const { getIO } = await import("../socket.js");
    const io = getIO();
    const event = await Event.findById(eventId).select("availableSeats capacity");
    const heldSeats = await getTotalHeldSeats(String(eventId));

    io.to(`seats:${eventId}`).emit("seatUpdate", {
      eventId: String(eventId),
      availableSeats: event?.availableSeats ?? 0,
      heldSeats,
      effectiveFreeSeats: Math.max(0, (event?.availableSeats ?? 0) - heldSeats),
      capacity: event?.capacity ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical — socket might not be initialized during tests
  }
}

let isRunning = false; // Prevent overlapping runs

async function processExpiredHolds() {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();

    // Find all expired hold bookings
    const expiredBookings = await Booking.find({
      status: "hold",
      holdExpiresAt: { $lte: now },
    });

    if (expiredBookings.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`⏰ Hold expiry job: processing ${expiredBookings.length} expired hold(s)`);
    const affectedEventIds = new Set();

    for (const booking of expiredBookings) {
      try {
        // 1. Mark booking expired
        await Booking.findByIdAndUpdate(booking._id, {
          status: "expired",
          paymentstatus: "cancelled",
          cancelDate: now,
        });

        // 2. Release Redis hold (might already be gone, but clean up anyway)
        await releaseHold(String(booking.event), String(booking.user));

        // 3. Restore seats atomically in MongoDB
        const event = await Event.findById(booking.event).select("capacity");
        await atomicRestoreSeats(booking.event, booking.seatsBooked, event?.capacity);

        affectedEventIds.add(String(booking.event));

        console.log(
          `  ✅ Expired hold for booking ${booking._id}: restored ${booking.seatsBooked} seats to event ${booking.event}`
        );
      } catch (err) {
        console.error(`  ❌ Failed to process expired booking ${booking._id}:`, err.message);
      }
    }

    // 4. Broadcast seat updates for all affected events
    for (const eventId of affectedEventIds) {
      await emitSeatUpdate(eventId);
    }
  } catch (err) {
    console.error("❌ Hold expiry job error:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the hold expiry cron job.
 * Call this once from index.js after the server boots.
 */
function startHoldExpiryJob() {
  // Run every 60 seconds
  cron.schedule("* * * * *", processExpiredHolds);
  console.log("🕐 Seat hold expiry job started (runs every 60 seconds)");
}

export { startHoldExpiryJob, processExpiredHolds };
