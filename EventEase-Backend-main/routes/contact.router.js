import { Router } from "express";
import { createContact } from "../controllers/contact.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const contactRouter = Router();

 contactRouter.route("/contact").post(
    authMiddleware,
    upload.single("image"),
    createContact
);

export default contactRouter