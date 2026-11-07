/**
 * booking.controller.js — Concurrency-safe ticket booking (BookMyShow-style)
 *
 * Flow Overview:
 * ─────────────────────────────────────────────────────────
 *  createOrder:
 *    1. Validate inputs
 *    2. holdSeats()          → Redis atomic seat hold (10 min TTL)
 *    3. Create Booking{status:"hold", holdExpiresAt}
 *    4. Create Stripe session
 *    5. Emit seatUpdate via Socket.io (live seat count to all watchers)
 *    6. Return session URL
 *
 *  verifyPayment:
 *    1. Verify Stripe session
 *    2. confirmHold()        → Remove from Redis (payment done)
 *    3. atomicDecrementSeats() → MongoDB $inc (single atomic op, no race)
 *    4. Update Booking{status:"confirmed"}, generate QR
 *    5. Update user wallet & event attendees
 *    6. Emit seatUpdate via Socket.io
 *    7. Return booking
 *
 *  cancelBooking:
 *    1. releaseHold()        → Restore Redis hold
 *    2. atomicRestoreSeats() → MongoDB $inc restore
 *    3. Update Booking{status:"cancelled"}
 *    4. Emit seatUpdate via Socket.io
 *
 * ─────────────────────────────────────────────────────────
 */

import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { holdSeats, releaseHold, confirmHold, getTotalHeldSeats } from "../utils/seatHold.js";
import { atomicDecrementSeats, atomicRestoreSeats } from "../utils/bookingLock.js";
import { DEFAULT_HOLD_SECONDS } from "../utils/seatHold.js";
import QRcode from "qrcode";
import crypto from "crypto";
import Stripe from "stripe";
import { sendTicketConfirmationEmail } from "../utils/emailService.js";
import { emitSeatUpdate } from "../utils/seatBroadcast.js";
import { getQrSecret } from "../utils/qrSecret.js";
import { isSandboxAllowed, isSimulatedId } from "../utils/paymentMode.js";
import { refundBooking } from "../utils/refund.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy_stripe_secret_key_12345");

const MAX_SEATS_PER_ORDER = 10;
const COUPONS = { SPHERE20: 0.2, WELCOME10: 0.1, FESTIVAL50: 0.5 };

// ─── Helper: Generate secure QR code ─────────────────────────────────────────
async function generateSecureQRCode(booking) {
  const qrPayload = `${booking._id}:${crypto.randomBytes(8).toString("hex")}`;
  const qrHash = crypto.createHmac("sha256", getQrSecret()).update(qrPayload).digest("hex");

  booking.qrCodeData = { payload: qrPayload, hash: qrHash };
  booking.qrCode = await QRcode.toDataURL(JSON.stringify({ payload: qrPayload, hash: qrHash }));
  return booking;
}

// Seat IDs come from the client: accept only a short list of unique, short strings.
function normalizeSeats(selectedSeats) {
  if (!Array.isArray(selectedSeats) || selectedSeats.length < 1) {
    throw new ApiError(400, "Event ID and an array of selected seats are required");
  }
  const seats = selectedSeats.map((s) => (typeof s === "string" || typeof s === "number" ? String(s).trim() : ""));
  if (seats.some((s) => !s || s.length > 20)) throw new ApiError(400, "Invalid seat identifier");
  if (new Set(seats).size !== seats.length) throw new ApiError(400, "Duplicate seats selected");
  if (seats.length > MAX_SEATS_PER_ORDER) {
    throw new ApiError(400, `You can book at most ${MAX_SEATS_PER_ORDER} seats at a time`);
  }
  return seats;
}

async function addAttendee(eventId, userId, seatsBooked) {
  const bumped = await Event.updateOne(
    { _id: eventId, "attendees.user": userId },
    { $inc: { "attendees.$.ticketsBooked": seatsBooked } }
  );
  if (!bumped.matchedCount) {
    await Event.updateOne(
      { _id: eventId, "attendees.user": { $ne: userId } },
      { $push: { attendees: { user: userId, ticketsBooked: seatsBooked } } }
    );
  }
}

// Gateway failed or isn't configured: in production the checkout must fail (never simulate a payment).
async function abortPendingOrder(pendingBooking, eventId, userId, selectedSeats) {
  await Booking.findByIdAndUpdate(pendingBooking._id, {
    status: "expired",
    paymentstatus: "cancelled",
    cancelDate: new Date(),
  });
  await releaseHold(String(eventId), String(userId), selectedSeats);
  await emitSeatUpdate(eventId);
}

