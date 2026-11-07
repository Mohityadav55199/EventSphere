// middlewares/multer.middleware.js
import multer from "multer";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, same limit the UI shows

// Files stay in memory (as a buffer) and are streamed to Cloudinary, so the limits matter:
// without them a single large upload could exhaust the server's RAM.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only JPG, PNG, WEBP, GIF or AVIF images are allowed"));
  },
});
