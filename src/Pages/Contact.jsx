import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { getInTouch } from "../services/contactservices/contactapi";
import { 
  Mail, 
  User, 
  MessageSquare, 
  Upload, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  HelpCircle,
  Loader2 
} from "lucide-react";
import { IconSend } from "@tabler/icons-react";

const ContactForm = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm();

  const [serverError, setServerError] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const selectedImage = watch("image");

  const onSubmit = async (data) => {
    try {
      setServerError("");
      setServerMessage("");
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email);
      formData.append("subject", data.subject);
      formData.append("message", data.message);
      if (data.image && data.image[0]) {
        formData.append("image", data.image[0]);
      }

      const response = await getInTouch(formData);
      setServerMessage(response.message || "Your message has been sent successfully! Our team will reach out soon.");
      reset();
    } catch (error) {
      setServerError(error.message || "Failed to send message. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>We're Here to Help</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Get in Touch With Us
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Have questions about event bookings, hosting, or payments? Drop us a note anytime.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          {/* Left Side: Info Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                Contact Information
              </h2>
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <div className="text-slate-400 text-xs font-medium">Customer Support</div>
                  <div className="text-white font-semibold mt-0.5">support@eventsphere.com</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs font-medium">Organizer Partnerships</div>
                  <div className="text-white font-semibold mt-0.5">partners@eventsphere.com</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs font-medium">Headquarters</div>
                  <div className="text-white font-semibold mt-0.5">Bengaluru, Karnataka, India</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-2xl shadow-xl">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                Response Guarantee
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our support team is active 7 days a week. Normal tickets receive an answer in under 
                <span className="text-emerald-400 font-semibold"> 2 hours</span>.
              </p>
            </div>

            <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-500/20 p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
                <HelpCircle className="w-4 h-4" />
                <span>Quick Tip</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mt-1">
                For live event queries or venue seating, each event also features a real-time community chat on the event details page!
              </p>
            </div>
          </div>

          {/* Right Side: Contact Form */}
          <div className="lg:col-span-3 bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-7 sm:p-9 rounded-3xl shadow-2xl">
            {serverMessage && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{serverMessage}</span>
              </div>
            )}

            {serverError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      {...register("name", { required: "Name is required" })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border ${
                        errors.name ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                      } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-rose-400 text-xs mt-1 font-medium">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                          message: "Please enter a valid email",
                        },
                      })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border ${
                        errors.email ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                      } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-rose-400 text-xs mt-1 font-medium">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Subject
                </label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Booking assistance, ticket issue, etc."
                    {...register("subject", { required: "Subject is required" })}
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border ${
                      errors.subject ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                    } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                  />
                </div>
                {errors.subject && (
                  <p className="text-rose-400 text-xs mt-1 font-medium">{errors.subject.message}</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Message
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    placeholder="Provide details about your query or booking reference..."
                    {...register("message", { required: "Message is required" })}
                    className={`w-full p-3.5 bg-slate-800/70 border ${
                      errors.message ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                    } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150 resize-none`}
                  />
                </div>
                {errors.message && (
                  <p className="text-rose-400 text-xs mt-1 font-medium">{errors.message.message}</p>
                )}
              </div>

              {/* Optional Screenshot / Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Attach Screenshot or Image (Optional)
                </label>
                <label className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700 border-dashed rounded-xl cursor-pointer transition">
                  <Upload className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div className="text-xs text-slate-400 truncate flex-1">
                    {selectedImage && selectedImage[0]
                      ? selectedImage[0].name
                      : "Choose file (PNG, JPG, max 5MB)"}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    {...register("image")}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transform active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Message...</span>
                  </>
                ) : (
                  <>
                    <IconSend className="w-4 h-4" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactForm;
