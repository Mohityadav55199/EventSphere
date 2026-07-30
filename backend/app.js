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
const allowedOrigins = [
    process.env.CLIENT_URL,
    "https://event-sphere-lemon-nu.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express.json({limit : "16kb"}));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("Public"));
app.use(cookieParser());


app.use('/api/v1/users', userRouter);
app.use('/api/v1/events', eventRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/contacts', contactRouter);

app.use(errorMiddleware)
export default app;