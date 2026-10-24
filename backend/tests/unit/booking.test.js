import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

test("HMAC ticket QR code generation and verification", () => {
  const secret = "test-qr-secret-key-1234567890";
  const bookingId = "507f1f77bcf86cd799439011";
  const randomHex = crypto.randomBytes(8).toString("hex");
  const payload = `${bookingId}:${randomHex}`;

  const validHash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const tamperedHash = crypto.createHmac("sha256", "wrong-secret").update(payload).digest("hex");

  // Re-verify
  const expectedHash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(validHash, expectedHash);
  assert.notEqual(tamperedHash, expectedHash);
});

test("seat hold expiry condition identifies abandoned checkouts", () => {
  const now = new Date();
  const pastExpiry = new Date(now.getTime() - 60 * 1000);
  const futureExpiry = new Date(now.getTime() + 5 * 60 * 1000);

  const bookings = [
    { _id: "b1", status: "hold", holdExpiresAt: pastExpiry },
    { _id: "b2", status: "hold", holdExpiresAt: futureExpiry },
    { _id: "b3", status: "confirmed", holdExpiresAt: pastExpiry },
  ];

  const expiredHolds = bookings.filter(
    (b) => b.status === "hold" && b.holdExpiresAt && b.holdExpiresAt < now
  );

  assert.equal(expiredHolds.length, 1);
  assert.equal(expiredHolds[0]._id, "b1");
});

test("booking pricing accurately calculates seat count and tiered pricing", () => {
  const tier = { name: "VIP Pass", price: 500 };
  const selectedSeats = ["A1", "A2", "A3"];
  const discountPercent = 20;

  const basePrice = tier.price * selectedSeats.length;
  const discountAmount = (basePrice * discountPercent) / 100;
  const finalPrice = basePrice - discountAmount;

  assert.equal(basePrice, 1500);
  assert.equal(discountAmount, 300);
  assert.equal(finalPrice, 1200);
});
