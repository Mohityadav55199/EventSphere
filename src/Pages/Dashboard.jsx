import React, { useEffect, useState } from "react";
import { getEventAnalytics,  updateEvent, getMyEvents, cancelEvent } from "../services/eventservices/eventapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Calendar, Trash2, Edit, Users, Ticket, IndianRupee } from "lucide-react";
import { IconChartBar } from "@tabler/icons-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import UpdateEventModal from "../Components/UpdateEventForm";

function Dashboard() {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Assuming you already have an API for fetching organizer's events
        const res = await getMyEvents();
        // console.log("My Events:", res.data);
        setEvents(res.data || []);

        // fetch analytics for each event
        for (let ev of res.data) {
          const a = await getEventAnalytics(ev._id);
          setAnalytics((prev) => ({ ...prev, [ev._id]: a.data }));
        }
      } catch (err) {
        toast.error("Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleDelete = async (id) => {
    try {
      await cancelEvent(id);
      setEvents(events.filter((ev) => ev._id !== id));
      toast.success("Event Cancelled successfully");
    } catch (err) {
      toast.error(err.message || "Failed to delete event");
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateEvent(id, data);
      toast.success("Event updated successfully");
      // refresh events list
      window.location.reload();
    } catch (err) {
      toast.error(err.message || "Failed to update event");
    }
  };

  if (loading) return <div className="p-6 text-white bg-gradient-to-r from-black via-blue-800 to-black">Loading...</div>;

return (
  <div className="min-h-screen bg-gradient-to-r from-black via-blue-800 to-black text-white py-6 px-6 sm:px-8 md:px-16 lg:px-24 xl:px-36">
    <ToastContainer position="top-right" autoClose={5000} />
    <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
      <IconChartBar size={24} className="text-orange-400 md:size-28" />
      Organizer Dashboard
    </h2>

    {/* Summary Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-indigo-800 rounded-xl p-4 shadow-lg flex items-center gap-3">
        <Calendar size={28} className="text-yellow-400" />
        <div>
          <h3 className="text-base md:text-lg font-semibold">My Events</h3>
          <p className="text-xl md:text-2xl">{events.length}</p>
        </div>
      </div>
      <div className="bg-indigo-800 rounded-xl p-4 shadow-lg flex items-center gap-3">
        <Users size={28} className="text-pink-400" />
        <div>
          <h3 className="text-base md:text-lg font-semibold">Total Bookings</h3>
          <p className="text-xl md:text-2xl">
            {Object.values(analytics).reduce((acc, a) => acc + (a?.totalBookings || 0), 0)}
          </p>
        </div>
      </div>
      <div className="bg-indigo-800 rounded-xl p-4 shadow-lg flex items-center gap-3">
        <Ticket size={28} className="text-green-400" />
        <div>
          <h3 className="text-base md:text-lg font-semibold">Seats Sold</h3>
          <p className="text-xl md:text-2xl">
            {Object.values(analytics).reduce((acc, a) => acc + (a?.totalSeats || 0), 0)}
          </p>
        </div>
      </div>
      <div className="bg-indigo-800 rounded-xl p-4 shadow-lg flex items-center gap-3">
        <IndianRupee size={28} className="text-yellow-500" />
        <div>
          <h3 className="text-base md:text-lg font-semibold">Revenue</h3>
          <p className="text-xl md:text-2xl">
            ₹{Object.values(analytics).reduce((acc, a) => acc + (a?.totalRevenue || 0), 0)}
          </p>
        </div>
      </div>
    </div>

    {/* Event Cards with Analytics */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {events
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map((event) => {
          const a = analytics[event._id] || {};
          return (
            <div
              key={event._id}
              className="bg-gradient-to-r from-indigo-800 to-indigo-700 rounded-xl shadow-md p-5 relative"
            >
              <h3 className="text-lg md:text-xl font-bold mb-2">{event.title}</h3>
              <p className="text-sm text-gray-300">{event.location}</p>
              <p className="text-xs md:text-sm text-gray-400 mb-3">
                {new Date(event.date).toLocaleString('en-US', { timeZone: 'UTC'  }).toLocaleUpperCase()}
              </p>

              {/* Mini Analytics */}
              <div className="grid grid-cols-3 text-center mb-4">
                <div>
                  <p className="font-bold text-base md:text-lg">{a.totalBookings || 0}</p>
                  <span className="text-xs text-gray-400">Bookings</span>
                </div>
                <div>
                  <p className="font-bold text-base md:text-lg">{a.totalSeats || 0}</p>
                  <span className="text-xs text-gray-400">Seats</span>
                </div>
                <div>
                  <p className="font-bold text-base md:text-lg">₹{a.totalRevenue || 0}</p>
                  <span className="text-xs text-gray-400">Revenue</span>
                </div>
              </div>

              {/* Chart */}
              <div className="h-32 md:h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[a]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                    <XAxis dataKey="_id" hide />
                    <YAxis stroke="#888" />
                    <Tooltip />
                    <Bar dataKey="totalBookings" fill="#60a5fa" />
                    <Bar dataKey="totalSeats" fill="#34d399" />
                    <Bar dataKey="totalRevenue" fill="#facc15" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
                <button
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg flex items-center justify-center gap-1 text-sm md:text-base"
                  onClick={() => {
                    setSelectedEvent(event);
                    setOpen(true);
                  }}
                >
                  <Edit size={18} /> Update Event Info
                </button>
                <button
                  className={`${
                    event.activeStatus === "cancelled"
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  } px-3 py-2 rounded-lg flex items-center justify-center gap-1 text-sm md:text-base`}
                  onClick={() => handleDelete(event._id)}
                  disabled={event.activeStatus === "cancelled"}
                >
                  <Trash2 size={18} /> Cancel Event
                </button>

                {open && selectedEvent && (
                  <UpdateEventModal
                    event={selectedEvent}
                    open={open}
                    onClose={() => {
                      setOpen(false);
                      setSelectedEvent(null);
                    }}
                    onUpdate={handleUpdate}
                  />
                )}
              </div>
            </div>
          );
        })}
    </div>
  </div>
);

}

export default Dashboard;
