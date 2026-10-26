import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import { getRedisClient } from "./utils/redisClient.js";
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

// Render sits behind one proxy hop; without this every client shares the proxy's IP,
// so the rate limiters would count all users together.
app.set("trust proxy", 1);

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

// Security headers. Cross-origin resource policy is relaxed because the Vercel frontend loads assets from this API.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Dynamic CORS configuration allowing credentials for Vercel & localhost with 24h preflight cache
app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400
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

// Plain /health is instant and lightweight (used by client to check server readiness and cold start).
// /health?deep=1 also checks MongoDB and Redis status.
app.get("/health", async (req, res) => {
    const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
    const body = {
        success: true,
        status: "ok",
        database: dbStates[mongoose.connection.readyState] || "unknown",
        service: "EventSphere API",
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString()
    };

    if (req.query.deep) {
        const started = Date.now();
        try {
            await mongoose.connection.db.admin().ping();
            body.databasePingMs = Date.now() - started;
        } catch {
            body.database = "unreachable";
        }
        try {
            const redis = await getRedisClient();
            await redis.get("health:ping");
            body.redis = redis.kind || "ok";
        } catch {
            body.redis = "error";
        }
        if (body.database !== "connected") {
            body.success = false;
            body.status = "degraded";
            return res.status(503).json(body);
        }
    }
    res.status(200).json(body);
});

app.use('/api/v1/users', authLimiter, userRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingLimiter, bookingRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/contacts', contactRouter);

app.use(errorMiddleware);

export default app;