// ─── Finalize a paid (or fully discounted) hold booking ───────────────────────
// Everything here is derived from the stored booking, never from the request.
async function confirmBooking(booking, event, user, paymentFields = {}) {
  const seats = booking.selectedSeats;
  const pointsUsed = booking.pointsUsed || 0;

  // Spend wallet points atomically (fails if the balance dropped since the order was created)
  if (pointsUsed > 0) {
    const spent = await User.updateOne(
      { _id: user._id, walletPoints: { $gte: pointsUsed } },
      { $inc: { walletPoints: -pointsUsed } }
    );
    if (!spent.modifiedCount) {
      throw new ApiError(409, "Your wallet balance changed. Please start the booking again.");
    }
  }

  const refundPoints = () =>
    pointsUsed > 0 ? User.updateOne({ _id: user._id }, { $inc: { walletPoints: pointsUsed } }) : null;

  // Final overselling guard at the DB level
  try {
    await atomicDecrementSeats(booking.event, seats);
  } catch (err) {
    await refundPoints();
    throw err;
  }
  await confirmHold(String(booking.event), String(user._id), seats);

  const amountPaid = booking.amountDue || 0;
  const confirmed = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "hold" },
    {
      $set: {
        ...paymentFields,
        amountPaid,
        paymentstatus: "confirmed",
        status: "confirmed",
        holdExpiresAt: null,
      },
    },
    { new: true }
  );
  if (!confirmed) {
    // Lost a race with another confirm/cancel/expiry: undo what we just did
    await atomicRestoreSeats(booking.event, seats);
    await refundPoints();
    throw new ApiError(409, "This booking is no longer pending.");
  }

  await generateSecureQRCode(confirmed);
  await confirmed.save();

  await addAttendee(event._id, user._id, seats.length);

  const earnedPoints = Math.floor(amountPaid / 20);
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    { $inc: { walletPoints: earnedPoints } },
    { new: true }
  );

  sendTicketConfirmationEmail({ user: updatedUser || user, event, booking: confirmed }).catch((emailErr) => {
    console.warn("⚠️ Ticket email dispatch error:", emailErr.message);
  });

  await emitSeatUpdate(booking.event);
  return { booking: confirmed, earnedPoints, remainingPoints: updatedUser?.walletPoints ?? 0 };
}

