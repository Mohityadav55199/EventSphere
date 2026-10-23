import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

/**
 * Sanitize MongoDB Connection String
 * Automatically handles:
 * - Stripping outer quotes ("..." or '...')
 * - Detecting unreplaced '<password>' or '<username>' placeholders
 * - Auto-URL-encoding passwords that contain unencoded special characters like '@', '#', ':', '%'
 */
function sanitizeMongoUri(rawUri) {
  if (!rawUri) return "";
  let uri = rawUri.trim().replace(/^["']|["']$/g, "");

  if (uri.includes("<password>") || uri.includes("<username>")) {
    console.error("🚨 CRITICAL ERROR: Your MONGODB_URI contains unreplaced '<password>' or '<username>' placeholders!");
    console.error("   In Render Dashboard -> Environment: Replace '<password>' with your real password without brackets.");
  }

  try {
    const srvPrefix = uri.startsWith("mongodb+srv://")
      ? "mongodb+srv://"
      : uri.startsWith("mongodb://")
      ? "mongodb://"
      : "";

    if (srvPrefix) {
      const rest = uri.slice(srvPrefix.length);
      const lastAt = rest.lastIndexOf("@");
      if (lastAt !== -1) {
        const userInfo = rest.slice(0, lastAt);
        const hostAndParams = rest.slice(lastAt + 1);
        const firstColon = userInfo.indexOf(":");
        if (firstColon !== -1) {
          const user = userInfo.slice(0, firstColon);
          const rawPassword = userInfo.slice(firstColon + 1);
          try {
            // Decode first in case partially encoded, then encode properly
            const decodedPassword = decodeURIComponent(rawPassword);
            const encodedPassword = encodeURIComponent(decodedPassword);
            const decodedUser = decodeURIComponent(user);
            const encodedUser = encodeURIComponent(decodedUser);
            uri = `${srvPrefix}${encodedUser}:${encodedPassword}@${hostAndParams}`;
          } catch {
            // Keep original if decoding fails
          }
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ URI sanitization warning:", err.message);
  }

  return uri;
}

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnecting) return;
  isConnecting = true;

  const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || "";
  const sanitizedUri = sanitizeMongoUri(rawUri);
  const isCloudUri =
    sanitizedUri.startsWith("mongodb+srv://") ||
    (sanitizedUri.startsWith("mongodb://") &&
      !sanitizedUri.includes("localhost") &&
      !sanitizedUri.includes("127.0.0.1"));

  if (sanitizedUri) {
    try {
      const connectInstance = await mongoose.connect(sanitizedUri, {
        dbName: DB_NAME,
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`✅ MongoDB connected successfully: ${connectInstance.connection.host} (DB: ${connectInstance.connection.name})`);
      isConnecting = false;
      return connectInstance;
    } catch (error) {
      console.error(`❌ Primary DB connection failed (${error.message}).`);
      if (error.message && error.message.includes("bad auth")) {
        console.error("🔑 AUTHENTICATION ERROR TROUBLESHOOTING:");
        console.error(" 1. Check your MONGODB_URI in Render dashboard environment variables.");
        console.error(" 2. Ensure your MongoDB Atlas user exists in 'Database Access' and has read/write permissions.");
        console.error(" 3. If your password contains special characters (like @, #, :, /, %, etc.), they MUST be URL-encoded (e.g., '@' becomes '%40').");
        console.error(" 4. Verify MongoDB Atlas Network Access has IP 0.0.0.0/0 (Allow from Anywhere) whitelisted for Render.");
      }
    }
  } else {
    console.warn("⚠️ No MONGODB_URI or MONGO_URI environment variable detected in environment.");
  }

  // Fallback to local MongoDB (primarily for local development)
  if (!isCloudUri && process.env.NODE_ENV !== "production") {
    try {
      console.log("🔄 Attempting local MongoDB fallback...");
      const fallbackUri = `mongodb://localhost:27017/${DB_NAME}`;
      const fallbackInstance = await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: 4000,
      });
      console.log(`✅ MongoDB connected (Local Fallback): ${fallbackInstance.connection.host}`);
      isConnecting = false;
      return fallbackInstance;
    } catch {
      console.error("❌ Local MongoDB fallback failed (connect ECONNREFUSED localhost:27017).");
    }
  }

  isConnecting = false;
  console.warn("⚠️ Database connection pending. The server will keep running and retry in 15 seconds.");
  setTimeout(() => {
    connectDB().catch(() => {});
  }, 15000);
};

export default connectDB;