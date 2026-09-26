/**
 * Forwards rejected async route-handler promises to Express error middleware.
 * Required for Express 4, which does not observe returned promises itself.
 */
export function asyncHandler(handler) {
  return function wrappedAsyncHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
