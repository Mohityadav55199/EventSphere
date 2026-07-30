import { Router } from "express";
import { getAllEvents, getEventbyId,createEvent,updateEvent,deleteEvent,getEventAnalytics,myEvents, cancelEvent, getAllActiveEvents } from "../controllers/event.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const eventRouter = Router();

// Public routes
eventRouter.route('/all-events').get(getAllActiveEvents);
eventRouter.route('/event/:id').get(getEventbyId);

// oranizer routes
eventRouter.route('/create-event').post(
    authMiddleware,
    authorizeRoles("organizer", "admin"), 
    upload.single("image"), // Assuming the image field in the form is named 'image'
    createEvent
);
eventRouter.route('/update-event/:id').patch(
    authMiddleware,
    authorizeRoles("organizer", "admin"),
    upload.single("image"), 
    updateEvent
);

eventRouter.route('/analytics/:eventid').get(
    authMiddleware,
    authorizeRoles("organizer" , "admin"),
    getEventAnalytics
);

eventRouter.route('/my-events').get(
    authMiddleware,
    authorizeRoles("organizer", "admin"),
    myEvents
);

eventRouter.route('/cancel-event/:eventid').patch(
    authMiddleware,
    authorizeRoles("organizer", "admin"),
    cancelEvent
);

// Admin routes
eventRouter.route('/admin/all-events').get(
    authMiddleware,
    authorizeRoles("admin"),  
    getAllEvents
);

eventRouter.route('/admin/delete-event/:id').delete(
    authMiddleware,
    authorizeRoles("admin"),
    deleteEvent
);



export default eventRouter
