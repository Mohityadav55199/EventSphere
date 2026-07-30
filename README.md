# EventSphere 🎉

EventSphere is a modern, full-stack event discovery and booking platform. It enables users to browse, search, and reserve events with secure Stripe payments, wallet cashback rewards, QR code ticket generation, and real-time chat communities.

---

## 🛠️ Tech Stack

- **Frontend**: React.js, Tailwind CSS, Redux Toolkit, Axios, Vite, Socket.io-client
- **Backend**: Node.js, Express.js, MongoDB Atlas / Mongoose, Socket.io, Stripe SDK, Cloudinary, QRCode, JWT Authentication

---

## 🚀 Deployment Guide

### 1. Backend Deployment (Render) — Recommended for WebSockets (Socket.io)

1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `https://github.com/Mohityadav55199/EventSphere.git`.
3. Configure the Web Service:
   - **Name**: `eventsphere-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Add the Environment Variables:
   - `MONGODB_URI`: `mongodb+srv://...`
   - `ACCESS_TOKEN_SECRET`: `your_access_token_secret`
   - `ACCESS_TOKEN_EXPIRY`: `1d`
   - `REFRESH_TOKEN_SECRET`: `your_refresh_token_secret`
   - `REFRESH_TOKEN_EXPIRY`: `10d`
   - `CLIENT_URL`: `https://your-frontend-app.vercel.app`
   - `STRIPE_SECRET_KEY`: `sk_test_...`
   - `QR_SECRET`: `your_qr_secret`
   - `CLOUDINARY_CLOUD_NAME`: `your_cloud_name`
   - `CLOUDINARY_API_KEY`: `your_api_key`
   - `CLOUDINARY_API_SECRET`: `your_api_secret`

---

### 2. Frontend Deployment (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Import repository `https://github.com/Mohityadav55199/EventSphere.git`.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (Root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variables:
   - `VITE_BACKEND_URL`: `https://eventsphere-backend.onrender.com` (Your deployed Render backend URL)
   - `VITE_STRIPE_PUBLIC_KEY`: `pk_test_...`
5. Click **Deploy**.

---

## 💻 Local Development Setup

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```
