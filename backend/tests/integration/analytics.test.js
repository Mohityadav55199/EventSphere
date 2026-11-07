import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApp, stopTestApp, makeUser, makeEvent, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

const buy = (token, eventId, seats, extra = {}) =>
  request(ctx.app).post(`/api/v1/bookings/create-order/${eventId}`).set(auth(token)).send({ selectedSeats: seats, ...extra });

test("organizer overview aggregates only their own confirmed bookings", async () => {
  const org = await makeUser(ctx.User, "organizer");
  const other = await makeUser(ctx.User, "organizer");
  const free = await makeEvent(ctx.Event, org.user._id, { title: "Free Show", Price: 0 });
  const mine = await makeEvent(ctx.Event, org.user._id, { title: "Paid Show", Price: 500 });
  const theirs = await makeEvent(ctx.Event, other.user._id, { title: "Other Show", Price: 900 });

  const a = await makeUser(ctx.User);
  const b = await makeUser(ctx.User);
  assert.equal((await buy(a.token, free._id, ["A1"])).status, 201);

  const order = await buy(b.token, mine._id, ["B1", "B2"]);
  await request(ctx.app).post("/api/v1/bookings/verify-payment").set(auth(b.token))
    .send({ bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  // someone else's event, and an unpaid hold: neither may appear in this organizer's numbers
  const foreign = await buy(a.token, theirs._id, ["C1"]);
  await request(ctx.app).post("/api/v1/bookings/verify-payment").set(auth(a.token))
    .send({ bookingId: foreign.body.data.bookingId, stripe_session_id: foreign.body.data.stripeSessionId });
  await buy(a.token, mine._id, ["B5"]); // left unpaid (status: hold)

  const res = await request(ctx.app).get("/api/v1/events/analytics/overview?days=7").set(auth(org.token));
  assert.equal(res.status, 200);
  const d = res.body.data;
  assert.equal(d.totals.bookings, 2);
  assert.equal(d.totals.seats, 3);
  assert.equal(d.totals.revenue, 1000);
  assert.equal(d.revenueByDay.length, 7);
  assert.equal(d.revenueByDay.reduce((sum, day) => sum + day.revenue, 0), 1000);
  assert.deepEqual(d.byEvent.map((e) => e.title), ["Paid Show", "Free Show"]);
  assert.equal(d.byTier[0].revenue, 1000);
});

test("attendees cannot read the organizer overview", async () => {
  const attendee = await makeUser(ctx.User);
  assert.equal((await request(ctx.app).get("/api/v1/events/analytics/overview").set(auth(attendee.token))).status, 403);
});

test("an organizer cannot read another organizer's event analytics", async () => {
  const owner = await makeUser(ctx.User, "organizer");
  const stranger = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, owner.user._id);
  const path = `/api/v1/events/analytics/${event._id}`;

  assert.equal((await request(ctx.app).get(path).set(auth(stranger.token))).status, 403);
  assert.equal((await request(ctx.app).get(path).set(auth(owner.token))).status, 200);
});

test("database refuses two confirmed bookings for the same seat (unique partial index)", async () => {
  await ctx.Booking.init(); // make sure indexes are built
  const org = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, org.user._id);
  const u1 = await makeUser(ctx.User);
  const u2 = await makeUser(ctx.User);
  const base = { event: event._id, selectedSeats: ["Z1"], seatsBooked: 1, status: "confirmed", paymentstatus: "confirmed" };

  await ctx.Booking.create({ ...base, user: u1.user._id });
  await assert.rejects(ctx.Booking.create({ ...base, user: u2.user._id }), (err) => err.code === 11000);

  // cancelled bookings do not block the seat
  await ctx.Booking.create({ ...base, user: u2.user._id, status: "cancelled", paymentstatus: "cancelled" });
  await ctx.Booking.create({ ...base, selectedSeats: ["Z2"], user: u2.user._id });
});
