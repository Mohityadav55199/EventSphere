/**
 * loadTest.js — proves the seat-booking race protection with real HTTP traffic.
 *
 *   npm run loadtest                # defaults: 300 users racing for 30 seats
 *   USERS=1000 SEATS=50 npm run loadtest
 *
 * What it does (no setup needed, nothing touches your real database):
 *   1. starts the real Express app on a random port with an in-memory MongoDB
 *   2. creates one free event with SEATS seats and USERS attendees
 *   3. every attendee fires a create-order request for a random seat, CONCURRENCY at a time
 *   4. checks the invariants: no seat sold twice, counter matches, successes <= seats
 *
 * Exits with code 1 if any invariant is violated.
 */
import http from "node:http";
import { startTestApp, stopTestApp, makeEvent } from "../tests/integration/helpers.js";
import { seatIdAt } from "../utils/seatLayout.js";

const USERS = Number(process.env.USERS) || 300;
const SEATS = Number(process.env.SEATS) || 30;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 100; // requests in flight at once (OS socket backlog limits a single burst)

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

const ctx = await startTestApp();
const server = http.createServer(ctx.app);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

console.log(`\nEventSphere booking load test: ${USERS} users, ${SEATS} seats\n`);

// Users are inserted raw (bcrypt-hashing hundreds of passwords is not what we are measuring)
const organizer = new ctx.User({ name: "organizer", email: "org@load.dev", password: "x", role: "organizer" });
await ctx.User.collection.insertOne(organizer.toObject());
const event = await makeEvent(ctx.Event, organizer._id, { capacity: SEATS, Price: 0 });

const attendees = Array.from({ length: USERS }, (_, i) => new ctx.User({
  name: `load user ${i}`, email: `load${i}@load.dev`, password: "x", role: "attendee",
}));
await ctx.User.collection.insertMany(attendees.map((u) => u.toObject()));
const tokens = attendees.map((u) => u.genearteAccessToken());

const seatIds = Array.from({ length: SEATS }, (_, i) => seatIdAt(i)); // real seat-map ids (A1..C10 for 30 seats)
const fire = async (token) => {
  const seat = seatIds[Math.floor(Math.random() * SEATS)];
  const started = performance.now();
  const res = await fetch(`${base}/api/v1/bookings/create-order/${event._id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ selectedSeats: [seat] }),
  });
  await res.arrayBuffer();
  return { status: res.status, ms: performance.now() - started };
};

const t0 = performance.now();
const results = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, USERS) }, async () => {
  while (next < tokens.length) results.push(await fire(tokens[next++]));
}));
const totalMs = performance.now() - t0;

const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
const latencies = results.map((r) => r.ms).sort((a, b) => a - b);

const fresh = await ctx.Event.findById(event._id);
const confirmed = await ctx.Booking.find({ event: event._id, status: "confirmed" });
const sold = confirmed.flatMap((b) => b.selectedSeats);

const checks = [
  ["no seat sold twice", new Set(sold).size === sold.length],
  ["bookedSeats has no duplicates", new Set(fresh.bookedSeats).size === fresh.bookedSeats.length],
  ["availableSeats == capacity - booked", fresh.availableSeats === fresh.capacity - fresh.bookedSeats.length],
  ["bookings never exceed capacity", sold.length <= SEATS],
  ["confirmed bookings == seats in event", sold.length === fresh.bookedSeats.length],
  ["no 5xx responses", !results.some((r) => r.status >= 500)],
];

console.log(`Finished in ${(totalMs / 1000).toFixed(2)}s  (${(USERS / (totalMs / 1000)).toFixed(0)} req/s)`);
console.log("Responses by status:", byStatus);
console.log(`Latency  p50 ${percentile(latencies, 50).toFixed(0)} ms | p95 ${percentile(latencies, 95).toFixed(0)} ms | p99 ${percentile(latencies, 99).toFixed(0)} ms`);
console.log(`Seats sold: ${sold.length}/${SEATS}   (distinct seats requested by ${USERS} users, so conflicts are expected)\n`);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);

server.close();
await stopTestApp();
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
