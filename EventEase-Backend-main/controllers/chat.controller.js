import chatMessageModel from "../models/chatMessage.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiResponse} from "../utils/ApiResponse.js";

const getChatHistory = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // Validate eventId
  if (!eventId) {
    return res.status(400).json({ message: "Event ID is required" });
  }
    const messages = await chatMessageModel.find({ roomId: eventId })
      .sort({ createdAt: 1 })
      .populate("sender", "name");


  res.status(200).json( new ApiResponse(
    200,
    messages,
    "Chat history fetched successfully"
  ));
})

export { getChatHistory };