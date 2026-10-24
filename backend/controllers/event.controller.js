import {deleteFromCloudinary, uploadOnCloudinary} from '../utils/cloudinary.js';
import { asyncHandler } from "../utils/asyncHandler.js";
import  Event  from "../models/event.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Booking from '../models/booking.model.js';

// Short-lived in-memory cache for the public events list (cheap win on a single Render instance).
// Cleared on any event write; otherwise entries expire after EVENTS_CACHE_TTL_MS.
const EVENTS_CACHE_TTL_MS = 30 * 1000;
let activeEventsCache = { data: null, expires: 0 };
const invalidateEventsCache = () => { activeEventsCache = { data: null, expires: 0 }; };

const UPDATABLE_EVENT_FIELDS = ["title", "description", "date", "location", "locationGoogleMapLink", "Price", "category", "capacity", "activeStatus"];

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
        invalidateEventsCache();
        res.status(201).json(
            new ApiResponse(201, newEvent, "Event created successfully")
        )
    } catch (error) {
        if (error instanceof ApiError) throw error;
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
    // Server-side search: /all-events?q=jazz&category=Music (uses the text index; skips the cache)
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    if (q || category) {
        const filter = { activeStatus: { $ne: "cancelled" } };
        if (q) filter.$text = { $search: q };
        if (category && category !== "All") filter.category = category;
        const found = await Event.find(filter, q ? { score: { $meta: "textScore" } } : undefined)
            .sort(q ? { score: { $meta: "textScore" } } : { date: 1 })
            .populate("organizer","name email")
            .lean();
        return res.status(200).json(new ApiResponse(
            200,
            found.map(event => ({ ...event, status: getEventStatus(event.date) })),
            "Events Fetched"
        ));
    }

    const now = Date.now();
    if (!activeEventsCache.data || activeEventsCache.expires < now) {
        const events = await Event.find({ activeStatus: { $ne: "cancelled" } })
            .populate("organizer","name email")
            .lean();
        activeEventsCache = {
            data: events.map(event => ({ ...event, status: getEventStatus(event.date) })),
            expires: now + EVENTS_CACHE_TTL_MS,
        };
    }

    let result = activeEventsCache.data;

    // Optional pagination (?page=1&limit=12). Without `limit` the full list is returned,
    // which the current Events page relies on for client-side filtering.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 100);
    if (limit) {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        res.set("X-Total-Count", String(result.length));
        result = result.slice((page - 1) * limit, page * limit);
    }

    res.status(200).json(
        new ApiResponse(200, result, "All Events Fetched")
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
    if(req.file?.buffer) {
        const eventImagePath = req.file.buffer;
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
    // Whitelist: never let the request body overwrite organizer, availableSeats, bookedSeats, etc.
    for (const field of UPDATABLE_EVENT_FIELDS) {
        if (req.body[field] !== undefined) event[field] = req.body[field];
    }
    await event.save();
    invalidateEventsCache();
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
    invalidateEventsCache();
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

// Refunds one booking through whichever gateway took the payment. Throws on failure.
async function refundBooking(booking) {
    if (!booking.amountPaid) return "nothing-to-refund";

    if (booking.razorpayPaymentId) {
        const Razorpay = (await import("razorpay")).default;
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        await razorpay.payments.refund(booking.razorpayPaymentId, { amount: Math.round(booking.amountPaid * 100) });
        return "refunded";
    }

    if (booking.stripeSessionId) {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
        if (!session.payment_intent) return "nothing-to-refund";
        await stripe.refunds.create({ payment_intent: session.payment_intent });
        return "refunded";
    }

    return "nothing-to-refund";
}

const cancelEvent = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.eventid);
    if (!event) throw new ApiError(404, "Event Not Found");
    if (event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to cancel this event");
    }
    event.activeStatus = "cancelled";
    await event.save();
    invalidateEventsCache();

    const bookings = await Booking.find({ event: event._id, status: { $in: ["hold", "confirmed"] } });
    const summary = { total: bookings.length, refunded: 0, failed: 0, failedBookings: [] };

    // Each booking is handled on its own so one failed refund can't leave the rest untouched
    for (const booking of bookings) {
        const wasPaid = booking.status === "confirmed";
        booking.status = "cancelled";
        booking.paymentstatus = "cancelled";
        booking.cancelDate = new Date();

        if (wasPaid) {
            try {
                const result = await refundBooking(booking);
                booking.refundStatus = result === "refunded" ? "refunded" : "none";
                if (result === "refunded") summary.refunded++;
            } catch (error) {
                booking.refundStatus = "failed";
                booking.refundError = String(error.message || error).slice(0, 300);
                summary.failed++;
                summary.failedBookings.push(String(booking._id));
                console.error(`Refund failed for booking ${booking._id}:`, error.message);
            }
        }
        await booking.save();
    }

    const message = summary.failed
        ? `Event cancelled. ${summary.failed} refund(s) failed and need manual follow-up.`
        : "Event cancelled successfully";
    res.status(200).json(new ApiResponse(200, { event, refunds: summary }, message));
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
