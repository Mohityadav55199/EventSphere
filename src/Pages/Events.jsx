import React, { useEffect, useState } from 'react';
import { getAllEvents, getAllEventsByAdmin } from '../services/eventservices/eventapi';
import { Link } from 'react-router-dom';
import { EventCard } from '../Components/Cards/EventCard';
import SkeletonCard from '../Components/SkeletonCard';
import { useSelector } from 'react-redux';
import { Sparkles } from 'lucide-react';

function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const fetchEventsFunc = user?.role === "admin" ? getAllEventsByAdmin : getAllEvents;
        const response = await fetchEventsFunc();
        setEvents(response.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [user]);

  const categories = ["All", "Music", "Workshop", "Movie", "Sports"];

  const filteredEvents = selectedCategory === "All"
    ? events
    : events.filter(e => e.category?.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 py-10 px-4 sm:px-8 md:px-12 lg:px-20">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Page Header */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 tracking-wide uppercase">
            Explore Experiences
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Discover Live Events near You
          </h1>
          <p className="text-sm text-slate-500">
            Book tickets securely with instant wallet rewards and live community chat access.
          </p>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 shrink-0 ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <Link key={event._id} to={`/event/${event._id}`}>
                <EventCard
                  organizer={event.organizer?.name || "EventSphere"}
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
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <p className="text-slate-500 font-medium text-sm">No events found in this category.</p>
              <button
                onClick={() => setSelectedCategory("All")}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Events;
