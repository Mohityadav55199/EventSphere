import React from "react";
import { useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";

/**
 * Route guard.
 *   authentication = true   -> must be logged in (otherwise -> /login, and back here afterwards)
 *   authentication = false  -> must be logged OUT (login/signup pages; otherwise -> /)
 *   roles = ["organizer"]   -> must also have one of these roles (otherwise -> /)
 *
 * It decides synchronously and renders <Navigate>, so a protected page never mounts (and never
 * fires its API calls) for someone who is not allowed to see it. App.jsx only renders routes after
 * the profile has loaded, so `user` is already known here.
 */
export function Protected({ authenication = true, roles, children }) {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const user = useSelector((state) => state.auth.user);
  const location = useLocation();
  const isLoggedIn = Boolean(accessToken);

  if (authenication && !isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (!authenication && isLoggedIn) {
    // Just logged in: go back to the page that sent them to /login, if any
    return <Navigate to={location.state?.from || "/"} replace />;
  }
  if (roles && !roles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
