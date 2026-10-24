import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { EventCard } from "./Cards/EventCard";
import useWishlist from "../hooks/useWishlist";
import { getEventById } from "../services/eventservices/eventapi";

// Lists the events the user hearted. Events deleted since saving are dropped quietly.
export default function SavedEvents() {
  const { ids } = useWishlist();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(ids.map((id) => getEventById(id).then((res) => res.data).catch(() => null))).then((results) => {
      if (cancelled) return;
      setEvents(results.filter((e) => e && e.activeStatus !== "cancelled"));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
        <Heart size={22} className="text-rose-500 fill-rose-500" /> Saved Events ({events.length})
      </h2>
      {loading && ids.length > 0 ? (
        <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" role="status" aria-label="Loading saved events" />
      ) : events.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
          <p className="text-slate-400 text-sm">
            Nothing saved yet. Tap the heart on any event to keep it here.
          </p>
          <Link to="/events" className="inline-block mt-3 text-xs font-bold text-indigo-600 hover:underline">
            Browse events →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => (
            <Link key={event._id} to={`/event/${event._id}`}>
              <EventCard
                id={event._id}
                image={event.image}
                title={event.title}
                description={event.description}
                date={event.date}
                location={event.location}
                avgRating={event.avgRating}
                price={event.Price}
                category={event.category}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
