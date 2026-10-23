import crypto from "crypto";
import Booking from "../models/booking.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const qrScanMiddleware = asyncHandler(async (req, res, next) => {
    try {
      const { payload, hash } = req.body; // from QR scan JSON

      // Validate QR_SECRET exists
      const secretKey = process.env.QR_SECRET || "eventease_qr_secret_key_987654321";

      // Verify hash matches payload
      const expectedHash = crypto
        .createHmac("sha256", secretKey)
        .update(payload)
        .digest("hex");

      if (hash !== expectedHash) {
        throw new ApiError(400, "Invalid QR code data");
      }

      // Extract bookingId from payload
      const bookingId = payload.split(":")[0];

      const booking = await Booking.findById(bookingId)
        .populate("user", "name email")
        .populate("event", "title location eventDate");

      if (!booking) {
        throw new ApiError(404, "Booking not found");
      }

      if (booking.checkedIn) {
        throw new ApiError(400, `Attendee already checked in at ${new Date(booking.updatedAt).toLocaleTimeString()}`);
      }

      booking.checkedIn = true;
      await booking.save();

      res.status(200).json(new ApiResponse(200, booking, "Check-in successful! Attendee admitted."));
    } catch (error) {
      console.error(error);
      throw new ApiError(403, error?.message || "Invalid QR code scan");
    }
  }
);

export default qrScanMiddleware;
