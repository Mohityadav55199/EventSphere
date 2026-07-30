import  { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { createReview, getEventReviews, editReview, deleteReview } from "../controllers/review.controller.js";

const reviewRouter = Router();

reviewRouter.post("/post-review/:eventId", authMiddleware, createReview);
reviewRouter.get("/AllReviews/:eventId", getEventReviews);
reviewRouter.patch("/edit/:reviewId", authMiddleware, editReview);
reviewRouter.delete("/delete-review/:reviewId", authMiddleware, deleteReview);

export default reviewRouter;
