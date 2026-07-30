import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import store from './store/store.js'
import { Provider } from 'react-redux'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom'
import {Home,LogIn,Signup,Protected,Profile, Events, About, Contact, Dashboard, AddEvent, DetailEvent} from './index.js'
import { SearchProvider } from './Context/SearchContext';


const router=createBrowserRouter(
  createRoutesFromElements(
    <Route path='/' element={<App/>}>
      <Route path='/' element={<Home/>}/>
      <Route path='/login' element={
        <Protected authenication={false}>
         <LogIn/>
        </Protected>
      }/>

<Route path='/signup' element={
        <Protected authenication={false}>
          <Signup/>
        </Protected>
      }/>

<Route path='/profile' element={<Profile/>}/>
<Route path='/events' element={<Events/>}/>
<Route path='/about' element={<About/>}/>
<Route path='/contact' element={<Contact/>}/>
<Route path='/events/:id' element={<DetailEvent/>}/>
<Route path='/dashboard' element={
        <Protected authenication={true}>
          <Dashboard/>
        </Protected>
      }/>
<Route path='/create-event' element={
        <Protected authenication={true}>
          <AddEvent/>
        </Protected>
      }/>

</Route> 
  ))


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <SearchProvider>
       <RouterProvider router={router}/>
      </SearchProvider>
   
    </Provider>
  </StrictMode>,
)
