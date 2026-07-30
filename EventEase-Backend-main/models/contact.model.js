import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  user : { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  image : { type: String, trim: true, default: null },
}, { timestamps: true });

export default mongoose.model("Contact", contactSchema);
