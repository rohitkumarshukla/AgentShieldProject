/**
 * Express error-handling middleware.
 *
 * Catches malformed JSON payloads and unexpected errors, returning
 * structured JSON responses without leaking internal stack traces.
 */
export function errorHandler(err, req, res, next) {
  // Catch JSON parsing errors from express.json()
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must contain valid JSON",
      },
    });
  }

  // Generic fallback error
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
}
