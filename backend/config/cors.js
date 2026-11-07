// Origins allowed to call the API / open sockets with credentials.
// Set CLIENT_URL to your frontend (comma-separate several, no trailing slash).
// localhost is always allowed outside production. If CLIENT_URL is unset we fall back to
// allowing any origin (and warn at startup via validateEnv) so a missing var can't take the site down.
const configured = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

export function isOriginAllowed(origin) {
  if (!origin) return true; // same-origin / curl / server-to-server
  if (configured.length === 0) return true;
  if (configured.includes(origin.replace(/\/$/, ""))) return true;
  return process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export const corsOriginCheck = (origin, callback) => callback(null, isOriginAllowed(origin));
