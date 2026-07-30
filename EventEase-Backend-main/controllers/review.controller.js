// controllers/review.controller.js
import Review from "../models/review.model.js";
import Event from "../models/event.model.js";
import Booking from "../models/booking.model.js";
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";

const createReview = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { rating, comment } = req.body;

  // Find event
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");

  // Check if event date has passed
  if (new Date(event.date) > new Date()) {
    throw new ApiError(400, "You can review only after the event date");
  }

  // Check if user attended
  const booking = await Booking.findOne({
    event: eventId,
    user: req.user._id,
    paymentstatus: "confirmed"
  });
  if (!booking) {
    throw new ApiError(403, "You must have attended the event to review");
  }

  // Save review
  const review = await Review.create({
    user: req.user._id,
    event: eventId,
    rating,
    comment
  });

// Update event's average rating
const stats = await Review.aggregate([
  { $match: { event: new mongoose.Types.ObjectId(eventId) } },
  { $group: { _id: "$event", avgRating: { $avg: "$rating" } } }
]);

// console.log("Average Rating Stats:", stats[0]?.avgRating);
await Event.findByIdAndUpdate(eventId, { avgRating: stats[0]?.avgRating || 0 });
res.status(201).json(new ApiResponse(201, review, "Review submitted successfully"));
});

const editReview = asyncHandler( async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  // Find review
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, "Review not found");

  // Check if review belongs to user
  if (review.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to edit this review");
  }

  // Update review
  review.rating = rating;
  review.comment = comment;
  await review.save();
  // Update event's average rating
const eventId = review.event.toString();
const stats = await Review.aggregate([
  { $match: { event: new mongoose.Types.ObjectId(eventId) } },
  { $group: { _id: "$event", avgRating: { $avg: "$rating" } } }
]);

await Event.findByIdAndUpdate(eventId, { avgRating: stats[0]?.avgRating || 0 });

  res.status(200).json(new ApiResponse(200, review, "Review updated successfully"));
});

const deleteReview = asyncHandler( async (req, res) => {
  const { reviewId } = req.params;

  // Find review
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, "Review not found");      

  // Check if review belongs to user
  if (review.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this review");
  }

  // Delete review
  await review.deleteOne();

  // Update event's average rating
const eventId = review.event.toString();
const stats = await Review.aggregate([
  { $match: { event: new mongoose.Types.ObjectId(eventId) } },
  { $group: { _id: "$event", avgRating: { $avg: "$rating" } } }
]);

await Event.findByIdAndUpdate(eventId, { avgRating: stats[0]?.avgRating || 0 });

  res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
});  

const getEventReviews = asyncHandler( async (req, res) => {
  const { eventId } = req.params;

  // Aggregate average rating
  const stats = await Review.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: "$event",
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  // Fetch individual reviews
  const reviews = await Review.find({ event: eventId })
    .populate("user", "name")
    .sort({ createdAt: -1 });

  res.status(200).json( new ApiResponse(
    200,
    {
    average: stats[0]?.avgRating || 0,
    totalReviews: stats[0]?.totalReviews || 0,
    reviews
  }, 
  "Reviews fetched successfully"));
});


export {
  createReview,
  editReview,
  deleteReview,
  getEventReviews
};