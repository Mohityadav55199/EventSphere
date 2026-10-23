# File 04: Frontend Walkthrough

This document guides you through the frontend architecture and implementation of EventSphere. It explores how the application initializes, manages global and local state, configures routing and authentication guards, communicates with the backend API, and renders interactive interfaces like the live seat map and community chat.

---

## 1. Application Initialization & Root Setup

The frontend entry point is [main.jsx](../../src/main.jsx), which mounts the React application into the DOM root.

```
index.html  ──>  main.jsx  ──>  Provider (Redux)  ──>  SearchProvider  ──>  RouterProvider (React Router)  ──>  App.jsx
```

### 1. `main.jsx` ([src/main.jsx](../../src/main.jsx#L1-L75))
- **Strict Mode & React 19 Root**: Uses `createRoot(document.getElementById('root')).render(...)` inside `<StrictMode>`.
- **Global Providers**: Wraps the application in two hierarchical context providers:
  1. `<Provider store={store}>`: Injects the Redux Toolkit store.
  2. `<SearchProvider>`: Injects custom React Context for cross-component search queries between the navigation bar and catalog pages.
- **Route-Level Code Splitting**: All 10 application pages are imported lazily using `React.lazy()`:
  ```javascript
  // src/main.jsx:12-21
  const Home = lazy(() => import('./Pages/Home'));
  const LogIn = lazy(() => import('./Pages/LogIn'));
  const Signup = lazy(() => import('./Pages/Signup'));
  const Profile = lazy(() => import('./Pages/Profile'));
  const Events = lazy(() => import('./Pages/Events'));
  const About = lazy(() => import('./Pages/About'));
  const Contact = lazy(() => import('./Pages/Contact'));
  const Dashboard = lazy(() => import('./Pages/Dashboard'));
  const AddEvent = lazy(() => import('./Pages/AddEvent'));
  const DetailEvent = lazy(() => import('./Pages/DetailEvent'));
  ```
  Every route is wrapped in `<Suspense fallback={<PageLoader />}>`, rendering a custom spinner during chunk downloads.

### 2. `App.jsx` ([src/App.jsx](../../src/App.jsx#L1-L60))
- **Session Rehydration**: On mount, `App.jsx` inspects Redux and `localStorage` for an existing `accessToken`:
  ```javascript
  // src/App.jsx:15-42
  useEffect(() => {
    const token = accessToken || localStorage.getItem("accessToken");
    if (!token) {
      dispatch(logout());
      setLoading(false);
      return;
    }

    getUserProfile(token)
      .then((userData) => {
        if (userData) {
          dispatch(setCredentials({ user: userData, accessToken: token }));
        } else {
          dispatch(logout());
        }
      })
      .catch((error) => {
        dispatch(logout());
      })
      .finally(() => setLoading(false));
  }, [accessToken, dispatch]);
  ```
- **Application Shell**: While validating credentials, it displays `"Initializing EventSphere..."`. Once settled, it renders the global layout with `<Header />`, `<ScrollToTop />`, `<Outlet />` (current page content), and `<Footer />`.

---

## 2. Routing, Route Guards, and Navigation

