import test from "node:test";
import assert from "node:assert/strict";
import { registerSchema, loginSchema, createEventSchema, idParam } from "../../validators/schemas.js";
import validate from "../../middlewares/validate.middleware.js";

test("register rejects self-signup as admin", () => {
  const r = registerSchema.safeParse({ name: "Test", email: "t@t.com", password: "123456", role: "admin" });
  assert.equal(r.success, false);
});

test("register accepts organizer and normalizes email", () => {
  const r = registerSchema.safeParse({ name: "Test", email: " T@T.com ", password: "123456", role: "organizer" });
  assert.equal(r.success, true);
  assert.equal(r.data.email, "t@t.com");
});

test("register rejects short password and bad email", () => {
  const r = registerSchema.safeParse({ name: "Test", email: "nope", password: "1" });
  assert.equal(r.success, false);
  assert.ok(r.error.issues.length >= 2);
});

test("login requires email and password", () => {
  assert.equal(loginSchema.safeParse({ email: "a@b.co" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success, true);
});

test("createEvent coerces multipart string fields", () => {
  const r = createEventSchema.safeParse({
    title: "Jazz Night",
    description: "An evening of live jazz music",
    date: "2030-12-01T10:00",
    location: "City Hall",
    locationGoogleMapLink: "https://maps.example.com",
    Price: "250",
    category: "Music",
    capacity: "100",
  });
  assert.equal(r.success, true);
  assert.equal(r.data.Price, 250);
  assert.equal(r.data.capacity, 100);
  assert.ok(r.data.date instanceof Date);
});

test("idParam rejects non-ObjectId values", () => {
  assert.equal(idParam.safeParse({ id: "xyz" }).success, false);
  assert.equal(idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success, true);
});

test("validate middleware forwards a 400 ApiError and replaces body on success", () => {
  const mw = validate(loginSchema);

  let err;
  mw({ body: { email: "bad" } }, {}, (e) => { err = e; });
  assert.equal(err.statusCode, 400);

  const req = { body: { email: " A@B.co ", password: "pw" } };
  let nextArg = "unset";
  mw(req, {}, (e) => { nextArg = e; });
  assert.equal(nextArg, undefined);
  assert.equal(req.body.email, "a@b.co");
});
