import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { createEvent } from "../services/eventservices/eventapi";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, Link } from "react-router-dom";
import {
  Calendar,
  MapPin,
  UploadCloud,
  Users,
  IndianRupee,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Tag,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

const CATEGORIES = [
  "Music",
  "Workshop",
  "Tech",
  "Sports",
  "Conference",
  "Movie",
  "Arts & Culture",
  "Food & Drinks",
  "Other",
];

function AddEvent() {
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      category: "Music",
      Price: "",
      capacity: "",
    },
  });

  const descriptionValue = watch("description", "") || "";
  const navigate = useNavigate();

  // Handle local image file selection and thumbnail preview
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image file size should be less than 5MB");
        return;
      }
      setSelectedFileName(file.name);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    } else {
      setSelectedFileName("");
      setImagePreview(null);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setSelectedFileName("");
    setValue("image", null);
  };

  const onSubmit = async (data) => {
    try {
      const formData = new FormData();
      for (const key in data) {
        if (key !== "image") {
          formData.append(key, data[key]);
        }
      }
      if (data.image && data.image[0]) {
        formData.append("image", data.image[0]);
      } else {
        toast.error("Event poster image is required");
        return;
      }

      toast.info("Uploading poster and publishing event...");
      const res = await createEvent(formData);
      toast.success("Event created successfully! 🎉");
      reset();
      setImagePreview(null);
      setSelectedFileName("");
      navigate("/events");
    } catch (err) {
      toast.error(err.message || "Failed to create event. Please check inputs.");
    }
  };

  // Get current date string for min datetime attribute
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors">
      <ToastContainer position="top-right" autoClose={4000} />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top Breadcrumb & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 self-start">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Organizer Studio</span>
          </div>
        </div>

        {/* Header Title Banner */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Create New Event
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Publish your event, set up seat allocations and ticket pricing, and start selling passes to attendees across EventSphere.
          </p>
        </div>

        {/* Main Form Card */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-8"
        >
          {/* Section 1: Basic Information */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                General Details
              </h2>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Event Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Neon Horizon EDM Music Festival 2026"
                {...register("title", {
                  required: "Event title is required",
                  minLength: { value: 3, message: "Title must be at least 3 characters" },
                })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {errors.title && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.title.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  {...register("category", { required: "Please select a category" })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.category.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Event Description <span className="text-red-500">*</span>
                </label>
                <span className={`text-[11px] font-semibold ${descriptionValue.length > 280 ? "text-amber-500" : "text-slate-400"}`}>
                  {descriptionValue.length} / 300
                </span>
              </div>
              <textarea
                rows="4"
                maxLength={300}
                placeholder="Give attendees a compelling summary of what to expect, artists performing, highlights, and guidelines..."
                {...register("description", {
                  required: "Description is required",
                  maxLength: {
                    value: 300,
                    message: "Maximum 300 characters allowed",
                  },
                })}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
              ></textarea>
              {errors.description && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.description.message}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Date, Time & Venue */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Date & Location
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date & Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    min={minDateTime}
                    {...register("date", { required: "Date and time are required" })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition"
                  />
                </div>
                {errors.date && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.date.message}
                  </p>
                )}
              </div>

              {/* Venue */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Venue / City <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Jio World Convention Centre, Mumbai"
                    {...register("location", { required: "Venue location is required" })}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                {errors.location && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.location.message}
                  </p>
                )}
              </div>
            </div>

            {/* Venue Location Google Map Link */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Google Maps Venue Link <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://maps.app.goo.gl/... or https://google.com/maps/..."
                  {...register("locationGoogleMapLink", {
                    required: "Google Maps URL is required",
                    pattern: {
                      value: /^(https?:\/\/)?(www\.)?(google\.com\/maps|maps\.app\.goo\.gl)\/.+$/,
                      message: "Please enter a valid Google Maps location link",
                    },
                  })}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Attendees will use this link to navigate directly to your venue via Google Maps.
              </p>
              {errors.locationGoogleMapLink && (
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.locationGoogleMapLink.message}
                </p>
              )}
            </div>
          </div>

          {/* Section 3: Tickets & Seating Capacity */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <IndianRupee className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Ticketing & Capacity
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ticket Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <span className="font-bold text-sm">₹</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 499 (0 for free)"
                    {...register("Price", {
                      required: "Ticket price is required",
                      min: { value: 0, message: "Price cannot be negative" },
                    })}
                    className="w-full pl-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                {errors.Price && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.Price.message}
                  </p>
                )}
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Total Seat Capacity <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 250"
                    {...register("capacity", {
                      required: "Capacity is required",
                      min: { value: 1, message: "Capacity must be at least 1" },
                    })}
                    className="w-full pl-9 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                {errors.capacity && (
                  <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.capacity.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Event Poster Banner */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Event Poster
              </h2>
            </div>

            {imagePreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-2 flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Event Poster Preview"
                  className="w-full sm:w-48 h-32 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <div className="flex-1 space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Image Selected</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-xs">
                    {selectedFileName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    This banner will appear on event cards, tickets, and checkout pages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition cursor-pointer"
                  title="Remove image"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <label className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50/60 dark:bg-slate-800/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition group">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-center mt-3 space-y-1">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Click to upload event banner
                  </span>
                  <p className="text-[11px] text-slate-400">
                    High resolution JPG, PNG, or WEBP (Max 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  {...register("image", {
                    required: "Event poster image is required",
                    onChange: handleImageChange,
                  })}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            )}

            {errors.image && (
              <p className="text-red-500 text-xs flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.image.message}
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/events")}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 rounded-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing Event...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Publish Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEvent;
