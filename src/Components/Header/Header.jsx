import { Link, NavLink, useLocation } from "react-router-dom";
import { LogoutBtn } from "./LogoutBtn";
import { useSelector } from "react-redux";
import { Wallet, Menu, X, Search, Sparkles } from "lucide-react";
import { IconUser } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { useSearch } from "../../Context/SearchContext";
import { getAllEvents } from "../../services/eventservices/eventapi";
import SearchEvents from "./SearchEvents";
import ThemeToggle from "../ThemeToggle";

export default function Header() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const isLoggedIn = Boolean(accessToken);
  const isAuthorised = user?.role === "admin" || user?.role === "organizer";
  const { searchQuery, setSearchQuery, setFilteredEvents } = useSearch();
  const location = useLocation();

  const [events, setEvents] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await getAllEvents();
        setEvents(response.data || []);
      } catch (error) {
        console.log(error);
      }
    };
    fetchEvents();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setMenuOpen(false);
    setSearchQuery(value);

    if (value.trim() === "") {
      setFilteredEvents([]);
      return;
    }

    const filtered = events.filter(
      (event) =>
        event.title.toLowerCase().includes(value) ||
        event.description.toLowerCase().includes(value) ||
        (event.category && event.category.toLowerCase().includes(value)) ||
        event.location.toLowerCase().includes(value)
    );
    setFilteredEvents(filtered);
  };

  useEffect(() => {
    setSearchQuery("");
    setFilteredEvents([]);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none">
            <Sparkles className="w-5 h-5 fill-white" />
          </div>
          <span>Event<span className="text-indigo-600 dark:text-indigo-400">Sphere</span></span>
        </Link>

        {/* Search Bar Container with Live Autocomplete Dropdown */}
        <div className="relative flex-1 max-w-lg hidden sm:block mx-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search events, categories, locations..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-full border border-slate-200/80 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all outline-none"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
          <SearchEvents />
        </div>

        {/* Right Section / Auth Controls */}
        <div className="hidden md:flex items-center space-x-3 shrink-0">
          <ThemeToggle />
          {!isLoggedIn ? (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-full transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-md shadow-indigo-200 dark:shadow-none transition"
              >
                Join Now
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold">
                <Wallet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{user?.walletPoints ?? 0} pts</span>
              </div>
              <Link to="/profile" className="p-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Profile">
                <IconUser className="w-6 h-6" />
              </Link>
              <LogoutBtn />
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            className="p-2 text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-lg"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Navigation Bar (Desktop) */}
      <div className="hidden md:block border-t border-slate-100/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <nav className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
          <div className="flex items-center space-x-6">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `py-1 transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600" : "hover:text-indigo-600"}`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `py-1 transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600" : "hover:text-indigo-600"}`
              }
            >
              Events
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `py-1 transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600" : "hover:text-indigo-600"}`
              }
            >
              Contact Us
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `py-1 transition-colors ${isActive ? "text-indigo-600 dark:text-indigo-400 font-bold border-b-2 border-indigo-600" : "hover:text-indigo-600"}`
              }
            >
              About
            </NavLink>
          </div>

          {isAuthorised && (
            <div className="flex items-center space-x-4">
              <NavLink
                to="/create-event"
                className={({ isActive }) =>
                  `px-3 py-1 rounded-full text-xs font-semibold ${isActive ? "bg-emerald-100 text-emerald-700" : "text-emerald-600 hover:bg-emerald-50"}`
                }
              >
                + Add Event
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-3 py-1 rounded-full text-xs font-semibold ${isActive ? "bg-indigo-100 text-indigo-700" : "text-indigo-600 hover:bg-indigo-50"}`
                }
              >
                Dashboard
              </NavLink>
            </div>
          )}
        </nav>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 space-y-4 shadow-xl">
          <div className="relative mb-3">
            <Search className="absolute left-3 w-4 h-4 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-full outline-none"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
          <SearchEvents />

          <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <NavLink to="/" className="py-2 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Home</NavLink>
            <NavLink to="/events" className="py-2 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Events</NavLink>
            <NavLink to="/contact" className="py-2 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Contact Us</NavLink>
            <NavLink to="/about" className="py-2 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>About</NavLink>

            {isAuthorised && (
              <>
                <NavLink to="/create-event" className="py-2 text-emerald-600 font-semibold" onClick={() => setMenuOpen(false)}>+ Add Event</NavLink>
                <NavLink to="/dashboard" className="py-2 text-indigo-600 font-semibold" onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
              </>
            )}
          </nav>

          {!isLoggedIn ? (
            <div className="pt-2 flex flex-col gap-2">
              <Link to="/login" className="w-full text-center py-2 border border-slate-300 dark:border-slate-700 rounded-full font-semibold text-slate-700 dark:text-slate-200" onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/signup" className="w-full text-center py-2 bg-indigo-600 text-white rounded-full font-semibold shadow" onClick={() => setMenuOpen(false)}>Join Now</Link>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link to="/profile" className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium text-sm" onClick={() => setMenuOpen(false)}>
                <IconUser className="w-5 h-5 text-indigo-600" />
                <span>Profile</span>
              </Link>
              <LogoutBtn onClick={() => setMenuOpen(false)} />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
