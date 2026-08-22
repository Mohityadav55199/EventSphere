/**
 * concurrencyTest.js — Stress test for seat booking concurrency
 *
 * Simulates N users trying to book seats simultaneously for an event
 * that only has M seats available.
 *
 * Expected result: Exactly M/seatsPerBooking bookings succeed, rest fail with 409.
 *
 * Run with:
 *   node backend/tests/concurrencyTest.js
 *
 * Requirements:
 *   - Backend must be running on localhost:5000
 *   - MONGODB_URI set in backend/.env
 *   - You need at least one event and user seeded
 */

const BACKEND_URL = "http://localhost:5000";

// ── Config — adjust these to match your test data ─────────────────────────────
const EVENT_ID = "REPLACE_WITH_REAL_EVENT_ID";        // from DB
const AUTH_TOKEN = "REPLACE_WITH_REAL_JWT_TOKEN";     // login first, grab token
const SEATS_PER_BOOKING = 2;                          // each simulated user books 2 seats
const CONCURRENT_USERS = 20;                          // 20 users at exactly the same time
// ─────────────────────────────────────────────────────────────────────────────

async function attemptBooking(userId) {
  const start = Date.now();
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/bookings/create-order/${EVENT_ID}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        seatsBooked: SEATS_PER_BOOKING,
        ticketTier: "Standard Pass",
      }),
    });

    const data = await res.json();
    const elapsed = Date.now() - start;

    return {
      userId,
      status: res.status,
      success: res.ok,
      message: data.message,
      elapsed,
    };
  } catch (err) {
    return { userId, status: 500, success: false, message: err.message, elapsed: 0 };
  }
}

async function runConcurrencyTest() {
  console.log("🚀 EventSphere Concurrency Stress Test");
  console.log(`   Event ID: ${EVENT_ID}`);
  console.log(`   Simulated users: ${CONCURRENT_USERS}`);
  console.log(`   Seats per booking: ${SEATS_PER_BOOKING}`);
  console.log(`   Total seats attempted: ${CONCURRENT_USERS * SEATS_PER_BOOKING}`);
  console.log("─".repeat(60));

  // Fire all requests simultaneously
  const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => attemptBooking(i + 1));
  const results = await Promise.allSettled(promises);

  let successes = 0;
  let failures = 0;
  let conflicts = 0;

  results.forEach(({ value: r }) => {
    if (!r) return;
    if (r.success) {
      successes++;
      console.log(`  ✅ User ${r.userId}: SUCCESS (${r.elapsed}ms)`);
    } else if (r.status === 409) {
      conflicts++;
      console.log(`  🔒 User ${r.userId}: CONFLICT — ${r.message} (${r.elapsed}ms)`);
    } else {
      failures++;
      console.log(`  ❌ User ${r.userId}: ERROR ${r.status} — ${r.message} (${r.elapsed}ms)`);
    }
  });

  console.log("─".repeat(60));
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Successful bookings: ${successes} (${successes * SEATS_PER_BOOKING} seats held)`);
  console.log(`   🔒 Properly rejected (409 Conflict): ${conflicts}`);
  console.log(`   ❌ Errors: ${failures}`);
  console.log(`\n${successes + conflicts === CONCURRENT_USERS ? "✅ PASS" : "❌ FAIL"}: All requests handled deterministically`);
  console.log(
    `${failures === 0 ? "✅ PASS" : "❌ FAIL"}: No unexpected errors (only 409 conflicts expected)`
  );
}

runConcurrencyTest().catch(console.error);
