import connectDB from "./config/db.js";
import dotenv from "dotenv";
import app from "./app.js";
import { initSocket } from "./socket.js";
import http from "http";
dotenv.config({
  path: "./.env",
})

connectDB()
.then(()=>{
    const port = process.env.PORT || 6000
    const server = http.createServer(app); // Create HTTP server & attach Express app
    initSocket(server); // Initialize socket.io with the server
    server.listen(port,()=>{
      console.log("server is started and running at port",port)
      console.log("server is running at http://localhost:" + port)
    })
})
.catch((err)=>{
  console.log("MongoDB Connection failed!!!",err)
})