import React, { useEffect, useState } from 'react'
import { FeaturesSection, HeroSectionOne } from '../Components/Hero'
import { EventCard } from '../Components/Cards/EventCard';
import { getAllEvents } from '../services/eventservices/eventapi';
import { Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function Home() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await getAllEvents();
        setEvents(response.data || []);
      } catch (error) {
        console.log(error);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="bg-gradient-to-r from-black via-blue-800 to-black shadow-lg">
         <ToastContainer autoClose={3000} position="top-right"/>
      <HeroSectionOne />
      <FeaturesSection />

      {/* Top Rated Events */}
      <label title="Top Rated Events">
        <section className="mt-0 px-6 sm:px-6 md:px-12 lg:px-20 xl:px-28 py-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold mb-6 text-yellow-300">
            Top Rated Events ⭐
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Object.values(events).length > 0 ? (
              <>
                {Object.values(events)
                  .sort((a, b) => b.avgRating - a.avgRating)
                  .slice(0, 4)
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
                  ))}

                {/* View More Button */}
                <div className="col-span-full flex lg:justify-center mt-6">
                  <Link to="/events">
                    <button className="w-full sm:w-auto text-sm cursor-pointer transform rounded-lg bg-black px-6 py-2 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                      View More Events
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center col-span-full">
                No Upcoming Events Available.
              </p>
            )}
          </div>
        </section>
      </label>

      {/* Browse Upcoming Events */}
      <label title="Browse Upcoming Events">
        <section className="mt-0 px-6 sm:px-6 md:px-12 lg:px-20 xl:px-28 py-6">
          <h2 className="text-base sm:text-lg md:text-xl font-bold mb-6 text-yellow-300">
            Browse Upcoming Events 🔥
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Object.values(events).filter((event) => event.status === "upcoming").length > 0 ? (
              <>
                {Object.values(events)
                  .filter((event) => event.status === "upcoming")
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 4)
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
                  ))}

                {/* View More Button */}
                <div className="col-span-full  flex lg:justify-center mt-6">
                  <Link to="/events">
                    <button className="w-full sm:w-auto text-sm cursor-pointer transform rounded-lg bg-black px-6 py-2 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                      View More Events
                    </button>
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center col-span-full">
                No Upcoming Events Available.
              </p>
            )}
          </div>
        </section>
      </label>
    </div>
  );
}

export default Home;
