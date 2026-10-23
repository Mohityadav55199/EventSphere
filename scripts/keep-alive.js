/**
 * EventSphere Keep-Alive Health Ping Script
 * 
 * Prevents Render free-tier web services from sleeping due to inactivity.
 * Pings the /health and / endpoints with retry handling for cold starts.
 */

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  "https://eventsphere-backend-nhzy.onrender.com"
).replace(/\/$/, "");

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15000; // 15 seconds between retries to allow Render to finish waking up
const TIMEOUT_MS = 60000;      // 60 seconds timeout (Render cold boot can take 30-50s)

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "EventSphere-KeepAlive/1.0",
        ...(options.headers || {})
      }
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function pingEndpoint(url) {
  const startTime = Date.now();
  console.log(`📡 Pinging: ${url}...`);

  const response = await fetchWithTimeout(url);
  const latency = Date.now() - startTime;

  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "<no body>";
  }

  return {
    status: response.status,
    ok: response.ok,
    latency,
    body: body.slice(0, 300) // snippet
  };
}

async function runKeepAlive() {
  console.log("==========================================");
  console.log(`🚀 EventSphere Server Keep-Alive Ping`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`🎯 Target Host: ${BACKEND_URL}`);
  console.log("==========================================");

  const endpoints = [`${BACKEND_URL}/health`, `${BACKEND_URL}/`];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[Attempt ${attempt}/${MAX_RETRIES}]`);
      const targetUrl = endpoints[0];
      const result = await pingEndpoint(targetUrl);

      if (result.ok) {
        console.log(`✅ Success! Response ${result.status} in ${result.latency}ms`);
        console.log(`📦 Response Body: ${result.body}`);
        console.log("\n🎉 Server is awake and healthy! Keep-alive succeeded.");
        process.exit(0);
      } else {
        console.warn(`⚠️ Warning: Server responded with status ${result.status}`);
        console.warn(`Response: ${result.body}`);
      }
    } catch (err) {
      console.error(`❌ Attempt ${attempt} failed: ${err.message}`);
      if (err.name === "AbortError") {
        console.warn("⏳ Request timed out (Render may still be booting from cold sleep)...");
      }
    }

    if (attempt < MAX_RETRIES) {
      console.log(`⏳ Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  console.error("\n💥 All keep-alive attempts failed. Check if the server is deployed and accessible.");
  process.exit(1);
}

runKeepAlive();
