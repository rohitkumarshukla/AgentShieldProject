import { ApiError } from "../utils/ApiError.js";

/**
 * Express error-handling middleware.
 *
 * Catches malformed JSON, payload size errors, ApiError throws, and unexpected crashes.
 * Always logs crash location to the server console so you can see where it failed.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // body-parser marks malformed JSON and payload-limit failures with types.
  if (err?.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON",
      },
    });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the allowed size",
      },
    });
  }

  if (err?.type === "charset.unsupported" || err?.type === "encoding.unsupported") {
    return res.status(415).json({
      success: false,
      error: {
        code: "UNSUPPORTED_REQUEST_ENCODING",
        message: "Request encoding is not supported",
      },
    });
  }

  const apiError =
    err instanceof ApiError
      ? err
      : ApiError.from(err, 500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred");

  const where = ApiError.formatLocation(apiError.location);
  const isServerFault = (apiError.statusCode || 500) >= 500;

  if (isServerFault) {
    console.error(
      `[AgentShield] ${apiError.code} (${apiError.statusCode}) at ${where}: ${apiError.message}`,
    );
    if (apiError.cause?.stack) {
      console.error(apiError.cause.stack);
    } else if (apiError.stack) {
      console.error(apiError.stack);
    }
  } else {
    console.warn(
      `[AgentShield] ${apiError.code} (${apiError.statusCode}) at ${where}: ${apiError.message}`,
    );
  }

  const includeLocation =
    process.env.NODE_ENV !== "production" && apiError.location != null;

  return res.status(apiError.statusCode || 500).json({
    success: false,
    error: {
      code: apiError.code || "INTERNAL_SERVER_ERROR",
      message: apiError.message || "An unexpected error occurred",
      ...(includeLocation ? { location: apiError.location } : {}),
      ...(apiError.errors?.length ? { details: apiError.errors } : {}),
    },
  });
}
