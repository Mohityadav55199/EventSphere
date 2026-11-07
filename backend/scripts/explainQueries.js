/**
 * explainQueries.js — measures what the indexes actually buy us.
 *
 *   npm run explain             # 30k events, 150k bookings
 *   EVENTS=100000 npm run explain
 *
 * Seeds an in-memory MongoDB, then runs each hot query twice with explain("executionStats"):
 *   - forced collection scan  (hint {$natural: 1})  = what you get with no index
 *   - normal planner choice   (uses our indexes)
 * and prints documents examined + execution time. Nothing touches your real database.
 */
import mongoose from "mongoose";
import { startTestApp, stopTestApp } from "../tests/integration/helpers.js";

const EVENTS = Number(process.env.EVENTS) || 30000;
const BOOKINGS = EVENTS * 5;
const USERS = 2000;

const ctx = await startTestApp();
const { Event, Booking, User } = ctx;
await Promise.all([Event.init(), Booking.init(), User.init()]);

const words = ["jazz", "tech", "food", "art", "startup", "film", "yoga", "music", "robot", "comedy", "gaming", "poetry"];
const cities = ["Delhi", "Mumbai", "Pune", "Bengaluru", "Chennai", "Kolkata", "Jaipur", "Lucknow"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const day = 24 * 3600 * 1000;

const organizers = Array.from({ length: 200 }, () => new mongoose.Types.ObjectId());
const users = Array.from({ length: USERS }, () => new mongoose.Types.ObjectId());

console.log(`Seeding ${EVENTS} events and ${BOOKINGS} bookings ...`);
const eventDocs = Array.from({ length: EVENTS }, (_, i) => ({
  _id: new mongoose.Types.ObjectId(),
  title: `${pick(words)} ${pick(words)} night ${i}`,
  description: `A ${pick(words)} experience featuring ${pick(words)} and ${pick(words)}.`,
  date: new Date(Date.now() + (Math.random() * 400 - 100) * day),
  location: pick(cities),
  locationGoogleMapLink: "https://maps.example.com",
  organizer: pick(organizers),
  image: "https://img.example.com/e.jpg",
  Price: Math.floor(Math.random() * 2000),
  category: pick(["Movie", "Music", "Workshop", "Sports", "Other"]),
  capacity: 500,
  availableSeats: 500,
  bookedSeats: [],
  activeStatus: Math.random() < 0.9 ? "active" : "cancelled",
  createdAt: new Date(), updatedAt: new Date(),
}));
await Event.collection.insertMany(eventDocs, { ordered: false });

const bookingDocs = Array.from({ length: BOOKINGS }, (_, i) => ({
  user: pick(users),
  event: eventDocs[Math.floor(Math.random() * EVENTS)]._id,
  selectedSeats: [`S${i}`],
  seatsBooked: 1,
  status: Math.random() < 0.8 ? "confirmed" : pick(["cancelled", "expired", "hold"]),
  paymentstatus: "confirmed",
  amountPaid: Math.floor(Math.random() * 1500),
  createdAt: new Date(Date.now() - Math.random() * 120 * day),
  updatedAt: new Date(),
}));
// bookings are inserted without the unique seat index getting in the way (every seat id is distinct anyway)
await Booking.collection.insertMany(bookingDocs, { ordered: false });

const sampleUser = bookingDocs[0].user;
const sampleOrganizer = eventDocs[0].organizer;
const organizerEventIds = eventDocs.filter((e) => String(e.organizer) === String(sampleOrganizer)).map((e) => e._id);

const cases = [
  {
    name: "Public events list (active, soonest first, page of 20)",
    run: (hint) => {
      let q = Event.find({ activeStatus: "active" }).sort({ date: 1 }).limit(20);
      return hint ? q.hint(hint) : q;
    },
    collscan: { $natural: 1 },
  },
  {
    name: "Full-text search for a specific term (matches 1 event)",
    run: (hint) => {
      let q = Event.find({ $text: { $search: "12345" } });
      return hint ? q.hint(hint) : q;
    },
    // a $text query cannot run without its text index, so the baseline is a regex scan over the text fields
    baseline: () => Event.find({ $or: [{ title: /12345/ }, { description: /12345/ }, { location: /12345/ }] }),
  },
  {
    name: "My bookings (one user, newest first)",
    run: (hint) => {
      let q = Booking.find({ user: sampleUser }).sort({ createdAt: -1 });
      return hint ? q.hint(hint) : q;
    },
    collscan: { $natural: 1 },
  },
  {
    name: "Organizer dashboard: confirmed bookings of own events",
    run: (hint) => {
      let q = Booking.find({ event: { $in: organizerEventIds }, status: "confirmed" });
      return hint ? q.hint(hint) : q;
    },
    collscan: { $natural: 1 },
  },
  {
    name: "Organizer's own events",
    run: (hint) => {
      let q = Event.find({ organizer: sampleOrganizer });
      return hint ? q.hint(hint) : q;
    },
    collscan: { $natural: 1 },
  },
];

const stats = async (query) => {
  const e = await query.explain("executionStats");
  const s = e.executionStats;
  return { examined: s.totalDocsExamined, returned: s.nReturned, ms: s.executionTimeMillis };
};

const rows = [];
for (const c of cases) {
  const without = await stats(c.baseline ? c.baseline() : c.run(c.collscan));
  const withIdx = await stats(c.run());
  rows.push({
    query: c.name,
    "docs scanned (no index)": without.examined,
    "docs scanned (index)": withIdx.examined,
    "ms (no index)": without.ms,
    "ms (index)": withIdx.ms,
  });
}

console.log(`\nResults on ${EVENTS} events / ${BOOKINGS} bookings:\n`);
console.table(rows);
await stopTestApp();
process.exit(0);
