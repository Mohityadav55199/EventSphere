import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { loginUser } from "../../services/authservices/authapi";
import { useDispatch } from "react-redux";
import { setCredentials } from "../../store/authslice";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, Loader2, CloudLightning } from "lucide-react";
import { baseURL } from "../../config/baseURL.js";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Proactively wake up backend server on Render free tier
    fetch(`${baseURL}/health`).catch(() => {});
  }, []);

  React.useEffect(() => {
    let timer;
    if (isSubmitting) {
      timer = setTimeout(() => {
        setIsWakingServer(true);
      }, 1500);
    } else {
      setIsWakingServer(false);
    }
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  const onSubmit = async (data) => {
    try {
      const response = await loginUser(data);
      dispatch(
        setCredentials({
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        })
      );
      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("userId", response.data.user._id);

      toast.success("Welcome back! Redirecting...");
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (error) {
      console.error("Login Error:", error);
      toast.error(error.response?.data?.message || error.message || "Invalid email or password!");
    }
  };

  return (
    <div className="w-full">
      <ToastContainer autoClose={3000} position="top-right" theme="dark" />

      <div className="bg-slate-900/80 backdrop-blur-2xl p-7 sm:p-9 rounded-3xl shadow-2xl border border-slate-800 text-white transition-all">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>EventSphere Portal</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome Back
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Sign in to access your bookings, tickets, and events
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: "Please enter a valid email address",
                  },
                })}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border ${
                  errors.email ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            {errors.email && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                {...register("password", { required: "Password is required" })}
                className={`w-full pl-10 pr-11 py-2.5 bg-slate-800/70 border ${
                  errors.password ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.password.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transform active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Waking Server Feedback */}
          {isWakingServer && (
            <div className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-center gap-2 animate-pulse">
              <CloudLightning className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Connecting to cloud server... (Render free tier spin-up in progress)</span>
            </div>
          )}

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure 256-bit encrypted authentication</span>
          </div>

          {/* Sign Up Redirect */}
          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            Don’t have an account yet?{" "}
            <Link
              to="/signup"
              className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline transition-colors"
            >
              Create Account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
