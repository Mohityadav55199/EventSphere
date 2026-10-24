import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import { resetPasswordWithToken } from "../services/authservices/authapi";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      await resetPasswordWithToken({ token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err?.message || "Reset link is invalid or has expired");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 focus:border-indigo-500 focus:ring-indigo-500/30";

  return (
    <div className="min-h-[calc(100vh-4.5rem)] w-full flex items-center justify-center bg-slate-950 py-12 px-4">
      <div className="w-full max-w-md bg-slate-900/80 p-7 sm:p-9 rounded-3xl shadow-2xl border border-slate-800 text-white">
        {done ? (
          <div className="text-center space-y-2" role="status">
            <h1 className="text-2xl font-extrabold">Password updated</h1>
            <p className="text-slate-400 text-sm">Redirecting you to login...</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold">Set a new password</h1>
              <p className="text-slate-400 text-sm mt-1.5">Choose a password you haven't used before.</p>
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input id="new-password" type="password" required minLength={6} autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input id="confirm-password" type="password" required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
              </div>
            </div>
            {error && <p role="alert" className="text-rose-400 text-xs font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : "Reset Password"}
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

export default ResetPassword;
