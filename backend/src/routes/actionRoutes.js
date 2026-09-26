import express from "express";
import { createActionRepository } from "../repositories/actionRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";

import { validatePaginationMiddleware } from "../middleware/pagination.js";

/**
 * Creates an action router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - actionRepository: explicit ActionRepository instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.actionRepository]
 * @returns {express.Router}
 */
export function createActionRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const actionRepository = options.actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);

  const router = express.Router();

  /**
   * Helper to verify database/repository availability.
   * If Supabase is unconfigured or no repository is available, returns HTTP 503.
   */
  function requireRepository(req, res, next) {
    if (!actionRepository) {
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
  // GET /api/v1/actions/:id — Retrieve an action by ID
  // ---------------------------------------------------------------------------
  router.get("/actions/:id", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ACTION_ID",
          message: "Invalid action ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const action = await actionRepository.getActionById(id);

      if (!action) {
        return res.status(404).json({
          success: false,
          error: {
            code: "ACTION_NOT_FOUND",
            message: `Action with ID "${id}" was not found`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          action,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "ACTION_RETRIEVAL_FAILED",
          message: "Failed to retrieve action record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/agents/:agentId/actions — Retrieve all actions for an agent (paginated)
  // ---------------------------------------------------------------------------
  router.get("/agents/:agentId/actions", requireRepository, validatePaginationMiddleware, async (req, res) => {
    const { agentId } = req.params;
    const { page, limit } = req.pagination;

    if (!isValidUuid(agentId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AGENT_ID",
          message: "Invalid agent ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const result = await actionRepository.listActionsByAgentId(agentId, { page, limit });

      const actions = Array.isArray(result) ? result : (result.items || []);
      const hasMore = Array.isArray(result) ? false : Boolean(result.hasMore);

      return res.status(200).json({
        success: true,
        data: {
          actions,
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
          code: "ACTION_LIST_FAILED",
          message: "Failed to list actions for agent",
        },
      });
    }
  });

  return router;
}

export default createActionRoutes();
