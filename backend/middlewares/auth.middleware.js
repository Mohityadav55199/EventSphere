import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Missing, expired or invalid credentials are 401 (the client should refresh or log in again).
// 403 is reserved for "authenticated but not allowed" (see role.middleware.js).
export const authMiddleware = asyncHandler(async(req,res,next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        throw new ApiError(401, "Access Token is required");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, error.name === "TokenExpiredError" ? "Access token expired" : "Invalid access token");
    }

    const user = await User.findById(decoded?._id).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(401, "User not found");
    }
    req.user = user;
    next();
})