// ─── createOrder ─────────────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { usePoints, couponCode, ticketTier, paymentGateway = "stripe" } = req.body;
  const selectedSeats = normalizeSeats(req.body.selectedSeats);

  const seatsBooked = selectedSeats.length;
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");
  if (event.activeStatus !== "active") {
    throw new ApiError(400, `This event is ${event.activeStatus}. Bookings are not accepted.`);
  }

  // ── LAYER 1: Redis seat hold ────────────────────────────────────────────────
  const effectiveAvailable = event.availableSeats ?? event.capacity;
  const holdResult = await holdSeats(
    String(eventId),
    String(req.user._id),
    selectedSeats,
    effectiveAvailable,
    DEFAULT_HOLD_SECONDS
  );
  if (!holdResult.success) {
    throw new ApiError(409, holdResult.reason || "Not enough seats available. Try fewer seats.");
  }

  let pendingBooking;
  try {
    // ── Price & discount calculation (server-side only) ───────────────────────
    let unitPrice = event.Price;
    let selectedTierName = ticketTier || "Standard Pass";
    if (event.ticketTypes?.length > 0 && ticketTier) {
      const foundTier = event.ticketTypes.find(
        (t) => t.name.toLowerCase() === String(ticketTier).toLowerCase()
      );
      if (foundTier) {
        unitPrice = foundTier.price;
        selectedTierName = foundTier.name;
      }
    }

    const totalPrice = unitPrice * seatsBooked;
    const user = await User.findById(req.user._id);

    let couponDiscount = 0;
    if (couponCode) {
      const rate = COUPONS[String(couponCode).toUpperCase().trim()];
      if (rate) couponDiscount = Math.round(totalPrice * rate);
    }
    let pointsUsed = 0;
    if (usePoints) {
      pointsUsed = Math.min(user.walletPoints, Math.max(0, totalPrice - couponDiscount));
    }
    const discount = couponDiscount + pointsUsed;
    const amountToPay = Math.max(0, totalPrice - discount);
    const holdExpiresAt = new Date(Date.now() + DEFAULT_HOLD_SECONDS * 1000);

    pendingBooking = await Booking.create({
      user: req.user._id,
      event: event._id,
      selectedSeats,
      seatsBooked,
      ticketTier: selectedTierName,
      ticketPrice: unitPrice,
      amountPaid: 0,
      amountDue: amountToPay,
      couponDiscount,
      pointsUsed,
      paymentstatus: "pending",
      status: "hold",
      holdExpiresAt,
    });

    // ── Nothing to charge (wallet points / 100% coupon): confirm immediately ──
    if (amountToPay <= 0) {
      const result = await confirmBooking(pendingBooking, event, user);
      return res.status(201).json(
        new ApiResponse(201, {
          booking: result.booking,
          earnedPoints: result.earnedPoints,
          remainingPoints: result.remainingPoints,
        }, "Booking confirmed via wallet")
      );
    }

    const baseResponse = {
      bookingId: pendingBooking._id,
      eventTitle: event.title,
      amountToPay,
      discount,
      selectedTier: selectedTierName,
      unitPrice,
      user: { name: user.name, email: user.email },
    };

    // ── Regional Gateway: Razorpay (UPI, Google Pay UPI, PhonePe, NetBanking) ─
    if (paymentGateway === "razorpay") {
      let razorpayOrder;
      let simulated = false;
      try {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID.includes("dummy")) {
          throw new Error("Razorpay credentials unconfigured in environment");
        }
        const Razorpay = (await import("razorpay")).default;
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(amountToPay * 100), // in paise
          currency: "INR",
          receipt: `rcpt_${pendingBooking._id.toString().slice(-10)}`,
          notes: { bookingId: String(pendingBooking._id), eventId: String(eventId) },
        });
      } catch (err) {
        if (!isSandboxAllowed()) {
          console.error("Razorpay order failed:", err.message);
          await abortPendingOrder(pendingBooking, eventId, req.user._id, selectedSeats);
          throw new ApiError(502, "Payment gateway unavailable. Please try again later.");
        }
        console.warn("⚠️ Razorpay order notice:", err.message, "— activating sandbox test simulation.");
        simulated = true;
        razorpayOrder = {
          id: `order_sim_${Date.now()}_${pendingBooking._id.toString().slice(-6)}`,
          amount: Math.round(amountToPay * 100),
          currency: "INR",
        };
      }

      await Booking.findByIdAndUpdate(pendingBooking._id, { razorpayOrderId: razorpayOrder.id });

      return res.status(200).json(
        new ApiResponse(200, {
          ...baseResponse,
          gateway: "razorpay",
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_sim",
          ...(simulated ? { isSimulated: true } : {}),
        }, simulated ? "Razorpay sandbox order initialized" : "Razorpay order initialized successfully")
      );
    }

    // ── International Gateway: Stripe (Apple Pay, Google Pay, Cards) ──────────
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    let session;
    try {
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("dummy")) {
        throw new Error("Stripe secret key unconfigured in environment");
      }
      session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: event.title,
                description: `${seatsBooked} ticket(s) for ${event.title}`,
                images: event.image ? [event.image] : [],
              },
              unit_amount: Math.round(amountToPay * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        customer_email: user.email,
        metadata: { bookingId: String(pendingBooking._id), eventId: String(eventId) },
        // Only IDs travel in the URL; price, seats and discount are read from the booking server-side
        success_url: `${clientUrl}/profile?session_id={CHECKOUT_SESSION_ID}&booking_id=${pendingBooking._id}&event_id=${eventId}`,
        cancel_url: `${clientUrl}/event/${eventId}`,
        expires_at: Math.floor(Date.now() / 1000) + DEFAULT_HOLD_SECONDS,
      });
    } catch (err) {
      if (!isSandboxAllowed()) {
        console.error("Stripe session failed:", err.message);
        await abortPendingOrder(pendingBooking, eventId, req.user._id, selectedSeats);
        throw new ApiError(502, "Payment gateway unavailable. Please try again later.");
      }
      console.warn("⚠️ Stripe session notice:", err.message, "— activating sandbox test simulation.");
      const simSessionId = `sim_cs_${Date.now()}_${pendingBooking._id.toString().slice(-6)}`;
      session = {
        id: simSessionId,
        url: `${clientUrl}/profile?session_id=${simSessionId}&booking_id=${pendingBooking._id}&event_id=${eventId}`,
      };
    }

    await Booking.findByIdAndUpdate(pendingBooking._id, { stripeSessionId: session.id });

    // ── LAYER 3: Broadcast that seats are now on hold ─────────────────────────
    await emitSeatUpdate(eventId);

    res.status(200).json(
      new ApiResponse(200, {
        orderId: session.id,
        stripeSessionId: session.id,
        bookingId: String(pendingBooking._id),
        checkoutUrl: session.url,
        currency: "inr",
        amount: amountToPay,
        seatsBooked,
        eventId,
        totalPrice,
        discount,
        holdExpiresAt,
        remainingPoints: user.walletPoints - pointsUsed,
        isSimulated: isSimulatedId(session.id),
      }, "Checkout session created. Seats held for 30 minutes.")
    );
  } catch (err) {
    // Anything that failed after the hold was taken must not leave seats locked
    // (abortPendingOrder already cleaned up after gateway failures)
    if (!(err instanceof ApiError && err.statusCode === 502)) {
      await releaseHold(String(eventId), String(req.user._id), selectedSeats);
      if (pendingBooking) {
        await Booking.updateOne(
          { _id: pendingBooking._id, status: "hold" },
          { status: "expired", paymentstatus: "cancelled", cancelDate: new Date() }
        );
      }
    }
    throw err;
  }
});

