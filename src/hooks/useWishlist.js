import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

// Saved events live in localStorage (per user id, or "guest"), so they work without a backend.
// A custom event keeps every heart button and the Profile list in sync within the same tab.
const CHANGE_EVENT = "eventsphere:wishlist";

const read = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function useWishlist() {
  const userId = useSelector((state) => state.auth.user?._id);
  const storageKey = `eventsphere:wishlist:${userId || "guest"}`;
  const [ids, setIds] = useState(() => read(storageKey));

  useEffect(() => {
    setIds(read(storageKey));
    const sync = () => setIds(read(storageKey));
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [storageKey]);

  const toggle = useCallback(
    (eventId) => {
      const current = read(storageKey);
      const next = current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage full or blocked: keep the in-memory state only
      }
      setIds(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storageKey]
  );

  const isSaved = useCallback((eventId) => ids.includes(eventId), [ids]);

  return { ids, isSaved, toggle };
}
