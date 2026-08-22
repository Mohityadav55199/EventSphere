/**
 * bookingLock.js — Atomic MongoDB seat decrement/restore
 *
 * Uses findOneAndUpdate with a conditional filter to atomically:
 *   - Decrement availableSeats (booking confirmation)
 *   - Increment availableSeats (cancellation / hold expiry)
 *
 * This eliminates the TOCTOU (read-then-write) race condition in the
 * original booking controller's aggregation-based seat check.
 */

import Event from "../models/event.model.js";
import { ApiError } from "./ApiError.js";

/**
 * Atomically decrement availableSeats.
 * Only succeeds if the event exists AND has enough available seats.
 *
 * @param {string} eventId
 * @param {number} seats - number of seats to decrement
 * @returns {Promise<Event>} updated event document
 * @throws {ApiError} if event not found or not enough seats
 */
async function atomicDecrementSeats(eventId, seats) {
  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: eventId,
      availableSeats: { $gte: seats }, // Guard: only proceed if enough seats
    },
    {
      $inc: { availableSeats: -seats },
    },
    { new: true }
  );

  if (!updatedEvent) {
    // Either event doesn't exist OR availableSeats was insufficient
    const event = await Event.findById(eventId).select("availableSeats title");
    if (!event) {
      throw new ApiError(404, "Event not found");
    }
    throw new ApiError(
      409, // 409 Conflict — appropriate for concurrency failures
      `Sorry, only ${event.availableSeats} seat(s) remaining for "${event.title}". Please reduce your selection.`
    );
  }

  return updatedEvent;
}

/**
 * Atomically restore (increment) availableSeats.
 * Used on cancellation or hold expiry.
 *
 * @param {string} eventId
 * @param {number} seats - number of seats to restore
 * @param {number} [maxCapacity] - optional cap to prevent exceeding original capacity
 * @returns {Promise<Event>} updated event document
 */
async function atomicRestoreSeats(eventId, seats, maxCapacity) {
  const filter = { _id: eventId };
  const update = { $inc: { availableSeats: seats } };

  // If we know the max capacity, clamp to prevent overflow
  if (maxCapacity !== undefined) {
    // findOneAndUpdate after increment then clamp — simpler approach
    const event = await Event.findOneAndUpdate(filter, update, { new: true });
    if (event && event.availableSeats > maxCapacity) {
      await Event.findByIdAndUpdate(eventId, { availableSeats: maxCapacity });
      event.availableSeats = maxCapacity;
    }
    return event;
  }

  return await Event.findOneAndUpdate(filter, update, { new: true });
}

export { atomicDecrementSeats, atomicRestoreSeats };
