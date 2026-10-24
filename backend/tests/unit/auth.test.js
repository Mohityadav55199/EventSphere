import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";

const { authMiddleware } = await import("../../middlewares/auth.middleware.js");
const { default: User } = await import("../../models/user.model.js");

const run = (req) =>
  new Promise((resolve) => {
    authMiddleware({ cookies: {}, header: () => undefined, ...req }, {}, (err) => resolve(err));
  });

test("missing token is 401", async () => {
  const err = await run({});
  assert.equal(err.statusCode, 401);
});

test("expired token is 401 so the client refreshes instead of seeing 403", async () => {
  const token = jwt.sign({ _id: "507f1f77bcf86cd799439011" }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: -10 });
  const err = await run({ header: () => `Bearer ${token}` });
  assert.equal(err.statusCode, 401);
  assert.match(err.message, /expired/i);
});

test("tampered token is 401", async () => {
  const token = jwt.sign({ _id: "507f1f77bcf86cd799439011" }, "wrong-secret");
  const err = await run({ header: () => `Bearer ${token}` });
  assert.equal(err.statusCode, 401);
});

test("valid token attaches the user", async () => {
  const fakeUser = { _id: "507f1f77bcf86cd799439011", role: "attendee" };
  const original = User.findById;
  User.findById = () => ({ select: async () => fakeUser });
  try {
    const token = jwt.sign({ _id: fakeUser._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
    const req = { cookies: {}, header: () => `Bearer ${token}` };
    const err = await new Promise((resolve) => authMiddleware(req, {}, resolve));
    assert.equal(err, undefined);
    assert.equal(req.user, fakeUser);
  } finally {
    User.findById = original;
  }
});
