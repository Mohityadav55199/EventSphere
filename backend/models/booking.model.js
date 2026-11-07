import mongoose, { Schema } from "mongoose";
const bookingSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User is required"],
    },
    event: {
        type: Schema.Types.ObjectId,
        ref: "Event",
        required: [true, "Event is required"],
    },
    bookingDate: {
        type: Date,
        default: Date.now,
    },
    paymentstatus: {
        type: String,
        enum: ["confirmed", "cancelled", "pending"],
        default: "pending",
    },
    // Concurrency lifecycle status
    // hold    → seats reserved in Redis, awaiting payment
    // confirmed → payment verified, seats permanently deducted in MongoDB
    // cancelled → user cancelled; seats restored
    // expired → hold TTL elapsed without payment; seats restored by cron job
    status: {
        type: String,
        enum: ["hold", "confirmed", "cancelled", "expired"],
        default: "hold",
        index: true,
    },
    // When the Redis seat hold expires (used by holdExpiry cron job)
    holdExpiresAt: {
        type: Date,
        index: true, // for fast expiry queries
    },
    cancelDate: {
        type: Date,
    },  
    selectedSeats: {
        type: [String],
        default: [],
    },
    seatsBooked: {
        type: Number,
        default: 0,
    },
    stripeSessionId: {
        type: String,
    },
    stripePaymentIntentId: {
        type: String,
    },
    razorpayOrderId: {
        type: String,
    },
    razorpayPaymentId: {
        type: String,
    },
    razorpaySignature: {
        type: String,
    },
    amountPaid: {
        type: Number,
    },
    // Server-computed at order time; verifyPayment trusts these, never the request body
    amountDue: { type: Number, default: 0 },
    couponDiscount: { type: Number, default: 0 },
    pointsUsed: { type: Number, default: 0 },
    ticketTier: {
        type: String,
        default: "Standard Pass",
    },
    ticketPrice: {
        type: Number,
    },

    qrCodeData: {
        payload: { type: String}, // bookingId:randomHex
        hash: { type: String }     // HMAC hash
    },
        
    qrCode: {
        type: String 
    },
    // Outcome of the refund issued when an organizer cancels the event
    refundStatus: {
        type: String,
        enum: ["none", "refunded", "failed"],
        default: "none",
    },
    refundError: { type: String },
    //track if user has checked in at the event
    checkedIn: {
        type: Boolean,
        default: false
    },


}, { timestamps: true });

// "My Bookings" (user + newest first), the hold-expiry job (status + expiry), per-event lookups
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.index({ event: 1, status: 1 });
// Organizer dashboard: confirmed bookings of an event over time
bookingSchema.index({ event: 1, status: 1, createdAt: -1 });
// Last line of defence against double-selling: two CONFIRMED bookings can never share a seat of the
// same event, even if the application-level atomic update were bypassed (a multikey unique index).
bookingSchema.index(
    { event: 1, selectedSeats: 1 },
    { unique: true, partialFilterExpression: { status: "confirmed" }, name: "uniq_confirmed_seat_per_event" }
);

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;