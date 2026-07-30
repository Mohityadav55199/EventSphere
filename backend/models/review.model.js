import mongoose, { Schema } from "mongoose";

const reviewSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User is required"],
    },
    event: {
        type: Schema.Types.ObjectId,
        ref: "Event",
        required: [true, "Event is required"],
    },
    rating: {
        type: Number,
        required: [true, "Rating is required"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating must be at most 5"],
    },
    comment: {
        type: String,
        required: [true, "Comment is required"],
        trim: true,
    },
}, { timestamps: true });


// Prevent duplicate reviews per user per event
reviewSchema.index({ user: 1, event: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);
export default Review;