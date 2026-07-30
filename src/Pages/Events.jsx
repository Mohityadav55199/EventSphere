import React, { useEffect, useState } from 'react'
import { getAllEvents, getAllEventsByAdmin } from '../services/eventservices/eventapi';
import { Link } from 'react-router-dom';
import { EventCard } from '../Components/Cards/EventCard';
import { useSelector } from 'react-redux';

function Events() {
  const [events, setEvents] = useState([]);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const fetchEvents =
          user?.role === "admin" ? await getAllEventsByAdmin() : await getAllEvents();
        const response = await fetchEvents;
        setEvents(response.data || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="py-6 px-6 sm:px-6 md:px-12 lg:px-24 xl:px-36 bg-gradient-to-r from-black via-blue-800 to-black shadow-lg">
      {/* Upcoming Events */}
      <label title="Upcoming Events">
        <h2 className="text-base sm:text-lg md:text-xl font-bold mb-6 text-yellow-300">
          Upcoming Events
        </h2>

        {/* Grid Wrapper */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Object.values(events).filter((event) => event.status === "upcoming").length > 0 ? (
            Object.values(events)
              .filter((event) => event.status === "upcoming")
              .sort((a, b) => new Date(b.date) - new Date(a.date)) // sort latest first
              .map((event) => (
                <Link key={event._id} to={`/events/${event._id}`}>
                  <EventCard
                    organizer={event.organizer?.name || "Unknown Organizer"}
                    image={event.image}
                    title={event.title}
                    description={
                      event.description
                        ? event.description.slice(0, 100) +
                          (event.description.length > 100 ? "..." : "")
                        : ""
                    }
                    date={event.date}
                    avgRating={event.avgRating}
                    price={event.Price}
                  />
                </Link>
              ))
          ) : (
            <p className="text-gray-500 text-center col-span-full">
              No Upcoming events Available.
            </p>
          )}
        </div>
      </label>

      {/* Past Events */}
      <label title="Past Events" className="mt-12 block">
        <h2 className="text-base sm:text-lg md:text-xl font-bold mt-8 mb-6 text-green-500">
          Past Events
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Object.values(events).filter(
            (event) => event.status === "past" || event.status === "completed"
          ).length > 0 ? (
            Object.values(events)
              .filter((event) => event.status === "past" || event.status === "completed")
              .sort((a, b) => new Date(b.date) - new Date(a.date)) // sort latest first
              .map((event) => (
                <Link key={event._id} to={`/events/${event._id}`}>
                  <EventCard
                    organizer={event.organizer?.name || "Unknown Organizer"}
                    image={event.image}
                    title={event.title}
                    description={
                      event.description
                        ? event.description.slice(0, 100) +
                          (event.description.length > 100 ? "..." : "")
                        : ""
                    }
                    date={event.date}
                    avgRating={event.avgRating}
                    price={event.Price}
                  />
                </Link>
              ))
          ) : (
            <p className="text-gray-500 text-center col-span-full">
              No Past events found.
            </p>
          )}
        </div>
      </label>
    </div>
  );
}

export default Events;
