import mongoose from "mongoose";
import chatMessageModel from "../models/chatMessage.model.js";
import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Same rule as the socket "joinRoom": only attendees with a confirmed booking,
// the event's organizer, or an admin may read an event's chat.
const getChatHistory = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  if (!mongoose.isValidObjectId(eventId)) throw new ApiError(400, "Valid event ID is required");

  if (req.user.role !== "admin") {
    const event = await Event.findById(eventId).select("organizer");
    if (!event) throw new ApiError(404, "Event not found");
    const isOrganizer = event.organizer?.toString() === req.user._id.toString();
    if (!isOrganizer) {
      const booking = await Booking.exists({ event: eventId, user: req.user._id, paymentstatus: "confirmed" });
      if (!booking) throw new ApiError(403, "Book this event to read its community chat");
    }
  }

  const messages = await chatMessageModel
    .find({ roomId: eventId })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("sender", "name");

  res.status(200).json(new ApiResponse(200, messages.reverse(), "Chat history fetched successfully"));
});

export { getChatHistory };
