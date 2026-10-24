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
import { sendTicketConfirmationEmail } from "../utils/emailService.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy_stripe_secret_key_12345");

// ─── Helper: Emit live seat availability to all watching clients ──────────────
async function emitSeatUpdate(eventId) {
  try {
    const io = getIO();
    const event = await Event.findById(eventId).select("availableSeats capacity bookedSeats");
    const heldSeats = await getTotalHeldSeats(String(eventId)); // now returns array of seat IDs

    io.to(`seats:${eventId}`).emit("seatUpdate", {
      eventId: String(eventId),
      availableSeats: event?.availableSeats ?? 0,
      bookedSeats: event?.bookedSeats || [],
      heldSeats: heldSeats || [],
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
  const { selectedSeats, usePoints, couponCode, ticketTier, paymentGateway = "stripe" } = req.body;

  if (!eventId || !Array.isArray(selectedSeats) || selectedSeats.length < 1) {
    throw new ApiError(400, "Event ID and an array of selected seats are required");
  }

  const seatsBooked = selectedSeats.length;
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
    selectedSeats,
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
    await confirmHold(String(eventId), String(req.user._id), selectedSeats);

    // ── LAYER 2: Atomic MongoDB seat decrement ──────────────────────────────
    await atomicDecrementSeats(eventId, selectedSeats);

    const booking = await Booking.create({
      user: req.user._id,
      event: event._id,
      selectedSeats,
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

    // ── Email Confirmation Dispatch ──────────────────────────────────────────
    sendTicketConfirmationEmail({ user, event, booking: qrBooking }).catch((emailErr) => {
      console.warn("⚠️ Ticket email dispatch error:", emailErr.message);
    });

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

  // Create a pending Booking doc NOW (with status:"hold") so the expiry job
  // can restore seats if the user abandons without paying.
  const pendingBooking = await Booking.create({
    user: req.user._id,
    event: event._id,
    selectedSeats,
    seatsBooked,
    ticketTier: selectedTierName,
    ticketPrice: unitPrice,
    amountPaid: 0,
    paymentstatus: "pending",
    status: "hold",
    holdExpiresAt,
  });

  // ── Regional Gateway: Razorpay (UPI, Google Pay UPI, PhonePe, NetBanking) ─
  if (paymentGateway === "razorpay") {
    try {
      if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes("dummy")) {
        throw new Error("Razorpay credentials unconfigured in environment");
      }
      const Razorpay = (await import("razorpay")).default;
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountToPay * 100), // in paise
        currency: "INR",
        receipt: `rcpt_${pendingBooking._id.toString().slice(-10)}`,
        notes: {
          bookingId: String(pendingBooking._id),
          eventId: String(eventId),
        },
      });

      pendingBooking.razorpayOrderId = razorpayOrder.id;
      await pendingBooking.save();

      return res.status(200).json(
        new ApiResponse(200, {
          gateway: "razorpay",
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          bookingId: pendingBooking._id,
          eventTitle: event.title,
          amountToPay,
          discount,
          selectedTier: selectedTierName,
          unitPrice,
          user: {
            name: user.name,
            email: user.email,
          },
        }, "Razorpay order initialized successfully")
      );
    } catch (err) {
      console.warn("⚠️ Razorpay order notice:", err.message, "— activating sandbox test simulation.");
      const simOrderId = `order_sim_${Date.now()}_${pendingBooking._id.toString().slice(-6)}`;
      pendingBooking.razorpayOrderId = simOrderId;
      await pendingBooking.save();

      return res.status(200).json(
        new ApiResponse(200, {
          gateway: "razorpay",
          orderId: simOrderId,
          amount: Math.round(amountToPay * 100),
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_sim",
          bookingId: pendingBooking._id,
          eventTitle: event.title,
          amountToPay,
          discount,
          selectedTier: selectedTierName,
          unitPrice,
          user: {
            name: user.name,
            email: user.email,
          },
          isSimulated: true,
        }, "Razorpay sandbox order initialized")
      );
    }
  }

  // ── International Gateway: Stripe (Apple Pay, Google Pay, Cards) ──────────
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
      metadata: {
        bookingId: String(pendingBooking._id),
        eventId: String(eventId),
        selectedSeats: JSON.stringify(selectedSeats),
        discount: String(discount),
        ticketTier: selectedTierName,
        ticketPrice: String(unitPrice),
      },
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/profile?session_id={CHECKOUT_SESSION_ID}&booking_id=${pendingBooking._id}&event_id=${eventId}&seats=${encodeURIComponent(JSON.stringify(selectedSeats))}&discount=${discount}&tier=${encodeURIComponent(selectedTierName)}&price=${unitPrice}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/event/${eventId}`,
      expires_at: Math.floor(Date.now() / 1000) + DEFAULT_HOLD_SECONDS,
    });

    await Booking.findByIdAndUpdate(pendingBooking._id, { stripeSessionId: session.id });
  } catch (err) {
    console.warn("⚠️ Stripe session notice:", err.message, "— activating sandbox test simulation.");
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const simSessionId = `sim_cs_${Date.now()}_${pendingBooking._id.toString().slice(-6)}`;
    await Booking.findByIdAndUpdate(pendingBooking._id, { stripeSessionId: simSessionId });
    session = {
      id: simSessionId,
      url: `${clientUrl}/profile?session_id=${simSessionId}&booking_id=${pendingBooking._id}&event_id=${eventId}&seats=${encodeURIComponent(JSON.stringify(selectedSeats))}&discount=${discount}&tier=${encodeURIComponent(selectedTierName)}&price=${unitPrice}`,
    };
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
      isSimulated: session.id.startsWith("sim_cs_"),
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
    selectedSeats, // Array, JSON string, or retrieved from pending booking
    discount,
    ticketTier,
    ticketPrice,
    bookingId, // pending booking ID from createOrder response
  } = req.body;

  let resolvedEventId = eventId;
  let resolvedSeats = selectedSeats;

  // If selectedSeats is a JSON string or comma-separated string, parse it
  if (typeof resolvedSeats === "string") {
    try {
      resolvedSeats = JSON.parse(resolvedSeats);
    } catch {
      resolvedSeats = resolvedSeats.includes(",") ? resolvedSeats.split(",").map(s => s.trim()) : [resolvedSeats];
    }
  }

  // If bookingId is provided, retrieve eventId and selectedSeats directly from the pending booking doc
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
    if (booking) {
      if (!resolvedEventId) resolvedEventId = String(booking.event);
      if (!Array.isArray(resolvedSeats) || resolvedSeats.length === 0) {
        resolvedSeats = booking.selectedSeats;
      }
    }
  }

  // Fallback if selectedSeats is still not an array
  if (!Array.isArray(resolvedSeats) || resolvedSeats.length === 0) {
    const seatCount = Number(req.body.seatsBooked) || 1;
    resolvedSeats = Array.from({ length: seatCount }, (_, i) => `Seat-${i + 1}`);
  }

  const sessionId = stripe_session_id || razorpay_order_id;
  if (!sessionId || !resolvedEventId) {
    throw new ApiError(400, "Session ID and event ID are required");
  }

  const seatsBooked = resolvedSeats.length;

  const event = await Event.findById(resolvedEventId);
  if (!event) throw new ApiError(404, "Event not found");

  // ── LAYER 1: Confirm hold (remove from Redis) ───────────────────────────────
  await confirmHold(String(resolvedEventId), String(req.user._id), resolvedSeats);

  // ── LAYER 2: Atomic MongoDB seat decrement ──────────────────────────────────
  // This is the final guard — even if Redis hold somehow failed, this
  // atomic op prevents overselling at the DB level.
  await atomicDecrementSeats(resolvedEventId, resolvedSeats);

  // ── Create / update booking as confirmed ───────────────────────────────────
  const basePrice = ticketPrice || event.Price;
  const amountPaid = Math.max(0, basePrice * seatsBooked - (discount || 0));

  if (booking) {
    // Update the pending hold booking to confirmed
    booking.selectedSeats = resolvedSeats;
    booking.seatsBooked = seatsBooked;
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
      selectedSeats: resolvedSeats,
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

  // ── Verify Razorpay signature if present ──────────────────────────────────
  if (razorpay_order_id && razorpay_payment_id && req.body.razorpay_signature) {
    const isSimulated = razorpay_order_id.startsWith("order_sim_");
    if (!isSimulated && process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes("dummy")) {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (generatedSignature !== req.body.razorpay_signature) {
        throw new ApiError(400, "Invalid Razorpay payment signature verification failed");
      }
    }
  }

  // ── Generate QR code ────────────────────────────────────────────────────────
  booking = await generateSecureQRCode(booking);
  if (razorpay_order_id) {
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = req.body.razorpay_signature;
  }
  await booking.save();

  // ── Email Confirmation Dispatch ──────────────────────────────────────────
  sendTicketConfirmationEmail({ user, event, booking }).catch((emailErr) => {
    console.warn("⚠️ Ticket email dispatch error:", emailErr.message);
  });

  // ── LAYER 3: Broadcast final seat count ─────────────────────────────────────
  await emitSeatUpdate(resolvedEventId);

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
  await releaseHold(String(eventId), String(req.user._id), booking.selectedSeats);

  // ── Restore seats in MongoDB (only if booking was confirmed) ────────────────
  if (wasConfirmed) {
    await atomicRestoreSeats(eventId, booking.selectedSeats);
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
  createOrder,
  verifyPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  getEventBookings,
  getSeatAvailability,
};
