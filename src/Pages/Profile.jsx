import React, { useEffect, useState } from "react";
import {
  getUserProfile,
  updateUserProfile,
  resetPassword,
} from "../services/authservices/authapi";
import { cancelBooking, getMyBookings } from "../services/bookingservices/bookingapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User, Mail, Wallet, Calendar, Lock, Pencil, X } from "lucide-react";
import { IconTicket } from "@tabler/icons-react";

function Profile() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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
        setEditName(profile?.name);
        setEditEmail(profile?.email);
        
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

  const handleCancleBooking = async(bookingId)=>{
    try {
         await cancelBooking(bookingId)
       toast.success("Booking cancelled successfully")
      // // Refresh bookings
      const myBookings = await getMyBookings();
      setBookings(myBookings?.data || []);
      window.location.reload();

      
    } catch (error) {
      console.log(error);
      toast.error(error.message || "Failed to cancel booking");
    }
  }

  if (loading) return <div className="p-4 bg-gradient-to-r from-black via-blue-800 to-black mx-auto ">Loading...</div>;

  return (
    <div className="bg-gradient-to-r from-black via-blue-800 to-black mx-auto p-4 ">
    <div className="max-w-6xl text-slate-200 mx-auto bg-transparent  rounded-2xl p-8 my-10">
      <ToastContainer position="top-right" autoClose={6000} />

      {/* Profile Header */}
      <div className="flex items-center gap-4 border-b pb-4 mb-6">
        <div className="bg-blue-500 p-4 rounded-full text-white">
          <User size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{(user?.name).toUpperCase()}</h2>
          <p className="text-gray-600">{user?.email}</p>
        </div>
      </div>

      {/* User Info */}
      <div className="space-y-3 mb-6">
        <p className="flex items-center gap-2">
          <Mail className="text-blue-500" size={20} /> {user?.email}
        </p>
        <p className="flex items-center gap-2">
          <User className="text-yellow-500" size={20} /> {user?.role === "attendee" ? "Event Explorer" : "Event Organizer"}
        </p>
        <p className="flex items-center gap-2">
          <Wallet className="text-green-600" size={20} /> Wallet Points:{" "}
          {user?.walletPoints || 0}
        </p>
        <p className="flex items-center gap-2">
          <Calendar className="text-purple-500" size={20} /> Joined:{" "}
          {new Date(user?.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mb-10">
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          <Pencil size={18} /> Edit Profile
        </button>
        <button
          onClick={() => setIsChangingPassword(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg"
        >
          <Lock size={18} /> Change Password
        </button>
      </div>

      {/* My Bookings Section */}
      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <IconTicket size={22} className="text-orange-500" /> My Bookings
      </h3>

      {bookings.length === 0 ? (
        <p className="text-gray-500">No bookings found.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
  {bookings.map((booking) => {
  if (!booking.event) return null; // skip deleted events

  return (
    <div
      key={booking._id}
      className="bg-black/50 shadow rounded-lg p-4 border hover:shadow-md transition"
    >
      <h4 className="font-bold text-lg">
        {booking.event?.title}
      </h4>
      <p className="text-gray-400">🆔 {booking._id}</p>
      <p className="text-gray-400">👥 {booking.seatsBooked} Seats</p>
      <p className="text-gray-400">🏷️ ₹{booking.amountPaid}</p>
      <p className="text-gray-400">
        📍 {booking.event?.location}
      </p>
      <p className="text-gray-400">
        📅 {new Date(booking.event?.date).toLocaleDateString()}
      </p>
      <p className="text-gray-400">
        ⏰ {new Date(booking.event?.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toUpperCase()}
      </p>

      <div className="flex justify-end mt-3">
        <button
          onClick={() => handleCancleBooking(booking._id)}
          disabled={!(new Date(booking.event?.date) > new Date()) || booking.paymentstatus === "cancelled"}
          className={`${
            !(new Date(booking.event?.date) > new Date()) || booking.paymentstatus === "cancelled"
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          } text-white py-2 px-4 rounded-md transition duration-300`}
        >
          {booking.paymentstatus === "cancelled" ? "Cancelled" : "Cancel Booking"}
        </button>
      </div>
    </div>
  );
})}

        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-10">
          <div className="bg-green-300 text-black p-6 rounded-xl shadow-md w-96">
            <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email"
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="text"
              value={user?.role === "attendee" ? "Event Explorer" : "Event Organizer"}
              disabled
              className="w-full mb-3 p-2 border rounded  cursor-not-allowed"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-2 bg-gray-300 rounded flex items-center gap-1"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="px-3 py-2 bg-blue-500 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-green-300 text-black p-6 rounded-xl shadow-md w-96">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Old Password"
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              className="w-full mb-3 p-2 border rounded"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsChangingPassword(false)}
                className="px-3 py-2 bg-gray-300 rounded flex items-center gap-1"
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={handleChangePassword}
                className="px-3 py-2 bg-green-600 text-white rounded"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default Profile;
