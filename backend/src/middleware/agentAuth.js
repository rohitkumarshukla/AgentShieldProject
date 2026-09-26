import crypto from "node:crypto";
import { getSupabaseClient } from "../lib/supabase.js";
import { createAgentRepository } from "../repositories/agentRepository.js";

/**
 * Computes a deterministic SHA-256 hex digest for an API key.
 * Used to securely compare API keys against pre-computed database hashes.
 *
 * @param {string} apiKey - Raw plaintext API key
 * @returns {string | null} SHA-256 hex string, or null if input is invalid
 */
export function hashApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") {
    return null;
  }
  return crypto.createHash("sha256").update(apiKey.trim()).digest("hex");
}

/**
 * Extracts the API key from incoming request headers.
 * Supports:
 * 1. `x-agent-api-key: <key>`
 * 2. `x-api-key: <key>`
 * 3. `Authorization: ApiKey <key>` or `Authorization: Bearer <key>`
 *
 * @param {import("express").Request} req
 * @returns {string | null} Extracted raw API key string, or null if missing
 */
export function extractApiKey(req) {
  if (!req?.headers) {
    return null;
  }

  // 1. Direct header: x-agent-api-key
  const agentKeyHeader = req.headers["x-agent-api-key"];
  if (typeof agentKeyHeader === "string" && agentKeyHeader.trim().length > 0) {
    return agentKeyHeader.trim();
  }

  // 2. Standard custom header: x-api-key
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.trim().length > 0) {
    return apiKeyHeader.trim();
  }

  // 3. Authorization header: ApiKey <key> or Bearer <key>
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string") {
    const parts = authHeader.trim().split(/\s+/);
    if (
      parts.length === 2 &&
      (parts[0].toLowerCase() === "apikey" || parts[0].toLowerCase() === "bearer") &&
      parts[1].length > 0
    ) {
      return parts[1];
    }
  }

  return null;
}

/**
 * Factory creating agent authentication middleware.
 * Supports dependency injection for unit testing with mock Supabase clients and repositories.
 *
 * @param {Object} [options]
 * @param {import("@supabase/supabase-js").SupabaseClient | null} [options.supabaseClient]
 * @param {Object} [options.agentRepository]
 * @returns {import("express").RequestHandler}
 */
export function createAgentAuthMiddleware(options = {}) {
  return async function agentAuthMiddleware(req, res, next) {
    const client = options.supabaseClient !== undefined ? options.supabaseClient : getSupabaseClient();
    const agentRepository = options.agentRepository !== undefined ? options.agentRepository : null;

    // Verify Supabase client / DB connectivity
    if (!client && !agentRepository) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "Authentication service is not configured. Missing SUPABASE_URL or SUPABASE_ANON_KEY.",
        },
      });
    }

    // Extract API Key
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Agent API key is missing. Provide 'x-agent-api-key', 'x-api-key', or 'Authorization: Bearer <key>' header.",
        },
      });
    }

    try {
      // Compute SHA-256 hash of provided key
      const keyHash = hashApiKey(apiKey);

      let agent = null;

      if (agentRepository) {
        agent = await agentRepository.getAgentByApiKeyHash(keyHash);
      } else {
        const repo = createAgentRepository(client);
        agent = await repo.getAgentByApiKeyHash(keyHash);
      }

      // If no agent record matches the key hash
      if (!agent) {
        return res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid or unrecognized agent API key.",
          },
        });
      }

      // Verify agent operational status
      if (agent.status !== "active") {
        return res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Agent '${agent.name || agent.id}' is inactive and cannot perform actions.`,
          },
        });
      }

      // Attach verified agent context to request object
      req.agent = agent;
      req.agentId = agent.id;
      req.agentName = agent.name;
      req.agentEnvironment = agent.environment;

      return next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUTH_VERIFICATION_FAILED",
          message: "An unexpected error occurred while verifying agent authentication.",
        },
      });
    }
  };
}

/**
 * Default Express middleware verifying agent API key hashes on incoming requests.
 * Attaches the resolved agent database record to `req.agent`.
 */
export const agentAuth = createAgentAuthMiddleware();
export default agentAuth;
