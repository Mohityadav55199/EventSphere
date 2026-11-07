// Shared setup for integration tests: real Express app + real MongoDB (in-memory) + in-memory Redis fallback.
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";

// The app logs a lot (emails, sandbox notices, Redis fallbacks). On Node 20 the built-in test runner can
// misparse its own result stream when a test file prints heavily ("Unable to deserialize cloned data"),
// so keep app logs quiet unless you ask for them:  TEST_VERBOSE=1 npm test
if (process.env.NODE_TEST_CONTEXT && !process.env.TEST_VERBOSE) { // NODE_TEST_CONTEXT is set only inside `node --test` workers
  for (const level of ["log", "info", "warn", "error"]) console[level] = () => {};
}
process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRY = "1h";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.QR_SECRET = "test-qr-secret";
// Empty strings (not delete): dotenv never overrides a variable that already exists,
// so a developer's local backend/.env can't leak real Redis/Stripe/SMTP keys into tests.
for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "REDIS_URL", "STRIPE_SECRET_KEY",
  "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "SMTP_HOST", "EMAIL_USER", "CLIENT_URL"]) {
  process.env[key] = "";
}

let mongod;

export async function startTestApp() {
  // Every test file starts its own mongod at the same time; on a busy machine one can occasionally
  // fail to boot (port race / startup timeout), so retry once and report why on stderr.
  try {
    mongod = await MongoMemoryServer.create();
  } catch (err) {
    process.stderr.write(`mongodb-memory-server failed to start (${err.message}); retrying once\n`);
    mongod = await MongoMemoryServer.create();
  }
  await mongoose.connect(mongod.getUri(), { dbName: "eventsphere_test" });
  const { default: app } = await import("../../app.js");
  const models = {
    User: (await import("../../models/user.model.js")).default,
    Event: (await import("../../models/event.model.js")).default,
    Booking: (await import("../../models/booking.model.js")).default,
  };
  return { app, ...models };
}

export async function stopTestApp() {
  await mongoose.disconnect();
  await mongod?.stop();
}

let counter = 0;
export async function makeUser(User, role = "attendee", extra = {}) {
  counter += 1;
  const user = await User.create({
    name: `user ${counter}`,
    email: `user${counter}-${Date.now()}@test.dev`,
    password: "password123",
    role,
    ...extra,
  });
  return { user, token: user.genearteAccessToken() };
}

export async function makeEvent(Event, organizerId, overrides = {}) {
  return Event.create({
    title: "Test Event",
    description: "An event used by integration tests",
    date: new Date(Date.now() + 7 * 864e5),
    location: "Test City",
    locationGoogleMapLink: "https://maps.example.com",
    organizer: organizerId,
    image: "https://img.example.com/e.jpg",
    Price: 0,
    category: "Other",
    capacity: 10,
    ...overrides,
  });
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
