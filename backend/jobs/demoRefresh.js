/**
 * demoRefresh.js — keeps the public demo bookable without anyone remembering to do it.
 *
 * Demo events are seeded once with dates relative to that day, so after a few weeks they are all
 * in the past and the API (correctly) refuses to book them. When DEMO_MODE=true, this job moves the
 * demo organizer's past, still-active events forward by whole weeks (same weekday and time).
 *
 * Safety:
 *   - off unless DEMO_MODE=true
 *   - only events owned by the demo organizer account (DEMO_ORGANIZER_EMAIL); real organizers'
 *     events are never touched
 *   - cancelled events are left alone, bookings are not modified
 *
 * Cost: it runs inside the server, so it only runs while the server is already awake. It never
 * wakes a sleeping free-tier instance (unlike an external keep-alive ping), so it uses no extra
 * Render hours. It runs once right after the database connects (i.e. when a visitor wakes the
 * server) and then daily while the server stays up.
 */
import cron from "node-cron";
import mongoose from "mongoose";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import { rollForwardByWeeks } from "../utils/demoDates.js";

export const DEFAULT_DEMO_ORGANIZER_EMAIL = "organizer@eventease.com";
const MIN_LEAD_DAYS = 7; // moved events land at least a week ahead

export const isDemoMode = () => process.env.DEMO_MODE === "true";

/** Returns how many events were moved. Safe to call any time. */
export async function refreshDemoEvents(now = new Date()) {
  if (!isDemoMode() || mongoose.connection.readyState !== 1) return 0;

  const email = (process.env.DEMO_ORGANIZER_EMAIL || DEFAULT_DEMO_ORGANIZER_EMAIL).toLowerCase();
  const organizer = await User.findOne({ email }).select("_id").lean();
  if (!organizer) return 0;

  const stale = await Event.find({ organizer: organizer._id, activeStatus: "active", date: { $lt: now } })
    .select("date title")
    .lean();
  if (stale.length === 0) return 0;

  await Event.bulkWrite(
    stale.map((e) => ({
      updateOne: {
        // the date in the filter makes this a no-op if something else changed the event meanwhile
        filter: { _id: e._id, date: e.date, activeStatus: "active" },
        update: { $set: { date: rollForwardByWeeks(e.date, now, MIN_LEAD_DAYS) } },
      },
    }))
  );
  console.log(`🗓️  Demo mode: moved ${stale.length} past demo event(s) into the future`);
  return stale.length;
}

export function startDemoRefreshJob() {
  if (!isDemoMode()) return;
  refreshDemoEvents().catch((err) => console.error("Demo refresh failed:", err.message));
  cron.schedule("17 3 * * *", () => {
    refreshDemoEvents().catch((err) => console.error("Demo refresh failed:", err.message));
  });
  console.log("🗓️  Demo mode on: demo events are kept in the future automatically");
}
