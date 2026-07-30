import { Link, NavLink, useLocation } from "react-router-dom";
import { LogoutBtn } from "./LogoutBtn";
import { useSelector } from "react-redux";
import {  Wallet } from "lucide-react";
import { IconUser } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { useSearch } from "../../Context/SearchContext";
import { getAllEvents } from "../../services/eventservices/eventapi";
import { Menu, X } from "lucide-react";

export default function Header() {
  const { accessToken, user } = useSelector((state) => state.auth);
  const isLoggedIn = Boolean(accessToken);
  const isAuthorised = user?.role === "admin" || user?.role === "organizer";
  const { searchQuery, setSearchQuery, setFilteredEvents } = useSearch();
  const location = useLocation()

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
        event.location.toLowerCase().includes(value)
    );
    setFilteredEvents(filtered);
  };
    useEffect(() => {
    setSearchQuery("");
    setFilteredEvents([]);
  }, [location.pathname]);

  return (
    <header className="w-full bg-gradient-to-r from-black via-blue-800 to-black shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex lg:items-center lg:justify-between justify-evenly">
        {/* Logo */}
        <Link to="/" className="text-white mt-2 lg:mt-0 lg:text-2xl text-lg font-bold tracking-wide">
          Event<span className="text-yellow-300">Sphere</span>
        </Link>

                {/* Desktop Search */}
        <div className=" md:flex  flex-grow md:ml-56">
          <input
            type="text"
            placeholder="Search events..."
            className="lg:w-full -mb-4 lg:mb-0 lg:mr-36 w-[90%] mx-3 lg:h-12 h-10 border-2 px-4 py-2 rounded-full focus:outline-none shadow text-slate-400"
            value={searchQuery}
            onChange={handleSearch}
          />
           </div>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden text-white  text-2xl"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={28} /> : <Menu size={30} className=" mx-4" />}
        </button>


       

        {/* Right Section (Desktop) */}
        <div className="hidden md:flex items-center space-x-6">
          {!isLoggedIn ? (
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="px-4 py-2 bg-white text-purple-700 rounded-full font-semibold shadow hover:bg-yellow-300 hover:text-black transition"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 bg-yellow-300 text-black rounded-full font-semibold shadow hover:bg-white hover:text-purple-700 transition"
              >
                Join Now
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2 px-4 py-2 hover:bg-white bg-white rounded-full shadow">
                <Wallet className="text-purple-700 text-xl font-semibold" />
                <span className="font-semibold text-black">
                  {user?.walletPoints ?? 0} pts
                </span>
              </div>
              <LogoutBtn />
              <Link to="/profile" className="flex items-center">
                <IconUser className="text-white text-3xl hover:text-yellow-300 transition" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex max-w-7xl mx-auto px-6 py-4 items-center space-x-8 text-white font-medium">
        <div className="flex items-center space-x-8">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `block py-2 duration-200 ${
                isActive ? "text-yellow-300" : "text-white"
              } hover:text-yellow-300`
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/events"
            className={({ isActive }) =>
              `block py-2 duration-200 ${
                isActive ? "text-yellow-300" : "text-white"
              } hover:text-yellow-300`
            }
          >
            Events
          </NavLink>
          <NavLink
            to="/contact"
            className={({ isActive }) =>
              `block py-2 duration-200 ${
                isActive ? "text-yellow-300" : "text-white"
              } hover:text-yellow-300`
            }
          >
            Contact Us
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `block py-2 duration-200 ${
                isActive ? "text-yellow-300" : "text-white"
              } hover:text-yellow-300`
            }
          >
            About
          </NavLink>
        </div>

        {isAuthorised && (
          <div className="ml-auto flex items-center space-x-6">
            <NavLink
              to="/create-event"
              className={({ isActive }) =>
                `block py-2 duration-200 ${
                  isActive ? "text-green-500" : "text-white"
                } hover:text-green-500`
              }
            >
              Add Event
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `block py-2 duration-200 ${
                  isActive ? "text-green-500" : "text-white"
                } hover:text-green-500`
              }
            >
              Dashboard
            </NavLink>
          </div>
        )}
      </nav>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="md:hidden bg-black/20  text-white px-6 py-4 space-y-4">

          {/* Mobile Nav Links */}
          <NavLink to="/" className="block hover:text-yellow-300 " onClick={() => setMenuOpen(false)}>
          Home
          </NavLink>
          <NavLink to="/events" className="block hover:text-yellow-300" onClick={() => setMenuOpen(false)}>
            Events
          </NavLink>
          <NavLink to="/contact" className="block hover:text-yellow-300" onClick={() => setMenuOpen(false)}>
            Contact Us
          </NavLink>
          <NavLink to="/about" className="block hover:text-yellow-300" onClick={() => setMenuOpen(false)}>
            About
          </NavLink>

          {isAuthorised && (
            <>
              <NavLink to="/create-event" className="block hover:text-green-500" onClick={() => setMenuOpen(false)}>
                Add Event
              </NavLink>
              <NavLink to="/dashboard" className="block hover:text-green-500" onClick={() => setMenuOpen(false)}>
                Dashboard
              </NavLink>
            </>
          )}

          {/* Auth Buttons (Mobile) */}
          {!isLoggedIn ? (
            <div className="flex flex-col space-y-2">
              <Link
                to="/login"
                className="lg:px-4 lg:py-2 lg:bg-white lg:text-purple-700 text-yellow-300 rounded-full font-semibold shadow lg:hover:bg-yellow-300 lg:hover:text-yellow-300 hover:text-white transition"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="lg:px-4 lg:py-2 lg:bg-yellow-300 lg:text-black text-yellow-300 rounded-full font-semibold shadow lg:hover:bg-white lg:hover:text-purple-700 hover:text-white transition"
                onClick={() => setMenuOpen(false)}
              >
                Join Now
              </Link>
            </div>
          ) : (
            <div className="flex flex-col  space-y-4">

              <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-white rounded-full shadow">
                <Link to="/profile" className="flex items-center   " onClick={() => setMenuOpen(false)}>
                <IconUser className="text-purple-700 text-center text-3xl " /> 
                <span className="font-semibold text-black hover:text-yellow-300 transition">Profile</span>
              </Link>
              </div>

              <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-white rounded-full shadow">
                <Wallet className="text-purple-700 text-xl font-semibold" />
                <span className="font-semibold text-black ">
                  {user?.walletPoints ?? 0} pts
                </span>
              </div>
                 <LogoutBtn onClick={() => setMenuOpen(false)} />
    
            </div>
          )}
        </div>
      )}
    </header>
  );
}
