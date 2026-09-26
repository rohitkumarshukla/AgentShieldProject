const SAFE_ERROR_NAMES = new Set(["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError", "URIError", "EvalError", "AgentServiceError"]);

/**
 * Log safe request/error metadata without serializing the error or request.
 * Route templates avoid recording user-controlled path parameters.
 */
export function logRequestError(req, error, { status = 500, code = "INTERNAL_SERVER_ERROR" } = {}) {
  const routePath = req.route?.path
    ? `${req.baseUrl || ""}${req.route.path}`
    : "<unmatched>";
  const errorName = SAFE_ERROR_NAMES.has(error?.name) ? error.name : "Error";

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: routePath,
    status,
    code,
    errorName,
    message: "Request failed",
  }));
}
