/**
 * holdExpiry.js — Cron job to clean up expired seat holds
 *
 * Runs every 60 seconds. Finds Booking documents that have:
 *   - status: "hold"
 *   - holdExpiresAt: in the past
 *
 * For each expired hold:
 *   1. Marks the booking status = "expired"
 *   2. Releases the Redis seat holds (MongoDB seats are only taken on payment,
 *      so there is nothing to restore there)
 *   3. Broadcasts seatUpdate via Socket.io so live seat counters update
 *
 * This is the safety net that handles users who:
 *   - Opened Stripe checkout but closed the browser tab
 *   - Lost internet mid-payment
 *   - Abandoned checkout without cancelling
 */

import cron from "node-cron";
import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import { releaseHold } from "../utils/seatHold.js";
import { emitSeatUpdate } from "../utils/seatBroadcast.js";

let isRunning = false; // Prevent overlapping runs

async function processExpiredHolds() {
  if (isRunning) return;
  // Queries would just buffer and time out while MongoDB is down
  if (mongoose.connection.readyState !== 1) return;
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
        // 1. Mark booking expired - conditional, so a payment confirmed a moment ago is never overwritten
        const expired = await Booking.findOneAndUpdate(
          { _id: booking._id, status: "hold" },
          { status: "expired", paymentstatus: "cancelled", cancelDate: now }
        );
        if (!expired) continue;

        // 2. Release the Redis holds for exactly the seats this booking reserved
        await releaseHold(String(booking.event), String(booking.user), booking.selectedSeats);

        affectedEventIds.add(String(booking.event));
        console.log(`  ✅ Expired hold for booking ${booking._id}: released ${booking.selectedSeats.length} seat(s) on event ${booking.event}`);
      } catch (err) {
        console.error(`  ❌ Failed to process expired booking ${booking._id}:`, err.message);
      }
    }

    // 3. Broadcast seat updates for all affected events
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
