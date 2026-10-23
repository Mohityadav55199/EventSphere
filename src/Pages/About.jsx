import React from "react";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  MessageSquare, 
  Headphones, 
  Star, 
  Wallet, 
  BarChart3, 
  Sparkles, 
  Ticket, 
  Users, 
  ArrowRight 
} from "lucide-react";
import { Link } from "react-router-dom";

export default function About() {
  const features = [
    {
      icon: ShieldCheck,
      color: "from-blue-500 to-indigo-600",
      title: "Secure Payments & Instant Holds",
      description:
        "Integrated with Stripe for bank-grade security. Our Redis-backed concurrency lock guarantees zero double-bookings with 10-minute automated seat reservations."
    },
    {
      icon: MessageSquare,
      color: "from-purple-500 to-pink-600",
      title: "Real-Time Event Chat Rooms",
      description:
        "Join event-specific live chat rooms powered by WebSockets. Connect with attendees, organizers, and fellow fans before, during, and after every show."
    },
    {
      icon: Headphones,
      color: "from-emerald-500 to-teal-600",
      title: "24/7 Dedicated Assistance",
      description:
        "Prompt assistance whenever you need it. From ticketing support to organizer onboarding, our customer success team is here round-the-clock."
    },
    {
      icon: Star,
      color: "from-amber-500 to-orange-600",
      title: "Verified Reviews & Ratings",
      description:
        "Genuine attendee feedback and star ratings ensure top-tier event quality. Discover crowd favorites and trending events across your city."
    },
    {
      icon: Wallet,
      color: "from-indigo-500 to-cyan-600",
      title: "Wallet Points & Cash Rewards",
      description:
        "Earn loyalty reward points on every single booking. Accumulate points in your EventSphere wallet and redeem them for free tickets and discounts."
    },
    {
      icon: BarChart3,
      color: "from-violet-500 to-purple-600",
      title: "Organizer Analytics & QR Check-In",
      description:
        "Powerful visual dashboards track real-time ticket sales, seat fills, and attendee analytics, with instant QR code scanning at the venue."
    }
  ];

  const stats = [
    { value: "50K+", label: "Happy Attendees" },
    { value: "1,200+", label: "Curated Live Events" },
    { value: "99.9%", label: "Uptime & Concurrency Lock" },
    { value: "4.9 ★", label: "Average Event Rating" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient glowing backdrop */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>The Modern Live Events Ecosystem</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Connecting People Through <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Unforgettable Experiences</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
            EventSphere was built to solve live ticketing bottlenecks. We combine BookMyShow-style 
            atomic seat selection, real-time WebSockets community rooms, and loyalty wallet rewards 
            into one cohesive, breathtaking platform.
          </p>
        </motion.div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 my-14"
        >
          {stats.map((stat, idx) => (
            <div 
              key={idx}
              className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl text-center shadow-lg"
            >
              <div className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">
                {stat.value}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Core Pillars / Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-xl hover:border-slate-700 transition duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mb-4 shadow-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Call to Action Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 bg-gradient-to-r from-indigo-950/60 via-slate-900/90 to-purple-950/60 border border-indigo-500/20 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden"
        >
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Ready to Dive In?
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-300">
              Join thousands of music lovers, techies, conference attendees, and artists. 
              Book your next ticket or publish your own event in minutes.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/events"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition duration-200"
              >
                <Ticket className="w-4 h-4" />
                <span>Explore Events</span>
              </Link>
              <Link
                to="/create-event"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition duration-200"
              >
                <Users className="w-4 h-4" />
                <span>Host an Event</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
