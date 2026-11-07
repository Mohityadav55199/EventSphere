import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startTestApp, stopTestApp, makeUser, makeEvent } from "./helpers.js";
import { refreshDemoEvents, DEFAULT_DEMO_ORGANIZER_EMAIL } from "../../jobs/demoRefresh.js";
import { rollForwardByWeeks, DAY_MS } from "../../utils/demoDates.js";

let ctx;
let demoOrganizer;
before(async () => {
  ctx = await startTestApp();
  demoOrganizer = await ctx.User.create({
    name: "demo organizer", email: DEFAULT_DEMO_ORGANIZER_EMAIL, password: "password123", role: "organizer",
  });
});
after(async () => {
  delete process.env.DEMO_MODE;
  await stopTestApp();
});
beforeEach(() => { process.env.DEMO_MODE = "true"; });

const daysAgo = (n) => new Date(Date.now() - n * DAY_MS);

test("rollForwardByWeeks keeps weekday and time, and lands at least a week ahead", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const past = new Date("2026-08-07T19:30:00Z"); // a Friday, 19:30 UTC
  const moved = rollForwardByWeeks(past, now, 7);
  assert.equal(moved.getUTCDay(), past.getUTCDay());
  assert.equal(moved.getUTCHours(), 19);
  assert.equal(moved.getUTCMinutes(), 30);
  assert.ok(moved.getTime() >= now.getTime() + 7 * DAY_MS);
  assert.ok(moved.getTime() < now.getTime() + 14 * DAY_MS, "no further than needed");

  const future = new Date("2027-01-01T10:00:00Z");
  assert.equal(rollForwardByWeeks(future, now, 7).getTime(), future.getTime(), "future dates are untouched");
});

test("moves only the demo organizer's past, active events", async () => {
  const realOrganizer = await makeUser(ctx.User, "organizer");
  const stale = await makeEvent(ctx.Event, demoOrganizer._id, { date: daysAgo(40) });
  const cancelled = await makeEvent(ctx.Event, demoOrganizer._id, { date: daysAgo(40), activeStatus: "cancelled" });
  const upcoming = await makeEvent(ctx.Event, demoOrganizer._id, { date: new Date(Date.now() + 30 * DAY_MS) });
  const someoneElses = await makeEvent(ctx.Event, realOrganizer.user._id, { date: daysAgo(40) });

  const moved = await refreshDemoEvents();
  assert.equal(moved, 1);

  const after = async (e) => (await ctx.Event.findById(e._id)).date.getTime();
  assert.ok(await after(stale) > Date.now() + 6 * DAY_MS, "stale demo event is bookable again");
  assert.equal(await after(cancelled), cancelled.date.getTime(), "cancelled events are left alone");
  assert.equal(await after(upcoming), upcoming.date.getTime(), "future events are left alone");
  assert.equal(await after(someoneElses), someoneElses.date.getTime(), "real organizers' events are never touched");
});

test("does nothing unless DEMO_MODE=true", async () => {
  process.env.DEMO_MODE = "false";
  const stale = await makeEvent(ctx.Event, demoOrganizer._id, { date: daysAgo(10) });
  assert.equal(await refreshDemoEvents(), 0);
  assert.equal((await ctx.Event.findById(stale._id)).date.getTime(), stale.date.getTime());
});
