import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendPasswordResetEmail } from "../utils/emailService.js";
import crypto from "crypto";

const genearteAccessTokenAndRefreshToken = async (userOrId) => {
    try {
        const user = (typeof userOrId === "object" && userOrId !== null && typeof userOrId.genearteAccessToken === "function")
            ? userOrId
            : await User.findById(userOrId);
        if (!user) {
            throw new ApiError(404, "User not found for token generation");
        }
        const accessToken = user.genearteAccessToken();
        const refreshToken = user.refreshAccessToken();
        user.refreshToken = refreshToken;
        // Targeted update: skips full-document save (and the pre-save password hook) on every login
        await User.updateOne({ _id: user._id }, { $set: { refreshToken } });
        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(error.statusCode || 500, error.message || "Error generating tokens");
    }
}
const registerUser = asyncHandler(async(req, res) => {
    const { name, email, password, role } = req.body;
    if(
        [name, email, password].some((field)=> !field || field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }
    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });
    if(existingUser){
        throw new ApiError(400, "User already exists with this email");
    }
    const user = await User.create({
        name: name.trim(),
        email: cleanEmail,
        password,
        role: role || "attendee" // Default to attendee if no role is provided
    });

    const { accessToken, refreshToken } = await genearteAccessTokenAndRefreshToken(user);
    const createdUser = user.toObject();
    delete createdUser.password;
    delete createdUser.refreshToken;

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    return res
    .status(201)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(201, { user: createdUser, accessToken, refreshToken }, "User registered successfully")
    );   
})

const loginUser = asyncHandler(async(req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ApiError(400, "Both email and password are required");
    }
    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });
    // Same message for unknown email and wrong password so emails can't be enumerated
    if(!user || !(await user.isPasswordCorrect(password))){
        console.warn(`[auth] failed login for ${cleanEmail} from ${req.ip}`);
        throw new ApiError(401, "Invalid email or password");
    }

    const { accessToken, refreshToken } = await genearteAccessTokenAndRefreshToken(user);
    const loggedInUser = user.toObject();
    delete loggedInUser.password;
    delete loggedInUser.refreshToken;

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {
            user : loggedInUser,
            accessToken,
            refreshToken
         },
         "User logged in successfully"
        )
    );
})

const logoutUser = asyncHandler(async(req, res) => {
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true,
        })
        const options = {
            httpOnly: true,
            secure: true,
            expires: new Date(0)
        }
        return res
        .status(200)
        .cookie("accessToken", "", options)
        .cookie("refreshToken", "", options)
        .json(
            new ApiResponse(200, {}, "User logged out successfully")
        )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"Refresh token is required")
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    } catch {
        throw new ApiError(401,"Refresh token is invalid or expired")
    }

    const user = await User.findById(decodedToken?._id)
    // The stored token must match: logging in elsewhere or logging out revokes older refresh tokens
    if(!user || incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401,"Refresh token is invalid or has been revoked")
    }

    // Must match the login cookie options or the browser treats them as cross-site and drops them
    const options = {
        httpOnly : true,
        secure : true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
    const { accessToken, refreshToken: newRefreshToken } = await genearteAccessTokenAndRefreshToken(user)
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(
            200,
            {accessToken,refreshToken:newRefreshToken},
            "Access Token Refreshed"
        )
    )
})

const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// Always answers the same way so the endpoint can't be used to discover registered emails
const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        await User.updateOne(
            { _id: user._id },
            { $set: { passwordResetToken: hashResetToken(token), passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000) } }
        );
        const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
        // Not awaited: email delivery shouldn't slow the response or reveal whether the account exists
        sendPasswordResetEmail({ user, resetUrl: `${clientUrl}/reset-password/${token}` });
    }
    return res.status(200).json(
        new ApiResponse(200, {}, "If an account exists for that email, a reset link has been sent")
    );
});

const resetPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({
        passwordResetToken: hashResetToken(req.params.token),
        passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");
    if (!user) {
        throw new ApiError(400, "Reset link is invalid or has expired");
    }
    user.password = req.body.password; // hashed by the pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined; // sign out existing sessions
    await user.save({ validateBeforeSave: false });
    return res.status(200).json(new ApiResponse(200, {}, "Password reset successful. Please log in."));
});

const changePassword = asyncHandler(async(req,res)=>{
 try {
       const {oldPassword,newPassword} = req.body;

       const user = await User.findById(req.user?._id)
       const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword)
       if(!isOldPasswordCorrect){
           throw new ApiError(400,"Wrong Old Password")
       }
       user.password = newPassword;
       await user.save({validateBeforeSave:false})
       return res.
           status(201)
           .json(
               new ApiResponse(201,{},"Password Changed Succesfully")
           )
 } catch (error) {
      throw new ApiError(400,error?.message || "Something went wrong")
 }
    
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {name,email} = req.body
    if(!name || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                name,
                email // email : email {another way of doing it}
            }
        },
        {
            new : true
        }
    ).select("-password") // remove password from the response

    return res
    .status(201)
    .json(
        new ApiResponse(201,user,"Account Details Updated Successfully")
    )
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    const userId = req.user?._id; // authMiddleware already set this
    if (!userId) {
        throw new ApiError(401, "Unauthorized: No user ID found");
    }

    // fetch fresh user (in case user data changed after token issue)
    const user = await User.findById(userId).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    return res
    .status(201)
    .json(
        new ApiResponse(201,user,"Current User Fetched Successfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    forgotPassword,
    resetPassword,
    getCurrentUser,
    updateAccountDetails
};
