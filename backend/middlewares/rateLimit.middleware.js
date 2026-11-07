import { rateLimit } from "express-rate-limit";

// Per-USER booking limiter. It must run after authMiddleware so req.user exists;
// keying by IP would make everyone on a shared network (college Wi-Fi, office, mobile carrier NAT)
// share one allowance.
export const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10, // booking mutations per user per minute: generous for people, tight for bots
  keyGenerator: (req) => String(req.user?._id),
  message: { success: false, message: "Too many booking attempts. Please wait a moment before trying again." },
  skip: () => process.env.NODE_ENV === "test", // integration tests fire hundreds of requests
  validate: { keyGeneratorIpFallback: false },
});
