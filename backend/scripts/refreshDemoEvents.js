/**
 * refreshDemoEvents.js — move past, still-active events into the future so the demo stays bookable.
 *
 *   cd backend
 *   node scripts/refreshDemoEvents.js            # dry run: shows what would change
 *   node scripts/refreshDemoEvents.js --apply    # actually updates the database
 *
 * Demo events are seeded once (when the database is empty) with dates relative to that day, so
 * after a few weeks they are all in the past and the API refuses bookings for them.
 * Only events that are "active" AND already past are touched; they are spread over the next
 * 3-30 days at their original time of day. Bookings are not changed.
 * Uses MONGODB_URI from backend/.env, so check which database that points at first.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectForScript } from "../config/db.js";
import Event from "../models/event.model.js";

dotenv.config({ path: "./.env" });
const apply = process.argv.includes("--apply");
await connectForScript(); // same Windows/ISP DNS workaround as the server, no localhost fallback
console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);
const now = new Date();
const past = await Event.find({ activeStatus: "active", date: { $lt: now } }).sort({ date: 1 });
if (past.length === 0) console.log("No past active events. Nothing to do.");

const DAY = 24 * 60 * 60 * 1000;
for (const [i, event] of past.entries()) {
  const old = new Date(event.date);
  const next = new Date(now.getTime() + (3 + Math.round((i * 27) / Math.max(1, past.length - 1))) * DAY);
  next.setHours(old.getHours(), old.getMinutes(), 0, 0);
  console.log(`${apply ? "Moved" : "Would move"}: ${event.title}  ${old.toISOString().slice(0, 10)} -> ${next.toISOString().slice(0, 10)}`);
  if (apply) await Event.updateOne({ _id: event._id }, { $set: { date: next } });
}
if (!apply && past.length) console.log("\nDry run only. Re-run with --apply to save these dates.");
await mongoose.disconnect();
