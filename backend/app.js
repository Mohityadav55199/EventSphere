import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";
import eventRouter from "./routes/event.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import bookingRouter from "./routes/booking.router.js";
import reviewRouter from "./routes/review.router.js";
import chatRouter from "./routes/chat.router.js";
import contactRouter from "./routes/contact.router.js";

const app = express();

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

app.use('/api/v1/users', userRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/contacts', contactRouter);

app.use(errorMiddleware);

export default app;