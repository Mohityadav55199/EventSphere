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
 * Uses SET NX EX — set-if-not-exists with TTL.
 *
 * @param {string} eventId
 * @param {string} userId
 * @param {number} seatsToHold
 * @param {number} availableSeats  - current DB value of event.availableSeats
 * @param {number} [durationSecs=600]
 * @returns {Promise<{ success: boolean, heldSeats: number, reason?: string }>}
 */
async function holdSeats(eventId, userId, seatsToHold, availableSeats, durationSecs = DEFAULT_HOLD_SECONDS) {
  const redis = await getRedisClient();
  const holdKey = `${HOLD_PREFIX}:${eventId}:${userId}`;

  // Count seats already held by ALL users for this event
  const totalHeld = await getTotalHeldSeats(eventId);
  const effectiveFree = availableSeats - totalHeld;

  if (effectiveFree < seatsToHold) {
    return {
      success: false,
      heldSeats: totalHeld,
      reason: `Only ${effectiveFree} seat(s) available (${totalHeld} currently on hold by other users)`,
    };
  }

  // Try NX (set only if not exists)
  const result = await redis.set(holdKey, String(seatsToHold), { nx: true, ex: durationSecs });

  if (!result) {
    // User already has an active hold — refresh it (allow re-booking same seats)
    await redis.set(holdKey, String(seatsToHold), { ex: durationSecs });
  }

  return { success: true, heldSeats: seatsToHold };
}

/**
 * Release a seat hold (cancel or payment failure).
 */
async function releaseHold(eventId, userId) {
  const redis = await getRedisClient();
  await redis.del(`${HOLD_PREFIX}:${eventId}:${userId}`);
}

/**
 * Confirm hold after successful payment — removes from Redis.
 * MongoDB is the source of truth after payment.
 */
async function confirmHold(eventId, userId) {
  await releaseHold(eventId, userId);
}

/**
 * Total seats currently on hold by ALL users for an event.
 */
async function getTotalHeldSeats(eventId) {
  const redis = await getRedisClient();
  const pattern = `${HOLD_PREFIX}:${eventId}:*`;

  try {
    const keys = await redis.keys(pattern);
    if (!keys || keys.length === 0) return 0;

    const values = await redis.mget(...keys);
    return values.reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Seats held by a specific user for an event.
 */
async function getUserHeldSeats(eventId, userId) {
  const redis = await getRedisClient();
  const val = await redis.get(`${HOLD_PREFIX}:${eventId}:${userId}`);
  return parseInt(val) || 0;
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
    return keys.map((key, i) => ({
      userId: key.split(":")[2],
      seats: parseInt(values[i]) || 0,
    }));
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
