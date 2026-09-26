import express from "express";
import { createActionRepository } from "../repositories/actionRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";
import { createActionService, ActionServiceError } from "../services/action.service.js";

/**
 * Creates an action router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - actionRepository: explicit ActionRepository instance (optional override)
 * - actionService: explicit ActionService instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.actionRepository]
 * @param {Object} [options.actionService]
 * @returns {express.Router}
 */
export function createActionRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const actionRepository = options.actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);
  const actionService =
    options.actionService ||
    (actionRepository ? createActionService({ actionRepository }) : null);

  const router = express.Router();

  /**
   * Helper to verify database/service availability.
   * If Supabase is unconfigured or no service is available, returns HTTP 503.
   */
  function requireService(req, res, next) {
    if (!actionService) {
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
  router.get("/actions/:id", requireService, async (req, res) => {
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
      const action = await actionService.getActionById(id);

      return res.status(200).json({
        success: true,
        data: {
          action,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ActionServiceError ? err.statusCode : 500;
      const message = statusCode === 500 ? "Failed to retrieve action record" : err.message;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "ACTION_RETRIEVAL_FAILED",
          message,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/agents/:agentId/actions — Retrieve all actions for an agent (paginated)
  // ---------------------------------------------------------------------------
  router.get("/agents/:agentId/actions", requireService, validatePaginationMiddleware, async (req, res) => {
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
      const result = await actionService.listActionsByAgent(agentId, { page, limit });

      return res.status(200).json({
        success: true,
        data: {
          actions: result.actions,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ActionServiceError ? err.statusCode : 500;
      const message = statusCode === 500 ? "Failed to list actions for agent" : err.message;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "ACTION_LIST_FAILED",
          message,
        },
      });
    }
  });

  return router;
}

export default createActionRoutes();
