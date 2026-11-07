import { Router } from "express";
import { getAllEvents, getEventbyId,createEvent,updateEvent,deleteEvent,getEventAnalytics,getOrganizerOverview,myEvents, cancelEvent, getAllActiveEvents } from "../controllers/event.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import authorizeRoles from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { createEventSchema, updateEventSchema, idParam } from "../validators/schemas.js";

const eventRouter = Router();

import { autoSeedEventsIfEmpty } from "../utils/autoSeed.js";

// Public routes
eventRouter.route('/all-events').get(getAllActiveEvents);
eventRouter.route('/event/:id').get(validate(idParam, "params"), getEventbyId);

// oranizer routes
eventRouter.route('/create-event').post(
    authMiddleware,
    authorizeRoles("organizer", "admin"), 
    upload.single("image"), // Assuming the image field in the form is named 'image'
    validate(createEventSchema),
    createEvent
);
eventRouter.route('/update-event/:id').patch(
    authMiddleware,
    authorizeRoles("organizer", "admin"),
    validate(idParam, "params"),
    upload.single("image"),
    validate(updateEventSchema),
    updateEvent
);

// must be registered before '/analytics/:eventid' or "overview" would be read as an event id
eventRouter.route('/analytics/overview').get(
    authMiddleware,
    authorizeRoles("organizer", "admin"),
    getOrganizerOverview
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
eventRouter.route('/seed-demo').get(
    authMiddleware,
    authorizeRoles("admin"),
    async (req, res, next) => {
        try {
            await autoSeedEventsIfEmpty();
            res.json({ success: true, message: "Demo events checked and populated if empty" });
        } catch (err) {
            next(err);
        }
    }
);

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
