import { ApiError } from "../utils/ApiError.js";

/**
 * 404 Not Found catch-all middleware.
 * Forwards a standardized NOT_FOUND ApiError to the global errorHandler.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function notFoundHandler(req, res, next) {
  next(
    new ApiError(
      404,
      `Route ${req.method} ${req.originalUrl} not found`,
      "NOT_FOUND",
    ),
  );
}

export default notFoundHandler;
