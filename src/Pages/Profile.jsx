import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getUserProfile,
  updateUserProfile,
  resetPassword,
} from "../services/authservices/authapi";
import { cancelBooking, getMyBookings, verifyPayment } from "../services/bookingservices/bookingapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User, Mail, Wallet, Calendar, CalendarPlus, Lock, Pencil, X, Download, QrCode } from "lucide-react";
import SavedEvents from "../Components/SavedEvents";
import { googleCalendarUrl } from "../lib/calendar";
import { IconTicket } from "@tabler/icons-react";

const calendarUrl = (event) =>
  googleCalendarUrl({ title: event?.title, date: event?.date, location: event?.location });

function Profile() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Handle Stripe redirect back to /profile?session_id=...&booking_id=... ────
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const bookingId = searchParams.get("booking_id");
    const eventId   = searchParams.get("event_id");
    const seats     = searchParams.get("seats");
    const discount  = searchParams.get("discount");
    const tierName  = searchParams.get("tier");
    const tierPrice = searchParams.get("price");

    if (!sessionId) return;

    // Clear URL params immediately so refreshing won't re-trigger
    setSearchParams({});

    let parsedSeats = [];
    if (seats) {
      try {
        parsedSeats = JSON.parse(seats);
        if (!Array.isArray(parsedSeats)) parsedSeats = [String(parsedSeats)];
      } catch {
        parsedSeats = seats.includes(",") ? seats.split(",").map(s => s.trim()) : [seats];
      }
    }

    const confirm = async () => {
      try {
        await verifyPayment({
          stripe_session_id: sessionId,
          bookingId: bookingId || undefined,
          eventId,
          selectedSeats: parsedSeats.length > 0 ? parsedSeats : undefined,
          seatsBooked: parsedSeats.length || Number(seats) || 1,
          discount: Number(discount) || 0,
          ticketTier: tierName || "Standard Pass",
          ticketPrice: Number(tierPrice) || 0,
        });
        toast.success("🎉 Payment successful! Your tickets are confirmed.");
        // Refresh bookings list
        const myBookings = await getMyBookings();
        setBookings(myBookings?.data || []);
      } catch (err) {
        const msg = err?.message || err?.data?.message || "Payment verification failed";
        toast.error(msg);
      }
    };

    confirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Password change states
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const fetchProfileAndBookings = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const profile = await getUserProfile(token);
        const myBookings = await getMyBookings();
        setUser(profile);
        setBookings(myBookings?.data || []);
        setEditName(profile?.name || "");
        setEditEmail(profile?.email || "");
      } catch (error) {
        toast.error(error.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfileAndBookings();
  }, []);

  const handleUpdate = async () => {
    try {
      const updated = await updateUserProfile({
        name: editName,
        email: editEmail,
      });
      setUser(updated.data);
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleChangePassword = async () => {
    try {
      await resetPassword({ oldPassword, newPassword });
      toast.success("Password changed successfully");
      setIsChangingPassword(false);
      setOldPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(error.message || "Failed to change password");
    }
  };

  const handleCancleBooking = async (bookingId) => {
    try {
      await cancelBooking(bookingId);
      toast.success("Booking cancelled successfully");
      const myBookings = await getMyBookings();
      setBookings(myBookings?.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to cancel booking");
    }
  };

  const handleDownloadPDF = async (bookingId, eventTitle) => {
    const element = document.getElementById(`ticket-${bookingId}`);
    if (!element) return;
    const cleanTitle = eventTitle ? `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_` : "";
    const opt = {
      margin: 0.4,
      filename: `EventSphere_${cleanTitle}Ticket_${bookingId.slice(-6)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    // Loaded on demand: html2pdf is ~700 kB and only needed when a ticket is downloaded
    const { default: html2pdf } = await import("html2pdf.js");
    html2pdf().set(opt).from(element).save();
    toast.success("Downloading PDF Ticket!");
  };

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8" role="status" aria-label="Loading profile and tickets">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-1/3 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 rounded-3xl bg-slate-200" />
            <div className="h-64 rounded-3xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-10 px-4 sm:px-6 lg:px-8 text-slate-800">
      <ToastContainer position="top-right" autoClose={4000} />
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Profile Card Header */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-indigo-200">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{user?.name?.toUpperCase()}</h1>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full transition"
              >
                <Pencil size={14} /> Edit Profile
              </button>
              <button
                onClick={() => setIsChangingPassword(true)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-full shadow transition"
              >
                <Lock size={14} /> Security
              </button>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 text-xs font-medium">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
              <Mail className="text-indigo-600 shrink-0" size={18} />
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px] uppercase">Email</span>
                <span className="text-slate-800 truncate block font-bold">{user?.email}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
              <User className="text-amber-500 shrink-0" size={18} />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Role</span>
                <span className="text-slate-800 font-bold">{user?.role === "attendee" ? "Event Explorer" : "Event Organizer"}</span>
              </div>
            </div>
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center gap-3">
              <Wallet className="text-indigo-600 shrink-0" size={18} />
              <div>
                <span className="text-indigo-400 block text-[10px] uppercase">Wallet Cashback</span>
                <span className="text-indigo-700 font-extrabold text-sm">{user?.walletPoints || 0} pts</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
              <Calendar className="text-emerald-500 shrink-0" size={18} />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Member Since</span>
                <span className="text-slate-800 font-bold">{new Date(user?.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Saved Events */}
        <SavedEvents />

        {/* Bookings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <IconTicket size={24} className="text-indigo-600" /> My Event Tickets ({bookings.length})
            </h2>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <p className="text-slate-400 text-sm">No ticket bookings found yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bookings.map((booking) => {
                if (!booking.event) return null;
                const isCancelled = booking.paymentstatus === "cancelled";

                return (
                  <div
                    key={booking._id}
                    id={`ticket-${booking._id}`}
                    className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-4 relative"
                  >
                    {/* Ticket Header */}
                    <div className="flex justify-between items-start gap-4 pb-3 border-b border-slate-100">
                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isCancelled ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {isCancelled ? "Cancelled" : "Confirmed Ticket"}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-base mt-1 line-clamp-1">
                          {booking.event?.title}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">Booking #{booking._id?.slice(-8)}</p>
                      </div>

                      {/* QR Code */}
                      {booking.qrCode && !isCancelled && (
                        <div className="bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                          <img src={booking.qrCode} alt="Ticket QR Code" className="w-16 h-16 object-contain" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Pass Type</span>
                        <span className="font-bold text-indigo-600">{booking.ticketTier || "Standard Pass"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Seats</span>
                        <span className="font-bold text-slate-800">{booking.seatsBooked} Ticket(s)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Amount Paid</span>
                        <span className="font-bold text-indigo-600">₹{booking.amountPaid}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">Location</span>
                        <span className="font-semibold text-slate-800 truncate block">{booking.event?.location}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">Event Date</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(booking.event?.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      {!isCancelled && calendarUrl(booking.event) && (
                        <a
                          href={calendarUrl(booking.event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition"
                        >
                          <CalendarPlus size={14} /> Add to Calendar
                        </a>
                      )}
                      {!isCancelled && (
                        <button
                          onClick={() => handleDownloadPDF(booking._id, booking.event?.title)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition"
                        >
                          <Download size={14} /> Download PDF Ticket
                        </button>
                      )}
                      <button
                        onClick={() => handleCancleBooking(booking._id)}
                        disabled={isCancelled}
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition ${
                          isCancelled
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                      >
                        {isCancelled ? "Cancelled" : "Cancel"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Edit Profile</h3>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">Cancel</button>
                <button onClick={handleUpdate} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Password Modal */}
        {isChangingPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Change Password</h3>
                <button onClick={() => setIsChangingPassword(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Current Password"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsChangingPassword(false)} className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">Cancel</button>
                <button onClick={handleChangePassword} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow">Update Password</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Profile;
