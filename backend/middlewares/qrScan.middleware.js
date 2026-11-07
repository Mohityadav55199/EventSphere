import crypto from "crypto";
import Booking from "../models/booking.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { getQrSecret } from "../utils/qrSecret.js";

const safeEqualHex = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const qrScanMiddleware = asyncHandler(async (req, res) => {
  const { payload, hash } = req.body || {};
  if (typeof payload !== "string" || typeof hash !== "string") {
    throw new ApiError(400, "Invalid QR code data");
  }

  const expectedHash = crypto.createHmac("sha256", getQrSecret()).update(payload).digest("hex");
  if (!safeEqualHex(hash, expectedHash)) {
    throw new ApiError(400, "Invalid QR code data");
  }

  const bookingId = payload.split(":")[0];
  const booking = await Booking.findById(bookingId)
    .populate("user", "name email")
    .populate("event", "title location eventDate organizer");
  if (!booking) throw new ApiError(404, "Booking not found");

  // The scanned code must be the one currently issued for this booking
  if (booking.qrCodeData?.payload !== payload) {
    throw new ApiError(400, "This QR code is no longer valid");
  }

  // Organizers may only admit attendees of their own events (admins can scan any)
  const isOwner = booking.event?.organizer?.toString() === req.user._id.toString();
  if (req.user.role !== "admin" && !isOwner) {
    throw new ApiError(403, "You can only check in attendees for your own events");
  }

  if (booking.status !== "confirmed" || booking.paymentstatus !== "confirmed") {
    throw new ApiError(400, `Ticket is not valid (booking is ${booking.status})`);
  }

  // Atomic: if two scanners race, only one flips checkedIn
  const checkedIn = await Booking.findOneAndUpdate(
    { _id: booking._id, checkedIn: { $ne: true } },
    { $set: { checkedIn: true } },
    { new: true }
  );
  if (!checkedIn) {
    throw new ApiError(400, `Attendee already checked in at ${new Date(booking.updatedAt).toLocaleTimeString()}`);
  }

  booking.checkedIn = true;
  res.status(200).json(new ApiResponse(200, booking, "Check-in successful! Attendee admitted."));
});

export default qrScanMiddleware;
