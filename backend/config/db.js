import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";

const connectDB = async () => {
    const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017";
    let connectionString = rawUri;
    if (!rawUri.includes(`/${DB_NAME}`)) {
        if (rawUri.includes("?")) {
            connectionString = rawUri.replace("?", `/${DB_NAME}?`);
        } else {
            connectionString = `${rawUri.replace(/\/$/, "")}/${DB_NAME}`;
        }
    }

    try {
        const connectInstance = await mongoose.connect(connectionString);
        console.log(`MongoDB connected: ${connectInstance.connection.host}`);
    } catch (error) {
        console.warn(`Primary DB connection failed (${error.message}). Retrying with local MongoDB...`);
        try {
            const fallbackUri = `mongodb://localhost:27017/${DB_NAME}`;
            const fallbackInstance = await mongoose.connect(fallbackUri);
            console.log(`MongoDB connected (Local Fallback): ${fallbackInstance.connection.host}`);
        } catch (fallbackError) {
            console.error("Database connection failed completely:", fallbackError);
            process.exit(1);
        }
    }
}

export default connectDB;