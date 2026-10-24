import React from "react";
import { Link } from "react-router-dom";
import useDocumentTitle from "../hooks/useDocumentTitle";

function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="text-center space-y-4">
        <p className="text-6xl font-black text-indigo-600">404</p>
        <h1 className="text-2xl font-extrabold text-slate-900">We couldn't find that page</h1>
        <p className="text-sm text-slate-500">The link may be broken, or the event may have been removed.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
            Back to home
          </Link>
          <Link to="/events" className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
