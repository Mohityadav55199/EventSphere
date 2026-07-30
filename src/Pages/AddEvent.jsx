import React from "react";
import { useForm } from "react-hook-form";
import { createEvent } from "../services/eventservices/eventapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";


function AddEvent() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

   const descriptionValue = watch("description", ""); // Watch description field for character count
  const navigate = useNavigate()
  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      for (let key in data) {
        formData.append(key, data[key]);
      }
      if (data.image && data.image[0]) {
        formData.append("image", data.image[0]);
      }
      console.log("Submitting Event:", data);
      const res = await createEvent(formData);
      console.log("Event Created:", res);
      toast.success("Event created successfully!");
      reset();
      navigate('/events')
    } catch (err) {
      toast.error(err.message || "Failed to create event");
    }
  };

return (
  <div className="min-h-screen py-8 px-6 sm:px-8 md:px-16 lg:px-24 xl:px-36 bg-gradient-to-r from-black via-blue-800 to-black text-slate-200 shadow-lg">
    <ToastContainer position="top-right" autoClose={6000} />
    <h2 className="text-xl sm:text-2xl font-bold mb-6 text-yellow-300">Create Event</h2>

    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block mb-1 font-medium">Title</label>
        <input
          type="text"
          {...register("title", { required: "Title is required" })}
          className="w-full border rounded-lg p-2"
        />
        {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block mb-1 font-medium">Description</label>
        <textarea
          {...register("description", {
            required: "Description is required",
            maxLength: {
              value: 300,
              message: "Maximum 300 characters allowed",
            },
          })}
          className="w-full border rounded-lg p-2"
          rows="3"
          maxLength="300"
        ></textarea>

        {/* Character counter */}
        <span className="text-sm text-gray-500">{descriptionValue.length} / 300</span>

        {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
      </div>

      {/* Date */}
      <div>
        <label className="block mb-1 font-medium">Date & Time</label>
        <input
          type="datetime-local"
          {...register("date", { required: "Date is required" })}
          className="w-full border rounded-lg p-2"
        />
        {errors.date && <p className="text-red-500 text-sm">{errors.date.message}</p>}
      </div>

      {/* Location */}
      <div>
        <label className="block mb-1 font-medium">Venue</label>
        <input
          type="text"
          {...register("location", { required: "Location is required" })}
          className="w-full border rounded-lg p-2"
        />
        {errors.location && <p className="text-red-500 text-sm">{errors.location.message}</p>}
      </div>

      <div>
        <label className="block mb-1 font-medium">Venue Location (Google Map Link)</label>
        <input
          type="url"
          {...register("locationGoogleMapLink", {
            required: "Google Map link is required",
            pattern: {
              value: /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.app\.goo\.gl)\/.+$/,
              message: "Please enter a valid Google Maps link",
            },
          })}
          className="w-full border rounded-lg p-2"
        />
        {errors.locationGoogleMapLink && (
          <p className="text-red-500 text-sm">{errors.locationGoogleMapLink.message}</p>
        )}
      </div>

      {/* Price */}
      <div>
        <label className="block mb-1 font-medium">Price</label>
        <input
          type="number"
          {...register("Price", { required: "Price is required" })}
          className="w-full border rounded-lg p-2"
        />
        {errors.Price && <p className="text-red-500 text-sm">{errors.Price.message}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block mb-1 font-medium">Category</label>
        <select
          {...register("category", { required: "Category is required" })}
          className="w-full border rounded-lg p-2 bg-black text-white"
        >
          <option value="" >Select Category</option>
          <option value="Movie">Movie</option>
          <option value="Sports">Sports</option>
          <option value="Music">Music</option>
          <option value="Workshop">Workshop</option>
          <option value="Other">Other</option>
        </select>
        {errors.category && <p className="text-red-500 text-sm">{errors.category.message}</p>}
      </div>

      {/* Capacity */}
      <div>
        <label className="block mb-1 font-medium">Capacity</label>
        <input
          type="number"
          {...register("capacity", { required: "Capacity is required" })}
          className="w-full border rounded-lg p-2"
        />
        {errors.capacity && <p className="text-red-500 text-sm">{errors.capacity.message}</p>}
      </div>

      {/* Image Upload */}
      <div>
        <label className="block mb-1 font-medium">Event Poster</label>
        <input
          type="file"
          {...register("image", { required: "Event image is required" })}
          className="w-full border rounded-lg p-2"
          accept="image/*"
        />
        {errors.image && <p className="text-red-500 text-sm">{errors.image.message}</p>}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold p-2 rounded-lg transition"
      >
        {isSubmitting ? "Creating..." : "Create Event"}
      </button>
    </form>
  </div>
);

}

export default AddEvent;
