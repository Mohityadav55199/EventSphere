/**
 * refreshDemoEvents.js — one-off: move past, still-active events into the future.
 *
 *   cd backend
 *   node scripts/refreshDemoEvents.js                 # dry run: shows what would change
 *   node scripts/refreshDemoEvents.js --apply         # saves it (spread over the next 365 days)
 *   node scripts/refreshDemoEvents.js --apply --days=180
 *
 * With DEMO_MODE=true on the server this happens automatically for the demo organizer's events
 * (see jobs/demoRefresh.js). This script is the manual version: it covers EVERY past active event,
 * whoever owns it, and spreads them out so the demo stays bookable for a long time.
 * Events are spaced evenly from 2 weeks ahead to --days ahead, keeping their original time of day.
 * Bookings are not changed. Uses MONGODB_URI from backend/.env, so check which database that is.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectForScript } from "../config/db.js";
import Event from "../models/event.model.js";
import { DAY_MS } from "../utils/demoDates.js";

dotenv.config({ path: "./.env" });
const apply = process.argv.includes("--apply");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const horizonDays = Math.max(21, Math.min(730, Number(daysArg?.split("=")[1]) || 365));
const FIRST_DAY = 14;

await connectForScript(); // same Windows/ISP DNS workaround as the server, no localhost fallback
console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);
const now = new Date();
const past = await Event.find({ activeStatus: "active", date: { $lt: now } }).sort({ date: 1 });
if (past.length === 0) console.log("No past active events. Nothing to do.");

for (const [i, event] of past.entries()) {
  const old = new Date(event.date);
  const offsetDays = past.length === 1
    ? FIRST_DAY
    : FIRST_DAY + Math.round((i * (horizonDays - FIRST_DAY)) / (past.length - 1));
  const next = new Date(now.getTime() + offsetDays * DAY_MS);
  next.setHours(old.getHours(), old.getMinutes(), 0, 0);
  console.log(`${apply ? "Moved" : "Would move"}: ${event.title}  ${old.toISOString().slice(0, 10)} -> ${next.toISOString().slice(0, 10)}`);
  if (apply) await Event.updateOne({ _id: event._id, date: event.date }, { $set: { date: next } });
}
if (!apply && past.length) console.log(`\nDry run only (spread over ${horizonDays} days). Re-run with --apply to save these dates.`);
await mongoose.disconnect();
