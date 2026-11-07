// Single source for the ticket-signing secret. There is deliberately no fallback in
// production: a guessable default would let anyone forge valid QR tickets.
const DEV_FALLBACK = "dev-only-qr-secret-do-not-use-in-production";

export function getQrSecret() {
  const secret = process.env.QR_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("QR_SECRET is not configured");
  }
  return DEV_FALLBACK;
}
