import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApp, stopTestApp, makeUser, makeEvent, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

const book = (token, eventId, seats) =>
  request(ctx.app).post(`/api/v1/bookings/create-order/${eventId}`).set(auth(token)).send({ selectedSeats: seats });

test("50 users racing for the same seat: exactly one wins, the rest get 409", async () => {
  const organizer = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, organizer.user._id, { capacity: 10 }); // free event => confirms immediately
  const users = await Promise.all(Array.from({ length: 50 }, () => makeUser(ctx.User)));

  const results = await Promise.all(users.map((u) => book(u.token, event._id, ["A1"])));
  const won = results.filter((r) => r.status === 201).length;
  const conflicts = results.filter((r) => r.status === 409).length;

  assert.equal(won, 1, "exactly one booking may succeed");
  assert.equal(conflicts, 49, "everyone else must get a clean 409");

  const fresh = await ctx.Event.findById(event._id);
  assert.deepEqual(fresh.bookedSeats, ["A1"]);
  assert.equal(fresh.availableSeats, 9);
});

test("overlapping multi-seat bookings never double-sell a seat", async () => {
  const organizer = await makeUser(ctx.User, "organizer");
  const seatIds = Array.from({ length: 10 }, (_, i) => `A${i + 1}`); // row A of the seat map
  const event = await makeEvent(ctx.Event, organizer.user._id, { capacity: 10 });
  const users = await Promise.all(Array.from({ length: 40 }, () => makeUser(ctx.User)));

  // every user wants 2 random seats out of the same 10
  const pick = () => [...seatIds].sort(() => Math.random() - 0.5).slice(0, 2);
  const results = await Promise.all(users.map((u) => book(u.token, event._id, pick())));

  for (const r of results) assert.ok([201, 409].includes(r.status), `unexpected status ${r.status}`);

  const fresh = await ctx.Event.findById(event._id);
  const unique = new Set(fresh.bookedSeats);
  assert.equal(unique.size, fresh.bookedSeats.length, "a seat appears twice in bookedSeats");
  assert.equal(fresh.availableSeats, fresh.capacity - fresh.bookedSeats.length, "counter drifted from booked seats");
  assert.ok(fresh.bookedSeats.length <= 10);

  const confirmed = await ctx.Booking.find({ event: event._id, status: "confirmed" });
  const sold = confirmed.flatMap((b) => b.selectedSeats);
  assert.equal(new Set(sold).size, sold.length, "two confirmed bookings share a seat");
  assert.equal(sold.length, fresh.bookedSeats.length);
});

test("double-clicking cancel refunds the seat exactly once", async () => {
  const organizer = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, organizer.user._id);
  const buyer = await makeUser(ctx.User);
  const created = await book(buyer.token, event._id, ["A1", "A2"]);
  assert.equal(created.status, 201);
  const bookingId = created.body.data.booking._id;

  const cancel = () => request(ctx.app).delete(`/api/v1/bookings/cancel-booking/${bookingId}`).set(auth(buyer.token));
  const results = await Promise.all([cancel(), cancel(), cancel()]);

  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const fresh = await ctx.Event.findById(event._id);
  assert.equal(fresh.availableSeats, 10);
  assert.deepEqual(fresh.bookedSeats, []);
});
