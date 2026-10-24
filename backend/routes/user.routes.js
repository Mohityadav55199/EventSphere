import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { changePassword, forgotPassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, resetPassword, updateAccountDetails } from "../controllers/user.controllers.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../validators/schemas.js";

// Tight limit against password guessing; successful logins don't count against it
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." }
});

// Stops the reset endpoint being used to spam someone's inbox
const resetRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, message: "Too many reset requests. Please try again later." }
});

const userRouter = Router();
userRouter.route('/register').post(validate(registerSchema), registerUser)
userRouter.route('/login').post(loginLimiter, validate(loginSchema), loginUser)
userRouter.route("/logout").post(authMiddleware,logoutUser)
userRouter.route("/refresh-token").post(refreshAccessToken)
userRouter.route("/forgot-password").post(resetRequestLimiter, validate(forgotPasswordSchema), forgotPassword)
userRouter.route("/reset-password/:token").post(validate(resetPasswordSchema), resetPassword)
userRouter.route("/profile").get(authMiddleware,getCurrentUser)
userRouter.route("/change-password").post(authMiddleware,changePassword)
userRouter.route("/update-account").patch(authMiddleware,updateAccountDetails)

export default userRouter
