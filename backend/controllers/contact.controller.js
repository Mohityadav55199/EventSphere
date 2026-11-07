import Contact from "../models/contact.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";

export const createContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    throw new ApiError(400, "All fields are required");
  }
  // The screenshot is optional; a message without one must still go through
  let image = null;
  if (req.file?.buffer) {
    image = (await uploadOnCloudinary(req.file.buffer)) || null;
  }

  const contact = await Contact.create({ 
    user : req.user?._id,
    name, 
    email,
    subject,
    message ,
    image: image?.secure_url || null,
});

  res.status(201).json(new ApiResponse(201, contact, "Query submitted successfully"));
});


