import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Mail,
  Send,
  ShieldCheck,
  CreditCard,
  Ticket,
  MapPin,
  Phone,
  Github,
  Twitter,
  Linkedin,
  Instagram,
  Heart,
  CheckCircle2,
  Lock
} from "lucide-react";

export default function Footer() {
  const [emailInput, setEmailInput] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) return;
    setSubscribed(true);
    setEmailInput("");
    setTimeout(() => setSubscribed(false), 5000);
  };

  return (
    <footer className="w-full bg-slate-950 text-slate-300 border-t border-slate-800/80 relative overflow-hidden pt-14 pb-8">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Top Newsletter & Hook Bar */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-3xl p-6 sm:p-8 backdrop-blur-md flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1.5 text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stay Ahead of the Scene</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Get Curated Events & VIP Early-Bird Passes
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Join 50,000+ experience enthusiasts. Zero spam, just headline festival alerts and member discounts.
            </p>
          </div>

          {/* Newsletter Input */}
          <div className="w-full lg:w-auto lg:min-w-[380px]">
            {subscribed ? (
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>You're subscribed! Watch your inbox for weekend drops.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter your email address..."
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Subscribe</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Main 4-Column Footer Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          
          {/* Column 1: Brand Info & Status */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <Ticket className="w-4 h-4" />
              </span>
              <span className="text-xl font-black text-white tracking-tight">
                Event<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Sphere</span>
              </span>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed">
              The premier platform for discovering live experiences, cryptographic QR gate check-ins, automated seat allocation, and community chat hubs.
            </p>

            {/* Live Service Status */}
            <div className="pt-2">
              <a
                href="https://eventsphere-backend-nhzy.onrender.com/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300 hover:border-slate-700 transition"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>All Systems Operational (99.9% Uptime)</span>
              </a>
            </div>
          </div>

          {/* Column 2: Discover Experiences */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explore Categories</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/events" className="text-slate-400 hover:text-indigo-400 transition flex items-center justify-between group">
                  <span>Browse All Events</span>
                  <span className="text-slate-600 group-hover:text-indigo-400 transition">→</span>
                </Link>
              </li>
              <li>
                <Link to="/events" className="text-slate-400 hover:text-indigo-400 transition">Music Festivals & Concerts</Link>
              </li>
              <li>
                <Link to="/events" className="text-slate-400 hover:text-indigo-400 transition">Tech Summits & AI Workshops</Link>
              </li>
              <li>
                <Link to="/events" className="text-slate-400 hover:text-indigo-400 transition">Cinema & Movie Premieres</Link>
              </li>
              <li>
                <Link to="/events" className="text-slate-400 hover:text-indigo-400 transition">Sports & Tournaments</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Links & Organizers */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-purple-400" />
              <span>For Organizers</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/dashboard" className="text-slate-400 hover:text-purple-400 transition">Organizer Dashboard</Link>
              </li>
              <li>
                <Link to="/add-event" className="text-slate-400 hover:text-purple-400 transition">Publish a New Event</Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-400 hover:text-purple-400 transition">Live QR Gate Scanner</Link>
              </li>
              <li>
                <Link to="/about" className="text-slate-400 hover:text-purple-400 transition">About EventSphere</Link>
              </li>
              <li>
                <Link to="/contact" className="text-slate-400 hover:text-purple-400 transition">Support & Feedback</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contact & Security</span>
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <a href="mailto:support@eventsphere.com" className="hover:text-white transition">
                  support@eventsphere.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>+91 (800) 456-7890 (24/7 Desk)</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                <span>Tech Park, Bangalore & NCR, India</span>
              </li>
            </ul>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>256-Bit SSL Payment Protection</span>
            </div>
          </div>

        </div>

        {/* Security & Gateways Trust Strip */}
        <div className="pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Supported Gateways:</span>
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stripe (Apple Pay & GPay)</span>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Razorpay (UPI, NetBanking)</span>
            </span>
            <span className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
              <Ticket className="w-3.5 h-3.5 text-purple-400" />
              <span>HMAC Anti-Counterfeit Passes</span>
            </span>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Mohityadav55199/EventSphere"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white flex items-center justify-center transition"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white flex items-center justify-center transition"
              aria-label="Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white flex items-center justify-center transition"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500 hover:text-white flex items-center justify-center transition"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom Copyright & Legal Strip */}
        <div className="pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="flex items-center gap-1">
            © {new Date().getFullYear()} EventSphere Inc. Built with
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            for live experiences.
          </p>

          <div className="flex items-center gap-5 text-slate-400">
            <Link to="/about" className="hover:text-white transition">Privacy Policy</Link>
            <Link to="/about" className="hover:text-white transition">Terms of Service</Link>
            <Link to="/contact" className="hover:text-white transition">Security</Link>
            <Link to="/contact" className="hover:text-white transition">Help Center</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
