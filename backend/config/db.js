import mongoose from "mongoose";
import { DB_NAME } from "../constant.js";
const connectDB = async () => {
    try {
        const connectInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`MongoDB connected: ${connectInstance.connection.host}`);
    } catch (error) {
        console.error("Database connection failed:", error);
        process.exit(1); // Exit the process with failure 
    }
}
export default connectDB;