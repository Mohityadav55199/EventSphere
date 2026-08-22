import connectDB from "./config/db.js";
import dotenv from "dotenv";
import app from "./app.js";
import { initSocket } from "./socket.js";
import http from "http";
import { autoSeedEventsIfEmpty } from "./utils/autoSeed.js";
import { startHoldExpiryJob } from "./jobs/holdExpiry.js";
import { autoMigrateAvailableSeats } from "./utils/autoMigrateAvailableSeats.js";

dotenv.config({
  path: "./.env",
});

connectDB()
.then(async () => {
    // Automatically seed events if database is empty (e.g. fresh MongoDB Atlas deployment)
    await autoSeedEventsIfEmpty();

    // Backfill availableSeats on any events that predate the concurrency update
    // Safe to run every boot — skips events already migrated
    await autoMigrateAvailableSeats();

    const port = process.env.PORT || 5000;
    const server = http.createServer(app);
    initSocket(server);

    // Start the seat hold expiry cron job (cleans up abandoned checkouts every 60s)
    startHoldExpiryJob();

    server.listen(port, () => {
      console.log("Server is started and running at port", port);
      console.log("Server is running at http://localhost:" + port);
    });
})
.catch((err) => {
  console.log("MongoDB Connection failed!!!", err);
});