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
      { resource_type: "image" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Cloudinary deletes by public_id, not by URL.
 *   https://res.cloudinary.com/demo/image/upload/v1712345678/folder/poster.jpg  ->  "folder/poster"
 * Returns null for anything that isn't a Cloudinary upload URL (e.g. seeded Unsplash images).
 */
const publicIdFromUrl = (url) => {
  if (typeof url !== "string" || !url.includes("res.cloudinary.com")) return null;
  const afterUpload = url.split(/[?#]/)[0].split("/upload/")[1];
  if (!afterUpload) return null;
  let parts = afterUpload.split("/");
  const versionAt = parts.findIndex((p) => /^v\d+$/.test(p));
  if (versionAt !== -1) {
    parts = parts.slice(versionAt + 1); // everything before the version is transformations
  } else {
    while (parts.length > 1 && /^[a-z]{1,3}_[^/]*$|,/.test(parts[0])) parts.shift(); // e.g. "c_fill,w_300"
  }
  const id = parts.join("/").replace(/\.[a-z0-9]+$/i, "");
  return id ? decodeURIComponent(id) : null;
};

const deleteFromCloudinary = async (fileUrl) => {
  const publicId = publicIdFromUrl(fileUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    // Never fail the request just because an old image could not be cleaned up
    console.error(`Error deleting image ${publicId}:`, error.message);
  }
};

export { uploadOnCloudinary, deleteFromCloudinary, publicIdFromUrl };
