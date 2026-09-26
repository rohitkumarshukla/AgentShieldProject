import express from "express";
import { createApprovalRepository } from "../repositories/approvalRepository.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { defaultToolRegistry } from "../tools/toolRegistry.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";
import { createApprovalService, ApprovalServiceError } from "../services/approval.service.js";

/**
 * Creates approval routes for Human-in-the-Loop review.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.supabaseClient]
 * @param {Object} [options.approvalRepository]
 * @param {Object} [options.actionRepository]
 * @param {Object} [options.auditEventRepository]
 * @param {Object} [options.toolRegistry]
 * @param {Object} [options.approvalService]
 * @returns {express.Router}
 */
export function createApprovalRoutes(options = {}) {
  const supabaseClient =
    options.supabaseClient !== undefined
      ? options.supabaseClient
      : defaultSupabaseClient;

  const approvalRepo =
    options.approvalRepository ||
    (supabaseClient ? createApprovalRepository(supabaseClient) : null);

  const actionRepo =
    options.actionRepository ||
    (supabaseClient ? createActionRepository(supabaseClient) : null);

  const auditRepo =
    options.auditEventRepository ||
    (supabaseClient ? createAuditEventRepository(supabaseClient) : null);

  const toolRegistry = options.toolRegistry || defaultToolRegistry;

  const approvalService =
    options.approvalService ||
    (approvalRepo
      ? createApprovalService({
          approvalRepository: approvalRepo,
          actionRepository: actionRepo,
          auditEventRepository: auditRepo,
          toolRegistry,
        })
      : null);

  const router = express.Router();

  function requireService(req, res, next) {
    if (!approvalService) {
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
  // 1. GET /api/v1/approvals — List approvals with status filter & pagination
  // ---------------------------------------------------------------------------
  router.get("/approvals", requireService, validatePaginationMiddleware, async (req, res) => {
    try {
      const { page, limit } = req.pagination;
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;

      const result = await approvalService.listApprovals({ status, page, limit });
      return res.status(200).json({
        success: true,
        data: {
          approvals: result.approvals,
          pagination: result.pagination,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ApprovalServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "APPROVAL_LIST_FAILED",
          message: err.message,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/approvals/:id — Retrieve approval details
  // ---------------------------------------------------------------------------
  router.get("/approvals/:id", requireService, async (req, res) => {
    const { id } = req.params;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_APPROVAL_ID",
          message: "Invalid approval ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const result = await approvalService.getApprovalById(id.trim());
      return res.status(200).json({
        success: true,
        data: {
          approval: result.approval,
          action: result.action,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ApprovalServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "APPROVAL_RETRIEVAL_FAILED",
          message: err.message,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/approvals/:id/approve — Human authorizes paused action
  // ---------------------------------------------------------------------------
  router.post("/approvals/:id/approve", requireService, async (req, res) => {
    const { id } = req.params;
    const reviewer = req.body?.reviewer || req.user?.email || "human_reviewer";
    const notes = req.body?.notes || req.body?.reason || "Approved by security operator";

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_APPROVAL_ID",
          message: "Invalid approval ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const result = await approvalService.approveAction(id.trim(), {
        reviewer,
        notes,
        executeTool: true,
      });

      return res.status(200).json({
        success: true,
        message: "Action approved and executed successfully",
        data: {
          approval: result.approval,
          execution: result.execution,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ApprovalServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "APPROVAL_FAILED",
          message: err.message,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/approvals/:id/reject — Human denies paused action
  // ---------------------------------------------------------------------------
  router.post("/approvals/:id/reject", requireService, async (req, res) => {
    const { id } = req.params;
    const reviewer = req.body?.reviewer || req.user?.email || "human_reviewer";
    const reason = req.body?.reason || req.body?.notes || "Rejected by security operator";

    if (!isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_APPROVAL_ID",
          message: "Invalid approval ID format. Expected standard UUID.",
        },
      });
    }

    try {
      const result = await approvalService.rejectAction(id.trim(), {
        reviewer,
        reason,
      });

      return res.status(200).json({
        success: true,
        message: "Action rejected. Execution has been prevented.",
        data: {
          approval: result.approval,
        },
      });
    } catch (err) {
      const statusCode = err instanceof ApprovalServiceError ? err.statusCode : 500;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err.code || "REJECTION_FAILED",
          message: err.message,
        },
      });
    }
  });

  return router;
}

export default createApprovalRoutes();
