import express from "express";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { createAgentRepository } from "../repositories/agentRepository.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";
import { createAuditService, AuditServiceError } from "../services/audit.service.js";

/**
 * Creates an audit history router with configurable dependencies.
 *
 * Supports dependency injection for testing:
 * - supabaseClient: explicit Supabase client instance (or null)
 * - auditEventRepository: explicit AuditEventRepository instance (optional override)
 * - auditService: explicit AuditService instance (optional override)
 *
 * @param {Object} [options={}]
 * @param {Object|null} [options.supabaseClient]
 * @param {Object} [options.auditEventRepository]
 * @param {Object} [options.auditService]
 * @returns {express.Router}
 */
export function createAuditRoutes(options = {}) {
  const supabaseClient = options.supabaseClient !== undefined ? options.supabaseClient : defaultSupabaseClient;
  const auditEventRepository = options.auditEventRepository || (supabaseClient ? createAuditEventRepository(supabaseClient) : null);
  const agentRepository = options.agentRepository || (supabaseClient ? createAgentRepository(supabaseClient) : null);
  const actionRepository = options.actionRepository || (supabaseClient ? createActionRepository(supabaseClient) : null);

  const auditService =
    options.auditService ||
    (auditEventRepository
      ? createAuditService({
          auditEventRepository,
          agentRepository,
          actionRepository,
        })
      : null);

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
  // 1. GET /api/v1/audit-events/stats — Aggregated governance audit statistics
  // ---------------------------------------------------------------------------
  router.get("/audit-events/stats", requireRepository, async (req, res) => {
    try {
      const stats = await auditService.getAuditStats();
      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      const statusCode = err instanceof AuditServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "AUDIT_STATS_FAILED",
          message: err.message || "Failed to retrieve audit statistics",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/audit-events/export — Export audit logs as CSV or JSON
  // ---------------------------------------------------------------------------
  router.get("/audit-events/export", requireRepository, async (req, res) => {
    try {
      const format = req.query.format === "csv" ? "csv" : "json";
      const { search, decision, riskLevel, status, agentId, actionId } = req.query;

      const result = await auditService.exportAuditLog({
        format,
        search,
        decision,
        riskLevel,
        status,
        agentId,
        actionId,
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    } catch (err) {
      const statusCode = err instanceof AuditServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "AUDIT_EXPORT_FAILED",
          message: err.message || "Failed to export audit logs",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/audit-events — List all audit events with search & filters
  // ---------------------------------------------------------------------------
  router.get("/audit-events", requireRepository, validatePaginationMiddleware, async (req, res) => {
    try {
      const { page, limit } = req.pagination;
      const { search, decision, riskLevel, status, agentId, actionId } = req.query;

      const result = await auditService.listAuditEvents({
        search,
        decision,
        riskLevel,
        status,
        agentId,
        actionId,
        page,
        limit,
      });

      return res.status(200).json({
        success: true,
        data: {
          auditEvents: result.auditEvents,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      const statusCode = err instanceof AuditServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "AUDIT_EVENT_LIST_FAILED",
          message: err.message || "Failed to list audit events",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/v1/audit-events/:id — Retrieve an audit event by primary key ID
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
      const result = await auditService.getAuditEventById(id.trim());

      return res.status(200).json({
        success: true,
        data: {
          audit: result.audit,
          agent: result.agent,
          action: result.action,
          integrity: result.integrity,
        },
      });
    } catch (err) {
      const statusCode = err instanceof AuditServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "AUDIT_EVENT_RETRIEVAL_FAILED",
          message: err.message || "Failed to retrieve audit event record",
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. GET /api/v1/actions/:actionId/audit-events — Retrieve audit events for an action (paginated)
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
  // 6. GET /api/v1/agents/:agentId/audit-events — Retrieve audit events for an agent (paginated)
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
