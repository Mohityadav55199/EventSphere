import test from "node:test";
import assert from "node:assert/strict";
import { publicIdFromUrl } from "../../utils/cloudinary.js";
import { createEventSchema, updateEventSchema } from "../../validators/schemas.js";
import { seatIdAt, seatIndexOf, isSeatOnMap } from "../../utils/seatLayout.js";

test("Cloudinary public_id is extracted from every URL shape we store", () => {
  const base = "https://res.cloudinary.com/demo/image/upload";
  assert.equal(publicIdFromUrl(`${base}/v1712345678/folder/poster.jpg`), "folder/poster");
  assert.equal(publicIdFromUrl(`${base}/v1712345678/poster.png`), "poster");
  assert.equal(publicIdFromUrl(`${base}/c_fill,w_300/v17/a/b/c.webp`), "a/b/c");
  assert.equal(publicIdFromUrl(`${base}/c_fill,w_300/abc.jpg`), "abc");
  assert.equal(publicIdFromUrl(`${base}/abc123.jpg?x=1`), "abc123");
  // seeded/external images must never trigger a delete call
  assert.equal(publicIdFromUrl("https://images.unsplash.com/photo.jpg"), null);
  assert.equal(publicIdFromUrl(undefined), null);
});

const validEvent = {
  title: "Jazz Night", description: "A long enough description", date: "2030-01-01T18:00",
  location: "Pune", locationGoogleMapLink: "https://maps.example.com", Price: "500", category: "Music", capacity: "100",
};

test("ticket tiers arrive as JSON text in multipart forms and are parsed and validated", () => {
  const ok = createEventSchema.safeParse({ ...validEvent, ticketTypes: JSON.stringify([{ name: "VIP", price: "1500" }, { name: "Standard", price: 500 }]) });
  assert.equal(ok.success, true);
  assert.equal(ok.data.ticketTypes[0].price, 1500);

  const dup = createEventSchema.safeParse({ ...validEvent, ticketTypes: JSON.stringify([{ name: "VIP", price: 1 }, { name: "vip", price: 2 }]) });
  assert.equal(dup.success, false);
  assert.equal(createEventSchema.safeParse({ ...validEvent, category: "Rave" }).success, false);
});

test("event update only accepts known fields (no activeStatus / organizer / seats)", () => {
  assert.equal(updateEventSchema.safeParse({ title: "New title" }).success, true);
  assert.equal(updateEventSchema.safeParse({ activeStatus: "cancelled" }).success, false);
  assert.equal(updateEventSchema.safeParse({ bookedSeats: [] }).success, false);
});


test("seat ids map 1:1 to seat numbers, matching the frontend seat map", () => {
  assert.deepEqual([0, 9, 10, 259, 260].map(seatIdAt), ["A1", "A10", "B1", "Z10", "AA1"]);
  for (let i = 0; i < 2000; i++) assert.equal(seatIndexOf(seatIdAt(i)), i);
  for (const bad of ["A0", "A11", "a1", "Z99", "VIP-1", "", "1A"]) assert.equal(seatIndexOf(bad), -1, bad);
  assert.equal(isSeatOnMap("Y10", 250), true);
  assert.equal(isSeatOnMap("Z1", 250), false);
});
