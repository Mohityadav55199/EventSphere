import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  getEventBookings,
  getSeatAvailability,
} from "../controllers/booking.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/role.middleware.js";
import qrScanMiddleware from "../middlewares/qrScan.middleware.js";

const bookingRouter = Router();

// ── Public: live seat availability (no auth needed for seat count display) ────
bookingRouter.get("/seat-availability/:eventId", getSeatAvailability);

// ── Booking flow ──────────────────────────────────────────────────────────────
bookingRouter.post("/create-order/:eventId", authMiddleware, createOrder);
bookingRouter.post("/verify-payment", authMiddleware, verifyPayment);

// ── User routes ───────────────────────────────────────────────────────────────
bookingRouter.get("/my-bookings", authMiddleware, getMyBookings);
bookingRouter.delete("/cancel-booking/:bookingid", authMiddleware, cancelBooking);

// ── Admin routes ──────────────────────────────────────────────────────────────
bookingRouter.get("/admin/all-bookings", authMiddleware, authorizeRoles("admin"), getAllBookings);
bookingRouter.get("/admin/event-bookings/:eventId", authMiddleware, authorizeRoles("admin"), getEventBookings);

// ── Organizer routes ──────────────────────────────────────────────────────────
bookingRouter.get("/organizer/event-bookings/:eventId", authMiddleware, authorizeRoles("organizer"), getEventBookings);

// ── Check-in (QR scan) ────────────────────────────────────────────────────────
bookingRouter.post("/checkin", authMiddleware, authorizeRoles("organizer"), qrScanMiddleware);

export default bookingRouter;