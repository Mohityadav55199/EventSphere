import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true,
    },
    description: {
        type: String,
        required: [true, "Description is required"],
        trim: true,
    },
    date: {
        type: Date,
        required: [true, "Date is required"],
    },
    location: {
        type: String,
        required: [true, "Location is required"],
        trim: true,
    },
    locationGoogleMapLink: {
        type: String,
        required: [true, "Location Google Map Link is required"],
        trim: true,
    },
    organizer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Organizer Name is required"],
    },
    attendees: [
    {
        user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        },
        ticketsBooked: {
        type: Number,
        required: true,
        default: 1,
        }
    }
    ],
    image: {
        type: String,
        required: [true, "Image is required"],
        trim: true,
    },
    Price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
    },
    category: {
        type: String,
         enum : [ "Movie", "Music", "Workshop", "Sports", "Other"],
        required: [true, "Category is required"],
        trim: true,
        default: "other",
    },
    capacity: {
        type: Number,
        required: [true, "Capacity is required"],
        min: [1, "Capacity must be at least 1"],
    },
    avgRating: { 
        type: Number, 
        default: 0 
    },
    activeStatus: {
        enum: ["active", "cancelled", "postponed"],
        type: String,
        required: [true, "Active Status is required"],
        default: "active",
    }

    

}, { timestamps: true });

const Event = mongoose.model("Event", eventSchema);
export default Event;