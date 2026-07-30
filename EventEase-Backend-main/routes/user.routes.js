import { Router } from "express";
import { changePassword, getCurrentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails } from "../controllers/user.controllers.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const userRouter = Router();
userRouter.route('/register').post(registerUser)
userRouter.route('/login').post(loginUser)
userRouter.route("/logout").post(authMiddleware,logoutUser)
userRouter.route("/refresh-token").post(refreshAccessToken)
userRouter.route("/profile").get(authMiddleware,getCurrentUser)
userRouter.route("/change-password").post(authMiddleware,changePassword)
userRouter.route("/update-account").patch(authMiddleware,updateAccountDetails)

export default userRouter