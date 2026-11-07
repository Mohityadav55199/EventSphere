/**
 * makeAdmin.js — promote an existing account to admin.
 *
 *   cd backend
 *   node scripts/makeAdmin.js you@example.com
 *
 * Admins can't be created through sign-up (the API refuses role "admin" on purpose), so this is
 * the only way to get one. It uses MONGODB_URI from backend/.env, i.e. whichever database that
 * points at, so double-check it before running against production.
 * Sign up normally first, then run this with that email. Log out and back in afterwards.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectForScript } from "../config/db.js";
import User from "../models/user.model.js";

dotenv.config({ path: "./.env" });

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/makeAdmin.js <email>");
  process.exit(1);
}
await connectForScript(); // same Windows/ISP DNS workaround as the server, no localhost fallback
console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);
const user = await User.findOneAndUpdate({ email }, { $set: { role: "admin" } }, { new: true });
if (!user) {
  console.error(`No account with email ${email}. Sign up first, then run this again.`);
  process.exitCode = 1;
} else {
  console.log(`${user.email} is now an admin. Log out and log back in to see admin features.`);
}
await mongoose.disconnect();
