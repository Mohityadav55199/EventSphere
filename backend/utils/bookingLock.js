/**
 * bookingLock.js — Atomic MongoDB specific seat locking
 *
 * Uses findOneAndUpdate with a conditional filter to atomically:
 *   - Reserve specific seats (booking confirmation)
 *   - Release specific seats (cancellation / hold expiry)
 */

import Event from "../models/event.model.js";
import { ApiError } from "./ApiError.js";

/**
 * Atomically book specific seats.
 * Only succeeds if the event exists AND none of the requested seats are already booked.
 *
 * @param {string} eventId
 * @param {string[]} seatsArray - array of seat IDs to book
 * @returns {Promise<Event>} updated event document
 * @throws {ApiError} if event not found or seats unavailable
 */
async function atomicDecrementSeats(eventId, seatsArray) {
  if (!seatsArray || seatsArray.length === 0) return;

  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: eventId,
      bookedSeats: { $nin: seatsArray }, // Guard: only proceed if NO seats overlap
    },
    {
      $push: { bookedSeats: { $each: seatsArray } },
      $inc: { availableSeats: -seatsArray.length }, // Keep legacy count synced
    },
    { new: true }
  );

  if (!updatedEvent) {
    // Either event doesn't exist OR one of the seats was booked
    const event = await Event.findById(eventId).select("title bookedSeats");
    if (!event) {
      throw new ApiError(404, "Event not found");
    }
    throw new ApiError(
      409, // 409 Conflict — appropriate for concurrency failures
      `One or more of your selected seats for "${event.title}" have just been booked. Please choose different seats.`
    );
  }

  return updatedEvent;
}

/**
 * Atomically restore specific seats.
 * Used on cancellation or hold expiry.
 *
 * @param {string} eventId
 * @param {string[]} seatsArray - array of seat IDs to restore
 * @returns {Promise<Event>} updated event document
 */
async function atomicRestoreSeats(eventId, seatsArray) {
  if (!seatsArray || seatsArray.length === 0) return;
  
  const filter = { _id: eventId };
  const update = { 
      $pullAll: { bookedSeats: seatsArray },
      $inc: { availableSeats: seatsArray.length }
  };

  return await Event.findOneAndUpdate(filter, update, { new: true });
}

export { atomicDecrementSeats, atomicRestoreSeats };
