import API from "../../config/axios";

export const getChatHistory = async (eventId) => {
  try {
    const token = localStorage.getItem("accessToken");
    if(!token){
      console.log("User not logged in");
      return
    }
    const response = await API.get(`/api/v1/chat/chat-history/${eventId}`);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
}