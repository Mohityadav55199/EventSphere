import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApp, stopTestApp, makeUser, makeEvent, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

async function setup() {
  const organizer = await makeUser(ctx.User, "organizer");
  const event = await makeEvent(ctx.Event, organizer.user._id); // free => confirmed straight away
  const buyer = await makeUser(ctx.User);
  const order = await request(ctx.app)
    .post(`/api/v1/bookings/create-order/${event._id}`)
    .set(auth(buyer.token))
    .send({ selectedSeats: ["A1"] });
  assert.equal(order.status, 201);
  const booking = order.body.data.booking;
  return { organizer, buyer, event, booking, qr: booking.qrCodeData };
}

const scan = (token, qr) => request(ctx.app).post("/api/v1/bookings/checkin").set(auth(token)).send(qr);

test("organizer of the event can check an attendee in exactly once", async () => {
  const { organizer, qr } = await setup();
  assert.equal((await scan(organizer.token, qr)).status, 200);
  const second = await scan(organizer.token, qr);
  assert.equal(second.status, 400);
  assert.match(second.body.message, /already checked in/i);
});

test("a different organizer cannot check in attendees of this event", async () => {
  const { qr } = await setup();
  const stranger = await makeUser(ctx.User, "organizer");
  assert.equal((await scan(stranger.token, qr)).status, 403);
});

test("regular attendees cannot use the check-in endpoint", async () => {
  const { buyer, qr } = await setup();
  assert.equal((await scan(buyer.token, qr)).status, 403);
});

test("tampered or malformed QR data is rejected with 400, not 403/500", async () => {
  const { organizer, qr } = await setup();
  assert.equal((await scan(organizer.token, { payload: qr.payload, hash: "0".repeat(64) })).status, 400);
  assert.equal((await scan(organizer.token, { payload: qr.payload + "x", hash: qr.hash })).status, 400);
  assert.equal((await scan(organizer.token, {})).status, 400);
});

test("a cancelled ticket cannot be scanned in", async () => {
  const { organizer, buyer, booking, qr } = await setup();
  const cancel = await request(ctx.app).delete(`/api/v1/bookings/cancel-booking/${booking._id}`).set(auth(buyer.token));
  assert.equal(cancel.status, 200);
  const res = await scan(organizer.token, qr);
  assert.equal(res.status, 400);
  assert.match(res.body.message, /not valid/i);
});

test("unknown booking returns 404", async () => {
  const { organizer } = await setup();
  const crypto = await import("node:crypto");
  const payload = "507f1f77bcf86cd799439011:abcdef";
  const hash = crypto.createHmac("sha256", process.env.QR_SECRET).update(payload).digest("hex");
  assert.equal((await scan(organizer.token, { payload, hash })).status, 404);
});
