import express, { Router } from "express";
import { handleStripeWebhook } from "../controllers/webhook.controller.js";

const webhookRouter = Router();
webhookRouter.post("/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);

export default webhookRouter;
