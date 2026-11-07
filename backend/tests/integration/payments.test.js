import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import Stripe from "stripe";
import { startTestApp, stopTestApp, makeUser, makeEvent, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

const createOrder = (token, eventId, body) =>
  request(ctx.app).post(`/api/v1/bookings/create-order/${eventId}`).set(auth(token)).send(body);
const verify = (token, body) =>
  request(ctx.app).post("/api/v1/bookings/verify-payment").set(auth(token)).send(body);

// Runs fn with NODE_ENV=production (the app reads it per request), then restores it
async function inProduction(fn) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { return await fn(); } finally { process.env.NODE_ENV = prev; }
}

async function paidEvent(price = 500) {
  const organizer = await makeUser(ctx.User, "organizer");
  return makeEvent(ctx.Event, organizer.user._id, { Price: price, capacity: 10 });
}

// ── Payment verification ──────────────────────────────────────────────────────

test("verify-payment rejects a made-up session id (no free tickets)", async () => {
  const event = await paidEvent();
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"] });
  assert.equal(order.status, 200);

  const forged = await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: "cs_fake_123" });
  assert.equal(forged.status, 400);

  const fresh = await ctx.Event.findById(event._id);
  assert.deepEqual(fresh.bookedSeats, []);
});

test("verify-payment confirms with the real session id and ignores client-sent price/discount", async () => {
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"] });

  const res = await verify(buyer.token, {
    bookingId: order.body.data.bookingId,
    stripe_session_id: order.body.data.stripeSessionId,
    discount: 99999, ticketPrice: 0, selectedSeats: ["Z9"], // all must be ignored
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.booking.amountPaid, 500);
  assert.deepEqual(res.body.data.booking.selectedSeats, ["A1"]);
  assert.ok(res.body.data.booking.qrCode);

  // verifying twice is idempotent
  const again = await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  assert.equal(again.status, 200);
  assert.equal((await ctx.Event.findById(event._id)).bookedSeats.length, 1);
});

test("a user cannot confirm someone else's booking", async () => {
  const event = await paidEvent();
  const owner = await makeUser(ctx.User);
  const attacker = await makeUser(ctx.User);
  const order = await createOrder(owner.token, event._id, { selectedSeats: ["A1"] });

  const res = await verify(attacker.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  assert.equal(res.status, 404);
});

test("production never accepts simulated payments", async () => {
  const event = await paidEvent();
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"] }); // sandbox order made in test mode

  const res = await inProduction(() =>
    verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId })
  );
  assert.equal(res.status, 400);
  assert.deepEqual((await ctx.Event.findById(event._id)).bookedSeats, []);
});

test("production with no gateway keys fails the checkout and frees the seats", async () => {
  const event = await paidEvent();
  const first = await makeUser(ctx.User);
  const second = await makeUser(ctx.User);

  const res = await inProduction(() => createOrder(first.token, event._id, { selectedSeats: ["A1"] }));
  assert.equal(res.status, 502);

  // seat A1 must not stay locked
  const retry = await createOrder(second.token, event._id, { selectedSeats: ["A1"] });
  assert.equal(retry.status, 200);
});

// ── Wallet & coupons ──────────────────────────────────────────────────────────

test("a coupon discount is not taken out of the wallet", async () => {
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User, "attendee", { walletPoints: 100 });
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"], couponCode: "SPHERE20" });
  assert.equal(order.body.data.amount, 400); // 500 - 20%

  const res = await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  assert.equal(res.status, 201);
  const user = await ctx.User.findById(buyer.user._id);
  assert.equal(user.walletPoints, 100 + Math.floor(400 / 20)); // untouched + points earned on the 400 paid
});

test("wallet points are spent only when used, and only once payment is confirmed", async () => {
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User, "attendee", { walletPoints: 100 });
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"], usePoints: true });
  assert.equal(order.body.data.amount, 400);
  assert.equal((await ctx.User.findById(buyer.user._id)).walletPoints, 100, "points must not be spent before payment");

  await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  assert.equal((await ctx.User.findById(buyer.user._id)).walletPoints, 0 + 20);
});

