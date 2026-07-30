import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteEventbyAdmin, getEventById } from "../services/eventservices/eventapi";
import { Calendar, Clock, MapIcon, User2Icon, Ticket, Tag, Sparkles } from "lucide-react";
import { createOrder, verifyPayment } from "../services/bookingservices/bookingapi";
import { useSelector } from "react-redux";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReviewCard from "../Components/Cards/ReviewCard";
import ReviewForm from "../Components/Cards/PostReview";
import ChatBox from "../Components/Chatbox/Chatbox";

function DetailEvent() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [BookingAvailable, setBookingAvailable] = useState(false);
  const [seats, setSeats] = useState(1);
  const [usePoints, setUsePoints] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const user = useSelector((state) => state.auth.user);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [AvailableSeats, setAvailableSeats] = useState(0);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getEventById(id);
        setEvent(response.data);
        const totalFilledSeats = (response.data.attendees || []).reduce(
          (acc, attendee) => acc + (attendee.ticketsBooked || 1),
          0
        );
        setAvailableSeats(response.data.capacity - totalFilledSeats);
        if (response.data.capacity > totalFilledSeats && (response.data.status === "upcoming" || response.data.status === "ongoing" || response.data.activeStatus === "active")) {
          setBookingAvailable(true);
        }
      } catch (err) {
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const handleBooking = async () => {
    try {
      if (!user) {
        toast.error("Please login to book tickets");
        navigate("/login");
        return;
      }
      const orderResponse = await createOrder(id, { seatsBooked: seats, usePoints, couponCode });

      if (!orderResponse) {
        toast.error("Booking error. Please check login status.");
        return;
      }

      if (orderResponse.message === "Booking created successfully using wallet only" && orderResponse.statusCode === 201) {
        toast.success("Booking created successfully using wallet points!");
        setOpen(false);
        navigate("/profile");
        return;
      }

      if (orderResponse.data?.checkoutUrl) {
        window.location.href = orderResponse.data.checkoutUrl;
        return;
      }

      const verifyResponse = await verifyPayment({
        stripe_session_id: orderResponse.data.stripeSessionId || orderResponse.data.orderId,
        eventId: id,
        seatsBooked: seats,
        discount: orderResponse.data.discount || 0,
      });
      toast.success("Stripe Payment Successful & Booking Confirmed!");
      setOpen(false);
      navigate("/profile");
    } catch (error) {
      toast.error(error.message || "Booking failed");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEventbyAdmin(id);
      navigate("/");
    } catch (error) {
      toast.error(error.message || "Failed to delete event");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-slate-50 text-slate-600 font-medium">Loading event details...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center mt-10 bg-slate-50 p-4">{error}</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 text-slate-800">
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Main Event Card */}
        <div className="p-6 sm:p-8 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200/80 rounded-3xl space-y-6">
          
          {/* Banner Image */}
          <div className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100 relative">
            <img
              src={event?.image || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"}
              alt={event?.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
              {event?.category || "Featured Event"}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {event?.title}
          </h1>

          {/* Key Info Pills */}
          <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>{new Date(event?.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>{new Date(event?.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <a
              href={`${event?.locationGoogleMapLink}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-full transition"
            >
              <MapIcon className="w-4 h-4 text-rose-600" />
              <span className="underline">{event?.location}</span>
            </a>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full">
              <User2Icon className="w-4 h-4 text-emerald-600" />
              <span>{AvailableSeats} / {event?.capacity} Seats Left</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900">About the Event</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              {event?.description}
            </p>
          </div>

          {/* Footer Bar: Price & Book Button */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-400 block">Ticket Price</span>
              <span className="text-2xl font-black text-indigo-600">₹{event?.Price}</span>
            </div>

            <div className="flex gap-3">
              {user?.role === "admin" && event?.activeStatus === "cancelled" && (
                <button
                  onClick={handleDelete}
                  className="bg-red-600 text-white py-2.5 px-5 rounded-full text-xs font-bold hover:bg-red-700 transition shadow"
                >
                  Delete Event
                </button>
              )}

              {BookingAvailable ? (
                <button
                  onClick={() => {
                    if (!user) {
                      navigate("/login");
                    } else {
                      setOpen(true);
                    }
                  }}
                  className="bg-indigo-600 text-white py-2.5 px-6 rounded-full text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                >
                  Book Tickets Now
                </button>
              ) : (
                <button
                  disabled
                  className="bg-slate-200 text-slate-400 py-2.5 px-5 rounded-full text-xs font-bold cursor-not-allowed"
                >
                  Sold Out / Not Available
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="p-6 sm:p-8 bg-white/90 backdrop-blur-md shadow-md border border-slate-200/80 rounded-3xl space-y-4">
          <h2 className="text-xl font-black text-slate-900">Community Reviews & Ratings</h2>
          {user && <ReviewForm eventId={id} onSuccess={() => {}} />}
          <div className="pt-4">
            <ReviewCard eventId={id} />
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-900">Book Tickets</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Ticket Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Number of Tickets (Max {AvailableSeats})
              </label>
              <input
                type="number"
                min="1"
                max={AvailableSeats}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 w-full text-sm outline-none focus:border-indigo-500 font-bold"
              />
            </div>

            {/* Promo Code Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                Promo / Coupon Code
              </label>
              <input
                type="text"
                placeholder="Try SPHERE20 or WELCOME10"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 w-full text-sm outline-none uppercase font-semibold text-indigo-600 focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Use SPHERE20 for 20% discount</span>
            </div>

            {/* Wallet Cashback */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-indigo-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                Apply Wallet Cashback
              </label>
              <span className="text-xs font-extrabold text-indigo-600">{user?.walletPoints || 0} pts</span>
            </div>

            {/* Total Estimated Price */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Subtotal</span>
              <span className="text-lg font-black text-slate-900">₹{event?.Price * seats}</span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                className="px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200"
              >
                Proceed to Pay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Box */}
      <div className="fixed bottom-4 right-4 z-50">
        <ChatBox eventId={id} />
      </div>
    </div>
  );
}

export default DetailEvent;
