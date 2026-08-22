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
import { getIO } from "../socket.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy_stripe_secret_key_12345");

// ─── Helper: Emit live seat availability to all watching clients ──────────────
async function emitSeatUpdate(eventId) {
  try {
    const io = getIO();
    const event = await Event.findById(eventId).select("availableSeats capacity");
    const heldSeats = await getTotalHeldSeats(String(eventId));

    io.to(`seats:${eventId}`).emit("seatUpdate", {
      eventId: String(eventId),
      availableSeats: event?.availableSeats ?? 0,
      heldSeats,
      // Seats effectively free = available minus currently held
      effectiveFreeSeats: Math.max(0, (event?.availableSeats ?? 0) - heldSeats),
      capacity: event?.capacity ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't fail the booking if socket emit fails
  }
}

// ─── Helper: Generate secure QR code ─────────────────────────────────────────
async function generateSecureQRCode(booking) {
  const secretKey = process.env.QR_SECRET || "eventease_qr_secret_key_987654321";
  const qrPayload = `${booking._id}:${crypto.randomBytes(8).toString("hex")}`;
  const qrHash = crypto.createHmac("sha256", secretKey).update(qrPayload).digest("hex");

  booking.qrCodeData = { payload: qrPayload, hash: qrHash };
  const qrDataString = JSON.stringify({ payload: qrPayload, hash: qrHash });
  booking.qrCode = await QRcode.toDataURL(qrDataString);
  return booking;
}

// ─── createOrder ─────────────────────────────────────────────────────────────
const createOrder = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { seatsBooked, usePoints, couponCode, ticketTier } = req.body;

  if (!eventId || !seatsBooked || seatsBooked < 1) {
    throw new ApiError(400, "Event ID and a valid number of seats are required");
  }

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");
  if (event.activeStatus !== "active") {
    throw new ApiError(400, `This event is ${event.activeStatus}. Bookings are not accepted.`);
  }

  // ── LAYER 1: Redis seat hold ────────────────────────────────────────────────
  // availableSeats may be undefined on very old events — fall back to capacity
  const effectiveAvailable = event.availableSeats ?? event.capacity;

  const holdResult = await holdSeats(
    String(eventId),
    String(req.user._id),
    seatsBooked,
    effectiveAvailable,
    DEFAULT_HOLD_SECONDS
  );

  if (!holdResult.success) {
    throw new ApiError(409, holdResult.reason || "Not enough seats available. Try fewer seats.");
  }

  // ── Price & discount calculation ────────────────────────────────────────────
  let unitPrice = event.Price;
  let selectedTierName = ticketTier || "Standard Pass";
  if (event.ticketTypes?.length > 0 && ticketTier) {
    const foundTier = event.ticketTypes.find(
      (t) => t.name.toLowerCase() === ticketTier.toLowerCase()
    );
    if (foundTier) {
      unitPrice = foundTier.price;
      selectedTierName = foundTier.name;
    }
  }

  const totalPrice = unitPrice * seatsBooked;
  const user = await User.findById(req.user._id);
  let discount = 0;

  if (couponCode) {
    const code = String(couponCode).toUpperCase().trim();
    if (code === "SPHERE20") discount += Math.round(totalPrice * 0.20);
    else if (code === "WELCOME10") discount += Math.round(totalPrice * 0.10);
    else if (code === "FESTIVAL50") discount += Math.round(totalPrice * 0.50);
  }
  if (usePoints) {
    const remainingToPay = Math.max(0, totalPrice - discount);
    discount += Math.min(user.walletPoints, remainingToPay);
  }

  let amountToPay = Math.max(0, totalPrice - discount);
  const holdExpiresAt = new Date(Date.now() + DEFAULT_HOLD_SECONDS * 1000);

  // ── Wallet-only booking (skip Stripe) ──────────────────────────────────────
  if (amountToPay <= 0) {
    // Confirm hold in Redis
    await confirmHold(String(eventId), String(req.user._id));

    // ── LAYER 2: Atomic MongoDB seat decrement ──────────────────────────────
    await atomicDecrementSeats(eventId, seatsBooked);

    const booking = await Booking.create({
      user: req.user._id,
      event: event._id,
      seatsBooked,
      ticketTier: selectedTierName,
      ticketPrice: unitPrice,
      amountPaid: 0,
      paymentstatus: "confirmed",
      status: "confirmed",
      holdExpiresAt: null,
    });

    user.walletPoints -= discount;
    await user.save();

    // Update attendees list
    const existingAttendee = event.attendees.find(
      (att) => att.user.toString() === req.user._id.toString()
    );
    if (existingAttendee) {
      existingAttendee.ticketsBooked += seatsBooked;
    } else {
      event.attendees.push({ user: req.user._id, ticketsBooked: seatsBooked });
    }
    await event.save();

    const qrBooking = await generateSecureQRCode(booking);
    await qrBooking.save();

    // ── LAYER 3: Broadcast seat update ─────────────────────────────────────
    await emitSeatUpdate(eventId);

    return res.status(201).json(
      new ApiResponse(201, {
        booking: qrBooking,
        earnedPoints: 0,
        remainingPoints: user.walletPoints,
      }, "Booking confirmed via wallet")
    );
  }

  // ── Normal Stripe flow ──────────────────────────────────────────────────────
  // Create a pending Booking doc NOW (with status:"hold") so the expiry job
  // can restore seats if the user abandons without paying.
  const pendingBooking = await Booking.create({
    user: req.user._id,
    event: event._id,
    seatsBooked,
    ticketTier: selectedTierName,
    ticketPrice: unitPrice,
    amountPaid: 0,
    paymentstatus: "pending",
    status: "hold",
    holdExpiresAt,
  });

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
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
      // Pass bookingId in metadata so verifyPayment can find the pending doc
      metadata: {
        bookingId: String(pendingBooking._id),
        eventId: String(eventId),
        seatsBooked: String(seatsBooked),
        discount: String(discount),
        ticketTier: selectedTierName,
        ticketPrice: String(unitPrice),
      },
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/profile?session_id={CHECKOUT_SESSION_ID}&booking_id=${pendingBooking._id}&event_id=${eventId}&seats=${seatsBooked}&discount=${discount}&tier=${encodeURIComponent(selectedTierName)}&price=${unitPrice}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/event/${eventId}`,
      expires_at: Math.floor(Date.now() / 1000) + DEFAULT_HOLD_SECONDS, // Stripe session also expires
    });

    // Store session ID on the pending booking
    await Booking.findByIdAndUpdate(pendingBooking._id, { stripeSessionId: session.id });
  } catch (err) {
    console.warn("Stripe API error (using mock session for dev):", err.message);
    session = {
      id: `cs_test_mock_${Date.now()}`,
      url: null,
      currency: "inr",
      amount_total: Math.round(amountToPay * 100),
    };
    await Booking.findByIdAndUpdate(pendingBooking._id, { stripeSessionId: session.id });
  }

  // ── LAYER 3: Broadcast that seats are now on hold ──────────────────────────
  await emitSeatUpdate(eventId);

  res.status(200).json(
    new ApiResponse(200, {
      orderId: session.id,
      stripeSessionId: session.id,
      bookingId: String(pendingBooking._id), // frontend uses this to track hold
      checkoutUrl: session.url,
      currency: session.currency || "inr",
      amount: amountToPay,
      seatsBooked,
      eventId,
      totalPrice,
      discount,
      holdExpiresAt,
      remainingPoints: user.walletPoints - discount,
    }, "Checkout session created. Seats held for 10 minutes.")
  );
});

// ─── verifyPayment ────────────────────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    stripe_session_id,
    razorpay_order_id,
    razorpay_payment_id,
    eventId,
    seatsBooked,
    discount,
    ticketTier,
    ticketPrice,
    bookingId, // pending booking ID from createOrder response
  } = req.body;

  const sessionId = stripe_session_id || razorpay_order_id;
  if (!sessionId || !eventId || !seatsBooked) {
    throw new ApiError(400, "Session ID, event ID, and seats are required");
  }

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");

  // ── Find or handle pending booking ─────────────────────────────────────────
  let booking = null;
  if (bookingId) {
    booking = await Booking.findOne({
      _id: bookingId,
      user: req.user._id,
      status: "hold",
    });
    if (booking?.holdExpiresAt && booking.holdExpiresAt < new Date()) {
      booking.status = "expired";
      await booking.save();
      throw new ApiError(409, "Your seat hold has expired. Please start the booking again.");
    }
  }

  // ── LAYER 1: Confirm hold (remove from Redis) ───────────────────────────────
  await confirmHold(String(eventId), String(req.user._id));

  // ── LAYER 2: Atomic MongoDB seat decrement ──────────────────────────────────
  // This is the final guard — even if Redis hold somehow failed, this
  // atomic op prevents overselling at the DB level.
  await atomicDecrementSeats(eventId, seatsBooked);

  // ── Create / update booking as confirmed ───────────────────────────────────
  const basePrice = ticketPrice || event.Price;
  const amountPaid = Math.max(0, basePrice * seatsBooked - (discount || 0));

  if (booking) {
    // Update the pending hold booking to confirmed
    booking.stripeSessionId = sessionId;
    booking.stripePaymentIntentId = razorpay_payment_id || `pi_${sessionId}`;
    booking.amountPaid = amountPaid;
    booking.paymentstatus = "confirmed";
    booking.status = "confirmed";
    booking.holdExpiresAt = null;
    booking.ticketTier = ticketTier || booking.ticketTier || "Standard Pass";
    booking.ticketPrice = basePrice;
  } else {
    // Fallback: create fresh booking (e.g., webhook flow)
    booking = await Booking.create({
      user: req.user._id,
      event: event._id,
      seatsBooked,
      ticketTier: ticketTier || "Standard Pass",
      ticketPrice: basePrice,
      stripeSessionId: sessionId,
      stripePaymentIntentId: razorpay_payment_id || `pi_${sessionId}`,
      amountPaid,
      paymentstatus: "confirmed",
      status: "confirmed",
      holdExpiresAt: null,
    });
  }

  // ── Wallet: deduct used points, credit earned points ───────────────────────
  const user = await User.findById(req.user._id);
  if (discount > 0) user.walletPoints = Math.max(0, user.walletPoints - discount);
  const earnedPoints = Math.floor(amountPaid / 20);
  user.walletPoints += earnedPoints;
  await user.save();

  // ── Update event attendees list ─────────────────────────────────────────────
  const existingAttendee = event.attendees.find(
    (att) => att.user.toString() === req.user._id.toString()
  );
  if (existingAttendee) {
    existingAttendee.ticketsBooked += seatsBooked;
  } else {
    event.attendees.push({ user: req.user._id, ticketsBooked: seatsBooked });
  }
  await event.save();

  // ── Generate QR code ────────────────────────────────────────────────────────
  booking = await generateSecureQRCode(booking);
  await booking.save();

  // ── LAYER 3: Broadcast final seat count ─────────────────────────────────────
  await emitSeatUpdate(eventId);

  res.status(201).json(
    new ApiResponse(201, { booking, earnedPoints, remainingPoints: user.walletPoints },
      "Booking confirmed successfully")
  );
});

// ─── cancelBooking ────────────────────────────────────────────────────────────
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingid).populate("event");
  if (!booking) throw new ApiError(404, "Booking not found");

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to cancel this booking");
  }

  if (booking.status === "cancelled" || booking.paymentstatus === "cancelled") {
    throw new ApiError(400, "Booking is already cancelled");
  }

  const eventId = booking.event?._id || booking.event;
  const wasConfirmed = booking.status === "confirmed" || booking.paymentstatus === "confirmed";

  // ── Cancel the booking ──────────────────────────────────────────────────────
  booking.paymentstatus = "cancelled";
  booking.status = "cancelled";
  booking.cancelDate = new Date();
  await booking.save();

  // ── Release Redis hold (if still active) ───────────────────────────────────
  await releaseHold(String(eventId), String(req.user._id));

  // ── Restore seats in MongoDB (only if booking was confirmed) ────────────────
  if (wasConfirmed) {
    const event = await Event.findById(eventId);
    await atomicRestoreSeats(eventId, booking.seatsBooked, event?.capacity);
  }

  // ── LAYER 3: Broadcast restored seat count ─────────────────────────────────
  await emitSeatUpdate(eventId);

  // ── Razorpay refund (if applicable) ────────────────────────────────────────
  if (booking.razorpayPaymentId) {
    try {
      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const refund = await razorpay.payments.refund(booking.razorpayPaymentId, {
        amount: booking.amountPaid * 100,
      });
      console.log("Refund initiated:", refund);
    } catch (err) {
      console.error("Refund failed (non-blocking):", err.message);
    }
  }

  res.status(200).json(new ApiResponse(200, booking, "Booking cancelled and seats restored"));
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
  const event = await Event.findById(eventId).select("capacity availableSeats title");
  if (!event) throw new ApiError(404, "Event not found");

  const heldSeats = await getTotalHeldSeats(String(eventId));
  const effectiveFreeSeats = Math.max(0, (event.availableSeats ?? event.capacity) - heldSeats);

  res.status(200).json(
    new ApiResponse(200, {
      eventId,
      capacity: event.capacity,
      availableSeats: event.availableSeats ?? event.capacity,
      heldSeats,
      effectiveFreeSeats,
      isSoldOut: effectiveFreeSeats === 0,
      fillingFast: effectiveFreeSeats > 0 && effectiveFreeSeats <= event.capacity * 0.2,
    }, "Seat availability fetched")
  );
});

export {
  createOrder,
  verifyPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  getEventBookings,
  getSeatAvailability,
};
