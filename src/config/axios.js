import axios from "axios";
import { baseURL } from "./baseURL.js";
import store from "../store/store.js";
import { logout, setCredentials } from "../store/authslice.js";

const API = axios.create({
  baseURL: baseURL,
});

// Attach token to requests
API.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken || localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses & refresh tokens
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If token expired & not retried already
    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken } = store.getState().auth;

        // Get new access token
        const res = await axios.post(`${baseURL}/api/v1/users/refresh-token`, {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        const newRefreshToken = res.data.refreshToken;

        // Update Redux store
        store.dispatch(
          setCredentials({ accessToken: newAccessToken, refreshToken: newRefreshToken })
        );

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return API(originalRequest);
      } catch (err) {
        store.dispatch(logout());
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export default API;
