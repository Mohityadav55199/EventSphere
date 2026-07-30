import React, { useEffect, useState } from 'react';
import { FeaturesSection, HeroSectionOne } from '../Components/Hero';
import { EventCard } from '../Components/Cards/EventCard';
import SkeletonCard from '../Components/SkeletonCard';
import { getAllEvents } from '../services/eventservices/eventapi';
import { Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Home() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await getAllEvents();
        setEvents(response.data || []);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="bg-slate-50 text-slate-800 min-h-screen">
      <ToastContainer autoClose={3000} position="top-right"/>
      <HeroSectionOne />
      <FeaturesSection />

      {/* Top Rated Events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Top Rated Events ⭐
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Discover trending experiences with top attendee ratings</p>
          </div>
          <Link to="/events" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hidden sm:block">
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : events.length > 0 ? (
            events
              .slice()
              .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
              .slice(0, 4)
              .map((event) => (
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
            <p className="text-slate-400 text-center col-span-full py-12">
              No Top Rated Events Currently Available.
            </p>
          )}
        </div>

        <div className="flex justify-center mt-8 sm:hidden">
          <Link to="/events" className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-full shadow text-sm">
            Explore All Events
          </Link>
        </div>
      </section>

      {/* Featured Upcoming Events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 border-t border-slate-200/60">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Featured Upcoming Events 🔥
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Book your tickets before capacity runs out</p>
          </div>
          <Link to="/events" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hidden sm:block">
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : events.length > 0 ? (
            events
              .slice(0, 8)
              .map((event) => (
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
            <p className="text-slate-400 text-center col-span-full py-12">
              No Upcoming Events Available.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
