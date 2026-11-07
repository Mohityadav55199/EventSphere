import Stripe from "stripe";
import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import WebhookEvent from "../models/webhookEvent.model.js";
import { releaseHold } from "../utils/seatHold.js";
import { emitSeatUpdate } from "../utils/seatBroadcast.js";
import { confirmBooking } from "./booking.controller.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy_stripe_secret_key_12345");

// Stripe -> POST /api/v1/webhooks/stripe
// Needs the RAW request body (the signature is computed over the exact bytes), so the
// route is mounted with express.raw() before the global express.json().
//
// Why this exists: the browser redirect after checkout is not reliable (tab closed, network
// drop). The webhook confirms the ticket server-to-server even if the user never comes back.
export async function handleStripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: "Webhook not configured" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Invalid signature: ${err.message}` });
  }

  // Idempotency: the first delivery claims the event id; redeliveries stop here
  try {
    await WebhookEvent.create({ eventId: event.id, type: event.type });
  } catch (err) {
    if (err.code === 11000) return res.status(200).json({ received: true, duplicate: true });
    return res.status(500).json({ success: false, message: "Could not record webhook event" });
  }

  try {
    if (event.type === "checkout.session.completed") await onCheckoutCompleted(event.data.object);
    else if (event.type === "checkout.session.expired") await onCheckoutExpired(event.data.object);
    return res.status(200).json({ received: true });
  } catch (err) {
    // Free the claim so Stripe's automatic retry can process this event again
    await WebhookEvent.deleteOne({ eventId: event.id }).catch(() => {});
    console.error(`Webhook ${event.type} (${event.id}) failed:`, err.message);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

async function onCheckoutCompleted(session) {
  if (session.payment_status !== "paid") return; // async payment methods: wait for the later event

  const booking = await Booking.findById(session.metadata?.bookingId);
  if (!booking || booking.stripeSessionId !== session.id) return; // not ours / tampered
  if (booking.status === "confirmed") return; // browser redirect got there first

  if (booking.status === "hold" && session.amount_total === Math.round((booking.amountDue || 0) * 100)) {
    const [eventDoc, user] = await Promise.all([Event.findById(booking.event), User.findById(booking.user)]);
    if (eventDoc && user && eventDoc.activeStatus === "active") {
      try {
        await confirmBooking(booking, eventDoc, user, {
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        });
        return;
      } catch (err) {
        if (err.statusCode !== 409) throw err;
        // 409: seats or the hold were lost -> fall through to the refund below
        const again = await Booking.findById(booking._id);
        if (again?.status === "confirmed") return; // lost a race with the redirect, still fine
      }
    }
  }

  // Customer paid but we can no longer give them the seats (hold expired, event cancelled...)
  await refundLatePayment(booking, session);
}

async function refundLatePayment(booking, session) {
  const update = { status: booking.status === "hold" ? "expired" : booking.status };
  try {
    if (typeof session.payment_intent === "string") {
      await stripe.refunds.create({ payment_intent: session.payment_intent });
      update.refundStatus = "refunded";
    }
  } catch (err) {
    update.refundStatus = "failed";
    update.refundError = String(err.message).slice(0, 300);
    console.error(`Late-payment refund failed for booking ${booking._id}:`, err.message);
  }
  await Booking.updateOne({ _id: booking._id }, { $set: update });
  await releaseHold(String(booking.event), String(booking.user), booking.selectedSeats);
  await emitSeatUpdate(booking.event);
}

async function onCheckoutExpired(session) {
  const booking = await Booking.findOneAndUpdate(
    { _id: session.metadata?.bookingId, stripeSessionId: session.id, status: "hold" },
    { status: "expired", paymentstatus: "cancelled", cancelDate: new Date() }
  );
  if (!booking) return;
  await releaseHold(String(booking.event), String(booking.user), booking.selectedSeats);
  await emitSeatUpdate(booking.event);
}
