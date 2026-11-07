import { z } from "zod";
import { EVENT_CATEGORIES } from "../constant.js";

const email = z.string().trim().toLowerCase().email("Invalid email address");
const password = z.string().min(6, "Password must be at least 6 characters").max(128);
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const registerSchema = z.object({
    name: z.string().trim().min(2, "Name is too short").max(60),
    email,
    password,
    // Self-signup can never create an admin
    role: z.enum(["attendee", "organizer"]).optional(),
});

export const loginSchema = z.object({
    email,
    password: z.string().min(1, "Password is required").max(128),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });

// Multipart form fields arrive as strings, so numbers are coerced
export const createEventSchema = z.object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    date: z.coerce.date(),
    location: z.string().trim().min(2).max(200),
    locationGoogleMapLink: z.string().trim().min(1),
    Price: z.coerce.number().min(0),
    category: z.enum(EVENT_CATEGORIES),
    capacity: z.coerce.number().int().min(1).max(1000000),
    // Optional ticket tiers. Multipart forms can only send strings, so the array arrives as JSON text.
    ticketTypes: z.preprocess(
        (v) => {
            if (typeof v !== "string") return v;
            try { return JSON.parse(v); } catch { return v; }
        },
        z.array(z.object({
            name: z.string().trim().min(1).max(40),
            price: z.coerce.number().min(0),
            description: z.string().trim().max(120).optional(),
        })).max(5)
          .refine((tiers) => new Set(tiers.map((t) => t.name.toLowerCase())).size === tiers.length, "Ticket tier names must be unique")
    ).optional(),
});

// Organizer edits: every field optional, but whatever is sent must be valid.
// activeStatus is deliberately NOT editable here: cancelling must go through cancelEvent, which refunds.
export const updateEventSchema = createEventSchema.partial().strict();

export const eventIdParam = z.object({ eventId: objectId });
export const reviewIdParam = z.object({ reviewId: objectId });

export const reviewSchema = z.object({
    rating: z.coerce.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
    comment: z.string().trim().min(1, "Comment is required").max(1000),
});

export const updateAccountSchema = z.object({
    name: z.string().trim().min(2, "Name is too short").max(60),
    email,
});

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: password,
});

export const contactSchema = z.object({
    name: z.string().trim().min(2).max(60),
    email,
    subject: z.string().trim().min(2).max(150),
    message: z.string().trim().min(5).max(5000),
});
export const idParam = z.object({ id: objectId });
