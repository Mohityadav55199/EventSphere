import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { forgotPassword } from "../services/authservices/authapi";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] w-full flex items-center justify-center bg-slate-950 py-12 px-4">
      <div className="w-full max-w-md bg-slate-900/80 p-7 sm:p-9 rounded-3xl shadow-2xl border border-slate-800 text-white">
        {sent ? (
          <div className="text-center space-y-3" role="status">
            <MailCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-extrabold">Check your inbox</h1>
            <p className="text-slate-400 text-sm">
              If an account exists for <strong className="text-slate-200">{email}</strong>, we've sent a
              reset link. It expires in 15 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold">Forgot password?</h1>
              <p className="text-slate-400 text-sm mt-1.5">Enter your email and we'll send you a reset link.</p>
            </div>
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            {error && <p role="alert" className="text-rose-400 text-xs font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : "Send Reset Link"}
            </button>
          </form>
        )}
        <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </Link>
      </div>
    </div>
  );
}

export default ForgotPassword;
