import mongoose, { Schema } from "mongoose";

// One row per payment-gateway event we have started processing.
// The unique index on eventId is what makes webhook handling idempotent: gateways deliver
// the same event more than once, and a duplicate insert tells us to skip it.
const webhookEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // TTL: keep 30 days
});

export default mongoose.model("WebhookEvent", webhookEventSchema);
