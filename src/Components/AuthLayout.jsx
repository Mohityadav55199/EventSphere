//THIS COMPONENT IS PURELY MADE FOR SECURITY PURPOSE
import React, {useState,useEffect} from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

 export function Protected({
    authenication=true ,children
 }) {
    const navigate = useNavigate()
    const [loader, setloader] = useState(true)
    const accessToken = useSelector(state => state.auth.accessToken)
    const authStatus = accessToken ? true : false
    useEffect(() => {
        //CONDITION TO PREVENT UNAUTHORISED LOGIN
      if(authenication && authStatus !== authenication){
      navigate("/login")
      }
      // CONDITION FOR AUTHORISED USER LOGIN
      else if(!authenication && authStatus !== authenication) {
     navigate("/")
      }
      setloader(false)
    }, [authStatus,navigate,authenication])
    
  return loader ? <h1>Loading...</h1> : <>{children}</>
 }