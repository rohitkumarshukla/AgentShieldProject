import express from "express";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";

import { validatePaginationMiddleware } from "../middleware/pagination.js";

/**
 * Creates an audit history router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - auditEventRepository: explicit AuditEventRepository instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.auditEventRepository]
 * @returns {express.Router}
 */
export function createAuditRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const auditEventRepository = options.auditEventRepository || (supabaseClient ? createAuditEventRepository(supabaseClient) : null);

  const router = express.Router();

  /**
   * Helper to verify database/repository availability.
   * If Supabase is unconfigured or no repository is available, returns HTTP 503.
   */
  function requireRepository(req, res, next) {
    if (!auditEventRepository) {
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
  // GET /api/v1/audit-events/:id — Retrieve an audit event by primary key ID
  // ---------------------------------------------------------------------------
  router.get("/audit-events/:id", requireRepository, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_AUDIT_EVENT_ID",
          message: "Invalid audit event ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const audit = await auditEventRepository.getAuditEventById(id);

      if (!audit) {
        return res.status(404).json({
          success: false,
          error: {
            code: "AUDIT_EVENT_NOT_FOUND",
            message: `Audit event with ID "${id}" was not found`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          audit,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "AUDIT_EVENT_RETRIEVAL_FAILED",
          message: "Failed to retrieve audit event record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/actions/:actionId/audit-events — Retrieve audit events for an action (paginated)
  // ---------------------------------------------------------------------------
  router.get("/actions/:actionId/audit-events", requireRepository, validatePaginationMiddleware, async (req, res) => {
    const { actionId } = req.params;
    const { page, limit } = req.pagination;

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
      const result = await auditEventRepository.listAuditEventsByActionId(actionId, { page, limit });

      const auditEvents = Array.isArray(result) ? result : (result.items || []);
      const hasMore = Array.isArray(result) ? false : Boolean(result.hasMore);

      return res.status(200).json({
        success: true,
        data: {
          auditEvents,
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
          code: "AUDIT_EVENT_LIST_FAILED",
          message: "Failed to list audit events for action",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/agents/:agentId/audit-events — Retrieve audit events for an agent (paginated)
  // ---------------------------------------------------------------------------
  router.get("/agents/:agentId/audit-events", requireRepository, validatePaginationMiddleware, async (req, res) => {
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
      const result = await auditEventRepository.listAuditEventsByAgentId(agentId, { page, limit });

      const auditEvents = Array.isArray(result) ? result : (result.items || []);
      const hasMore = Array.isArray(result) ? false : Boolean(result.hasMore);

      return res.status(200).json({
        success: true,
        data: {
          auditEvents,
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
          code: "AUDIT_EVENT_LIST_FAILED",
          message: "Failed to list audit events for agent",
        },
      });
    }
  });

  return router;
}

export default createAuditRoutes();