// ─── Payment proof checks (throw ApiError unless the payment is genuine) ──────
async function assertPaymentGenuine(booking, body) {
  const { stripe_session_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (razorpay_order_id) {
    if (booking.razorpayOrderId !== razorpay_order_id) {
      throw new ApiError(400, "Payment does not match this booking");
    }
    if (isSimulatedId(booking.razorpayOrderId)) {
      if (!isSandboxAllowed()) throw new ApiError(400, "Simulated payments are disabled");
      return { razorpayOrderId: razorpay_order_id, razorpayPaymentId: `pay_sim_${Date.now()}` };
    }
    if (!process.env.RAZORPAY_KEY_SECRET || !razorpay_payment_id || !razorpay_signature) {
      throw new ApiError(400, "Razorpay payment details are required");
    }
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(String(razorpay_signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new ApiError(400, "Invalid Razorpay payment signature");
    }
    return { razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature };
  }

  if (stripe_session_id) {
    if (booking.stripeSessionId !== stripe_session_id) {
      throw new ApiError(400, "Payment does not match this booking");
    }
    if (isSimulatedId(booking.stripeSessionId)) {
      if (!isSandboxAllowed()) throw new ApiError(400, "Simulated payments are disabled");
      return { stripeSessionId: stripe_session_id, stripePaymentIntentId: `pi_${stripe_session_id}` };
    }
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(stripe_session_id);
    } catch {
      throw new ApiError(400, "Could not verify the Stripe payment");
    }
    if (
      session.payment_status !== "paid" ||
      session.metadata?.bookingId !== String(booking._id) ||
      session.amount_total !== Math.round((booking.amountDue || 0) * 100)
    ) {
      throw new ApiError(402, "Payment has not been completed");
    }
    return {
      stripeSessionId: stripe_session_id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : `pi_${stripe_session_id}`,
    };
  }

  throw new ApiError(400, "A Stripe session ID or Razorpay order ID is required");
}

// ─── verifyPayment ────────────────────────────────────────────────────────────
// The request only says WHICH booking and carries the gateway proof. Seats, prices
// and discounts all come from the booking created by createOrder.
const verifyPayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    throw new ApiError(400, "A valid booking ID is required");
  }

  const booking = await Booking.findOne({ _id: bookingId, user: req.user._id });
  if (!booking) throw new ApiError(404, "Booking not found");

  // Idempotent: a page refresh or retry after success just returns the ticket
  if (booking.status === "confirmed") {
    return res.status(200).json(
      new ApiResponse(200, { booking, earnedPoints: 0, remainingPoints: req.user.walletPoints }, "Booking already confirmed")
    );
  }
  if (booking.status !== "hold") {
    throw new ApiError(409, `This booking is ${booking.status} and can no longer be paid.`);
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    await Booking.updateOne({ _id: booking._id, status: "hold" }, { status: "expired", paymentstatus: "cancelled" });
    throw new ApiError(409, "Your seat hold has expired. Please start the booking again.");
  }

  const event = await Event.findById(booking.event);
  if (!event) throw new ApiError(404, "Event not found");
  if (event.activeStatus !== "active") {
    throw new ApiError(400, `This event is ${event.activeStatus}. Bookings are not accepted.`);
  }

  const paymentFields = await assertPaymentGenuine(booking, req.body);
  const user = await User.findById(req.user._id);
  let result;
  try {
    result = await confirmBooking(booking, event, user, paymentFields);
  } catch (err) {
    // The Stripe webhook may have confirmed this booking a moment ago: that is a success, not an error
    const latest = await Booking.findById(booking._id);
    if (err.statusCode === 409 && latest?.status === "confirmed") {
      return res.status(200).json(
        new ApiResponse(200, { booking: latest, earnedPoints: 0, remainingPoints: user.walletPoints }, "Booking already confirmed")
      );
    }
    throw err;
  }

  res.status(201).json(new ApiResponse(201, result, "Booking confirmed successfully"));
});

