import {deleteFromCloudinary, uploadOnCloudinary} from '../utils/cloudinary.js';
import { asyncHandler } from "../utils/asyncHandler.js";
import  Event  from "../models/event.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Booking from '../models/booking.model.js';

const createEvent = asyncHandler(async(req,res)=>{
    try {
        const {title,description,date,location,Price,category,capacity,locationGoogleMapLink} = req.body;
        if(![title,description,date,location,Price,category,capacity,locationGoogleMapLink].every(Boolean)){
            throw new ApiError(400,"All Fields are Required");
        }
        const eventImagePath = req.file; //  file
        if(!eventImagePath){
            throw new ApiError(400,"Event Image is Required")
        }
    
        const image = await uploadOnCloudinary(req.file.buffer);
        if(!image){
            throw new ApiError(500,"Failed to Upload Event Image");
        }
    const Eventdate = new Date(date); // ✅ parse date-time from request
    
    const newEvent = await Event.create({
        title,
        description,
        date: Eventdate,
        location,
        locationGoogleMapLink,
        Price,
        category,
        capacity,
        image: image.secure_url,
        organizer: req.user._id,
       
    });
        res.status(201).json(
            new ApiResponse(201, newEvent, "Event created successfully")
        )
    } catch (error) {
        throw new ApiError(500, error.message || "Error creating event");
    }
})

const getEventStatus = (eventDate) => {
  const now = new Date();
  if (eventDate > now) return "upcoming";
  if (eventDate.toDateString() === now.toDateString()) return "ongoing";
  if (eventDate < now && eventDate.getTime() + (60 * 60 * 1000) < now.getTime()) 
    return "completed";
  return "past";
};


// GET ALL EVENTS (Public)
const getAllEvents = asyncHandler(async(req,res)=>{
    const events = await Event.find().populate("organizer","name email");

    // Add computed status
    const eventsWithStatus = events.map(event => ({
        ...event.toObject(),
        status: getEventStatus(event.date)
    }));

    res.status(200).json(
        new ApiResponse(200, eventsWithStatus, "All Events Fetched")
    )
})

const getAllActiveEvents = asyncHandler(async(req,res)=>{
    const events = await Event.find({ activeStatus: { $ne: "cancelled" } }).populate("organizer","name email");

    // Add computed status
    const eventsWithStatus = events.map(event => ({
        ...event.toObject(),
        status: getEventStatus(event.date)
    }));

    res.status(200).json(
        new ApiResponse(200, eventsWithStatus, "All Events Fetched")
    )
})

// GET SINGLE EVENT
const getEventbyId = asyncHandler(async(req,res)=>{
    const event = await Event.findById(req.params.id).populate("organizer","name email");
    if(!event) throw new ApiError(404,"Event Not Found");

    const eventWithStatus = {
        ...event.toObject(),
        status: getEventStatus(event.date)
    };

    res.status(200).json(
        new ApiResponse(200, eventWithStatus, "Event Fetched Succesfully")
    )
})


// UPDATE EVENT(ONLY BY ORGANIZER)

const updateEvent = asyncHandler(async(req,res)=>{
  const event = await Event.findById(req.params.id);
  if(!event) throw new ApiError(404,"Event Not Found");
    if(event.organizer.toString() !== req.user._id.toString()){
        throw new ApiError(403,"You are not authorized to update this event");
    }
    // Handle image upload if provided
    if(req.file.buffer) {
        console.log("Image file found in request");
        const eventImagePath = req.file.buffer; // files or file
        if(!eventImagePath){
            throw new ApiError(400,"Event Image is Required")
        }
        const oldImageUrl = event.image; // Store old image URL for deletion if needed
        if(oldImageUrl){
            await deleteFromCloudinary(oldImageUrl); // Delete old image from Cloudinary
        }
        const image = await uploadOnCloudinary(eventImagePath);
        if(!image){
            throw new ApiError(500,"Failed to Upload Image");
        }
        event.image = image.secure_url; // Update the image URL
    }
    Object.assign(event, req.body); // Update event with new data
    await event.save();
    res.status(200).json(
        new ApiResponse(200,event,"Event Updated Successfully")
    )
})

// DELETE EVENT (ONLY BY Admin)
const deleteEvent = asyncHandler(async(req,res)=>{
    const event = await Event.findById(req.params.id);
    if(!event) throw new ApiError(404,"Event Not Found");
    const oldImageUrl = event.image; // Store old image URL for deletion
    if(oldImageUrl){
        await deleteFromCloudinary(oldImageUrl); // Delete image from Cloudinary
    }
    await event.deleteOne();
    res.status(200).json(
        new ApiResponse(200,null,"Event Deleted Successfully")
    )
})

const getEventAnalytics = asyncHandler(async (req, res) => {
  const eventId  = req.params.eventid ;

  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, "Event not found");

  const analytics = await Booking.aggregate([
    { $match: { event: event._id, paymentstatus: "confirmed" } },
    {
      $group: {
        _id: "$event",
        totalBookings: { $sum: 1 },
        totalSeats: { $sum: "$seatsBooked" },
        totalRevenue: { $sum: "$amountPaid" }
      }
    }
  ]);

  res.status(200).json(new ApiResponse(200, analytics[0] || {}, "Event analytics fetched successfully"));
});

const myEvents = asyncHandler(async (req, res) => { 
    const events = await Event.find({ organizer: req.user._id });
    res.status(200).json(new ApiResponse(200, events, "Events fetched successfully"))

});

const cancelEvent = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.eventid);
    if (!event) throw new ApiError(404, "Event Not Found");
    if (event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to cancel this event");
    }
    event.activeStatus = "cancelled";
    await event.save();
    const bookings = await Booking.find({ event: event._id })
    console.log(bookings);
    if(bookings.length === 0) {
        return res.status(200).json(new ApiResponse(200, event, "Event cancelled successfully"));
    }
    for (const booking of bookings) {
        booking.paymentstatus = "cancelled";
        booking.cancelDate = new Date();
        await booking.save();

        if( booking.razorpayPaymentId ){
        try {
        const refund = await razorpay.payments.refund(booking.razorpayPaymentId, { 
            amount: booking.amountPaid * 100
        });
        // console.log("Refund initiated:", refund);
        
        } catch (error) {
        throw new ApiError(500, "Failed to initiate refund");
        }
        // console.log("Initiate refund via Razorpay API for payment ID:", booking.razorpayPaymentId);
    }
    }

    res.status(200).json(new ApiResponse(200, event, "Event cancelled successfully"));
});

export {
    createEvent,
    getAllEvents,
    getEventbyId,
    updateEvent,
    deleteEvent,
    getEventAnalytics,
    myEvents,
    cancelEvent,
    getAllActiveEvents
}
