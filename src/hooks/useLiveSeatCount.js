/**
 * useLiveSeatCount.js — React hook for real-time seat availability
 *
 * Connects to Socket.io and subscribes to the `seats:{eventId}` room.
 * Receives live `seatUpdate` events whenever anyone holds, releases,
 * confirms, or expires a seat hold for this event.
 *
 * Usage:
 *   const { effectiveFreeSeats, heldSeats, isSoldOut, fillingFast, isLoading } =
 *     useLiveSeatCount(eventId);
 *
 * Falls back to HTTP polling every 30s if Socket.io is unavailable.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 30_000; // 30s HTTP fallback polling

/**
 * @param {string | null} eventId - MongoDB ObjectId of the event to watch
 * @returns {{
 *   effectiveFreeSeats: number,
 *   availableSeats: number,
 *   heldSeats: number,
 *   capacity: number,
 *   isSoldOut: boolean,
 *   fillingFast: boolean,
 *   isLoading: boolean,
 *   lastUpdated: Date | null
 * }}
 */
function useLiveSeatCount(eventId) {
  const [seatData, setSeatData] = useState({
    effectiveFreeSeats: 0,
    availableSeats: 0,
    bookedSeats: [],
    heldSeats: [],
    capacity: 0,
    isSoldOut: false,
    fillingFast: false,
    isLoading: true,
    lastUpdated: null,
  });

  const socketRef = useRef(null);
  const pollTimerRef = useRef(null);
  const isSocketConnected = useRef(false);

  // ── HTTP fallback: poll /api/v1/bookings/seat-availability/:eventId ──────────
  const pollSeatAvailability = useCallback(async () => {
    if (!eventId || isSocketConnected.current) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/bookings/seat-availability/${eventId}`);
      if (!res.ok) return;
      const { data } = await res.json();
      setSeatData((prev) => ({
        ...prev,
        effectiveFreeSeats: data.effectiveFreeSeats ?? prev.effectiveFreeSeats,
        availableSeats: data.availableSeats ?? prev.availableSeats,
        bookedSeats: data.bookedSeats || [],
        heldSeats: data.heldSeats || [],
        capacity: data.capacity ?? prev.capacity,
        isSoldOut: data.isSoldOut ?? prev.isSoldOut,
        fillingFast: data.fillingFast ?? prev.fillingFast,
        isLoading: false,
        lastUpdated: new Date(),
      }));
    } catch {
      // Silently fail on network errors
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    // ── Connect to Socket.io (no auth token needed for seat watching) ──────────
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      isSocketConnected.current = true;
      // Subscribe to live seat updates for this event
      socket.emit("watchSeats", { eventId });
    });

    // ── Handle incoming seat update ───────────────────────────────────────────
    socket.on("seatUpdate", (data) => {
      if (data.eventId !== String(eventId)) return; // Guard for multi-event pages
      // Calculate effective free seats in frontend if backend doesn't send it
      const freeSeats = Math.max(0, (data.availableSeats ?? data.capacity) - (data.heldSeats?.length || 0));
      
      setSeatData({
        effectiveFreeSeats: data.effectiveFreeSeats ?? freeSeats,
        availableSeats: data.availableSeats,
        bookedSeats: data.bookedSeats || [],
        heldSeats: data.heldSeats || [],
        capacity: data.capacity,
        isSoldOut: data.isSoldOut ?? (freeSeats === 0 || (data.bookedSeats?.length >= data.capacity)),
        fillingFast: data.fillingFast ?? (freeSeats > 0 && freeSeats <= data.capacity * 0.2),
        isLoading: false,
        lastUpdated: new Date(data.timestamp),
      });
    });

    socket.on("connect_error", () => {
      isSocketConnected.current = false;
      // Start HTTP fallback polling
      pollSeatAvailability();
      pollTimerRef.current = setInterval(pollSeatAvailability, POLL_INTERVAL_MS);
    });

    socket.on("disconnect", () => {
      isSocketConnected.current = false;
    });

    // Initial HTTP fetch while Socket.io connects (avoids blank state flash)
    pollSeatAvailability();

    return () => {
      socket.emit("unwatchSeats", { eventId });
      socket.disconnect();
      socketRef.current = null;
      isSocketConnected.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [eventId, pollSeatAvailability]);

  return seatData;
}

export default useLiveSeatCount;
