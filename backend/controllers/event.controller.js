import {deleteFromCloudinary, uploadOnCloudinary} from '../utils/cloudinary.js';
import { asyncHandler } from "../utils/asyncHandler.js";
import  Event  from "../models/event.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Booking from '../models/booking.model.js';
import { refundBooking } from "../utils/refund.js";

// Short-lived in-memory cache for the public events list (cheap win on a single Render instance).
// Cleared on any event write; otherwise entries expire after EVENTS_CACHE_TTL_MS.
const EVENTS_CACHE_TTL_MS = 30 * 1000;
let activeEventsCache = { data: null, expires: 0 };
const invalidateEventsCache = () => { activeEventsCache = { data: null, expires: 0 }; };

// Fields an organizer may edit directly. NOT here on purpose:
//  - activeStatus: cancelling must go through cancelEvent so every attendee is refunded
//  - capacity: changed atomically below so it can never drop under seats already sold
//  - organizer / availableSeats / bookedSeats / attendees: owned by the booking flow
const UPDATABLE_EVENT_FIELDS = ["title", "description", "date", "location", "locationGoogleMapLink", "Price", "category", "ticketTypes"];

// Body has already been validated and coerced by createEventSchema (see event.routes.js)
const createEvent = asyncHandler(async (req, res) => {
    if (!req.file?.buffer) {
        throw new ApiError(400, "Event Image is Required");
    }
    const image = await uploadOnCloudinary(req.file.buffer);
    if (!image) {
        throw new ApiError(502, "Failed to Upload Event Image");
    }

    const { title, description, date, location, locationGoogleMapLink, Price, category, capacity, ticketTypes } = req.body;
    const newEvent = await Event.create({
        title,
        description,
        date,
        location,
        locationGoogleMapLink,
        Price,
        category,
        capacity,
        ...(ticketTypes?.length ? { ticketTypes } : {}),
        image: image.secure_url,
        organizer: req.user._id,
    });
    invalidateEventsCache();
    res.status(201).json(new ApiResponse(201, newEvent, "Event created successfully"));
});

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

const updateEvent = asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) throw new ApiError(404, "Event Not Found");
    if (event.organizer.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this event");
    }
    if (event.activeStatus === "cancelled") {
        throw new ApiError(400, "Cancelled events can no longer be edited");
    }

    // Capacity: one atomic update, guarded so it can't go below seats already sold,
    // and availableSeats is recomputed from the same document (no read-modify-write race with bookings)
    if (req.body.capacity !== undefined && req.body.capacity !== event.capacity) {
        const newCapacity = req.body.capacity;
        const updated = await Event.findOneAndUpdate(
            { _id: event._id, $expr: { $lte: [{ $size: "$bookedSeats" }, newCapacity] } },
            [{ $set: { capacity: newCapacity, availableSeats: { $subtract: [newCapacity, { $size: "$bookedSeats" }] } } }],
            { new: true }
        );
        if (!updated) {
            throw new ApiError(400, `Capacity cannot be lower than the ${event.bookedSeats.length} seats already sold`);
        }
        event.capacity = updated.capacity;
        event.availableSeats = updated.availableSeats;
    }

    // Upload the new image first; only delete the old one once the new one is safely stored
    let oldImageToDelete = null;
    if (req.file?.buffer) {
        const image = await uploadOnCloudinary(req.file.buffer);
        if (!image) throw new ApiError(502, "Failed to Upload Image");
        oldImageToDelete = event.image;
        event.image = image.secure_url;
    }

    for (const field of UPDATABLE_EVENT_FIELDS) {
        if (req.body[field] !== undefined) event[field] = req.body[field];
    }
    // capacity/availableSeats were already written atomically above; don't overwrite them with a stale copy
    event.unmarkModified("capacity");
    event.unmarkModified("availableSeats");
    await event.save();
    if (oldImageToDelete) await deleteFromCloudinary(oldImageToDelete);

    invalidateEventsCache();
    res.status(200).json(new ApiResponse(200, event, "Event Updated Successfully"));
});

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
  // Revenue figures are private: only the event's organizer (or an admin) may read them
  if (req.user.role !== "admin" && event.organizer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only view analytics for your own events");
  }

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


// One round trip for the whole organizer dashboard (replaces N per-event requests).
// GET /events/analytics/overview?days=30
const getOrganizerOverview = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const ownEvents = await Event.find(req.user.role === "admin" ? {} : { organizer: req.user._id })
    .select("_id title")
    .lean();
  const titles = new Map(ownEvents.map((e) => [String(e._id), e.title]));
  const eventIds = ownEvents.map((e) => e._id);

  const [facets] = await Booking.aggregate([
    { $match: { event: { $in: eventIds }, status: "confirmed" } },
    {
      $facet: {
        totals: [{ $group: { _id: null, bookings: { $sum: 1 }, seats: { $sum: "$seatsBooked" }, revenue: { $sum: "$amountPaid" } } }],
        // revenue per day inside the window; gaps are filled below so the chart has no holes
        byDay: [
          { $match: { createdAt: { $gte: since } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$amountPaid" }, seats: { $sum: "$seatsBooked" } } },
        ],
        byTier: [
          { $group: { _id: "$ticketTier", seats: { $sum: "$seatsBooked" }, revenue: { $sum: "$amountPaid" } } },
          { $sort: { revenue: -1 } },
        ],
        byEvent: [
          { $group: { _id: "$event", bookings: { $sum: 1 }, seats: { $sum: "$seatsBooked" }, revenue: { $sum: "$amountPaid" }, checkedIn: { $sum: { $cond: ["$checkedIn", 1, 0] } } } },
          { $sort: { revenue: -1 } },
        ],
      },
    },
  ]);

  const totals = facets?.totals?.[0] || { bookings: 0, seats: 0, revenue: 0 };
  const dayMap = new Map((facets?.byDay || []).map((d) => [d._id, d]));
  const revenueByDay = Array.from({ length: days }, (_, i) => {
    const date = new Date(since.getTime() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hit = dayMap.get(date);
    return { date, revenue: hit?.revenue || 0, seats: hit?.seats || 0 };
  });

  res.status(200).json(new ApiResponse(200, {
    days,
    totals: { bookings: totals.bookings, seats: totals.seats, revenue: totals.revenue },
    revenueByDay,
    byTier: (facets?.byTier || []).map((t) => ({ tier: t._id || "Standard Pass", seats: t.seats, revenue: t.revenue })),
    byEvent: (facets?.byEvent || []).map((e) => ({
      eventId: String(e._id), title: titles.get(String(e._id)) || "Deleted event",
      bookings: e.bookings, seats: e.seats, revenue: e.revenue, checkedIn: e.checkedIn,
    })),
  }, "Organizer overview fetched"));
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
    getOrganizerOverview,
    myEvents,
    cancelEvent,
    getAllActiveEvents
}
