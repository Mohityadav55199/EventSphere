import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import store from './store/store.js';
import { Provider } from 'react-redux';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { Protected } from './Components/AuthLayout';
import { SearchProvider } from './Context/SearchContext';

// React Code Splitting with React.lazy
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
import PageLoader from './Components/PageLoader';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path='/' element={<App />}>
      <Route path='/' element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
      <Route path='/login' element={
        <Protected authenication={false}>
          <Suspense fallback={<PageLoader />}><LogIn /></Suspense>
        </Protected>
      } />
      <Route path='/signup' element={
        <Protected authenication={false}>
          <Suspense fallback={<PageLoader />}><Signup /></Suspense>
        </Protected>
      } />
      <Route path='/profile' element={<Suspense fallback={<PageLoader />}><Profile /></Suspense>} />
      <Route path='/events' element={<Suspense fallback={<PageLoader />}><Events /></Suspense>} />
      <Route path='/about' element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
      <Route path='/contact' element={<Suspense fallback={<PageLoader />}><Contact /></Suspense>} />
      <Route path='/events/:id' element={<Suspense fallback={<PageLoader />}><DetailEvent /></Suspense>} />
      <Route path='/event/:id' element={<Suspense fallback={<PageLoader />}><DetailEvent /></Suspense>} />
      <Route path='/dashboard' element={
        <Protected authenication={true}>
          <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
        </Protected>
      } />
      <Route path='/create-event' element={
        <Protected authenication={true}>
          <Suspense fallback={<PageLoader />}><AddEvent /></Suspense>
        </Protected>
      } />
    </Route>
  )
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <SearchProvider>
        <RouterProvider router={router} />
      </SearchProvider>
    </Provider>
  </StrictMode>
);
