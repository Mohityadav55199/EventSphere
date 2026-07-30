import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { getInTouch } from "../services/contactservices/contactapi";
import { Mail, User, MessageSquare, Upload, ImageIcon } from "lucide-react";
import { IconSend } from "@tabler/icons-react";

const ContactForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm();

  const [serverError, setServerError] = useState("");
  const [serverMessage, setServerMessage] = useState("");

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
      setServerMessage(response.message || "Submitted successfully ✅");
      reset();
    } catch (error) {
      setServerError(error.message || "Something went wrong ❌");
    }
  };

  return (
    <div className="w-full p-6 bg-gradient-to-r from-black via-blue-800 to-black shadow-lg">

    
    <div className="max-w-lg mx-auto p-6 bg-transparent text-slate-200  to-blue-400 shadow-lg rounded-2xl border">
      <h2 className="text-2xl p-6 my-6 font-semibold mb-4 text-slate-200 flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-blue-500" />
        Get in Touch
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Name
          </label>
          <div className="flex mt-2 items-center border rounded-lg px-3 py-2">
            <User className="text-gray-400 w-5 h-5 mr-2" />
            <input
              type="text"
              placeholder="Your name"
              {...register("name", { required: "Name is required" })}
              className="w-full outline-none"
            />
          </div>
          {errors.name && (
            <p className="text-red-500 text-xs">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Email
          </label>
          <div className="flex  mt-2 items-center border rounded-lg px-3 py-2">
            <Mail className="text-gray-400 w-5 h-5 mr-2" />
            <input
              type="email"
              placeholder="Your email"
              {...register("email", {
                required: "Email is required",
                // pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" },
              })}
              className="w-full outline-none"
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-xs">{errors.email.message}</p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Subject
          </label>
          <div className="flex  mt-2 items-center border rounded-lg px-3 py-2">
            <MessageSquare className="text-gray-400 w-5 h-5 mr-2" />
            <input
              type="text"
              placeholder="Subject"
              {...register("subject", { required: "Subject is required" })}
              className="w-full outline-none"
            />
          </div>
          {errors.subject && (
            <p className="text-red-500 text-xs">{errors.subject.message}</p>
          )}
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Message
          </label>
          <textarea
            placeholder="Write your message..."
            {...register("message", { required: "Message is required" })}
            className="w-full border  mt-2 rounded-lg px-3 py-2 outline-none resize-none h-24"
          />
          {errors.message && (
            <p className="text-red-500 text-xs">{errors.message.message}</p>
          )}
        </div>

        {/* Optional Image Upload */}
        <div>
          <label className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-gray-400" /> Upload Image (optional)
          </label>
          <div className="flex  mt-2 items-center border rounded-lg px-3 py-2">
            <Upload className="text-gray-400 w-5 h-5 mr-2" />
            <input
              type="file"
              accept="image/*"
              {...register("image")}
              className="w-full text-sm text-gray-600"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          <IconSend size={18} />
          {isSubmitting ? "Submitting..." : "Send Message"}
        </button>
      </form>

      {/* Messages */}
      {serverError && (
        <p className="mt-3 text-red-500 text-sm text-center">{serverError}</p>
      )}
      {serverMessage && (
        <p className="mt-3 text-green-600 text-sm text-center">{serverMessage}</p>
      )}
    </div>
    </div>
  );
};

export default ContactForm;
