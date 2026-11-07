import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApp, stopTestApp, makeUser, makeEvent, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

// ── Error mapping ─────────────────────────────────────────────────────────────

test("malformed ids return 400, not 500", async () => {
  assert.equal((await request(ctx.app).get("/api/v1/events/event/not-an-id")).status, 400);
  assert.equal((await request(ctx.app).get("/api/v1/reviews/AllReviews/not-an-id")).status, 400);
});

test("malformed JSON returns 400", async () => {
  const res = await request(ctx.app).post("/api/v1/users/login").set("Content-Type", "application/json").send("{bad json");
  assert.equal(res.status, 400);
});

// ── Event updates ─────────────────────────────────────────────────────────────

async function eventWithSales(sold) {
  const org = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, org.user._id, { capacity: 10 });
  const buyer = await makeUser(ctx.User);
  const seats = Array.from({ length: sold }, (_, i) => `A${i + 1}`);
  const res = await request(ctx.app).post(`/api/v1/bookings/create-order/${event._id}`).set(auth(buyer.token)).send({ selectedSeats: seats });
  assert.equal(res.status, 201);
  return { org, event };
}
const update = (token, id, body) => request(ctx.app).patch(`/api/v1/events/update-event/${id}`).set(auth(token)).send(body);

test("organizers cannot cancel an event through 'update' (that would skip refunds)", async () => {
  const { org, event } = await eventWithSales(2);
  const res = await update(org.token, event._id, { activeStatus: "cancelled" });
  assert.equal(res.status, 400);
  assert.equal((await ctx.Event.findById(event._id)).activeStatus, "active");
});

test("capacity cannot drop below seats already sold", async () => {
  const { org, event } = await eventWithSales(4);
  assert.equal((await update(org.token, event._id, { capacity: 3 })).status, 400);
  const fresh = await ctx.Event.findById(event._id);
  assert.equal(fresh.capacity, 10);
  assert.equal(fresh.availableSeats, 6);
});

test("changing capacity keeps availableSeats consistent", async () => {
  const { org, event } = await eventWithSales(4);
  const res = await update(org.token, event._id, { capacity: 20, title: "Bigger venue" });
  assert.equal(res.status, 200);
  const fresh = await ctx.Event.findById(event._id);
  assert.equal(fresh.capacity, 20);
  assert.equal(fresh.availableSeats, 16);
  assert.equal(fresh.title, "Bigger venue");
  assert.equal(fresh.bookedSeats.length, 4);
});

test("event categories offered by the form are accepted by the database", async () => {
  const org = await makeUser(ctx.User, "organizer");
  for (const category of ["Tech", "Food & Drinks", "Arts & Culture", "Conference", "Networking"]) {
    await makeEvent(ctx.Event, org.user._id, { category }); // used to throw a ValidationError
  }
  await assert.rejects(makeEvent(ctx.Event, org.user._id, { category: "Rave" }));
});

// ── Contact form & uploads ────────────────────────────────────────────────────

const contact = (token) =>
  request(ctx.app).post("/api/v1/contacts/contact").set(auth(token))
    .field("name", "Asha").field("email", "asha@test.dev").field("subject", "Refund").field("message", "Where is my refund?");

test("contact form works without an attachment", async () => {
  const user = await makeUser(ctx.User);
  assert.equal((await contact(user.token)).status, 201);
});

test("uploads must be images and at most 5MB", async () => {
  const user = await makeUser(ctx.User);
  const notImage = await contact(user.token).attach("image", Buffer.from("MZ fake exe"), { filename: "virus.exe", contentType: "application/octet-stream" });
  assert.equal(notImage.status, 400);
  const huge = await contact(user.token).attach("image", Buffer.alloc(6 * 1024 * 1024), { filename: "big.png", contentType: "image/png" });
  assert.equal(huge.status, 400);
  assert.match(huge.body.message, /too large/i);
});

// ── Account & password ────────────────────────────────────────────────────────

test("profile update validates and refuses an email that belongs to someone else", async () => {
  const a = await makeUser(ctx.User);
  const b = await makeUser(ctx.User);
  const path = "/api/v1/users/update-account";

  assert.equal((await request(ctx.app).patch(path).set(auth(a.token)).send({ name: "A", email: "nope" })).status, 400);
  assert.equal((await request(ctx.app).patch(path).set(auth(a.token)).send({ name: "Asha", email: b.user.email })).status, 409);

  const ok = await request(ctx.app).patch(path).set(auth(a.token)).send({ name: "Asha", email: "  NEW.Mail@Test.dev " });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.email, "new.mail@test.dev");
});

