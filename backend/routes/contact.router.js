import { Router } from "express";
import { createContact } from "../controllers/contact.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { contactSchema } from "../validators/schemas.js";

const contactRouter = Router();

 contactRouter.route("/contact").post(
    authMiddleware,
    upload.single("image"),
    validate(contactSchema),
    createContact
);

export default contactRouter