// ─── cancelBooking ────────────────────────────────────────────────────────────
const cancelBooking = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookingid)) throw new ApiError(400, "Invalid booking ID");

  const existing = await Booking.findById(req.params.bookingid).select("user checkedIn status");
  if (!existing) throw new ApiError(404, "Booking not found");
  if (existing.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to cancel this booking");
  }
  if (existing.checkedIn) throw new ApiError(400, "Checked-in tickets cannot be cancelled");

  // Atomic claim: only one concurrent request can move the booking to "cancelled"
  const previous = await Booking.findOneAndUpdate(
    { _id: existing._id, status: { $in: ["hold", "confirmed"] }, checkedIn: { $ne: true } },
    { $set: { paymentstatus: "cancelled", status: "cancelled", cancelDate: new Date() } },
    { new: false }
  );
  if (!previous) throw new ApiError(400, "Booking is already cancelled or can no longer be cancelled");

  const eventId = previous.event;
  const wasConfirmed = previous.status === "confirmed";

  await releaseHold(String(eventId), String(req.user._id), previous.selectedSeats);

  let refundStatus = "none";
  if (wasConfirmed) {
    await atomicRestoreSeats(eventId, previous.selectedSeats);

    // Wallet: give back points spent on this booking and take back points it earned
    const earned = Math.floor((previous.amountPaid || 0) / 20);
    const user = await User.findById(previous.user);
    if (user) {
      user.walletPoints = Math.max(0, user.walletPoints + (previous.pointsUsed || 0) - earned);
      await user.save();
    }

    try {
      const result = await refundBooking(previous);
      refundStatus = result === "refunded" ? "refunded" : "none";
      if (refundStatus === "refunded") {
        await Booking.updateOne({ _id: previous._id }, { refundStatus: "refunded" });
      }
    } catch (err) {
      refundStatus = "failed";
      console.error("Refund failed (needs manual follow-up):", String(previous._id), err.message);
      await Booking.updateOne(
        { _id: previous._id },
        { refundStatus: "failed", refundError: String(err.message).slice(0, 300) }
      );
    }
  }

  await emitSeatUpdate(eventId);

  const updated = await Booking.findById(previous._id);
  const message =
    refundStatus === "failed"
      ? "Booking cancelled, but the refund failed and needs manual follow-up."
      : "Booking cancelled and seats restored";
  res.status(200).json(new ApiResponse(200, updated, message));
});

// ─── getMyBookings ─────────────────────────────────────────────────────────────
const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id, status: { $ne: "expired" } })
    .populate("event", "title date location Price")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
});

// ─── getAllBookings ────────────────────────────────────────────────────────────
const getAllBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find()
    .populate("user", "name email")
    .populate("event", "title date location")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "All bookings fetched successfully"));
});

// ─── getEventBookings ─────────────────────────────────────────────────────────
const getEventBookings = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw new ApiError(404, "Event not found");

  const bookings = await Booking.find({ event: req.params.eventId })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "Event bookings fetched successfully"));
});

// ─── getSeatAvailability ──────────────────────────────────────────────────────
// New endpoint: returns live seat count for polling or initial page load
const getSeatAvailability = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await Event.findById(eventId).select("capacity availableSeats title bookedSeats");
  if (!event) throw new ApiError(404, "Event not found");

  const heldSeats = await getTotalHeldSeats(String(eventId)); // Array of seat IDs
  
  // Backwards compatibility for capacity checks
  const effectiveFreeSeats = Math.max(0, (event.availableSeats ?? event.capacity) - heldSeats.length);

  res.status(200).json(
    new ApiResponse(200, {
      eventId,
      capacity: event.capacity,
      availableSeats: event.availableSeats ?? event.capacity,
      bookedSeats: event.bookedSeats || [],
      heldSeats: heldSeats || [],
      effectiveFreeSeats,
      isSoldOut: effectiveFreeSeats === 0 || event.bookedSeats?.length >= event.capacity,
      fillingFast: effectiveFreeSeats > 0 && effectiveFreeSeats <= event.capacity * 0.2,
    }, "Seat availability fetched")
  );
});

export {
  confirmBooking,
  createOrder,
  verifyPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  getEventBookings,
  getSeatAvailability,
};
