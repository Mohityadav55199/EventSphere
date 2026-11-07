import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getChatHistory } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/chat-history/:eventId").get(authMiddleware, getChatHistory);

export default chatRouter;