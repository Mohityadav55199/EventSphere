import API from "../../config/axios";

export const getInTouch = async (formData) => {
  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.log("User not logged in");
      throw new Error("User not logged in");
    }

    const response = await API.post("/api/v1/contacts/contact", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data; // already returning only data
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
};
