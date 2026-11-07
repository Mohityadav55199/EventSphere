import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApp, stopTestApp, makeUser, auth } from "./helpers.js";

let ctx;
before(async () => { ctx = await startTestApp(); });
after(async () => { await stopTestApp(); });

test("booking rate limit is per user, not per IP", async () => {
  const alice = await makeUser(ctx.User);
  const bob = await makeUser(ctx.User);
  const missing = "507f1f77bcf86cd799439011";
  const cancel = (token) => request(ctx.app).delete(`/api/v1/bookings/cancel-booking/${missing}`).set(auth(token));

  // the limiter is switched off under NODE_ENV=test; turn it on for this test
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    for (let i = 0; i < 10; i++) assert.equal((await cancel(alice.token)).status, 404);
    assert.equal((await cancel(alice.token)).status, 429, "11th request in a minute is blocked");
    // same IP (supertest), different user: unaffected
    assert.equal((await cancel(bob.token)).status, 404);
  } finally {
    process.env.NODE_ENV = prev;
  }
});
