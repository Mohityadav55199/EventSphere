import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
    const rawUri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
    const isCloudUri = rawUri.startsWith("mongodb+srv://") || (rawUri.startsWith("mongodb://") && !rawUri.includes("localhost") && !rawUri.includes("127.0.0.1"));

    // Primary connection attempt
    if (rawUri) {
        try {
            // Using Mongoose dbName option avoids brittle regex or string replacements on MongoDB Atlas URIs
            const connectInstance = await mongoose.connect(rawUri, {
                dbName: DB_NAME,
                serverSelectionTimeoutMS: 10000,
            });
            console.log(`✅ MongoDB connected successfully: ${connectInstance.connection.host} (DB: ${connectInstance.connection.name})`);
            return;
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
        console.warn("⚠️ No MONGODB_URI or MONGO_URI environment variable detected.");
    }

    // Fallback to local MongoDB (primarily for local development)
    if (!isCloudUri || process.env.NODE_ENV !== "production") {
        try {
            console.log("🔄 Attempting local MongoDB fallback...");
            const fallbackUri = `mongodb://localhost:27017/${DB_NAME}`;
            const fallbackInstance = await mongoose.connect(fallbackUri, {
                serverSelectionTimeoutMS: 4000,
            });
            console.log(`✅ MongoDB connected (Local Fallback): ${fallbackInstance.connection.host}`);
            return;
        } catch (fallbackError) {
            console.error("❌ Local MongoDB fallback also failed (connect ECONNREFUSED localhost:27017).");
        }
    }

    console.error("💥 Database connection failed completely. Ensure valid MONGODB_URI is provided in your environment variables.");
    process.exit(1);
};

export default connectDB;