import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const authorizeRoles = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "User is not authenticated");
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Role ${req.user.role} is not allowed to access this resource`);
    }

    next();
  });
};

export default authorizeRoles;
