import React, { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteEventbyAdmin, getEventById } from "../services/eventservices/eventapi";
import { Calendar, Clock, MapIcon, User2Icon, Ticket, Tag, Sparkles, CheckCircle2, Zap, Users, CreditCard, Smartphone, Heart, CalendarPlus, X, Loader2 } from "lucide-react";
import { createOrder, verifyPayment } from "../services/bookingservices/bookingapi";
import { useSelector } from "react-redux";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ReviewCard from "../Components/Cards/ReviewCard";
import ReviewForm from "../Components/Cards/PostReview";
import useDocumentTitle from "../hooks/useDocumentTitle";
import useWishlist from "../hooks/useWishlist";
import { googleCalendarUrl } from "../lib/calendar";
import { optimizeImage } from "../lib/image";

const ChatBox = lazy(() => import("../Components/Chatbox/Chatbox"));
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
  const [paymentGateway, setPaymentGateway] = useState("stripe");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [isBooking, setIsBooking] = useState(false);
  const [sandboxOrder, setSandboxOrder] = useState(null);
  useDocumentTitle(event?.title);

  const { isSaved, toggle: toggleWishlist } = useWishlist();
  const isEventSaved = id ? isSaved(id) : false;
  const calendarLink = event?.date
    ? googleCalendarUrl({
        title: event?.title,
        date: event?.date,
        location: event?.location,
        description: event?.description,
      })
    : null;

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
        paymentGateway,
      });

      if (!orderResponse) {
        toast.error("Booking error. Please check login status.");
        return;
      }

      // Wallet-only booking
      if (orderResponse.message === "Booking confirmed via wallet" && orderResponse.statusCode === 201) {
        toast.success("Booking confirmed using wallet points! Confirmation email sent 🎉");
        setOpen(false);
        navigate("/profile");
        return;
      }

      // Sandbox Test Simulation: Show interactive test gateway modal instead of auto-confirming
      if (orderResponse.data?.isSimulated) {
        setIsBooking(false);
        setSandboxOrder({
          gateway: orderResponse.data.gateway || paymentGateway,
          orderId: orderResponse.data.orderId,
          bookingId: orderResponse.data.bookingId,
          amountToPay: orderResponse.data.amountToPay ?? finalPayable,
          checkoutUrl: orderResponse.data.checkoutUrl,
          eventTitle: event?.title,
          selectedSeats,
          discount: orderResponse.data.discount ?? (couponDiscount + pointsDiscount),
          selectedTier: orderResponse.data.selectedTier || selectedTier?.name,
          unitPrice,
        });
        return;
      }

      if (paymentGateway === "razorpay") {
        const loadRazorpayScript = () => {
          return new Promise((resolve) => {
            if (window.Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const loaded = await loadRazorpayScript();
        if (!loaded) {
          toast.info("Razorpay SDK offline. Processing demo confirmation...");
          await verifyPayment({
            razorpay_order_id: orderResponse.data.orderId,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            razorpay_signature: `sig_sim_${Date.now()}`,
            bookingId: orderResponse.data.bookingId,
            eventId: id,
            selectedSeats,
            discount: orderResponse.data.discount,
            ticketTier: orderResponse.data.selectedTier,
            ticketPrice: orderResponse.data.unitPrice,
          });
          toast.success("Payment confirmed! Tickets and confirmation email dispatched 🎉");
          setOpen(false);
          navigate("/profile");
          return;
        }

        const rzpOptions = {
          key: orderResponse.data.keyId,
          amount: orderResponse.data.amount,
          currency: orderResponse.data.currency,
          name: "EventSphere",
          description: `Tickets for ${orderResponse.data.eventTitle}`,
          order_id: orderResponse.data.orderId,
          prefill: {
            name: orderResponse.data.user?.name || "",
            email: orderResponse.data.user?.email || "",
          },
          theme: {
            color: "#4f46e5",
          },
          handler: async function (response) {
            try {
              toast.info("Verifying Razorpay payment...");
              await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: orderResponse.data.bookingId,
                eventId: id,
                selectedSeats,
                discount: orderResponse.data.discount,
                ticketTier: orderResponse.data.selectedTier,
                ticketPrice: orderResponse.data.unitPrice,
              });
              toast.success("Payment confirmed! Tickets and confirmation email dispatched 🎉");
              setOpen(false);
              navigate("/profile");
            } catch (verifyErr) {
              toast.error(verifyErr.message || "Payment verification failed.");
            }
          },
        };

        const rzp = new window.Razorpay(rzpOptions);
        rzp.open();
        return;
      }

      // Stripe (Apple Pay / Google Pay / Global Cards)
      if (orderResponse.data?.checkoutUrl) {
        window.location.href = orderResponse.data.checkoutUrl;
        return;
      }

      toast.error("Payment checkout URL not provided by the server.");
    } catch (error) {
      const msg = error?.message || error?.data?.message || "Booking failed. Try again.";
      if (error?.statusCode === 409 || msg.includes("seat") || msg.includes("hold")) {
        toast.error(`⚡ ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handleConfirmSandboxPayment = async () => {
    if (!sandboxOrder || isBooking) return;
    setIsBooking(true);
    try {
      if (sandboxOrder.gateway === "stripe" && sandboxOrder.checkoutUrl) {
        window.location.href = sandboxOrder.checkoutUrl;
        return;
      }

      toast.info("Verifying demo sandbox payment...");
      await verifyPayment({
        razorpay_order_id: sandboxOrder.orderId,
        razorpay_payment_id: `pay_sim_${Date.now()}`,
        razorpay_signature: `sig_sim_${Date.now()}`,
        bookingId: sandboxOrder.bookingId,
        eventId: id,
        selectedSeats: sandboxOrder.selectedSeats,
        discount: sandboxOrder.discount,
        ticketTier: sandboxOrder.selectedTier,
        ticketPrice: sandboxOrder.unitPrice,
      });
      toast.success("Payment confirmed! Tickets and confirmation email dispatched 🎉");
      setSandboxOrder(null);
      setOpen(false);
      navigate("/profile");
    } catch (err) {
      toast.error(err?.message || "Payment verification failed.");
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
    return (
      <div className="bg-slate-50 min-h-screen p-4 sm:p-8" role="status" aria-label="Loading event details">
        <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 space-y-6 animate-pulse">
          <div className="w-full h-72 sm:h-96 rounded-2xl bg-slate-200" />
          <div className="h-8 w-2/3 rounded-lg bg-slate-200" />
          <div className="flex flex-wrap gap-3">
            <div className="h-8 w-40 rounded-full bg-slate-200" />
            <div className="h-8 w-28 rounded-full bg-slate-200" />
            <div className="h-8 w-48 rounded-full bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="h-24 rounded-2xl bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-5/6 rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
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

  // ── Dynamic price & discount breakdown ───────────────────────────────────────
  const unitPrice = selectedTier?.price ?? (event?.Price || 0);
  const baseTotal = unitPrice * selectedSeats.length;

  let couponDiscount = 0;
  if (couponCode) {
    const code = String(couponCode).toUpperCase().trim();
    if (code === "SPHERE20") couponDiscount = Math.round(baseTotal * 0.20);
    else if (code === "WELCOME10") couponDiscount = Math.round(baseTotal * 0.10);
    else if (code === "FESTIVAL50") couponDiscount = Math.round(baseTotal * 0.50);
  }

  const subtotalAfterCoupon = Math.max(0, baseTotal - couponDiscount);
  const pointsDiscount = usePoints ? Math.min(user?.walletPoints || 0, subtotalAfterCoupon) : 0;
  const finalPayable = Math.max(0, subtotalAfterCoupon - pointsDiscount);
  const totalDiscount = couponDiscount + pointsDiscount;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 text-slate-800">
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="max-w-5xl mx-auto space-y-8">
        {/* Main Event Card */}
        <div className="p-6 sm:p-8 bg-white/90 backdrop-blur-md shadow-lg border border-slate-200/80 rounded-3xl space-y-6">

          {/* Banner Image */}
          <div className="w-full h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100 relative">
            <img
              src={optimizeImage(event?.image, 1200) || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80"}
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

          {/* Title & Top Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {event?.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {calendarLink && (
                <a
                  href={calendarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-full transition shadow-xs"
                  title="Add to Google Calendar"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Add to Calendar</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => toggleWishlist(id)}
                aria-pressed={isEventSaved}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition border cursor-pointer ${
                  isEventSaved
                    ? "bg-rose-50 border-rose-200 text-rose-600 shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700"
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isEventSaved ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
                <span>{isEventSaved ? "Saved" : "Save Event"}</span>
              </button>
            </div>
          </div>

          {/* Key Info Pills */}
          <div className="flex flex-wrap gap-3 sm:gap-4 text-xs font-medium text-slate-600">
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
                <span className={`w-1.5 h-1.5 rounded-full ${seatBadge.dot} ${seatBadge.pulse ? "animate-pulse" : ""}`} />
                {seatLoading ? "Checking seats..." : seatBadge.label}
              </span>
            </div>
          </div>

          {/* Held seats notice — shows when others are currently in checkout */}
          {!seatLoading && heldSeats.length > 0 && !isSoldOut && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                <strong>{heldSeats.length} seat{heldSeats.length > 1 ? "s" : ""}</strong> currently in checkout by other users — grab yours before they sell out!
              </span>
            </div>
          )}

          {/* Tiered Ticket Selection Cards */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Select Ticket Tier / Pass</h3>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl md:max-w-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
            
            {/* Fixed Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Confirm Ticket Booking</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">{event?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition cursor-pointer"
                aria-label="Close booking modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Live seat warning inside modal */}
              {fillingFast && !isSoldOut && (
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Only {displayAvailableSeats} seat{displayAvailableSeats !== 1 ? "s" : ""} left — book now before they're gone!</span>
                </div>
              )}

              {/* Selected Tier Banner */}
              <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 block tracking-wider">Selected Tier</span>
                  <span className="text-sm font-extrabold text-indigo-950 dark:text-indigo-200">{selectedTier?.name || "Standard Pass"}</span>
                </div>
                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">₹{selectedTier?.price || event?.Price}</span>
              </div>

              {/* Interactive Seat Map */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Your Seats ({selectedSeats.length}/10 selected)
                  </label>
                  {selectedSeats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedSeats([])}
                      className="text-[11px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <SeatMap
                  capacity={event?.capacity || 100}
                  bookedSeats={bookedSeats}
                  heldSeats={heldSeats}
                  selectedSeats={selectedSeats}
                  onSeatToggle={setSelectedSeats}
                  maxSelectable={10}
                />
              </div>

              {/* Promo Code Input */}
              <div className="pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Promo / Coupon Code</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Try SPHERE20 or WELCOME10"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 w-full text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Use SPHERE20 for 20% instant discount</span>
              </div>

              {/* Wallet Cashback */}
              <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-indigo-950 dark:text-indigo-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={usePoints}
                    onChange={(e) => setUsePoints(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Apply Wallet Cashback Points</span>
                </label>
                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{user?.walletPoints || 0} pts</span>
              </div>

              {/* Price & Ticket Breakdown */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
                  <span className="flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Price Breakdown</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {selectedTier?.name || "Standard Pass"}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>
                    Base Tickets ({selectedSeats.length} &times; ₹{unitPrice})
                  </span>
                  <span className="font-semibold">₹{baseTotal}</span>
                </div>

                {couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>Coupon ({couponCode.toUpperCase().trim()})</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}

                {pointsDiscount > 0 && (
                  <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-semibold">
                    <span>Wallet Points Applied ({pointsDiscount} pts)</span>
                    <span>-₹{pointsDiscount}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>Total Payable</span>
                  <div className="text-right">
                    {totalDiscount > 0 && selectedSeats.length > 0 && (
                      <span className="text-xs text-slate-400 line-through mr-2 font-normal">
                        ₹{baseTotal}
                      </span>
                    )}
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      ₹{finalPayable}
                    </span>
                  </div>
                </div>

                {finalPayable === 0 && selectedSeats.length > 0 && (
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 rounded-xl text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold text-center">
                    🎉 100% covered by discounts! No payment gateway needed.
                  </div>
                )}
              </div>

              {/* Payment Gateway Selector (Only needed when amount > 0) */}
              {finalPayable > 0 ? (
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentGateway("stripe")}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        paymentGateway === "stripe"
                          ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20 shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        {paymentGateway === "stripe" && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-bold">Stripe / Global</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Apple Pay, Cards, Google Pay</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentGateway("razorpay")}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        paymentGateway === "razorpay"
                          ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20 shadow-xs"
                          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        {paymentGateway === "razorpay" && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-bold">Razorpay / UPI</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">UPI, PhonePe, GPay, NetBanking</div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Fixed Sticky Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                  {selectedSeats.length > 0
                    ? `${selectedSeats.length} ticket${selectedSeats.length > 1 ? "s" : ""} selected`
                    : "No seats selected"}
                </span>
                <div className="flex items-baseline gap-1.5">
                  {totalDiscount > 0 && selectedSeats.length > 0 && (
                    <span className="text-xs text-slate-400 line-through font-semibold">
                      ₹{baseTotal}
                    </span>
                  )}
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                    ₹{finalPayable}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBooking}
                  disabled={isBooking || isSoldOut || selectedSeats.length === 0}
                  className={`px-6 py-2.5 rounded-full text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer ${
                    isBooking || isSoldOut || selectedSeats.length === 0
                      ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none"
                  }`}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : finalPayable === 0 ? (
                    <span>Confirm Free Reservation</span>
                  ) : (
                    <span>Proceed to Pay</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Sandbox Test Gateway Modal */}
      {sandboxOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Sandbox Demo Gateway
              </span>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-1.5">
                {sandboxOrder.gateway === "razorpay" ? "Razorpay / UPI Sandbox" : "Stripe Test Checkout"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Payable Amount: <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{sandboxOrder.amountToPay}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-left text-xs space-y-1 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span>Event:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">{event?.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Seats:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{sandboxOrder.selectedSeats.join(", ")}</span>
              </div>
              <div className="flex justify-between">
                <span>Tier:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">{sandboxOrder.selectedTier}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleConfirmSandboxPayment}
                disabled={isBooking}
                className="w-full py-2.5 rounded-full text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 dark:shadow-none transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Simulate Successful Payment</span>
              </button>
              <button
                type="button"
                onClick={() => setSandboxOrder(null)}
                disabled={isBooking}
                className="w-full py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Box */}
      <div className="fixed bottom-4 right-4 z-50">
        <Suspense fallback={null}>
          <ChatBox eventId={id} />
        </Suspense>
      </div>
    </div>
  );
}

export default DetailEvent;
