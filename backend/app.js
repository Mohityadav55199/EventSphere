import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import { getRedisClient } from "./utils/redisClient.js";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import userRouter from "./routes/user.routes.js";
import eventRouter from "./routes/event.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import bookingRouter from "./routes/booking.router.js";
import reviewRouter from "./routes/review.router.js";
import chatRouter from "./routes/chat.router.js";
import contactRouter from "./routes/contact.router.js";
import webhookRouter from "./routes/webhook.router.js";
import { corsOriginCheck } from "./config/cors.js";

const app = express();

// Render sits behind one proxy hop; without this every client shares the proxy's IP,
// so the rate limiters would count all users together.
app.set("trust proxy", 1);

// General rate limiter for auth endpoints
const isTestEnv = process.env.NODE_ENV === "test"; // integration tests fire hundreds of requests from one IP

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    skip: () => isTestEnv,
    message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes." }
});

// Security headers. Cross-origin resource policy is relaxed because the Vercel frontend loads assets from this API.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Dynamic CORS configuration allowing credentials for Vercel & localhost with 24h preflight cache
app.use(cors({
    origin: corsOriginCheck,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400
}));

// Gateway webhooks need the raw body for signature checks, so they are mounted before express.json()
app.use("/api/v1/webhooks", webhookRouter);

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
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/contacts', contactRouter);

app.use(errorMiddleware);

export default app;