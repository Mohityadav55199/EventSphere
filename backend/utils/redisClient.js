/**
 * redisClient.js — Unified Redis client
 *
 * Priority order:
 *   1. Upstash REST API  → set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (Render/Vercel)
 *   2. Standard Redis URL → set REDIS_URL (local Docker / Railway / Redis Cloud)
 *   3. In-memory fallback → no env vars set (single-process dev only, non-persistent)
 */

// ── In-memory fallback (no Redis at all) ──────────────────────────────────────
const inMemoryStore = new Map();
const inMemoryExpiry = new Map();

const inMemoryClient = {
  async set(key, value, options = {}) {
    // Handle NX (only set if not exists)
    if (options.nx && inMemoryStore.has(key)) return null;
    inMemoryStore.set(key, String(value));
    if (options.ex) {
      const prev = inMemoryExpiry.get(key);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        inMemoryStore.delete(key);
        inMemoryExpiry.delete(key);
      }, options.ex * 1000);
      inMemoryExpiry.set(key, timer);
    }
    return "OK";
  },
  async get(key) {
    return inMemoryStore.get(key) ?? null;
  },
  async del(key) {
    inMemoryStore.delete(key);
    const timer = inMemoryExpiry.get(key);
    if (timer) { clearTimeout(timer); inMemoryExpiry.delete(key); }
    return 1;
  },
  async keys(pattern) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return [...inMemoryStore.keys()].filter(k => regex.test(k));
  },
  async mget(...keys) {
    return keys.map(k => inMemoryStore.get(k) ?? null);
  },
};

// ── Upstash REST adapter (wraps @upstash/redis to match our interface) ─────────
function makeUpstashAdapter(upstashClient) {
  return {
    async set(key, value, options = {}) {
      // @upstash/redis set(key, value, { nx, ex })
      return upstashClient.set(key, String(value), options);
    },
    async get(key) {
      return upstashClient.get(key);
    },
    async del(key) {
      return upstashClient.del(key);
    },
    async keys(pattern) {
      return upstashClient.keys(pattern);
    },
    async mget(...keys) {
      if (keys.length === 0) return [];
      return upstashClient.mget(...keys);
    },
  };
}

// ── ioredis adapter (wraps ioredis to match our interface) ────────────────────
function makeIoRedisAdapter(ioRedisClient) {
  return {
    async set(key, value, options = {}) {
      const args = [key, String(value)];
      if (options.ex) { args.push("EX", options.ex); }
      if (options.nx) { args.push("NX"); }
      return ioRedisClient.set(...args);
    },
    async get(key) {
      return ioRedisClient.get(key);
    },
    async del(key) {
      return ioRedisClient.del(key);
    },
    async keys(pattern) {
      return ioRedisClient.keys(pattern);
    },
    async mget(...keys) {
      if (keys.length === 0) return [];
      return ioRedisClient.mget(...keys);
    },
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────
let _client = null;

async function getRedisClient() {
  if (_client) return _client;

  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl     = process.env.REDIS_URL;

  // 1️⃣ Upstash REST (Render / Vercel / serverless)
  if (upstashUrl && upstashToken) {
    try {
      const { Redis } = await import("@upstash/redis");
      const upstash = new Redis({ url: upstashUrl, token: upstashToken });
      _client = makeUpstashAdapter(upstash);
      console.log("✅ Redis: connected via Upstash REST API");
      return _client;
    } catch (err) {
      console.warn("⚠️  Upstash REST init failed:", err.message);
    }
  }

  // 2️⃣ Standard Redis protocol (local / Railway / Redis Cloud)
  if (redisUrl) {
    try {
      const { default: Redis } = await import("ioredis");
      const ioredis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
      await new Promise((resolve, reject) => {
        ioredis.once("ready", resolve);
        ioredis.once("error", reject);
        setTimeout(reject, 5000); // 5s connection timeout
      });
      _client = makeIoRedisAdapter(ioredis);
      console.log("✅ Redis: connected via standard protocol (ioredis)");
      return _client;
    } catch (err) {
      console.warn("⚠️  ioredis connection failed:", err.message);
    }
  }

  // 3️⃣ In-memory fallback
  console.warn(
    "⚠️  No Redis config found. Using in-memory seat hold fallback.\n" +
    "   Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production."
  );
  _client = inMemoryClient;
  return _client;
}

export { getRedisClient };
export default getRedisClient;
