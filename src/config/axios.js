import axios from "axios";
import { baseURL } from "./baseURL.js";
import store from "../store/store.js";
import { logout, setCredentials } from "../store/authslice.js";

const API = axios.create({
  baseURL: baseURL,
  timeout: 30000, // 30s timeout to allow Render free tier instance cold start
  withCredentials: true, // lets the browser send the httpOnly refresh-token cookie
});

// Attach token to requests
API.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken || localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// These endpoints answer 401 for wrong credentials, so a refresh attempt makes no sense
const NO_REFRESH_URLS = ["/users/login", "/users/register", "/users/refresh-token", "/users/forgot-password", "/users/reset-password"];

// Several requests can fail at once when a token expires; share one refresh call between them
let refreshPromise = null;

function refreshTokens() {
  if (!refreshPromise) {
    const { refreshToken } = store.getState().auth;
    refreshPromise = axios
      .post(`${baseURL}/api/v1/users/refresh-token`, { refreshToken }, { withCredentials: true })
      .then((res) => {
        // The server wraps payloads as { statusCode, data, message }
        const { accessToken, refreshToken: newRefreshToken } = res.data.data;
        store.dispatch(setCredentials({ user: store.getState().auth.user, accessToken, refreshToken: newRefreshToken }));
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Handle responses & refresh tokens
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = NO_REFRESH_URLS.some((url) => originalRequest?.url?.includes(url));

    // Access token missing/expired → get a new one once, then retry the original request
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshTokens();
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
