/**
 * Standardized application API Error class for AgentShield.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 403, 404, 500)
   * @param {string} message - Error description
   * @param {string} [code="INTERNAL_SERVER_ERROR"] - Machine-readable error code string
   * @param {Array<string>} [errors=[]] - Array of specific validation errors or details
   * @param {Object} [location=null] - Source file/function location metadata
   * @param {Error} [cause=null] - Original underlying error
   */
  constructor(
    statusCode = 500,
    message = "An unexpected error occurred",
    code = "INTERNAL_SERVER_ERROR",
    errors = [],
    location = null,
    cause = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.location = location;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Constructs an ApiError instance wrapping an unexpected caught exception.
   *
   * @param {Error | unknown} err
   * @param {number} [statusCode=500]
   * @param {string} [code="INTERNAL_SERVER_ERROR"]
   * @param {string} [fallbackMessage="An unexpected error occurred"]
   * @returns {ApiError}
   */
  static from(
    err,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    fallbackMessage = "An unexpected error occurred",
  ) {
    if (err instanceof ApiError) {
      return err;
    }

    const message = err instanceof Error ? err.message : fallbackMessage;
    const apiErr = new ApiError(statusCode, message, code, [], null, err instanceof Error ? err : null);
    if (err instanceof Error && err.stack) {
      apiErr.stack = err.stack;
    }
    return apiErr;
  }

  /**
   * Formats a code location descriptor for logging.
   *
   * @param {Object | string | null} location
   * @returns {string}
   */
  static formatLocation(location) {
    if (!location) return "unknown";
    if (typeof location === "string") return location;
    if (location.file && location.line) {
      return `${location.file}:${location.line}`;
    }
    return JSON.stringify(location);
  }
}
