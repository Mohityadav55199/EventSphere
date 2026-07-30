// middlewares/multer.middleware.js
import multer from "multer";

// Store file in memory (as buffer) instead of disk
const storage = multer.memoryStorage();

export const upload = multer({ storage });
