// EventList.jsx
import React from "react";
import { Link } from "react-router-dom";
import { EventCard } from "../Cards/EventCard";
import { useSearch } from "../../Context/SearchContext";

const EventList = ( ) => {
  // If search query is empty → render nothing
  const{filteredEvents,searchQuery, setSearchQuery} = useSearch();
 
  if (!searchQuery || searchQuery.trim() === "") {
    return null;
  }

  // If no matching events found → show "No events found"
  if (!filteredEvents || filteredEvents.length === 0) {
    return (
      <div className="text-center text-gray-500 py-6 px-36 bg-gradient-to-r from-black via-blue-800 to-black">
        No events found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-0 px-6 sm:px-6 md:px-12 lg:px-20 xl:px-28 py-6  bg-gradient-to-r from-black via-blue-800 to-black">
      {filteredEvents.map((event) => (
          <Link 
          key={event._id}
         onClick={() => setSearchQuery("")} 
          to={`/events/${event._id}`
           }>
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
    </div>
  );
};

export default EventList;
