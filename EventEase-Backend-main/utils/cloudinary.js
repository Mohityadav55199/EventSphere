// utils/cloudinary.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload buffer directly
const uploadOnCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          console.log("File uploaded on Cloudinary:", result.url);
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

    const deleteFromCloudinary = async(oldfileUrl)=>{
       try {
         if(oldfileUrl){
             await cloudinary.uploader.destroy(oldfileUrl)
            //  console.log(`Deleted image with public ID: ${publicId}`);
         }
       } catch (error) {
        console.error(`Error deleting image: ${error}`);
       }
    };
   

export {uploadOnCloudinary,deleteFromCloudinary}