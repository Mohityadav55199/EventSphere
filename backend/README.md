
---

# ⚙️ Backend (Node.js + Express + MongoDB)

### **About Section (GitHub)**  
> EventEase Backend is the core API service for the EventEase platform. It manages user authentication, event creation, booking, and payment handling. It integrates Razorpay for secure payments, Cloudinary for image storage, and implements a wallet points system for cashback. Built with Node.js, Express, and MongoDB, it provides scalable and secure REST APIs.

### **README.md**
```markdown
# EventEase Backend ⚙️

The backend of **EventEase**, a complete event booking system with user authentication, payment processing, wallet cashback, and event management.

 🚀 Features
- 👤 User authentication (JWT-based)
- 🗂️ Role-based access control (admin, organizer, user)
- 📝 Event creation & management
- 💳 Razorpay integration for payments
- 💰 Wallet points system with discounts & rewards
- 🖼️ Cloudinary integration for image uploads
- 📧 Secure APIs for bookings & event data
- 🛡️ Middleware-based auth & validation
- 💬 Real-time Socket.io based Chat for event communities

## 🛠️ Tech Stack
- Node.js
- Express.js
- MongoDB + Mongoose
- Razorpay SDK
- Cloudinary SDK
- Multer (file handling)
- Socket.io

## 📦 Installation
```bash
# Clone repo
git clone <your-backend-repo-url>
cd backend

# Install dependencies
npm install

3. Environment Variables

Create a .env file in the root directory and configure:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLIENT_URL= your_client_url
ACCESS_TOKEN_SECRET= your_token_secret
ACCESS_TOKEN_EXPIRY= in days(d)
REFRESH_TOKEN_SECRET=your_token_secret
REFRESH_TOKEN_EXPIRY= in days(d)

# Run dev server
npm run dev
