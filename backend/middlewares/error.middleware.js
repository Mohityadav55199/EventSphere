import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

// Turns library errors into the HTTP status a client can act on, instead of a blanket 500.
function normalize(err) {
  if (err instanceof ApiError) return { statusCode: err.statusCode, message: err.message, errors: err.errors };

  // Malformed ObjectId in a query/param (e.g. /events/event/abc)
  if (err.name === "CastError" || err.name === "BSONError") {
    return { statusCode: 400, message: `Invalid ${err.path || "id"}` };
  }
  // Mongoose schema validation (min/max/required/enum)
  if (err.name === "ValidationError" && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return { statusCode: 400, message: errors[0]?.message || "Validation failed", errors };
  }
  // Unique index violation (duplicate email, second review, same seat...)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
    return { statusCode: 409, message: field ? `A record with this ${field} already exists` : "Duplicate record" };
  }
  // Upload limits from multer, and the image-only filter
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 5MB)" : err.message;
    return { statusCode: 400, message };
  }
  // Bad JSON body / body too large from express.json()
  if (err.type === "entity.parse.failed") return { statusCode: 400, message: "Malformed JSON body" };
  if (err.type === "entity.too.large") return { statusCode: 413, message: "Request body is too large" };

  return { statusCode: err.statusCode || err.status || 500, message: err.message };
}

const errorMiddleware = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const { statusCode, message, errors = [] } = normalize(err);
  const isProd = process.env.NODE_ENV === "production";

  if (statusCode >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);

  res.status(statusCode).json({
    success: false,
    // Unexpected 5xx details (driver messages, stack-ish text) stay in the logs in production
    message: statusCode >= 500 && isProd && !(err instanceof ApiError) ? "Internal Server Error" : message || "Internal Server Error",
    errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorMiddleware;