test("cancelling a paid booking restores seats and the wallet", async () => {
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User, "attendee", { walletPoints: 100 });
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"], usePoints: true });
  await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });

  const res = await request(ctx.app).delete(`/api/v1/bookings/cancel-booking/${order.body.data.bookingId}`).set(auth(buyer.token));
  assert.equal(res.status, 200);
  assert.equal((await ctx.User.findById(buyer.user._id)).walletPoints, 100); // spent 100, earned 20, both reversed
  const fresh = await ctx.Event.findById(event._id);
  assert.deepEqual(fresh.bookedSeats, []);
  assert.equal(fresh.availableSeats, 10);
});

// ── Stripe webhook ────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = "whsec_test_secret";
const stripeHelper = new Stripe("sk_test_dummy_stripe_secret_key_12345");

function postWebhook(payloadObj, { secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify(payloadObj);
  const signature = stripeHelper.webhooks.generateTestHeaderString({ payload, secret });
  return request(ctx.app)
    .post("/api/v1/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", signature)
    .send(payload);
}

const completedEvent = (id, order, amount) => ({
  id,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: order.stripeSessionId,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: amount,
      payment_intent: null,
      metadata: { bookingId: order.bookingId },
    },
  },
});

test("webhook: unsigned or wrongly signed requests are rejected", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const res = await postWebhook({ id: "evt_bad", type: "checkout.session.completed" }, { secret: "whsec_wrong" });
  assert.equal(res.status, 400);

  delete process.env.STRIPE_WEBHOOK_SECRET;
  const unconfigured = await postWebhook({ id: "evt_x", type: "x" });
  assert.equal(unconfigured.status, 503);
});

test("webhook confirms the ticket without the browser, and redelivery is a no-op", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1", "A2"] });
  const evt = completedEvent("evt_ok_1", order.body.data, 1000 * 100);

  const first = await postWebhook(evt);
  assert.equal(first.status, 200);
  const booking = await ctx.Booking.findById(order.body.data.bookingId);
  assert.equal(booking.status, "confirmed");
  assert.ok(booking.qrCode);

  const duplicate = await postWebhook(evt);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  const fresh = await ctx.Event.findById(event._id);
  assert.equal(fresh.bookedSeats.length, 2, "redelivery must not book seats twice");
  assert.equal(await ctx.Booking.countDocuments({ event: event._id, status: "confirmed" }), 1);

  // the user's browser then arrives at /profile and calls verify: still a success
  const redirect = await verify(buyer.token, { bookingId: order.body.data.bookingId, stripe_session_id: order.body.data.stripeSessionId });
  assert.equal(redirect.status, 200);
});

test("webhook ignores a payment whose amount does not match the booking", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"] });

  const res = await postWebhook(completedEvent("evt_amount_1", order.body.data, 100)); // paid 1.00 instead of 5.00
  assert.equal(res.status, 200);
  const booking = await ctx.Booking.findById(order.body.data.bookingId);
  assert.notEqual(booking.status, "confirmed");
  assert.deepEqual((await ctx.Event.findById(event._id)).bookedSeats, []);
});

test("webhook for an expired checkout releases the hold", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const event = await paidEvent(500);
  const buyer = await makeUser(ctx.User);
  const order = await createOrder(buyer.token, event._id, { selectedSeats: ["A1"] });

  const expired = { ...completedEvent("evt_exp_1", order.body.data, 500 * 100), type: "checkout.session.expired" };
  const res = await postWebhook(expired);
  assert.equal(res.status, 200);
  assert.equal((await ctx.Booking.findById(order.body.data.bookingId)).status, "expired");

  const other = await makeUser(ctx.User);
  assert.equal((await createOrder(other.token, event._id, { selectedSeats: ["A1"] })).status, 200);
});
