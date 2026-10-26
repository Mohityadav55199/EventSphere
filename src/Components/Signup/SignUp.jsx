import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { registerUser } from "../../services/authservices/authapi";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { setCredentials } from "../../store/authslice";
import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Ticket, 
  Megaphone,
  CheckCircle2,
  Loader2,
  CloudLightning
} from "lucide-react";
import useServerStatus from "../../hooks/useServerStatus";

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const serverStatus = useServerStatus();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm({
    defaultValues: {
      role: "attendee"
    }
  });

  const selectedRole = watch("role");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
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
      const response = await registerUser(data);
      dispatch(
        setCredentials({
          user: response.data.user,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        })
      );
      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("userId", response.data.user._id);

      reset();
      toast.success("Account created successfully! Welcome to EventSphere 🎉");
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (error) {
      console.error("Register Error:", error);
      toast.error(error.response?.data?.message || error.message || "Registration failed!");
    }
  };

  return (
    <div className="w-full">
      <ToastContainer autoClose={3000} position="top-right" theme="dark" />

      <div className="bg-slate-900/80 backdrop-blur-2xl p-7 sm:p-9 rounded-3xl shadow-2xl border border-slate-800 text-white transition-all">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join the Community</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Create Your Account
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Discover live experiences or start hosting your own events
          </p>
        </div>

        {serverStatus === "unreachable" && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span>Waking up the server. This can take up to a minute on the free tier.</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                {...register("name", {
                  required: "Full name is required",
                  minLength: { value: 2, message: "Name must be at least 2 characters" }
                })}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-800/70 border ${
                  errors.name ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            {errors.name && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.name.message}</p>
            )}
          </div>

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
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Create Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "Password must be at least 6 characters" }
                })}
                className={`w-full pl-10 pr-11 py-2.5 bg-slate-800/70 border ${
                  errors.password ? "border-rose-500/80 focus:ring-rose-500/20" : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20"
                } text-white placeholder-slate-500 text-sm rounded-xl focus:outline-none focus:ring-2 transition duration-150`}
                placeholder="At least 6 characters"
                autoComplete="new-password"
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

          {/* Role Selection */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              I want to:
            </label>
            <input type="hidden" {...register("role", { required: "Please select an account type" })} />
            <div className="grid grid-cols-2 gap-3">
              {/* Attendee Option */}
              <button
                type="button"
                onClick={() => setValue("role", "attendee")}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  selectedRole === "attendee"
                    ? "bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-900/30 ring-1 ring-indigo-500"
                    : "bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/70 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${selectedRole === "attendee" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                    <Ticket className="w-4 h-4" />
                  </div>
                  {selectedRole === "attendee" && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Event Explorer</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Explore & book tickets</div>
                </div>
              </button>

              {/* Organizer Option */}
              <button
                type="button"
                onClick={() => setValue("role", "organizer")}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                  selectedRole === "organizer"
                    ? "bg-indigo-950/50 border-indigo-500 shadow-md shadow-indigo-900/30 ring-1 ring-indigo-500"
                    : "bg-slate-800/40 border-slate-700/80 hover:bg-slate-800/70 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div className={`p-2 rounded-xl ${selectedRole === "organizer" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                    <Megaphone className="w-4 h-4" />
                  </div>
                  {selectedRole === "organizer" && (
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Event Organizer</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Create & host events</div>
                </div>
              </button>
            </div>
            {errors.role && (
              <p className="text-rose-400 text-xs mt-1.5 font-medium">{errors.role.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white py-3 px-4 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transform active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Waking Server Feedback */}
          {isWakingServer && (
            <div role="status" className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-center gap-2 animate-pulse">
              <CloudLightning className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Connecting to cloud server... (Render free tier spin-up in progress)</span>
            </div>
          )}

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted credentials & secure JWT sessions</span>
          </div>

          {/* Login Redirect */}
          <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline transition-colors"
            >
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
