/**
 * autoMigrateAvailableSeats.js
 *
 * Runs once on server boot. For every Event that is missing `availableSeats`,
 * it calculates:
 *   availableSeats = capacity - SUM(confirmed bookings)
 *
 * Safe to run repeatedly — skips events that already have availableSeats set.
 */

import Event from "../models/event.model.js";
import Booking from "../models/booking.model.js";

async function autoMigrateAvailableSeats() {
  try {
    // Only find events where availableSeats is not yet set
    const events = await Event.find({ availableSeats: { $exists: false } });

    if (events.length === 0) {
      console.log("✅ availableSeats migration: all events already migrated, skipping.");
      return;
    }

    console.log(`🔄 availableSeats migration: backfilling ${events.length} event(s)...`);

    for (const event of events) {
      const [result] = await Booking.aggregate([
        {
          $match: {
            event: event._id,
            $or: [{ paymentstatus: "confirmed" }, { status: "confirmed" }],
          },
        },
        { $group: { _id: null, total: { $sum: "$seatsBooked" } } },
      ]);

      const booked = result?.total || 0;
      const available = Math.max(0, event.capacity - booked);

      await Event.findByIdAndUpdate(event._id, { availableSeats: available });
      console.log(`  ✅ "${event.title}" → capacity: ${event.capacity}, booked: ${booked}, available: ${available}`);
    }

    console.log(`🎉 availableSeats migration complete: ${events.length} event(s) updated.`);
  } catch (err) {
    // Non-fatal — log and continue server startup
    console.error("❌ availableSeats migration error (non-fatal):", err.message);
  }
}

export { autoMigrateAvailableSeats };
