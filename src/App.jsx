import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Components/Header/Header";
import Footer from "./Components/Footer/Footer";
import { getUserProfile } from "./services/authservices/authapi";
import { logout, setCredentials } from "./store/authslice";
import ScrollToTop from "./ScrollToTop";
import { baseURL } from "./config/baseURL.js";
import useDocumentTitle from "./hooks/useDocumentTitle";

const ROUTE_TITLES = {
  "/": "Discover Live Events",
  "/events": "Explore Events",
  "/about": "About Us",
  "/contact": "Contact Us",
  "/login": "Log In",
  "/signup": "Create Account",
  "/forgot-password": "Forgot Password",
  "/profile": "My Profile & Tickets",
  "/dashboard": "Organizer Dashboard",
  "/create-event": "Create Event",
};

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { pathname } = useLocation();
  // Event pages set their own title (see DetailEvent)
  const isEventPage = pathname.startsWith("/event");
  useDocumentTitle(isEventPage ? undefined : ROUTE_TITLES[pathname]);

  useEffect(() => {
    // Proactively warm up cloud backend on Render so requests don't hit cold start latency
    fetch(`${baseURL}/health`).catch(() => {});
  }, []);

  useEffect(() => {
    const token = accessToken || localStorage.getItem("accessToken");

    if (!token) {
      dispatch(logout());
      setLoading(false);
      return;
    }

    getUserProfile(token)
      .then((userData) => {
        if (userData) {
          dispatch(
            setCredentials({
              user: userData,
              accessToken: token,
            })
          );
        } else {
          dispatch(logout());
        }
      })
      .catch((error) => {
        console.log("App.jsx :: error in getUserProfile", error);
        dispatch(logout());
      })
      .finally(() => setLoading(false));
  }, [accessToken, dispatch]);

  return !loading ? (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-800">
      <Header />
      <ScrollToTop />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  ) : (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 text-slate-600 gap-2 font-medium px-4 text-center">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-1" />
      <span>Initializing EventSphere...</span>
      <span className="text-xs text-slate-400 max-w-sm">
        Connecting to cloud backend. Initial boot may take up to a minute on Render’s free tier.
      </span>
    </div>
  );
}

export default App;
