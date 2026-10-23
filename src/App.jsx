import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Outlet } from "react-router-dom";
import Header from "./Components/Header/Header";
import Footer from "./Components/Footer/Footer";
import { getUserProfile } from "./services/authservices/authapi";
import { logout, setCredentials } from "./store/authslice";
import ScrollToTop from "./ScrollToTop";
import { baseURL } from "./config/baseURL.js";

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);

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
    <div className="min-h-screen flex justify-center items-center bg-slate-50 text-slate-500 font-medium">
      Initializing EventSphere...
    </div>
  );
}

export default App;
