import API from "../../config/axios";

// Create Razorpay Order
export const createOrder = async (eventId, data) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }    
    const res = await API.post(`/api/v1/bookings/create-order/${eventId}`, data);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Verify Payment and Create Booking
export const verifyPayment = async (data) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const res = await API.post(`/api/v1/bookings/verify-payment`, data);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get Logged-in User’s Bookings
export const getMyBookings = async () => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const res = await API.get(`/api/v1/bookings/my-bookings`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Cancel a Booking
export const cancelBooking = async (bookingId) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const res = await API.delete(`/api/v1/bookings/cancel-booking/${bookingId}`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get All Bookings (Admin)
export const fetchAllBookingsbyAdmin = async () => {
  try {
    const res = await API.get(`/api/v1/bookings/admin/all-bookings`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get Bookings for Specific Event (Admin/Organizer)
export const fetchEventBookingsbyOrganizer = async (eventId) => {
  try {
    const res = await API.get(`/api/v1/bookings/organizer/event-bookings/${eventId}`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const fetchEventBookingsbyAdmin = async (eventId) => {
  try {
    const res = await API.get(`/api/v1/bookings/admin/event-bookings/${eventId}`);
    return res.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
}



