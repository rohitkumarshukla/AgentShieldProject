import express from "express";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import {
  validateCreateAgentInput,
  normalizeCreateAgentInput,
  isValidUuid,
} from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";

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
  // POST /api/v1/agents — Create / register a new agent
  // ---------------------------------------------------------------------------
  router.post("/agents", requireRepository, async (req, res) => {
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

    const normalizedInput = normalizeCreateAgentInput(body);

    try {
      const createdRecord =
        await agentRepository.createAgent(normalizedInput);

      return res.status(201).json({
        success: true,
        data: {
          agent: createdRecord,
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
  // GET /api/v1/agents — List all registered agents (paginated)
  // ---------------------------------------------------------------------------
  router.get(
    "/agents",
    requireRepository,
    validatePaginationMiddleware,
    async (req, res) => {
      const { page, limit } = req.pagination;

      try {
        const result = await agentRepository.listAgents({ page, limit });

        const agents = Array.isArray(result)
          ? result
          : result.items || [];

        const hasMore = Array.isArray(result)
          ? false
          : Boolean(result.hasMore);

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
    }
  );

  // ---------------------------------------------------------------------------
  // GET /api/v1/agents/:id — Retrieve an agent by ID
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
      const agent = await agentRepository.getAgentById(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent with ID "${id}" was not found`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          agent,
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

  return router;
}

export default createAgentRoutes();