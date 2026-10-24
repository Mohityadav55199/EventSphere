import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

import connectDB from "./config/db.js";
import { validateEnv } from "./config/env.js";
import app from "./app.js";
import { initSocket } from "./socket.js";
import http from "http";
import { autoSeedEventsIfEmpty } from "./utils/autoSeed.js";
import { startHoldExpiryJob } from "./jobs/holdExpiry.js";
import { autoMigrateAvailableSeats } from "./utils/autoMigrateAvailableSeats.js";

validateEnv();

const port = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

// Start server immediately so cloud platforms (Render, Railway, etc.) detect open port right away
server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 EventSphere Server started and listening on port ${port}`);
  console.log(`🌐 Server available at http://0.0.0.0:${port}`);
});

// Initialize database connection and post-connection background jobs
connectDB()
  .then(async () => {
    try {
      // Automatically seed events if database is empty (e.g. fresh MongoDB Atlas deployment)
      await autoSeedEventsIfEmpty();

      // Backfill availableSeats on any events that predate the concurrency update
      await autoMigrateAvailableSeats();

      // Start the seat hold expiry cron job (cleans up abandoned checkouts every 60s)
      startHoldExpiryJob();
    } catch (err) {
      console.error("Post-connection setup warning:", err.message);
    }
  })
  .catch((err) => {
    console.error("MongoDB initial connection error:", err.message);
  });

export { server };