import { logRequestError } from "./requestErrorLogger.js";

/**
 * Express error-handling middleware.
 *
 * Catches malformed JSON, payload size errors, and unexpected crashes.
 * Always logs safe request/error metadata using logRequestError.
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

  logRequestError(req, err);
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
