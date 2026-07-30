import { useDispatch } from "react-redux";
import API from "../../config/axios";

export const loginUser = async ({email, password}) => {
  try {
    const response = await API.post("/api/v1/users/login", { email, password });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}

export const registerUser = async ({name, email, password, role}) => {
  try {
    const response = await API.post("/api/v1/users/register", { 
      name,
      email, 
      password,
      role 
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}

export const logoutUser = async () => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const response = await API.post("/api/v1/users/logout");
    localStorage.removeItem("accessToken");
    console.log(localStorage.getItem("accessToken"))
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}

export const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) throw new Error("No refresh token found");

    const response = await API.post("/api/v1/users/refresh-token", { refreshToken });
    localStorage.setItem("accessToken", response.data.accessToken);
    return response.data.accessToken;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}

export const getUserProfile = async (token) => {
  try {
    if (!token) {
      console.log("User not logged in");
      return null;
    }

    const response = await API.get("/api/v1/users/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return response.data?.data; // ✅ return only the user object
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
};


export const updateUserProfile = async ({name, email}) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const response = await API.patch(`/api/v1/users/update-account`, {
      name,
      email
    });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}

export const resetPassword = async ({ oldPassword, newPassword }) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const response = await API.post(`/api/v1/users/change-password`, { oldPassword, newPassword });
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}
