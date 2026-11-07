import { isSimulatedId } from "./paymentMode.js";

// Refunds one booking through whichever gateway took the payment. Throws on failure.
// Returns "refunded" or "nothing-to-refund" (free / wallet-only / sandbox bookings).
export async function refundBooking(booking) {
  if (!booking.amountPaid) return "nothing-to-refund";

  if (booking.razorpayPaymentId && !isSimulatedId(booking.razorpayOrderId) && !booking.razorpayPaymentId.startsWith("pay_sim_")) {
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    await razorpay.payments.refund(booking.razorpayPaymentId, { amount: Math.round(booking.amountPaid * 100) });
    return "refunded";
  }

  if (booking.stripeSessionId && !isSimulatedId(booking.stripeSessionId)) {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
    if (!session.payment_intent) return "nothing-to-refund";
    await stripe.refunds.create({ payment_intent: session.payment_intent });
    return "refunded";
  }

  return "nothing-to-refund";
}
