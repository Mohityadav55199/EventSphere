"use client";
import React from "react";
import { motion } from "framer-motion";
import { IconAnalyzeFilled, IconHeart, IconRouteAltLeft } from "@tabler/icons-react";
import { CreditCard, Star, TicketIcon, Wallet, ChartArea, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

export function HeroSectionOne() {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="relative mx-auto flex max-w-7xl flex-col items-center justify-center bg-slate-50 text-slate-900 py-16 sm:py-24 px-6 overflow-hidden">
      {/* Background Subtle Gradient Spheres */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-20 right-10 w-72 h-72 bg-purple-200/40 rounded-full blur-3xl pointer-events-none"></div>

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 fill-indigo-600" />
        <span>India's Premier Event Booking & Community Platform</span>
      </motion.div>

      {/* Hero Title */}
      <div className="px-4 py-2">
        <h1 className="relative z-10 mx-auto max-w-4xl text-center text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-tight">
          {"Book the Best Live Moments with Ease".split(" ").map((word, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.08,
                ease: "easeInOut",
              }}
              className="mr-2.5 inline-block"
            >
              {word === "Ease" ? <span className="text-indigo-600 underline decoration-indigo-300">{word}</span> : word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.7 }}
          className="relative z-10 mx-auto max-w-2xl py-6 text-center text-sm sm:text-base md:text-lg font-medium text-slate-600 leading-relaxed"
        >
          Plan your perfect outing in seconds — instant downloadable PDF tickets, live community event chat, automatic cashback points, and hassle-free payments in ₹.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.9 }}
          className="relative z-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link to="/events">
            <button className="px-8 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-xl shadow-indigo-200 transition-all duration-300 hover:-translate-y-0.5 text-sm sm:text-base">
              Explore All Events →
            </button>
          </Link>
          {!user && (
            <Link to="/signup">
              <button className="px-8 py-3.5 rounded-full border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 text-sm sm:text-base">
                Join Community
              </button>
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const features = [
    {
      title: "Built for Event Lovers",
      description: "Designed for organizers, attendees, and everyone who loves seamless event experiences",
      icon: <TicketIcon className="w-6 h-6 text-indigo-600" />,
    },
    {
      title: "Personalized Recommendations",
      description: "Discover concerts, workshops, and sports matches tailored to your interests",
      icon: <Star className="w-6 h-6 text-amber-500" />,
    },
    {
      title: "Hassle Free & Secure Payments",
      description: "Fast & instant checkout powered by Stripe & INR Rupee support",
      icon: <CreditCard className="w-6 h-6 text-emerald-600" />,
    },
    {
      title: "Wallet Points & Cashback",
      description: "Earn cashback in wallet points on every booking & redeem instantly",
      icon: <Wallet className="w-6 h-6 text-purple-600" />,
    },
    {
      title: "24/7 Dedicated Support",
      description: "We’re always here to help you enjoy stress-free ticket bookings",
      icon: <IconRouteAltLeft className="w-6 h-6 text-rose-500" />,
    },
    {
      title: "Organizer Revenue Analytics",
      description: "Track ticket sales, revenue charts, and attendee metrics in real-time",
      icon: <IconAnalyzeFilled className="w-6 h-6 text-indigo-600" />,
    },
    {
      title: "Real-time Event Chat",
      description: "Chat with fellow attendees, share updates, and network live",
      icon: <ChartArea className="w-6 h-6 text-cyan-600" />,
    },
    {
      title: "PDF Tickets & QR Scanner",
      description: "Download verified QR code PDF tickets instantly from your profile",
      icon: <IconHeart className="w-6 h-6 text-pink-500" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="p-6 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 space-y-3"
          >
            <div className="p-3 bg-slate-50 rounded-xl w-fit border border-slate-100">{feature.icon}</div>
            <h3 className="font-bold text-base text-slate-900">{feature.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
