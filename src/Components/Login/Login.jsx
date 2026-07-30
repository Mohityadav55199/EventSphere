import React from "react";
import { useForm } from "react-hook-form";
import { loginUser } from "../../services/authservices/authapi";
import { useDispatch } from "react-redux";
import { setCredentials } from "../../store/authslice";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const dispatch = useDispatch();
  const navigate = useNavigate();

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

      // console.log("Login Response:", response.data);
      navigate("/");
    } catch (error) {
      console.error("Login Error:", error);
      toast.error(error.message || "Login failed!");
    }
  };

  return (
    <div className="flex p-6 justify-center items-center h-screen ">
      <ToastContainer autoClose={3000} position="top-right"/>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className=" backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-96 border bg-transparent border-gray-200"
      >
        <h2 className="text-3xl font-extrabold text-center text-slate-200 mb-2">
          Welcome Back
        </h2>
        <p className="text-center text-gray-400 mb-6 text-sm">
          Login to continue exploring events
        </p>

        {/* Email */}
        <div className="mb-5">
          <label className="block mb-1 font-semibold text-gray-400">Email</label>
          <input
            type="email"
            {...register("email", { required: "Email is required", 
              pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
             })}
            className="w-full px-4 py-2 border lg:text-black/80 text-slate-300  rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            placeholder="your@email.com"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block mb-1 font-semibold text-gray-400">Password</label>
          <input
            type="password"
            {...register("password", { required: "Password is required" })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none lg:text-black/80 text-slate-300  focus:ring-2 focus:ring-indigo-500 shadow-sm"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 text-white py-2 rounded-lg font-semibold shadow-md hover:from-indigo-700 hover:to-blue-600 transition duration-300 transform hover:scale-[1.02]"
        >
          Login
        </button>

        {/* Extra Links */}
        <p className="text-center text-sm text-gray-400 mt-4">
          Don’t have an account?{" "}

          <span className="text-blue-100 font-semibold hover:underline cursor-pointer" onClick={() => navigate("/signup")}>
            Sign up
          </span>
        </p>
      </form>
    </div>
  );
}

export default Login;