EventSphere uses React Router DOM v7 with `createBrowserRouter` and `createRoutesFromElements` ([src/main.jsx:32-64](../../src/main.jsx#L32-L64)).

### Route Inventory

| Route Path | Component | Auth Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `Home.jsx` | No | Hero section, 3D globe visualization, featured events |
| `/login` | `LogIn.jsx` | Guest Only (`authenication={false}`) | User sign-in form |
| `/signup` | `Signup.jsx` | Guest Only (`authenication={false}`) | User registration form |
| `/events` | `Events.jsx` | No | Searchable event catalog with category filters |
| `/events/:id`, `/event/:id` | `DetailEvent.jsx` | No | Event details, live seat map, reviews, chat |
| `/about` | `About.jsx` | No | Platform overview and mission statement |
| `/contact` | `Contact.jsx` | No | Support and organizer inquiry form |
| `/profile` | `Profile.jsx` | Logged In (`authenication={true}`) | User profile, ticket ledger, QR display, PDF download |
| `/dashboard` | `Dashboard.jsx` | Organizer/Admin (`authenication={true}`) | Revenue charts, booking statistics, event cancellations |
| `/create-event` | `AddEvent.jsx` | Organizer/Admin (`authenication={true}`) | Multipart event publishing form with image upload |

### The Route Guard: `AuthLayout.jsx` ([src/Components/AuthLayout.jsx](../../src/Components/AuthLayout.jsx#L1-L28))
The `Protected` component guards sensitive views:
```javascript
// src/Components/AuthLayout.jsx:4-24
export function Protected({ children, authenication = true }) {
  const authStatus = useSelector((state) => state.auth.status);
  const navigate = useNavigate();
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    // If route requires auth (true) and user is NOT logged in (false) -> redirect /login
    if (authenication && authStatus !== authenication) {
      navigate('/login');
    }
    // If route requires guest (false) and user IS logged in (true) -> redirect /
    else if (!authenication && authStatus !== authenication) {
      navigate('/');
    }
    setLoader(false);
  }, [authStatus, navigate, authenication]);

  return loader ? <h1>Loading...</h1> : <>{children}</>;
}
```

---

## 3. State Management Architecture

EventSphere separates state into three distinct scopes:

```
+-----------------------------------------------------------------------------------------+
|                                    STATE TOPOLOGY                                       |
|                                                                                         |
|  GLOBAL SESSION (Redux Toolkit)      CROSS-COMPONENT SEARCH (Context)  LIVE METRICS (Hook)|
|  • user: Object                      • searchTerm: String              • effectiveFreeSeats|
|  • accessToken: String               • setSearchTerm: Function         • heldSeats Array  |
|  • status: Boolean (isAuthenticated)                                   • isSoldOut Boolean |
+-----------------------------------------------------------------------------------------+
```

### 1. Global Redux Auth Slice ([src/store/authslice.js](../../src/store/authslice.js#L1-L32))
- **Initial State**:
  ```javascript
  const initialState = {
    status: false,
    user: null,
    accessToken: localStorage.getItem("accessToken") || null,
  };
  ```
- **Reducers**:
  - `setCredentials(state, action)`: Sets `status = true`, `user = action.payload.user`, and stores `accessToken` in both Redux state and `localStorage`.
  - `logout(state)`: Clears state (`status = false, user = null, accessToken = null`) and deletes `accessToken` from `localStorage`.

### 2. Search Context ([src/Context/SearchContext.jsx](../../src/Context/SearchContext.jsx#L1-L15))
A lightweight React Context that binds the search bar inside `<Header />` to the event list inside `<Events />`. Typing in the header immediately filters the catalog cards without requiring URL query strings.

### 3. Real-Time Seat Hook: `useLiveSeatCount` ([src/hooks/useLiveSeatCount.js](../../src/hooks/useLiveSeatCount.js#L1-L138))
A custom hook that coordinates WebSocket state for an event:
- Connects to Socket.io and emits `socket.emit("watchSeats", { eventId })`.
- Listens for `seatUpdate` events and parses `effectiveFreeSeats`, `bookedSeats`, and `heldSeats`.
- Implements an **HTTP Polling Fallback**: If the WebSocket drops (`connect_error`), it automatically initiates HTTP polling against `/api/v1/bookings/seat-availability/:eventId` every 30 seconds.
- Automatically leaves the room (`socket.emit("unwatchSeats", { eventId })`) and disconnects on unmount.

---

## 4. API Service Layer & Axios Configuration

All backend communication flows through pre-configured service modules.

### Axios Instance & Credentials ([src/config/axios.js](../../src/config/axios.js#L1-L40))
- Sets `baseURL` to `import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"`.
- Sets `withCredentials: true`, ensuring browser cookies (`accessToken`, `refreshToken`) are transmitted on cross-origin requests between Vercel and Render.
- **Request Interceptor**: Extracts `accessToken` from Redux or `localStorage` and appends `Authorization: Bearer <token>`.

### Service Directory Structure

```
src/services/
├── authservices/authapi.js       -> loginUser, registerUser, getUserProfile, logoutUser
├── eventservices/eventapi.js     -> getAllEvents, getEventById, createEvent, updateEvent, cancelEvent
├── bookingservices/bookingapi.js -> createOrder, verifyPayment, getMyBookings, cancelBooking
├── chatservices/chatapi.js       -> getChatHistory
├── reviewservices/reviewapi.js   -> createReview, getEventReviews, deleteReview
└── contactservices/contactapi.js -> createContact
```

---

## 5. Walkthrough of Critical Pages and Components

### 1. Event Details Page: `DetailEvent.jsx` ([src/Pages/DetailEvent.jsx](../../src/Pages/DetailEvent.jsx#L1-L437))
This is the most feature-rich screen in the application. It orchestrates:
1. **Event Data Loading**: Fetches event details via `getEventById(id)` on mount.
2. **Real-time Hook Integration**: Subscribes to live inventory with `useLiveSeatCount(id)`.
3. **Ticket Tier Selection**: Parses `event.ticketTypes` (e.g., VIP Pass, Early Bird, Standard Pass) and updates unit prices dynamically.
4. **Seat Selection Matrix**: Renders `<SeatMap />` allowing attendees to click specific chairs up to a maximum of 10.
5. **Checkout Dispatcher (`handleBooking`)**:
   - Validates that the user is authenticated.
   - Calls `createOrder(id, { selectedSeats, usePoints, couponCode, ticketTier })`.
   - If paid entirely with wallet points (`statusCode === 201`), redirects to `/profile`.
   - If paying via Stripe, redirects browser to `orderResponse.data.checkoutUrl`.
6. **Community Chatbox**: Mounts `<ChatBox eventId={id} />` at the bottom-right of the screen.
7. **Reviews & Ratings**: Displays existing attendee feedback via `<ReviewCard />` and renders `<ReviewForm />` for post-event reviews.

---

### 2. Interactive Seat Selection: `SeatMap.jsx` ([src/Components/SeatMap.jsx](../../src/Components/SeatMap.jsx#L1-L138))
- Dynamically creates an auditorium grid with 10 seats per row (`columns = 10`), computing row letters (`A, B, C...`) from character codes:
  ```javascript
  const rowLetter = String.fromCharCode(65 + rowIndex);
  const colNumber = colIndex + 1;
  const seatId = `${rowLetter}${colNumber}`; // e.g. "A1", "B4"
  ```
- **Visual State Indicators**:
  - `isBooked`: Occupied in MongoDB -> Grayed out (`bg-slate-200 cursor-not-allowed opacity-60`).
  - `isHeld`: Held in Redis by another user -> Amber warning (`bg-amber-100 border-amber-300 text-amber-500 cursor-not-allowed`).
  - `isSelected`: Chosen by current user -> Indigo highlighted (`bg-indigo-500 text-white scale-110`).
  - `isAvailable`: Free -> White with emerald border (`bg-white border-emerald-500 hover:bg-emerald-50`).

---

### 3. Attendee Community Chat: `Chatbox.jsx` ([src/Components/Chatbox/Chatbox.jsx](../../src/Components/Chatbox/Chatbox.jsx#L1-L146))
- Controlled floating widget toggled via a floating action button.
- When opened, connects to Socket.io passing `{ auth: { token } }` and emits `joinRoom({ eventId })`.
- **Server Guard Response**: If the user has not confirmed a booking for this event, the server emits an `error` event: `"Book this event to access the community room"`. The component catches this and displays a red toast notification.
- Supports real-time typing indicators (`typing` and `stopTyping` events) and auto-scrolls to the newest message using `messagesEndRef.current?.scrollIntoView()`.

---

### 4. User Profile & Ticket Ledger: `Profile.jsx` ([src/Pages/Profile.jsx](../../src/Pages/Profile.jsx#L1-L380))
- **Stripe Redirect Verification**:
  ```javascript
  // src/Pages/Profile.jsx:21-59
  const sessionId = searchParams.get("session_id");
  if (sessionId) {
    setSearchParams({}); // Clear query params to prevent duplicate verification
    verifyPayment({ stripe_session_id: sessionId, ... })
      .then(() => toast.success("🎉 Payment successful!"))
      .catch((err) => toast.error(err.message));
  }
  ```
- **Ticket Ledger Display**: Loops over confirmed bookings and renders styled physical tickets with date, venue, ticket tier, seat numbers, and the Base64 QR code.
- **Client-Side PDF Generation**:
  ```javascript
  // src/Pages/Profile.jsx:127-139
  const handleDownloadPDF = (bookingId, eventTitle) => {
    const element = document.getElementById(`ticket-${bookingId}`);
    const opt = {
      margin: 0.4,
      filename: `EventSphere_Ticket_${bookingId.slice(-6)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };
  ```

---

### 5. Organizer Analytics Dashboard: `Dashboard.jsx` ([src/Pages/Dashboard.jsx](../../src/Pages/Dashboard.jsx#L1-L243))
- Displays top-level executive metrics: Total Events Created, Total Bookings, Total Seats Sold, and Gross Revenue (₹).
- Loops through all organizer events and fetches aggregate metrics from `/api/v1/events/analytics/:eventid`.
- Embeds a Recharts `<BarChart>` inside each event card visualizing relative bookings, seat volumes, and revenue distributions.
- Allows organizers to trigger modal edits via `<UpdateEventModal />` or cancel events with automatic attendee notification.

---

## 6. Summary for Technical Interviews

> "EventSphere's frontend is an SPA built on React 19 and Vite. Routing is managed via React Router v7 with route-level code splitting using `React.lazy` and `Suspense`. Global authentication state is managed in Redux Toolkit, while real-time seat availability is handled by a custom `useLiveSeatCount` hook that connects to Socket.io and falls back to HTTP polling on network disconnects. Interactive seat selection is rendered dynamically based on event capacity, and tickets are rendered client-side with embedded HMAC QR codes that can be exported directly to PDF using `html2pdf.js`."
