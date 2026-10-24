import test from "node:test";
import assert from "node:assert/strict";

const { cancelEvent } = await import("../../controllers/event.controller.js");
const { default: Event } = await import("../../models/event.model.js");
const { default: Booking } = await import("../../models/booking.model.js");

const makeBooking = (id, fields) => ({
  _id: id,
  status: "confirmed",
  saved: false,
  async save() { this.saved = true; },
  ...fields,
});

test("one failed refund does not stop the other bookings from being cancelled", async () => {
  const organizerId = "507f1f77bcf86cd799439011";
  const event = { _id: "e1", organizer: organizerId, async save() {} };

  // Razorpay is unconfigured in tests, so this refund throws; the free booking needs no refund
  const failing = makeBooking("b1", { amountPaid: 500, razorpayPaymentId: "pay_123" });
  const free = makeBooking("b2", { amountPaid: 0 });

  const originalFindEvent = Event.findById;
  const originalFindBookings = Booking.find;
  Event.findById = async () => event;
  Booking.find = async () => [failing, free];

  try {
    let result;
    let error;
    const res = {
      status() { return this; },
      json(body) { result = body; return this; },
    };
    await cancelEvent({ params: { eventid: "e1" }, user: { _id: organizerId } }, res, (e) => { error = e; });

    assert.equal(error, undefined);
    assert.equal(event.activeStatus, "cancelled");
    assert.equal(failing.refundStatus, "failed");
    assert.equal(failing.status, "cancelled");
    assert.equal(free.status, "cancelled");
    assert.ok(failing.saved && free.saved, "both bookings must be saved");
    assert.equal(result.data.refunds.failed, 1);
    assert.deepEqual(result.data.refunds.failedBookings, ["b1"]);
  } finally {
    Event.findById = originalFindEvent;
    Booking.find = originalFindBookings;
  }
});

test("only the organizer can cancel their event", async () => {
  const originalFindEvent = Event.findById;
  Event.findById = async () => ({ organizer: "owner-id" });
  try {
    let error;
    await cancelEvent({ params: { eventid: "e1" }, user: { _id: "someone-else" } }, {}, (e) => { error = e; });
    assert.equal(error.statusCode, 403);
  } finally {
    Event.findById = originalFindEvent;
  }
});
