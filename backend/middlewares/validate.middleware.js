import { ApiError } from "../utils/ApiError.js";

// Validates req[source] against a zod schema and replaces it with the parsed value
const validate = (schema, source = "body") => (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
        const message = result.error.issues
            .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
            .join(", ");
        return next(new ApiError(400, message));
    }
    if (source === "body") req.body = result.data;
    return next();
};

export default validate;
