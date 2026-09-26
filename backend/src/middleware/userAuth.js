import { getSupabaseClient } from "../lib/supabase.js";

/**
 * Extracts the Bearer token from the incoming Request's Authorization header.
 *
 * @param {import("express").Request} req
 * @returns {string | null} The extracted JWT token string, or null if missing/malformed
 */
export function extractBearerToken(req) {
  const authHeader = req?.headers?.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer" && parts[1].length > 0) {
    return parts[1];
  }

  return null;
}

/**
 * Factory creating user authentication middleware with an injected Supabase client.
 * Allows dependency injection for tests without making real network requests.
 *
 * @param {Object} [options]
 * @param {import("@supabase/supabase-js").SupabaseClient | null} [options.supabaseClient]
 * @returns {import("express").RequestHandler}
 */
export function createUserAuthMiddleware({ supabaseClient = null } = {}) {
  return async function userAuthMiddleware(req, res, next) {
    const client = supabaseClient || getSupabaseClient();

    // Verify Supabase client configuration
    if (!client) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "Authentication service is not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY.",
        },
      });
    }

    // Extract Bearer token
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization token is missing or malformed. Expected 'Bearer <token>'.",
        },
      });
    }

    try {
      // Validate token with Supabase Auth
      const { data, error } = await client.auth.getUser(token);

      if (error || !data?.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: error?.message || "Invalid or expired user session token.",
          },
        });
      }

      // Attach authenticated user details to request object
      req.user = data.user;
      req.userId = data.user.id;
      req.userEmail = data.user.email;
      req.userRole = data.user.app_metadata?.role || data.user.role || "authenticated";

      return next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTH_VERIFICATION_FAILED",
          message: "An unexpected error occurred while verifying user authentication.",
        },
      });
    }
  };
}

/**
 * Default Express middleware verifying Supabase Auth JWT Bearer token on incoming requests.
 * Attaches the resolved Supabase user object to `req.user`.
 */
export const userAuth = createUserAuthMiddleware();
