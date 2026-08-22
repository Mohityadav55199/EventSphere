/**
 * migrateAvailableSeats.js
 *
 * One-time migration script to backfill `availableSeats` on all existing Event documents.
 *
 * Formula:
 *   availableSeats = capacity - SUM(seatsBooked of confirmed bookings)
 *
 * Run with:
 *   node backend/scripts/migrateAvailableSeats.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

// Import models AFTER dotenv so env is loaded
const { default: Event } = await import("../models/event.model.js");
const { default: Booking } = await import("../models/booking.model.js");

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const events = await Event.find({});
    console.log(`📋 Found ${events.length} events to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const event of events) {
      // Sum confirmed bookings for this event
      const [result] = await Booking.aggregate([
        {
          $match: {
            event: event._id,
            $or: [
              { paymentstatus: "confirmed" },
              { status: "confirmed" },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalSeatsBooked: { $sum: "$seatsBooked" },
          },
        },
      ]);

      const totalBooked = result?.totalSeatsBooked || 0;
      const availableSeats = Math.max(0, event.capacity - totalBooked);

      if (event.availableSeats !== undefined && event.availableSeats === availableSeats) {
        skipped++;
        continue;
      }

      await Event.findByIdAndUpdate(event._id, { availableSeats });
      console.log(
        `  ✅ "${event.title}" → capacity: ${event.capacity}, booked: ${totalBooked}, available: ${availableSeats}`
      );
      updated++;
    }

    console.log(`\n🎉 Migration complete: ${updated} updated, ${skipped} already correct`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

migrate();
