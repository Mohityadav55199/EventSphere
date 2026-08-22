/**
 * seatHold.js — Redis-backed seat reservation (BookMyShow-style)
 *
 * Redis key schema:
 *   seat_hold:{eventId}:{userId}  →  seatsBooked  (TTL = hold duration)
 *
 * Uses getRedisClient() which is now async and returns a unified client
 * supporting Upstash REST, ioredis, or in-memory fallback transparently.
 */

import { getRedisClient } from "./redisClient.js";

const HOLD_PREFIX = "seat_hold";
const DEFAULT_HOLD_SECONDS = 600; // 10 minutes

/**
 * Atomically hold seats for a user on an event.
 *
 * @param {string} eventId
 * @param {string} userId
 * @param {string[]} seatsToHoldArray  - array of specific seat IDs e.g. ['A1', 'A2']
 * @param {number} availableSeats  - (deprecated in this model, keeping for signature compatibility)
 * @param {number} [durationSecs=600]
 * @returns {Promise<{ success: boolean, heldSeats: number, reason?: string }>}
 */
async function holdSeats(eventId, userId, seatsToHoldArray, availableSeats, durationSecs = DEFAULT_HOLD_SECONDS) {
  const redis = await getRedisClient();
  
  if (!Array.isArray(seatsToHoldArray) || seatsToHoldArray.length === 0) {
    return { success: false, heldSeats: 0, reason: "No seats selected" };
  }

  const keys = seatsToHoldArray.map(seatId => `${HOLD_PREFIX}:${eventId}:${seatId}`);
  
  // Quick pre-check
  const existingHolds = await redis.mget(...keys);
  for (let i = 0; i < existingHolds.length; i++) {
    if (existingHolds[i] !== null && existingHolds[i] !== userId) {
      return { success: false, heldSeats: 0, reason: `Seat ${seatsToHoldArray[i]} is currently reserved by someone else.` };
    }
  }

  const successfullyLocked = [];

  // Attempt to lock each seat
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    // try to set if not exists
    let locked = await redis.set(key, userId, { nx: true, ex: durationSecs });
    
    if (!locked) {
      // If it failed to set, it means the key exists.
      // Check if the current user is the owner (e.g. refreshing their own hold)
      const owner = await redis.get(key);
      if (owner === userId) {
        // Refresh the expiry
        await redis.set(key, userId, { ex: durationSecs });
        locked = true;
      }
    }

    if (locked) {
      successfullyLocked.push(key);
    } else {
      // Rollback! Someone else grabbed a seat in the middle of our loop
      for (const lockedKey of successfullyLocked) {
        await redis.del(lockedKey);
      }
      return { success: false, heldSeats: 0, reason: `Seat ${seatsToHoldArray[i]} was just taken by someone else.` };
    }
  }

  return { success: true, heldSeats: seatsToHoldArray.length };
}

/**
 * Release a seat hold (cancel or payment failure).
 * @param {string} eventId 
 * @param {string} userId 
 * @param {string[]} [seatsToRelease] - If provided, release specific seats. If omitted, release ALL seats held by this user for the event.
 */
async function releaseHold(eventId, userId, seatsToRelease) {
  const redis = await getRedisClient();
  
  if (seatsToRelease && Array.isArray(seatsToRelease)) {
    for (const seatId of seatsToRelease) {
      const key = `${HOLD_PREFIX}:${eventId}:${seatId}`;
      const owner = await redis.get(key);
      if (owner === userId) {
        await redis.del(key);
      }
    }
  } else {
    // Release ALL seats held by this user for this event
    const pattern = `${HOLD_PREFIX}:${eventId}:*`;
    const keys = await redis.keys(pattern);
    for (const key of keys) {
      const owner = await redis.get(key);
      if (owner === userId) {
        await redis.del(key);
      }
    }
  }
}

/**
 * Confirm hold after successful payment — removes from Redis.
 * MongoDB is the source of truth after payment.
 */
async function confirmHold(eventId, userId, seatsToConfirm) {
  await releaseHold(eventId, userId, seatsToConfirm);
}

/**
 * Returns an array of specific seat IDs currently on hold by ALL users.
 */
async function getTotalHeldSeats(eventId) {
  const redis = await getRedisClient();
  const pattern = `${HOLD_PREFIX}:${eventId}:*`;

  try {
    const keys = await redis.keys(pattern);
    if (!keys || keys.length === 0) return [];

    // Extract seat IDs from keys e.g. "seat_hold:eventId:A1" -> "A1"
    return keys.map(k => {
      const parts = k.split(":");
      return parts[parts.length - 1];
    });
  } catch {
    return [];
  }
}

/**
 * Seats held by a specific user for an event.
 */
async function getUserHeldSeats(eventId, userId) {
  const redis = await getRedisClient();
  const pattern = `${HOLD_PREFIX}:${eventId}:*`;
  
  try {
    const keys = await redis.keys(pattern);
    let heldByMe = [];
    for (const key of keys) {
      const owner = await redis.get(key);
      if (owner === userId) {
        const parts = key.split(":");
        heldByMe.push(parts[parts.length - 1]);
      }
    }
    return heldByMe;
  } catch {
    return [];
  }
}

/**
 * All active holds for an event (admin/debug).
 */
async function getEventHolds(eventId) {
  const redis = await getRedisClient();
  const pattern = `${HOLD_PREFIX}:${eventId}:*`;

  try {
    const keys = await redis.keys(pattern);
    if (!keys || keys.length === 0) return [];

    const values = await redis.mget(...keys);
    return keys.map((key, i) => {
      const parts = key.split(":");
      return {
        userId: values[i],
        seatId: parts[parts.length - 1],
      };
    });
  } catch {
    return [];
  }
}

export {
  holdSeats,
  releaseHold,
  confirmHold,
  getTotalHeldSeats,
  getUserHeldSeats,
  getEventHolds,
  DEFAULT_HOLD_SECONDS,
};
