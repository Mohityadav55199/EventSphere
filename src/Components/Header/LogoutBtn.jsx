import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'

import { logout } from '../../store/authslice'
import { logoutUser } from '../../services/authservices/authapi'
import { LogOut } from 'lucide-react'

export function LogoutBtn({onClick}) {
    const dispatch = useDispatch()
     const navigate = useNavigate()
    const logoutHandler = async ()=> {
        try {
            await logoutUser();
            dispatch(logout());
            if(onClick) onClick();
        } catch (error) {
            console.error("Logout Error:", error);
            alert(error.message || "Something went wrong!");
        }finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("userId");
            navigate('/')
        }


        
        // navigate('/login')

    }    

    return <button onClick={logoutHandler} className='inline-bock px-4 py-2 bg-yellow-300 text-black rounded-full font-semibold shadow hover:bg-white hover:text-purple-700 transition'>
        <LogOut className='inline-block mr-2'/>
        Logout</button>
}