import test from "node:test";
import assert from "node:assert/strict";
import { isSandboxAllowed, isSimulatedId } from "../../utils/paymentMode.js";
import { getQrSecret } from "../../utils/qrSecret.js";
import { isOriginAllowed } from "../../config/cors.js";

const withEnv = (vars, fn) => {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
};

test("sandbox payment simulation is disabled in production", () => {
  withEnv({ NODE_ENV: "production" }, () => assert.equal(isSandboxAllowed(), false));
  withEnv({ NODE_ENV: "development" }, () => assert.equal(isSandboxAllowed(), true));
});

test("simulated payment ids are recognised", () => {
  assert.equal(isSimulatedId("sim_cs_123"), true);
  assert.equal(isSimulatedId("order_sim_123"), true);
  assert.equal(isSimulatedId("cs_live_abc"), false);
  assert.equal(isSimulatedId(undefined), false);
});

test("QR secret has no fallback in production", () => {
  withEnv({ NODE_ENV: "production", QR_SECRET: undefined }, () => assert.throws(() => getQrSecret()));
  withEnv({ NODE_ENV: "production", QR_SECRET: "abc" }, () => assert.equal(getQrSecret(), "abc"));
  withEnv({ NODE_ENV: "development", QR_SECRET: undefined }, () => assert.ok(getQrSecret()));
});

test("CORS only allows the configured client origin when CLIENT_URL is set", async () => {
  // cors.js reads CLIENT_URL at import time, so load a fresh copy
  process.env.CLIENT_URL = "https://app.example.com/";
  const fresh = await import(`../../config/cors.js?cb=${Date.now()}`);
  delete process.env.CLIENT_URL;
  assert.equal(fresh.isOriginAllowed("https://app.example.com"), true);
  assert.equal(fresh.isOriginAllowed("https://evil.example.org"), false);
  assert.equal(fresh.isOriginAllowed(undefined), true);
  assert.equal(typeof isOriginAllowed, "function");
});
