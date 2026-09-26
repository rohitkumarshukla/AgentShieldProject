import express from "express";
import crypto from "node:crypto";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import {
  validateCreateAgentInput,
  normalizeCreateAgentInput,
  validateUpdateAgentInput,
  normalizeUpdateAgentInput,
  validatePermissionsInput,
  normalizePermissionsInput,
  isValidUuid,
} from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";

/**
 * Generates a random, secure agent API key formatted as 'ash_live_<random_bytes>'.
 * @returns {{ apiKey: string, apiKeyPrefix: string, apiKeyHash: string }}
 */
function generateAgentApiKey() {
  const secret = crypto.randomBytes(24).toString("base64url");
  const apiKey = `ash_live_${secret}`;
  const apiKeyPrefix = apiKey.slice(0, 12);
  const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  return { apiKey, apiKeyPrefix, apiKeyHash };
}

/**
 * Creates an agent router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - agentRepository: explicit AgentRepository instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.agentRepository]
 * @returns {express.Router}
 */
export function createAgentRoutes(options = {}) {
  const supabaseClient =
    options.supabaseClient !== undefined
      ? options.supabaseClient
      : defaultSupabaseClient;

  const agentRepository =
    options.agentRepository ||
    (supabaseClient ? createAgentRepository(supabaseClient) : null);

  const router = express.Router();

  /**
   * Helper to verify database/repository availability.
   * If Supabase is unconfigured or no repository is available, returns HTTP 503.
   */
  function requireRepository(req, res, next) {
    if (!agentRepository) {
      return res.status(503).json({
        success: false,
        error: {
          code: "SUPABASE_NOT_CONFIGURED",
          message: "Database persistence is not configured",
        },
      });
    }
    next();
  }

  // ---------------------------------------------------------------------------
  // 1. POST /api/v1/agents — Create / register a new agent (Optionally with key)
  // ---------------------------------------------------------------------------
  router.post("/agents", requireRepository, async (req, res) => {
    try {
      const body = req.body;
      const validation = validateCreateAgentInput(body);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_AGENT",
            message: validation.errors.join("; "),
          },
        });
      }

      const normalized = normalizeCreateAgentInput(body);

      // Auto-generate API key credentials on creation
      const { apiKey, apiKeyPrefix, apiKeyHash } = generateAgentApiKey();

      const createdAgent = await agentRepository.createAgent({
        name: normalized.name,
        description: normalized.description,
        status: normalized.status,
        environment: normalized.environment,
        metadata: {
          ...normalized.metadata,
          api_key_prefix: apiKeyPrefix,
          permissions: {
            allowedTools: ["*"],
            blockedOperations: [],
            environmentRestrictions: ["development", "staging", "production"],
            maxFinancialLimit: null,
            requiresApprovalThreshold: 60,
          },
        },
        api_key_hash: apiKeyHash,
      });

      // Format response, stripping internal hash while exposing generated plaintext apiKey once
      const safeAgent = { ...createdAgent };
      delete safeAgent.api_key_hash;

      return res.status(201).json({
        success: true,
        data: {
          agent: safeAgent,
          apiKey,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AGENT_CREATION_FAILED",
          message: "Failed to persist agent record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/agents — List all registered agents (Paginated)
  // ---------------------------------------------------------------------------
  router.get(
    "/agents",
    requireRepository,
    validatePaginationMiddleware,
    async (req, res) => {
      try {
        const { page, limit } = req.pagination;
        const result = await agentRepository.listAgents({ page, limit });

        const agents = Array.isArray(result) ? result : result.items || [];
        const hasMore = Array.isArray(result) ? false : Boolean(result.hasMore);

        return res.status(200).json({
          success: true,
          data: {
            agents,
            pagination: {
              page,
              limit,
              hasMore,
            },
          },
        });
      } catch (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: "AGENT_LIST_FAILED",
            message: "Failed to retrieve agent records",
          },
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/agents/:id — Retrieve an agent by ID
  // ---------------------------------------------------------------------------
  router.get("/agents/:id", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const agent = await agentRepository.getAgentById(id.trim());

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const safeAgent = { ...agent };
      delete safeAgent.api_key_hash;

      return res.status(200).json({
        success: true,
        data: {
          agent: safeAgent,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AGENT_RETRIEVAL_FAILED",
          message: "Failed to retrieve agent record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. PATCH / PUT /api/v1/agents/:id — Update agent details
  // ---------------------------------------------------------------------------
  const updateAgentHandler = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    const validation = validateUpdateAgentInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_UPDATE",
          message: validation.errors.join("; "),
        },
      });
    }

    try {
      const existing = await agentRepository.getAgentById(id.trim());
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const normalizedUpdates = normalizeUpdateAgentInput(req.body);
      const updatedAgent = await agentRepository.updateAgent(id.trim(), normalizedUpdates);

      const safeAgent = { ...updatedAgent };
      delete safeAgent.api_key_hash;

      return res.status(200).json({
        success: true,
        data: {
          agent: safeAgent,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AGENT_UPDATE_FAILED",
          message: "Failed to update agent record",
        },
      });
    }
  };

  router.patch("/agents/:id", requireRepository, updateAgentHandler);
  router.put("/agents/:id", requireRepository, updateAgentHandler);

  // ---------------------------------------------------------------------------
  // 5. DELETE /api/v1/agents/:id — Delete an agent
  // ---------------------------------------------------------------------------
  router.delete("/agents/:id", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const existing = await agentRepository.getAgentById(id.trim());
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const deleted = await agentRepository.deleteAgent(id.trim());
      return res.status(200).json({
        success: true,
        data: {
          deleted: Boolean(deleted),
          id: id.trim(),
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AGENT_DELETION_FAILED",
          message: "Failed to delete agent record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. GET /api/v1/agents/:id/permissions — Retrieve agent permissions
  // ---------------------------------------------------------------------------
  router.get("/agents/:id/permissions", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const agent = await agentRepository.getAgentById(id.trim());
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const permissions = agent.metadata?.permissions || {
        allowedTools: ["*"],
        blockedOperations: [],
        maxFinancialLimit: null,
        requiresApprovalThreshold: 60,
        environmentRestrictions: ["development", "staging", "production"],
        customPolicies: [],
      };

      return res.status(200).json({
        success: true,
        data: {
          agentId: id.trim(),
          permissions,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "PERMISSIONS_RETRIEVAL_FAILED",
          message: "Failed to retrieve agent permissions",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 7. PUT / PATCH /api/v1/agents/:id/permissions — Update agent permissions
  // ---------------------------------------------------------------------------
  const updatePermissionsHandler = async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    const validation = validatePermissionsInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_PERMISSIONS",
          message: validation.errors.join("; "),
        },
      });
    }

    try {
      const existing = await agentRepository.getAgentById(id.trim());
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const normalizedPermissions = normalizePermissionsInput(req.body);
      const updatedMetadata = {
        ...(existing.metadata || {}),
        permissions: normalizedPermissions,
      };

      const updatedAgent = await agentRepository.updateAgent(id.trim(), {
        metadata: updatedMetadata,
      });

      return res.status(200).json({
        success: true,
        data: {
          agentId: id.trim(),
          permissions: updatedAgent.metadata?.permissions,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "PERMISSIONS_UPDATE_FAILED",
          message: "Failed to update agent permissions",
        },
      });
    }
  };

  router.put("/agents/:id/permissions", requireRepository, updatePermissionsHandler);
  router.patch("/agents/:id/permissions", requireRepository, updatePermissionsHandler);

  // ---------------------------------------------------------------------------
  // 8. POST /api/v1/agents/:id/rotate-key — Rotate agent API key
  // ---------------------------------------------------------------------------
  router.post("/agents/:id/rotate-key", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const existing = await agentRepository.getAgentById(id.trim());
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      const { apiKey, apiKeyPrefix, apiKeyHash } = generateAgentApiKey();

      const updatedMetadata = {
        ...(existing.metadata || {}),
        api_key_prefix: apiKeyPrefix,
        key_rotated_at: new Date().toISOString(),
      };

      await agentRepository.updateApiKey(id.trim(), apiKeyHash, updatedMetadata);

      return res.status(200).json({
        success: true,
        data: {
          agentId: id.trim(),
          apiKey,
          apiKeyPrefix,
          message: "API key rotated successfully. Save this key; it will not be shown again.",
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "KEY_ROTATION_FAILED",
          message: "Failed to rotate agent API key",
        },
      });
    }
  });

  return router;
}

export default createAgentRoutes();
