# File 14: Setup, Environment & Deployment

This document provides complete instructions for setting up, configuring, and deploying EventSphere. It details required environment variables (without exposing sensitive secrets), local development commands, and production deployment configurations for Render and Vercel.

---

## 1. System Prerequisites

Before running EventSphere locally, ensure you have:
- **Node.js**: v20.x or higher (`node -v`).
- **npm**: v10.x or higher (`npm -v`).
- **MongoDB**: A free cloud cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) or a local MongoDB service (`mongod`).
- **Redis (Optional)**: A free [Upstash Redis](https://upstash.com/) database or a local Redis instance. *(If omitted, the backend automatically engages its built-in in-memory Map fallback).*
- **Cloudinary Account**: For organizer event banner uploads and user support attachments.
- **Stripe Account**: Test mode API keys (`sk_test_...` and `pk_test_...`) from the Stripe Developer Dashboard.

---

## 2. Environment Variables Specification

Never commit `.env` files to source control. Configure the following variable names:

### 1. Backend Environment Variables (`backend/.env`)

```ini
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (MongoDB Atlas or Local)
# Note: connectDB() appends /EventSphere automatically if omitted
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/EventSphere?retryWrites=true&w=majority

# Authentication Secrets (Dual JWT)
ACCESS_TOKEN_SECRET=your_long_random_access_token_secret_string
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_long_random_refresh_token_secret_string
REFRESH_TOKEN_EXPIRY=10d

# Cryptographic Ticket Secret
# Used by crypto.createHmac for tamper-proof QR code generation
QR_SECRET=your_qr_hmac_secret_key_minimum_32_characters

# Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key

# Optional: Razorpay (for cancellations & legacy refund logic)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Redis Cache (Optional - Upstash REST preferred for cloud deployment)
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

# Alternative Redis Protocol (Optional - for local Docker / TCP)
REDIS_URL=redis://127.0.0.1:6379
```

### 2. Frontend Environment Variables (`.env` in repository root)

```ini
# Backend API Base URL (Do not include trailing slash)
VITE_BACKEND_URL=http://localhost:5000

# Stripe Publishable Key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_publishable_key
```

---

## 3. Local Development Step-by-Step

### Step 1: Clone and Configure Backend
```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Create environment configuration
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, Stripe key, and Cloudinary keys

# Launch backend in development mode (nodemon on port 5000)
npm run dev
```

### Step 2: Verify Backend Health
Open `http://localhost:5000` in your browser. You should receive:
```json
{
  "success": true,
  "message": "EventSphere API is running smoothly 🚀",
  "timestamp": "2026-10-14T10:30:00.000Z"
}
```

### Step 3: Configure and Launch Frontend
Open a second terminal window in the project root:
```bash
# Install frontend dependencies
npm install

# Launch frontend via Vite dev server
npm run dev
```
Open `http://localhost:5173`. You can now browse seeded events, register accounts, and interact with the seat map.

---

## 4. Production Deployment Architecture

EventSphere is architected for dual-cloud hosting:
- **Backend on Render**: Hosted on Render as a persistent Node.js Web Service to maintain continuous WebSocket (Socket.io) connections and support the 60-second Node-Cron worker.
- **Frontend on Vercel**: Hosted on Vercel as a global, static Single Page Application with edge caching.

```
+------------------------------------+       +------------------------------------+
|          VERCEL (Frontend)         |       |          RENDER (Backend)          |
|                                    |       |                                    |
| • Static React 19 Build (Vite)     | HTTPS | • Node.js 20 Web Service           |
| • Edge CDN distribution            |──────>| • Socket.io WebSocket Server       |
| • SPA routing rewrites             |       | • Background node-cron Job         |
| • Domain: eventsphere.vercel.app   |       | • Domain: eventsphere-backend.on...|
+------------------------------------+       +------------------------------------+
```

---

## 5. Backend Deployment Guide (Render)

Render is recommended for the backend because serverless platforms (like AWS Lambda or Vercel Serverless) terminate connections after HTTP responses, breaking persistent WebSockets and cron jobs.

### Configuration Steps
1. Navigate to the [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configure the settings:
   - **Name**: `eventsphere-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Runtime**: `Node 20`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Enter the backend environment variables listed in Section 2.
5. In **Advanced Settings**, ensure auto-deploy on git push is enabled.
6. Once deployed, note your backend URL: `https://eventsphere-backend.onrender.com`.

---

## 6. Frontend Deployment Guide (Vercel)

Vercel provides optimal CDN caching and sub-second asset delivery for Vite SPAs.

### 1. SPA Routing Configuration (`vercel.json`)
EventSphere includes a verified [vercel.json](../../vercel.json) in the project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```
**Why this is critical**: Because EventSphere is a Single Page Application using HTML5 `pushState` history routing, direct navigation to `/events/673...` or `/profile` would result in a 404 error from standard static servers. This rewrite rule redirects all deep links back to `index.html`, allowing React Router to handle page rendering client-side.

### 2. Vercel Configuration Steps
1. Navigate to the [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Import the EventSphere repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (Root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variables:
   - `VITE_BACKEND_URL`: `https://eventsphere-backend.onrender.com`
   - `VITE_STRIPE_PUBLIC_KEY`: `pk_test_...`
5. Click **Deploy**.

---

## 7. Production Health & Observability Checklist

Before opening the platform to public traffic:
1. **CORS Origin Hardening**:
   In `backend/app.js:39-44`, change `origin: true` to an explicit whitelist array:
   ```javascript
   app.use(cors({
     origin: [process.env.CLIENT_URL, "https://eventsphere.vercel.app"],
     credentials: true
   }));
   ```
2. **Database Connection Pooling**:
   Verify MongoDB Atlas connection limits to ensure connection spikes during flash sales do not exceed cluster tier limits.
3. **Stripe Webhook Configuration**:
   Register a live webhook endpoint in the Stripe Dashboard pointing to `/api/v1/bookings/stripe-webhook` to provide a redundant payment confirmation channel.
4. **Health Check Monitoring**:
   Configure an external monitoring service (e.g., UptimeRobot, Better Uptime) pinging `GET https://eventsphere-backend.onrender.com/` every 5 minutes to prevent free-tier instances from idling to sleep.

---

## 8. Summary for Technical Interviews

> "EventSphere is deployed using a decoupled multi-cloud strategy. The frontend is bundled with Vite and hosted on Vercel as an SPA, utilizing a `vercel.json` rewrite rule to route all deep links to `index.html`. The backend runs as a persistent Node 20 service on Render to support uninterrupted Socket.io WebSocket connections and the 60-second seat hold cleanup cron worker. Secrets are managed through environment variables without hardcoded defaults, and the backend features an automated database health check and self-healing data bootstrapping on boot."
