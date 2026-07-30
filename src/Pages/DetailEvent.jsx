import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteEventbyAdmin, getEventById } from "../services/eventservices/eventapi";
import { Calendar, Clock, MapIcon, User2Icon } from "lucide-react";
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
  const[BookingAvailable,setBookingAvailable]=useState(false)
  const[seats,setSeats]=useState(1);
  const[usePoints,setUsePoints]=useState(false); 
  const user = useSelector((state) => state.auth.user);
  const [open,setOpen]=useState(false);
  const navigate = useNavigate();
  const [AvailableSeats,setAvailableSeats]=useState(0);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await getEventById(id);
         setEvent(response.data);
        // console.log(response.data.attendees.length);
        const totalFilledSeats = response.data.attendees.reduce(
          (acc, attendee) => acc + (attendee.ticketsBooked || 1),
          0
        );
        setAvailableSeats(response.data.capacity - totalFilledSeats);
        //  console.log("Total Filled Seats:", totalFilledSeats);
        //  console.log("Available Seats:", response.data.capacity - totalFilledSeats);
       
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
      const orderResponse = await createOrder(id, { seatsBooked: seats, usePoints });
      console.log("Order Response", orderResponse);

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

      // Check for Stripe Checkout Session URL
      if (orderResponse.data?.checkoutUrl) {
        window.location.href = orderResponse.data.checkoutUrl;
        return;
      }

      // Fallback for dev mode / mock Stripe Session
      const verifyResponse = await verifyPayment({
        stripe_session_id: orderResponse.data.stripeSessionId || orderResponse.data.orderId,
        eventId: id,
        seatsBooked: seats,
        discount: orderResponse.data.discount || 0,
      });
      console.log("Stripe Payment Verified", verifyResponse);
      toast.success("Stripe Payment Successful & Booking Confirmed!");
      setOpen(false);
      navigate("/profile");
    } catch (error) {
      console.log("Booking Error", error);
      toast.error(error.message || "Booking failed");
    }
  };

  const handleDelete = async()=>{
    try {
       await deleteEventbyAdmin(id);
        navigate("/");
    } catch (error) {
      console.log(error);
      toast.error(error.message || "Failed to delete event");
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gradient-to-r from-black via-blue-800 to-black ">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center mt-10  bg-gradient-to-r from-black via-blue-800 to-black">{error}</div>;
  }

return (
  <div className="bg-gradient-to-r from-black via-blue-800 to-black min-h-screen p-8">
    <ToastContainer position="top-right" autoClose={4000} />

    <div className="max-w-6xl mx-auto space-y-10">
      {/* Event Card */}
      <div className="p-6 bg-transparent text-slate-200 shadow-lg border-2 border-slate-200 rounded-2xl">
        {/* Banner Image */}
        <div className="w-full h-64 mb-6">
          <img
            src={event?.image || "https://via.placeholder.com/800x400"}
            alt={event?.title}
            className=" h-full object-cover rounded-2xl border-2 border-slate-200 p-2"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-4 text-slate-200">
          {event?.title}
        </h1>

        {/* Event Info */}
        <div className="flex flex-wrap gap-6 mb-6 text-slate-200">
          <div className="flex items-center gap-2">
            <Calendar className="text-indigo-600" />
            <span>{new Date(event?.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="text-indigo-600" />
            <span>
              {new Date(event?.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC'  }).toUpperCase()}
            </span>
          </div>
          <a
            href={`${event?.locationGoogleMapLink}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="flex items-center gap-2">
              <MapIcon className="text-red-500" />
              <span>{event?.location}</span>
            </div>
          </a>
          <div className="flex items-center gap-2">
            <User2Icon className="text-green-600" />
            <span>{event?.capacity} Seats</span>
          </div>
        </div>

        {/* Description */}
        <span className="text-xl font-semibold mb-2 text-slate-200">
          About the Event
        </span>
        <p className="text-slate-500 leading-relaxed mb-6">
          {event?.description}
        </p>

        {/* Price & Booking */}
        <div className="flex justify-between items-center mt-6">
          <span className="text-2xl font-semibold text-blue-500">
            ₹{event?.Price}
          </span>
          {
            user?.role==="admin" && event?.activeStatus ==="cancelled" && (
                             <button
              onClick={handleDelete}
              className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition duration-300"
            >
              Delete Event
            </button>
            )}

          
          {BookingAvailable ? (
            <button
              onClick={() => {
                if(!user){
                  navigate("/login")
                }
                else {
                  setOpen(true);
                };
              }}
              className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition duration-300"
            >
              Book Now
            </button>
          ) : (
            <button
              disabled
              className="bg-gray-400 text-white py-2 px-4 rounded-md cursor-not-allowed"
            >
              Booking Not Available
            </button>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      {(event.status === "completed" || event.status === "ongoing" || event.status === "past") && (
        <div className="lg:p-6  max-w-full shadow-lg rounded-2xl">
          <h2 className="text-2xl  font-bold text-yellow-300 mb-4">
            Reviews
          </h2>
        { user != null &&
            <ReviewForm eventId={id} onSuccess={() => {}} />
        }
        
          <div className="mt-6 overflow-y-auto space-y-3 pt-2">
            <ReviewCard eventId={id} />
          </div>
        </div>
      )}
    </div>

    {/* Booking Modal */}
    {open && (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
          <h2 className="text-xl font-bold mb-4">Book Tickets</h2>
          {/* Seats input */}
          <label className="block mb-2 text-slate-700 font-medium">
            Number of Tickets
          </label>
          <input
            type="number"
            min="1"
            max={AvailableSeats}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-full mb-4"
          />
          {/* Wallet Points */}
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="mr-2"
            />
            <span className="text-slate-700">Use Wallet Points</span>
          </div>
          <span className="text-green-600 ml-[18px]">
            Available Points: {user?.walletPoints}{" "}
          </span>
          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-400 text-slate-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleBooking}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Chat Box */}
    <div className="fixed bg-amber-200 bottom-4 right-4 z-50">
      <ChatBox eventId={id} />
    </div>
    
  </div>
);
}

export default DetailEvent;
