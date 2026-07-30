import { Router } from "express";
import { getChatHistory } from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.route("/chat-history/:eventId").get(getChatHistory);

export default chatRouter;