import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteEventbyAdmin, getEventById } from "../services/eventservices/eventapi";
import { Calendar, Clock, MapIcon, User2Icon, Ticket, Tag, Sparkles, CheckCircle2, Zap, Users } from "lucide-react";
import { createOrder } from "../services/bookingservices/bookingapi";
import { useSelector } from "react-redux";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReviewCard from "../Components/Cards/ReviewCard";
import ReviewForm from "../Components/Cards/PostReview";
import ChatBox from "../Components/Chatbox/Chatbox";
import useLiveSeatCount from "../hooks/useLiveSeatCount";
import SeatMap from "../Components/SeatMap";

function DetailEvent() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [BookingAvailable, setBookingAvailable] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [usePoints, setUsePoints] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const user = useSelector((state) => state.auth.user);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [isBooking, setIsBooking] = useState(false);

  // ── Live seat count via Socket.io (BookMyShow-style real-time updates) ───────
  const {
    effectiveFreeSeats,
    bookedSeats,
    heldSeats,
    isSoldOut,
    fillingFast,
    isLoading: seatLoading,
  } = useLiveSeatCount(id);

  // Derive display value: prefer live socket data, fall back to event data
  const displayAvailableSeats = seatLoading
    ? event?.availableSeats ?? 0
    : effectiveFreeSeats;

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getEventById(id);
        const evData = response.data;
        setEvent(evData);

        const tiers = evData?.ticketTypes?.length > 0
          ? evData.ticketTypes
          : [{ name: "Standard Pass", price: evData.Price, description: "General Admission Entry" }];
        setSelectedTier(tiers[0]);

        if (evData.activeStatus === "active") {
          setBookingAvailable(true);
        }
      } catch {
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  // Disable booking if live seat count drops to zero
  useEffect(() => {
    if (!seatLoading && isSoldOut) {
      setBookingAvailable(false);
    }
  }, [isSoldOut, seatLoading]);

  const handleBooking = async () => {
    if (isBooking) return;
    setIsBooking(true);
    try {
      if (!user) {
        toast.error("Please login to book tickets");
        navigate("/login");
        return;
      }

      if (selectedSeats.length === 0) {
        toast.error("Please select at least one seat.");
        return;
      }

      if (selectedSeats.length > displayAvailableSeats) {
        toast.error(`Only ${displayAvailableSeats} seat(s) available right now.`);
        return;
      }

      const orderResponse = await createOrder(id, {
        selectedSeats,
        usePoints,
        couponCode,
        ticketTier: selectedTier?.name,
      });

      if (!orderResponse) {
        toast.error("Booking error. Please check login status.");
        return;
      }

      // Wallet-only booking (no Stripe needed)
      if (orderResponse.message === "Booking confirmed via wallet" && orderResponse.statusCode === 201) {
        toast.success("Booking confirmed using wallet points!");
        setOpen(false);
        navigate("/profile");
        return;
      }

      // Redirect to Stripe Checkout
      if (orderResponse.data?.checkoutUrl) {
        window.location.href = orderResponse.data.checkoutUrl;
        return;
      }

      toast.error("Stripe Checkout URL not provided by the server.");
    } catch (error) {
      const msg = error?.message || error?.data?.message || "Booking failed. Try again.";
      // Show concurrency-specific messages clearly
      if (error?.statusCode === 409 || msg.includes("seat") || msg.includes("hold")) {
        toast.error(`⚡ ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsBooking(false);
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

  const availableTiers = event?.ticketTypes?.length > 0
    ? event.ticketTypes
    : [{ name: "Standard Pass", price: event?.Price, description: "General Admission Pass" }];

  // ── Seat status badge config ──────────────────────────────────────────────────
  const seatBadge = isSoldOut
    ? { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Sold Out", pulse: true }
    : fillingFast
    ? { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: `${displayAvailableSeats} left — Filling Fast!`, pulse: true }
    : { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: `${displayAvailableSeats} / ${event?.capacity} Seats Left`, pulse: false };

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
            {/* Live seat badge on image */}
            <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg ${seatBadge.bg} ${seatBadge.text}`}>
              <span className={`w-2 h-2 rounded-full ${seatBadge.dot} ${seatBadge.pulse ? "animate-pulse" : ""}`} />
              {seatBadge.label}
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

            {/* Live seat count pill — updates in real-time via Socket.io */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-500 ${seatBadge.bg} ${seatBadge.text}`}>
              <Users className="w-4 h-4" />
              <span className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${seatBadge.dot} ${seatBadge.pulse ? "animate-pulse" : ""} inline-block`} />
                {seatLoading ? "Checking seats..." : seatBadge.label}
              </span>
            </div>
          </div>

          {/* Held seats notice — shows when others are currently in checkout */}
          {!seatLoading && heldSeats.length > 0 && !isSoldOut && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
              <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>
                <strong>{heldSeats.length} seat{heldSeats.length > 1 ? "s" : ""}</strong> currently in checkout by other users — grab yours before they sell out!
              </span>
            </div>
          )}

          {/* Tiered Ticket Selection Cards */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">Select Ticket Tier / Pass</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableTiers.map((tier) => (
                <div
                  key={tier.name}
                  onClick={() => setSelectedTier(tier)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 relative ${
                    selectedTier?.name === tier.name
                      ? "bg-indigo-50/80 border-indigo-500 shadow-md ring-2 ring-indigo-200"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {selectedTier?.name === tier.name && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 absolute top-3 right-3" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{tier.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{tier.description || "Admission pass"}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-lg font-black text-indigo-600">₹{tier.price}</span>
                  </div>
                </div>
              ))}
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
              <span className="text-xs text-slate-400 block">Selected Tier ({selectedTier?.name || "Pass"})</span>
              <span className="text-2xl font-black text-indigo-600">₹{selectedTier?.price || event?.Price}</span>
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

              {BookingAvailable && !isSoldOut ? (
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
                  {isSoldOut ? "Sold Out" : "Not Available"}
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
              <h2 className="text-lg font-black text-slate-900">Confirm Ticket Booking</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Live seat warning inside modal */}
            {fillingFast && !isSoldOut && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Only {displayAvailableSeats} seat{displayAvailableSeats !== 1 ? "s" : ""} left — book now before they're gone!
              </div>
            )}

            {/* Selected Tier Banner */}
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">Selected Tier</span>
                <span className="text-sm font-extrabold text-indigo-900">{selectedTier?.name || "Standard Pass"}</span>
              </div>
              <span className="text-base font-black text-indigo-600">₹{selectedTier?.price || event?.Price}</span>
            </div>

            {/* Interactive Seat Map */}
            <div className="w-full">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Select Your Seats (Max 10)
              </label>
              <div className="max-h-64 overflow-y-auto w-full custom-scrollbar">
                <SeatMap
                  capacity={event?.capacity || 100}
                  bookedSeats={bookedSeats}
                  heldSeats={heldSeats}
                  selectedSeats={selectedSeats}
                  onSeatToggle={setSelectedSeats}
                  maxSelectable={10}
                />
              </div>
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
              <span className="text-xs text-slate-500 font-medium">Subtotal ({selectedSeats.length} ticket{selectedSeats.length > 1 ? "s" : ""})</span>
              <span className="text-lg font-black text-slate-900">₹{(selectedTier?.price || event?.Price) * selectedSeats.length}</span>
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
                disabled={isBooking || isSoldOut}
                className={`px-6 py-2.5 rounded-full text-white text-xs font-bold shadow-md transition ${
                  isBooking || isSoldOut
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                }`}
              >
                {isBooking ? "Processing..." : "Proceed to Pay"}
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
