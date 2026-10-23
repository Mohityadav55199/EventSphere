import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import userRouter from "./routes/user.routes.js";
import eventRouter from "./routes/event.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import bookingRouter from "./routes/booking.router.js";
import reviewRouter from "./routes/review.router.js";
import chatRouter from "./routes/chat.router.js";
import contactRouter from "./routes/contact.router.js";

const app = express();

// General rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes." }
});

// Strict booking limiter — prevents seat hold spam (BookMyShow-style abuse prevention).
// 5 booking attempts per minute per IP is generous for real users but blocks bots.
const bookingLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 5,              // 5 booking mutations per minute per IP
    keyGenerator: (req, res) => {
        // Use ipKeyGenerator to correctly handle IPv6 and avoid ERR_ERL_KEY_GEN_IPV6
        return ipKeyGenerator(req, res) + (req.user?._id || "");
    },
    message: {
        success: false,
        message: "Too many booking attempts. Please wait a moment before trying again."
    },
    skip: (req) => req.method === "GET", // seat availability GETs are not rate-limited
});

// Dynamic CORS configuration allowing credentials for Vercel & localhost
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("Public"));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "EventSphere API is running smoothly 🚀",
        timestamp: new Date().toISOString()
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        status: "ok",
        service: "EventSphere API",
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString()
    });
});

app.use('/api/v1/users', authLimiter, userRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingLimiter, bookingRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/contacts', contactRouter);

app.use(errorMiddleware);

export default app;