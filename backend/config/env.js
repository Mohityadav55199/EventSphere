// Fails fast with a readable message when the app can't possibly work, and warns about
// optional features that will be disabled. Call once after dotenv has loaded.
const REQUIRED = [
  { keys: ["MONGODB_URI", "MONGO_URI"], hint: "MongoDB Atlas connection string" },
  { keys: ["ACCESS_TOKEN_SECRET"], hint: "secret used to sign access tokens" },
  { keys: ["REFRESH_TOKEN_SECRET"], hint: "secret used to sign refresh tokens" },
];

const RECOMMENDED = [
  { keys: ["CLIENT_URL"], feature: "payment redirects and email links (set to your Vercel URL, no trailing slash)" },
  { keys: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"], feature: "event image uploads", all: true },
  { keys: ["QR_SECRET"], feature: "signed ticket QR codes" },
  { keys: ["STRIPE_SECRET_KEY"], feature: "Stripe payments" },
  { keys: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"], feature: "Razorpay payments", all: true },
  { keys: ["UPSTASH_REDIS_REST_URL", "REDIS_URL"], feature: "shared Redis seat holds (falls back to in-memory)" },
  { keys: ["EMAIL_USER", "SMTP_HOST"], feature: "ticket and password-reset emails" },
];

const isSet = (key) => Boolean(process.env[key] && process.env[key].trim());

export function validateEnv() {
  const missing = REQUIRED.filter(({ keys }) => !keys.some(isSet));
  if (missing.length) {
    console.error("🚨 Missing required environment variables:");
    for (const { keys, hint } of missing) {
      console.error(`   - ${keys.join(" or ")}  (${hint})`);
    }
    console.error("   Set them in Render → Environment (or backend/.env locally) and restart.");
    process.exit(1);
  }

  for (const { keys, feature, all } of RECOMMENDED) {
    const ok = all ? keys.every(isSet) : keys.some(isSet);
    if (!ok) console.warn(`⚠️  ${keys.join(all ? " + " : " or ")} not set → ${feature} disabled or degraded`);
  }
}
