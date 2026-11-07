import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { eventIdParam, reviewIdParam, reviewSchema } from "../validators/schemas.js";
import { createReview, getEventReviews, editReview, deleteReview } from "../controllers/review.controller.js";

const reviewRouter = Router();

reviewRouter.post("/post-review/:eventId", authMiddleware, validate(eventIdParam, "params"), validate(reviewSchema), createReview);
reviewRouter.get("/AllReviews/:eventId", validate(eventIdParam, "params"), getEventReviews);
reviewRouter.patch("/edit/:reviewId", authMiddleware, validate(reviewIdParam, "params"), validate(reviewSchema), editReview);
reviewRouter.delete("/delete-review/:reviewId", authMiddleware, validate(reviewIdParam, "params"), deleteReview);

export default reviewRouter;
