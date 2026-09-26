import express from "express";
import { createDecisionRepository } from "../repositories/decisionRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";

/**
 * Creates a decision history router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - decisionRepository: explicit DecisionRepository instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.decisionRepository]
 * @returns {express.Router}
 */
export function createDecisionHistoryRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const decisionRepository = options.decisionRepository || (supabaseClient ? createDecisionRepository(supabaseClient) : null);

  const router = express.Router();

  /**
   * Helper to verify database/repository availability.
   * If Supabase is unconfigured or no repository is available, returns HTTP 503.
   */
  function requireRepository(req, res, next) {
    if (!decisionRepository) {
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
  // GET /api/v1/decisions/:id — Retrieve a decision by primary key ID
  // ---------------------------------------------------------------------------
  router.get("/decisions/:id", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DECISION_ID",
          message: "Invalid decision ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const decision = await decisionRepository.getDecisionById(id);

      if (!decision) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DECISION_NOT_FOUND",
            message: `Decision with ID "${id}" was not found`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          decision,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "DECISION_RETRIEVAL_FAILED",
          message: "Failed to retrieve decision record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/actions/:actionId/decision — Retrieve decision for an action
  // ---------------------------------------------------------------------------
  router.get("/actions/:actionId/decision", requireRepository, async (req, res) => {
    const { actionId } = req.params;

    if (!isValidUuid(actionId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ACTION_ID",
          message: "Invalid action ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const decision = await decisionRepository.getDecisionByActionId(actionId);

      if (!decision) {
        return res.status(404).json({
          success: false,
          error: {
            code: "DECISION_NOT_FOUND",
            message: `Decision for action "${actionId}" was not found`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          decision,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "DECISION_RETRIEVAL_FAILED",
          message: "Failed to retrieve decision record",
        },
      });
    }
  });

  return router;
}

export default createDecisionHistoryRoutes();
