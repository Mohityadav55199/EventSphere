import { z } from "zod";

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
    category: z.string().trim().min(1).max(50),
    capacity: z.coerce.number().int().min(1).max(1000000),
});

export const eventIdParam = z.object({ eventId: objectId });
export const idParam = z.object({ id: objectId });
