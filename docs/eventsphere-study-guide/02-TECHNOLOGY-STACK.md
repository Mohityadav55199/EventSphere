# File 02: Technology Stack

This document breaks down every technology used in EventSphere. For each entry, we examine what it does, why it was chosen for this project, its exact code locations, practical alternatives with trade-offs, and how to discuss it in technical interviews.

---

## 1. Technology Inventory

```
+-----------------------------------------------------------------------------------------+
|                                    EVENTSPHERE STACK                                    |
|                                                                                         |
|  FRONTEND                      BACKEND                      STORAGE & CACHE             |
|  • React 19.1.1 (Vite 7)       • Node.js 20.x (ESM)         • MongoDB Atlas / Mongoose  |
|  • Redux Toolkit 2.8.2         • Express 5.1.0              • Redis (Upstash / ioredis) |
|  • Tailwind CSS v4             • Socket.io 4.7.5            • In-memory fallback map    |
|  • React Router DOM 7.8.1      • Stripe SDK 22.4.0          • Cloudinary CDN            |
|  • Socket.io Client 4.8.1      • JWT & bcryptjs             • Node Native Crypto        |
|  • Recharts & html2pdf.js      • express-rate-limit 8.6.1   • node-cron 4.6.0           |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Frontend Technologies

### 1. React (v19.1.1) & Vite (v7.1.3)
- **What it is**: React is a declarative component-based UI library. Vite is a next-generation frontend bundler powered by Rollup and native ES modules.
- **Why EventSphere uses it**: EventSphere features dynamic interactive views (seat selection grid, live seat count badges, community chat box) that demand fast reactive re-rendering. Vite provides sub-second Hot Module Replacement (HMR) and optimized build bundling.
- **Where it appears**:
  - Root configuration: [vite.config.js](../../vite.config.js#L1-L8)
  - Initialization: [main.jsx](../../src/main.jsx#L1-L75)
  - App root: [App.jsx](../../src/App.jsx#L1-L60)
- **Alternatives & Trade-offs**:
  - *Next.js (SSR/SSG)*: Offers better SEO out of the box and server components. However, for a high-concurrency booking dashboard with extensive client-side WebSocket state, an SPA with Vite provides simpler deployment on Vercel with minimal serverless latency.
- **Interview Soundbite**:
  > "We chose React 19 with Vite to build an SPA optimized for instant client-side updates. Vite leverages native browser ES modules during development, giving us fast HMR while isolating the client build from the Express backend."

---

### 2. Redux Toolkit (v2.8.2) & React-Redux (v9.2.0)
- **What it is**: Redux Toolkit (RTK) is the official, opinionated toolset for standardized Redux state management.
- **Why EventSphere uses it**: Manages global authentication credentials (`user`, `accessToken`, `authStatus`) across deeply nested routes, preventing prop drilling between the navigation header, protected route guards, and booking modals.
- **Where it appears**:
  - Store definition: [store.js](../../src/store/store.js#L1-L8)
  - Auth slice: [authslice.js](../../src/store/authslice.js#L1-L32)
  - Consumer hook: [App.jsx](../../src/App.jsx#L12-L33)
- **Alternatives & Trade-offs**:
  - *Zustand*: Smaller bundle footprint and simpler boilerplate. RTK was chosen for strict reducer immutability via Immer and predictable devtools debugging.
- **Interview Soundbite**:
  > "We use Redux Toolkit specifically for session state. When a user logs in, the `authSlice` stores their profile and access token, allowing router guards and the header to synchronize immediately without prop drilling."

---

### 3. Tailwind CSS (v4.1.12)
- **What it is**: A utility-first CSS framework for rapid UI styling directly inside JSX.
- **Why EventSphere uses it**: EventSphere uses Tailwind v4 with the new `@tailwindcss/vite` plugin to produce responsive layouts, glassmorphic card overlays (`bg-white/90 backdrop-blur-md`), and status-based seat colorings (`bg-emerald-50`, `bg-indigo-500`, `bg-amber-100`).
- **Where it appears**:
  - Vite plugin: [vite.config.js](../../vite.config.js#L6)
  - Global styles: [index.css](../../src/index.css#L1-L4)
  - Component styling: [SeatMap.jsx](../../src/Components/SeatMap.jsx#L62-L68)
- **Alternatives & Trade-offs**:
  - *CSS Modules / Styled Components*: Provide scoped styles but require more context switching and increase runtime JavaScript overhead compared to zero-runtime utility classes.
- **Interview Soundbite**:
  > "Tailwind v4 gives us zero-runtime CSS with the new Vite plugin. We use utility classes to bind seat state directly to design tokens—such as amber for held seats and emerald for available seats."

---

### 4. React Router DOM (v7.8.1)
- **What it is**: The standard declarative client-side routing library for React.
- **Why EventSphere uses it**: Enables nested routes with `createBrowserRouter` and code-splitting via `React.lazy` and `Suspense`, preventing the entire bundle from downloading upfront.
- **Where it appears**:
  - Route tree: [main.jsx](../../src/main.jsx#L32-L64)
  - Navigation outlet: [App.jsx](../../src/App.jsx#L48-L50)
  - Protected layout guard: [AuthLayout.jsx](../../src/Components/AuthLayout.jsx#L1-L28)
- **Alternatives & Trade-offs**:
  - *TanStack Router*: Offers full TypeScript route safety. React Router v7 was chosen for broad community familiarity and straightforward route guard wrapping.
- **Interview Soundbite**:
  > "We configure React Router v7 with route-level code splitting using `React.lazy`. Route guards dynamically verify user roles before mounting organizer dashboards or checkout pages."

---

### 5. Recharts (v3.10.1) & html2pdf.js (v0.14.0)
- **What it is**: Recharts is a composable SVG charting library. html2pdf.js is a client-side HTML-to-PDF compiler using jsPDF and html2canvas.
- **Why EventSphere uses it**:
  - Recharts renders real-time organizer revenue, booking volume, and seat occupancy graphs in [Dashboard.jsx](../../src/Pages/Dashboard.jsx#L183-L193).
  - html2pdf captures the DOM ticket node (including attendee metadata and the generated QR code image) and renders an A4 PDF for download in [Profile.jsx](../../src/Pages/Profile.jsx#L127-L139).
- **Alternatives & Trade-offs**:
  - *Server-side PDF generation (Puppeteer/PDFKit)*: Offloads rendering from the client but introduces significant CPU and memory overhead on the backend. Client-side rendering via html2pdf protects server resources.

---

## 3. Backend Technologies

### 1. Node.js (v20.x) & Express.js (v5.1.0)
- **What it is**: Node.js is an asynchronous, event-driven JavaScript runtime. Express 5 is the modern evolution of the classic Node web framework.
- **Why EventSphere uses it**: EventSphere takes advantage of Express 5's native support for returning rejected promises in route handlers, eliminating the need for manual try-catch wrappers around async controllers.
- **Where it appears**:
  - Engines declaration: [package.json](../../backend/package.json#L6-L8)
  - Server pipeline: [app.js](../../backend/app.js#L1-L68)
  - HTTP initialization: [index.js](../../backend/index.js#L24-L33)
- **Alternatives & Trade-offs**:
  - *Fastify*: Provides higher raw HTTP throughput via JSON schema compilation. Express 5 was chosen for rich middleware compatibility (multer, cookie-parser, rate-limit).
- **Interview Soundbite**:
  > "We run Node 20 with Express 5.1.0 using ECMAScript modules. Express 5 natively handles rejected async promises, allowing our custom `asyncHandler` and global error middleware to capture exceptions cleanly."

---

### 2. MongoDB (v6.16.0) & Mongoose (v8.15.1)
- **What it is**: MongoDB is a document-oriented NoSQL database. Mongoose is an Object Data Modeling (ODM) library providing schema enforcement, validation, and lifecycle hooks.
- **Why EventSphere uses it**: Events and bookings possess nested, polymorphic structures (attendee arrays, ticket tiers, QR payload hashes). Mongoose schemas enforce data integrity while enabling atomic updates (`$push`, `$pullAll`, `$inc`, `$nin`).
- **Where it appears**:
  - Database connection: [db.js](../../backend/config/db.js#L1-L31)
  - Schemas: [event.model.js](../../backend/models/event.model.js#L1-L115), [booking.model.js](../../backend/models/booking.model.js#L1-L93)
  - Atomic operators: [bookingLock.js](../../backend/utils/bookingLock.js#L24-L68)
- **Alternatives & Trade-offs**:
  - *PostgreSQL with Prisma*: Provides strict relational foreign keys. MongoDB was chosen for flexible event document hierarchies and native atomic array modifications.
- **Interview Soundbite**:
  > "MongoDB Atlas acts as our system of record. We rely heavily on atomic document operations like `findOneAndUpdate` with `$nin` filters to guarantee that seats cannot be double-booked at the database layer."

---

### 3. Redis Ecosystem: `@upstash/redis` (v1.38.2) & `ioredis` (v6.0.0)
- **What it is**: Redis is an in-memory key-value data store. `@upstash/redis` communicates over HTTP REST (ideal for serverless and firewall-restricted hosts). `ioredis` provides high-performance TCP socket connections.
- **Why EventSphere uses it**: Powers the seat-hold mechanism. EventSphere implements a **three-tier client adapter** that automatically selects Upstash REST, standard TCP Redis, or an in-memory JavaScript Map fallback based on environment variables.
- **Where it appears**:
  - Unified adapter: [redisClient.js](../../backend/utils/redisClient.js#L1-L148)
  - Seat reservation logic: [seatHold.js](../../backend/utils/seatHold.js#L26-L74)
- **Alternatives & Trade-offs**:
  - *Database-only locks*: Placing temporary holds directly into MongoDB increases write-amplification and requires frequent polling. Redis holds are kept in RAM with native sub-millisecond TTL expirations.
- **Interview Soundbite**:
  > "Our Redis client implements the Adapter pattern. It checks for Upstash REST credentials first, falls back to TCP `ioredis`, and defaults to an in-memory Map for local dev. This keeps temporary seat holds entirely off our database disk."

---

### 4. Socket.io (v4.7.5) & Socket.io-client (v4.8.1)
- **What it is**: An event-driven library enabling bi-directional, low-latency communication between web clients and servers via WebSockets with HTTP long-polling fallback.
- **Why EventSphere uses it**:
  - Broadcasts live seat availability changes to watching users without polling (`seats:{eventId}`).
  - Provides real-time messaging, typing indicators, and message history for confirmed event community members.
- **Where it appears**:
  - Backend socket manager: [socket.js](../../backend/socket.js#L12-L170)
  - Frontend seat watcher: [useLiveSeatCount.js](../../src/hooks/useLiveSeatCount.js#L79-L131)
  - Frontend chat component: [Chatbox.jsx](../../src/Components/Chatbox/Chatbox.jsx#L25-L62)
- **Alternatives & Trade-offs**:
  - *Server-Sent Events (SSE)*: Excellent for one-way seat count streaming, but does not support bidirectional messaging for attendee community chat.
- **Interview Soundbite**:
  > "We use Socket.io for dual purposes: public rooms for broadcast seat updates during ticket drops, and authenticated rooms for attendee community chat that require a verified booking."

---

### 5. Stripe SDK (v22.4.0) & `@stripe/stripe-js` (v9.12.1)
- **What it is**: Official developer tools for integrating Stripe Checkout and card payments.
- **Why EventSphere uses it**: Delegates PCI compliance and credit card handling to Stripe Checkout sessions. Metadata passes booking identifiers, discount amounts, and selected seat arrays for post-payment verification.
- **Where it appears**:
  - Session creation: [booking.controller.js](../../backend/controllers/booking.controller.js#L211-L241)
  - Frontend redirect: [DetailEvent.jsx](../../src/Pages/DetailEvent.jsx#L118-L122)
- **Alternatives & Trade-offs**:
  - *Custom Stripe Elements form*: Gives full UI control inside the app, but increases PCI-DSS compliance scope. Stripe Checkout provides a trusted, responsive checkout page with zero sensitive card data touching our servers.
- **Interview Soundbite**:
  > "We use Stripe Checkout sessions. The backend embeds booking IDs and seat matrices into session metadata and sets a matching 30-minute expiration, guaranteeing that Stripe sessions expire in tandem with our Redis holds."

---

### 6. Security & Utilities: JWT, bcryptjs, crypto, qrcode, express-rate-limit
- **jsonwebtoken (v9.0.2)**: Issues signed access tokens (containing user ID, role, and email) and refresh tokens stored in HTTP-only cookies.
- **bcryptjs (v3.0.2)**: Hashes user passwords with 10 salt rounds in Mongoose pre-save hooks.
- **crypto (Node Native)**: Generates HMAC-SHA256 digests over ticket payloads (`bookingId:randomHex`) using `QR_SECRET`.
- **qrcode (v1.5.4)**: Compiles the cryptographic ticket signature into a Base64 PNG data URL saved on the booking document.
- **express-rate-limit (v8.6.1)**: Throttles auth endpoints (100 requests per 15 min) and booking actions (5 attempts per min per IP/User) using IPv6-safe key generators.
- **node-cron (v4.6.0)**: Background worker executing every 60 seconds to release abandoned seat holds.

---

## 4. Summary Table: Technology Justification Matrix

| Technology | Architectural Responsibility | Key Alternative | Why We Chose Our Stack |
| :--- | :--- | :--- | :--- |
| **React 19 + Vite 7** | Client SPA & seat interaction | Next.js 15 | Ultra-fast client re-rendering and simple static hosting on Vercel |
| **Express 5.1.0** | REST API & routing | Fastify | Native promise handling in middleware, broad ecosystem support |
| **MongoDB Atlas** | Persistent system of record | PostgreSQL | Native document arrays for seats and flexible event schemas |
| **Upstash / ioredis** | Temporary seat holds | Memcached | Atomic key operations (`SET NX EX`) and TTL support |
| **Socket.io 4.7** | Real-time seat updates & chat | SSE + Pusher | Unified protocol supporting both broadcast metrics and bi-directional chat |
| **Stripe Checkout** | Card payments & security | Razorpay Only | Global currency support, hosted PCI-compliant checkout |
| **Cloudinary** | Media CDN & image storage | AWS S3 | Automatic image optimization, resizing, and simple buffer streaming |