test("password change enforces the minimum length and signs out other devices", async () => {
  const u = await makeUser(ctx.User);
  const login = await request(ctx.app).post("/api/v1/users/login").send({ email: u.user.email, password: "password123" });
  const oldRefresh = login.body.data.refreshToken;
  const path = "/api/v1/users/change-password";

  assert.equal((await request(ctx.app).post(path).set(auth(u.token)).send({ oldPassword: "password123", newPassword: "123" })).status, 400);
  assert.equal((await request(ctx.app).post(path).set(auth(u.token)).send({ oldPassword: "wrong-pass", newPassword: "newpass123" })).status, 400);

  const ok = await request(ctx.app).post(path).set(auth(u.token)).send({ oldPassword: "password123", newPassword: "newpass123" });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.accessToken);

  // the session created before the change can no longer refresh
  assert.equal((await request(ctx.app).post("/api/v1/users/refresh-token").send({ refreshToken: oldRefresh })).status, 401);
  // and the new password works
  assert.equal((await request(ctx.app).post("/api/v1/users/login").send({ email: u.user.email, password: "newpass123" })).status, 200);
});

test("logout clears the cross-site auth cookies", async () => {
  const u = await makeUser(ctx.User);
  const res = await request(ctx.app).post("/api/v1/users/logout").set(auth(u.token));
  assert.equal(res.status, 200);
  const cookies = res.headers["set-cookie"].join(" | ");
  assert.match(cookies, /refreshToken=;/);
  assert.match(cookies, /SameSite=None/i);
  assert.match(cookies, /Expires=Thu, 01 Jan 1970/);
});

// ── Reviews ───────────────────────────────────────────────────────────────────

async function attendedPastEvent() {
  const org = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, org.user._id, { date: new Date(Date.now() - 864e5) });
  const u = await makeUser(ctx.User);
  await ctx.Booking.create({ user: u.user._id, event: event._id, selectedSeats: ["A1"], seatsBooked: 1, status: "confirmed", paymentstatus: "confirmed" });
  return { event, u };
}

test("reviews validate the rating and reject a second review with 409", async () => {
  const { event, u } = await attendedPastEvent();
  const path = `/api/v1/reviews/post-review/${event._id}`;
  assert.equal((await request(ctx.app).post(path).set(auth(u.token)).send({ rating: 6, comment: "wow" })).status, 400);
  assert.equal((await request(ctx.app).post(path).set(auth(u.token)).send({ rating: 5, comment: "Great night" })).status, 201);
  assert.equal((await request(ctx.app).post(path).set(auth(u.token)).send({ rating: 4, comment: "Again" })).status, 409);
});

test("admins can remove any review; other users cannot", async () => {
  const { event, u } = await attendedPastEvent();
  const created = await request(ctx.app).post(`/api/v1/reviews/post-review/${event._id}`).set(auth(u.token)).send({ rating: 1, comment: "spam spam" });
  const id = created.body.data._id;
  const stranger = await makeUser(ctx.User);
  const admin = await makeUser(ctx.User, "admin");
  assert.equal((await request(ctx.app).delete(`/api/v1/reviews/delete-review/${id}`).set(auth(stranger.token))).status, 403);
  assert.equal((await request(ctx.app).delete(`/api/v1/reviews/delete-review/${id}`).set(auth(admin.token))).status, 200);
});

// ── Seats, dates and attendee privacy ─────────────────────────────────────────

const order = (token, eventId, seats) =>
  request(ctx.app).post(`/api/v1/bookings/create-order/${eventId}`).set(auth(token)).send({ selectedSeats: seats });

test("only seats that exist on the seat map can be booked (no selling past capacity)", async () => {
  const org = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, org.user._id, { capacity: 12 }); // seats A1..A10, B1, B2
  const u = await makeUser(ctx.User);
  assert.equal((await order(u.token, event._id, ["VIP-1"])).status, 400);
  assert.equal((await order(u.token, event._id, ["B3"])).status, 400, "seat #13 does not exist on a 12-seat map");
  assert.equal((await order(u.token, event._id, ["B2"])).status, 201);
  const fresh = await ctx.Event.findById(event._id);
  assert.equal(fresh.availableSeats, 11);
});

test("events that already happened cannot be booked", async () => {
  const org = await makeUser(ctx.User, "organizer");
  const past = await makeEvent(ctx.Event, org.user._id, { date: new Date(Date.now() - 3600e3) });
  const u = await makeUser(ctx.User);
  const res = await order(u.token, past._id, ["A1"]);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /already taken place/i);
});

test("an organizer cannot list the attendees of someone else's event", async () => {
  const owner = await makeUser(ctx.User, "organizer");
  const stranger = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, owner.user._id);
  const path = `/api/v1/bookings/organizer/event-bookings/${event._id}`;
  assert.equal((await request(ctx.app).get(path).set(auth(stranger.token))).status, 403);
  assert.equal((await request(ctx.app).get(path).set(auth(owner.token))).status, 200);
});
