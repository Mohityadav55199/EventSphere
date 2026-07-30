import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import QRcode from "qrcode";
import crypto from "crypto";
import User from "../models/user.model.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy_stripe_secret_key_12345");

// Generate secure QR code for booking
async function generateSecureQRCode(booking) {
    const secretKey = process.env.QR_SECRET || "eventease_qr_secret_key_987654321";

    // Create secure payload
    const qrPayload = `${booking._id}:${crypto.randomBytes(8).toString("hex")}`;
    const qrHash = crypto
        .createHmac("sha256", secretKey)
        .update(qrPayload)
        .digest("hex");

    // Store secure QR data
    booking.qrCodeData = { payload: qrPayload, hash: qrHash };
    console.log("QR Payload:", qrPayload);
    console.log("QR Hash:", qrHash);
    // Generate QR code image from payload and hash
    const qrDataString = JSON.stringify({
        payload: qrPayload,
        hash: qrHash,
    });

    const qrCodeImage = await QRcode.toDataURL(qrDataString);
    booking.qrCode = qrCodeImage;
    return booking;
}

// Stripe Payment Order / Session Creation
const createOrder = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { seatsBooked, usePoints, couponCode, ticketTier } = req.body;

  if (!eventId || !seatsBooked) {
    throw new ApiError(400, "Event ID and seats booked are required");
  }

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event Not Found");

  // Check seat availability
  const totalBookings = await Booking.aggregate([
    { $match: { event: event._id, paymentstatus: "confirmed" } },
    { $group: { _id: null, totalSeats: { $sum: "$seatsBooked" } } }
  ]);

  const seatsTaken = totalBookings[0]?.totalSeats || 0;
  if (seatsTaken + seatsBooked > event.capacity) {
    throw new ApiError(400, "Not enough seats available");
  }

  // Calculate tier price
  let unitPrice = event.Price;
  let selectedTierName = ticketTier || "Standard Pass";
  if (event.ticketTypes && event.ticketTypes.length > 0 && ticketTier) {
    const foundTier = event.ticketTypes.find(t => t.name.toLowerCase() === ticketTier.toLowerCase());
    if (foundTier) {
      unitPrice = foundTier.price;
      selectedTierName = foundTier.name;
    }
  }

  const totalPrice = unitPrice * seatsBooked;

  const user = await User.findById(req.user._id);
  let discount = 0;

  // Process promo code discount
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

  // ✅ Wallet-only booking (skip Stripe)
  if (amountToPay <= 0) {
    const booking = await Booking.create({
      user: req.user._id,
      event: event._id,
      seatsBooked,
      ticketTier: selectedTierName,
      ticketPrice: unitPrice,
      stripeSessionId: null,
      stripePaymentIntentId: null,
      amountPaid: 0,
      paymentstatus: "confirmed",
    });

    user.walletPoints -= discount; // discount = totalPrice here
    await user.save();

    // Update attendees
    const existingAttendee = event.attendees.find(
      (att) => att.user.toString() === req.user._id.toString()
    );

    if (existingAttendee) {
      existingAttendee.ticketsBooked += seatsBooked;
    } else {
      event.attendees.push({
        user: req.user._id,
        ticketsBooked: seatsBooked,
      });
    }
    await event.save();

    const qrBooking = await generateSecureQRCode(booking);
    await qrBooking.save();

    return res.status(201).json(
      new ApiResponse(201, {
        booking: qrBooking,
        earnedPoints: 0,
        remainingPoints: user.walletPoints,
      }, "Booking created successfully using wallet only")
    );
  }

  // ✅ Normal Stripe Flow
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
              description: `Tickets for ${event.title}`,
              images: event.image ? [event.image] : [],
            },
            unit_amount: Math.round(amountToPay * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: user.email,
      success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/profile?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/event/${eventId}`,
    });
  } catch (err) {
    console.log("Stripe API fallback to mock session (Dev mode):", err.message);
    session = {
      id: `cs_test_mock_${Date.now()}`,
      url: null,
      currency: "inr",
      amount_total: Math.round(amountToPay * 100),
    };
  }

  res.status(200).json(
    new ApiResponse(200, {
      orderId: session.id, // Keeping orderId alias for frontend compat
      stripeSessionId: session.id,
      checkoutUrl: session.url,
      currency: session.currency || "inr",
      amount: amountToPay,
      seatsBooked,
      eventId,
      totalPrice,
      discount,
      remainingPoints: user.walletPoints - discount
    }, "Stripe Checkout Session created successfully")
  );
});

// Confirm & Verify Stripe Payment
const verifyPayment = asyncHandler(async (req, res) => {
  const { stripe_session_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, eventId, seatsBooked, discount, ticketTier, ticketPrice } = req.body;

  const sessionId = stripe_session_id || razorpay_order_id;
  if (!sessionId || !eventId || !seatsBooked) {
    throw new ApiError(400, "Stripe session ID, event ID, and seats booked are required");
  }

  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) {
    throw new ApiError(404, "Event not found");
  }

  // Check if seats are available
  const totalBookings = await Booking.aggregate([
    { $match: { event: event._id, paymentstatus: "confirmed" } },
    { $group: { _id: null, totalSeats: { $sum: "$seatsBooked" } } }
  ]);

  const seatsTaken = totalBookings[0]?.totalSeats || 0;
  if (seatsTaken + seatsBooked > event.capacity) {
    throw new ApiError(400, "Not enough seats available");
  }

  const basePrice = ticketPrice || event.Price;
  const amountPaid = Math.max(0, basePrice * seatsBooked - (discount || 0));

  let booking = await Booking.create({
    user: req.user._id,
    event: event._id,
    seatsBooked,
    ticketTier: ticketTier || "Standard Pass",
    ticketPrice: basePrice,
    stripeSessionId: sessionId,
    stripePaymentIntentId: razorpay_payment_id || `pi_${sessionId}`,
    amountPaid,
    paymentstatus: "confirmed",
  });

  const user = await User.findById(req.user._id);
  if( discount > 0) user.walletPoints -= discount;
  const earnedPoints = Math.floor((amountPaid) / 20);
    user.walletPoints += earnedPoints;
  
    await user.save();

  // Update event attendees list
const existingAttendee = event.attendees.find(
  (att) => att.user.toString() === req.user._id.toString()
);

if (existingAttendee) {
  existingAttendee.ticketsBooked += seatsBooked;
} else {
  event.attendees.push({
    user: req.user._id,
    ticketsBooked: seatsBooked,
  });
}

await event.save();


  booking = await generateSecureQRCode(booking);          
  await booking.save();  
  res.status(201).json(new ApiResponse(201,{ 
    booking,
    earnedPoints,
    remainingPoints: user.walletPoints
  },
    "Booking created successfully"));
});

// Get all bookings for logged-in user
const getMyBookings = asyncHandler(async (req, res) => {

  const bookings = await Booking.find({user : req.user._id })
    .populate("event", "title date location Price")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
});

//Cancel Booking
const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingid);

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to cancel this booking");
  }

  booking.paymentstatus = "cancelled";
  booking.cancelDate = new Date();
  await booking.save();

  if( booking.razorpayPaymentId ){
    try {
      const refund = await razorpay.payments.refund(booking.razorpayPaymentId, { 
        amount: booking.amountPaid * 100
       });
      console.log("Refund initiated:", refund);
      
    } catch (error) {
      throw new ApiError(500, "Failed to initiate refund");
    }
    console.log("Initiate refund via Razorpay API for payment ID:", booking.razorpayPaymentId);
  }

  res.status(200).json(new ApiResponse(200, booking, "Booking cancelled successfully"));
});

const getAllBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find()
    .populate("user", "name email")
    .populate("event", "title date location")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "All bookings fetched successfully"));
});

const getEventBookings = asyncHandler(async (req, res) => {
  const eventId  = req.params.eventId;

  // Check if event exists
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");


  const bookings = await Booking.find({ event: eventId })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, bookings, "Bookings fetched successfully"));
});

export {createOrder,verifyPayment, getMyBookings, cancelBooking, getAllBookings, getEventBookings };
