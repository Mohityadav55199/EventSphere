import React, { lazy, Suspense, useEffect, useState } from "react";
import { getOrganizerOverview, updateEvent, getMyEvents, cancelEvent } from "../services/eventservices/eventapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Calendar, Trash2, Edit, Users, Ticket, IndianRupee, TrendingUp, Award, Camera } from "lucide-react";
import { IconChartBar } from "@tabler/icons-react";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import UpdateEventModal from "../Components/UpdateEventForm";
const QRScannerModal = lazy(() => import("../Components/QRScannerModal"));

function Dashboard() {
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [overview, setOverview] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await getMyEvents();
        setEvents(res.data || []);
      } catch {
        toast.error("Failed to load organizer dashboard events");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Totals, revenue-per-day, per-tier and per-event numbers come from ONE aggregation request
  useEffect(() => {
    let cancelled = false;
    getOrganizerOverview(days)
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data);
        const perEvent = {};
        for (const e of res.data.byEvent) {
          perEvent[e.eventId] = { totalBookings: e.bookings, totalSeats: e.seats, totalRevenue: e.revenue };
        }
        setAnalytics(perEvent);
      })
      .catch(() => !cancelled && toast.error("Failed to load analytics"));
    return () => { cancelled = true; };
  }, [days]);

  const handleDelete = async (id) => {
    try {
      await cancelEvent(id);
      setEvents(events.map((ev) => ev._id === id ? { ...ev, activeStatus: "cancelled" } : ev));
      toast.success("Event cancelled successfully");
    } catch (err) {
      toast.error(err.message || "Failed to cancel event");
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateEvent(id, data);
      toast.success("Event updated successfully");
      window.location.reload();
    } catch (err) {
      toast.error(err.message || "Failed to update event");
    }
  };

  const totalBookings = overview?.totals.bookings || 0;
  const totalSeats = overview?.totals.seats || 0;
  const totalRevenue = overview?.totals.revenue || 0;
  const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-600 font-medium">
        Loading organizer analytics...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-10 px-4 sm:px-6 lg:px-12">
      <ToastContainer position="top-right" autoClose={4000} />
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <IconChartBar className="text-indigo-600 w-8 h-8" />
              Organizer Revenue & Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Real-time metrics, ticket sales, and event performance overview</p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Attendee Tickets (Live QR Check-In)</span>
          </button>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Created Events</span>
              <span className="text-2xl font-black text-slate-900">{events.length}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 rounded-xl text-rose-600 shrink-0">
              <Users size={24} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Total Bookings</span>
              <span className="text-2xl font-black text-slate-900">{totalBookings}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 shrink-0">
              <Ticket size={24} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Seats Sold</span>
              <span className="text-2xl font-black text-slate-900">{totalSeats}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shrink-0">
              <IndianRupee size={24} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400 block uppercase">Total Revenue</span>
              <span className="text-2xl font-black text-indigo-600">₹{totalRevenue}</span>
            </div>
          </div>
        </div>

        {/* Revenue over time + ticket tiers + best events (single aggregation request) */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-extrabold text-slate-900 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-600" /> Revenue over time</h2>
                  <p className="text-xs text-slate-500">Confirmed bookings, last {overview.days} days</p>
                </div>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  {[7, 30, 90].map((d) => (
                    <button key={d} onClick={() => setDays(d)}
                      className={`px-3 py-1 rounded-lg transition ${days === d ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview.revenueByDay}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke="#94a3b8" fontSize={10} minTickGap={24} />
                    <YAxis stroke="#94a3b8" fontSize={10} width={44} />
                    <Tooltip labelFormatter={shortDate} formatter={(v) => [`₹${v}`, "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-6">
              <div>
                <h2 className="font-extrabold text-slate-900 mb-3 flex items-center gap-2"><Ticket size={18} className="text-indigo-600" /> Revenue by ticket tier</h2>
                {overview.byTier.length === 0 ? (
                  <p className="text-xs text-slate-400">No sales yet.</p>
                ) : (
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.byTier} layout="vertical" margin={{ left: 8 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="tier" stroke="#94a3b8" fontSize={10} width={80} />
                        <Tooltip formatter={(v) => [`₹${v}`, "Revenue"]} />
                        <Bar dataKey="revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-extrabold text-slate-900 mb-2 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Top events</h2>
                <ol className="space-y-2">
                  {overview.byEvent.slice(0, 3).map((e, i) => (
                    <li key={e.eventId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700"><span className="text-slate-400 mr-1.5">{i + 1}.</span>{e.title}</span>
                      <span className="font-bold text-indigo-600 shrink-0">₹{e.revenue}</span>
                    </li>
                  ))}
                  {overview.byEvent.length === 0 && <li className="text-xs text-slate-400">No sales yet.</li>}
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Event Cards & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm">No events created yet. Click "+ Add Event" to start organizing!</p>
            </div>
          ) : (
            events
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((event) => {
                const a = analytics[event._id] || {};
                const chartData = [
                  { name: "Bookings", count: a.totalBookings || 0 },
                  { name: "Seats", count: a.totalSeats || 0 },
                  { name: "Revenue (₹)", count: a.totalRevenue || 0 },
                ];

                return (
                  <div
                    key={event._id}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700">
                            {event.category || "Event"}
                          </span>
                          <h3 className="font-extrabold text-lg text-slate-900 mt-1 line-clamp-1">{event.title}</h3>
                          <p className="text-xs text-slate-500 truncate">{event.location}</p>
                        </div>
                        <span className="text-lg font-black text-indigo-600">₹{event.Price}</span>
                      </div>

                      {/* Mini Metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Bookings</span>
                          <span className="font-extrabold text-slate-800 text-sm">{a.totalBookings || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Seats Sold</span>
                          <span className="font-extrabold text-slate-800 text-sm">{a.totalSeats || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Revenue</span>
                          <span className="font-extrabold text-indigo-600 text-sm">₹{a.totalRevenue || 0}</span>
                        </div>
                      </div>

                      {/* Chart Visualization */}
                      <div className="h-40 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                        onClick={() => {
                          setSelectedEvent(event);
                          setOpen(true);
                        }}
                      >
                        <Edit size={14} /> Update
                      </button>
                      <button
                        disabled={event.activeStatus === "cancelled"}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          event.activeStatus === "cancelled"
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                        onClick={() => handleDelete(event._id)}
                      >
                        <Trash2 size={14} /> {event.activeStatus === "cancelled" ? "Cancelled" : "Cancel Event"}
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </div>

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

        {isScannerOpen && (
          <Suspense fallback={null}>
            <QRScannerModal
              isOpen={isScannerOpen}
              onClose={() => setIsScannerOpen(false)}
            />
          </Suspense>
        )}

      </div>
    </div>
  );
}

export default Dashboard;
