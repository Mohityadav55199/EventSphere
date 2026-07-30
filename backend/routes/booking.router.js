import { Router } from "express";
import { createOrder, verifyPayment, getMyBookings, cancelBooking,getAllBookings,getEventBookings  } from "../controllers/booking.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/role.middleware.js";
import qrScanMiddleware from "../middlewares/qrScan.middleware.js";

const bookingRouter = Router();

// Create a booking order
bookingRouter.post("/create-order/:eventId", authMiddleware, createOrder);
// Verify payment
bookingRouter.post("/verify-payment", authMiddleware, verifyPayment);

// Public routes
bookingRouter.route('/my-bookings').get(authMiddleware,getMyBookings);
bookingRouter.route('/cancel-booking/:bookingid').delete(authMiddleware, cancelBooking);

// Admin routes
bookingRouter.route('/admin/all-bookings').get(authMiddleware, authorizeRoles("admin"), getAllBookings);
bookingRouter.route('/admin/event-bookings/:eventId').get(authMiddleware, authorizeRoles("admin"), getEventBookings);

// organizer routes
bookingRouter.route('/organizer/event-bookings/:eventId').get(authMiddleware, authorizeRoles("organizer"), getEventBookings);

// Check-in route
bookingRouter.post("/checkin",authMiddleware, authorizeRoles("organizer"),qrScanMiddleware);


export default bookingRouter