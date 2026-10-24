import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../../Context/SearchContext";
import { Calendar } from "lucide-react";

const SearchEvents = ({ isOpen, onClose }) => {
  const { filteredEvents, searchQuery, setSearchQuery } = useSearch();
  const navigate = useNavigate();

  if (!isOpen || !searchQuery || searchQuery.trim() === "") {
    return null;
  }

  const handleSelect = () => {
    setSearchQuery("");
    if (onClose) onClose();
  };

  return (
    <div className="absolute top-full left-0 right-0 mt-2 mx-auto w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
      {filteredEvents.length === 0 ? (
        <div className="text-center text-slate-500 py-6 px-4 text-sm">
          No quick previews for &quot;<span className="font-semibold text-slate-800 dark:text-slate-200">{searchQuery}</span>&quot;.
          <button
            type="button"
            onClick={() => {
              handleSelect();
              navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
            }}
            className="mt-2 block mx-auto text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Search all events on Events page &rarr;
          </button>
        </div>
      ) : (
        filteredEvents.map((event) => (
          <Link
            key={event._id}
            to={`/event/${event._id}`}
            onClick={handleSelect}
            className="flex items-center gap-4 p-3.5 hover:bg-indigo-50/70 dark:hover:bg-slate-800/70 transition-colors group"
          >
            <img
              src={event.image || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=200&q=80"}
              alt={event.title}
              className="w-14 h-14 object-cover rounded-xl shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-indigo-600 transition-colors">
                {event.title}
              </h4>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-500" />
                  {event.date ? new Date(event.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "Upcoming"}
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                  {event.category || "General"}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">₹{event.Price}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
};

export default SearchEvents;
