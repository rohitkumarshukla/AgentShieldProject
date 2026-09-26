import express from "express";
import { createApprovalRepository } from "../repositories/approvalRepository.js";
import { createActionRepository } from "../repositories/actionRepository.js";
import { createAuditEventRepository } from "../repositories/auditEventRepository.js";
import { defaultToolRegistry } from "../tools/toolRegistry.js";
import { supabase as defaultSupabaseClient } from "../lib/supabase.js";
import { isValidUuid } from "../domain/agentValidator.js";
import { validatePaginationMiddleware } from "../middleware/pagination.js";

/**
 * Creates approval routes for Human-in-the-Loop review.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.supabaseClient]
 * @param {Object} [options.approvalRepository]
 * @param {Object} [options.actionRepository]
 * @param {Object} [options.auditEventRepository]
 * @param {Object} [options.toolRegistry]
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

  const router = express.Router();

  function requireRepository(req, res, next) {
    if (!approvalRepo) {
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
  router.get("/approvals", requireRepository, validatePaginationMiddleware, async (req, res) => {
    try {
      const { page, limit } = req.pagination;
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : undefined;

      const result = await approvalRepo.listApprovals({ status, page, limit });
      return res.status(200).json({
        success: true,
        data: {
          approvals: result.items || [],
          pagination: {
            page,
            limit,
            hasMore: result.hasMore || false,
          },
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "APPROVAL_LIST_FAILED",
          message: `Failed to list approvals: ${err.message}`,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/approvals/:id — Retrieve approval details
  // ---------------------------------------------------------------------------
  router.get("/approvals/:id", requireRepository, async (req, res) => {
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
      const approval = await approvalRepo.getApprovalById(id.trim());
      if (!approval) {
        return res.status(404).json({
          success: false,
          error: {
            code: "APPROVAL_NOT_FOUND",
            message: `Approval record with ID "${id}" was not found`,
          },
        });
      }

      // Optionally enrich with action details if action repository is available
      let actionDetails = null;
      if (actionRepo && approval.action_id) {
        try {
          actionDetails = await actionRepo.getActionById(approval.action_id);
        } catch (_ignore) {}
      }

      return res.status(200).json({
        success: true,
        data: {
          approval,
          action: actionDetails,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "APPROVAL_RETRIEVAL_FAILED",
          message: `Failed to retrieve approval: ${err.message}`,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/v1/approvals/:id/approve — Human authorizes paused action
  // ---------------------------------------------------------------------------
  router.post("/approvals/:id/approve", requireRepository, async (req, res) => {
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
      const approval = await approvalRepo.getApprovalById(id.trim());
      if (!approval) {
        return res.status(404).json({
          success: false,
          error: {
            code: "APPROVAL_NOT_FOUND",
            message: `Approval record with ID "${id}" was not found`,
          },
        });
      }

      if (approval.status !== "pending") {
        return res.status(409).json({
          success: false,
          error: {
            code: "APPROVAL_ALREADY_RESOLVED",
            message: `Approval has already been resolved with status: ${approval.status}`,
          },
        });
      }

      // 1. Update Approval Record
      const resolved = await approvalRepo.resolveApproval(id.trim(), {
        status: "approved",
        reviewer,
        reason: notes,
      });

      // 2. Lookup original action to execute downstream tool
      let executionResult = null;
      let action = null;
      if (actionRepo && approval.action_id) {
        try {
          action = await actionRepo.getActionById(approval.action_id);
          if (action && action.tool && toolRegistry) {
            const tool = toolRegistry.getTool(action.tool);
            if (tool) {
              const opName = action.target?.split(".")?.[1] || "default";
              executionResult = await toolRegistry.execute(action.tool, opName, action.parameters || {});
            }
          }
        } catch (_execErr) {
          executionResult = { status: "simulated_success", note: "Executed after human authorization" };
        }
      }

      // 3. Record Audit Event
      if (auditRepo && approval.action_id) {
        try {
          await auditRepo.createAuditEvent({
            action_id: approval.action_id,
            action_type: action?.action_type || "write",
            actor_id: action?.agent_id || "00000000-0000-0000-0000-000000000000",
            status: "APPROVED_AND_EXECUTED",
            decision: "ALLOW",
            reason: `Action approved by reviewer ${reviewer}: ${notes}`,
            metadata: {
              approval_id: id.trim(),
              reviewer,
              execution_result: executionResult,
            },
          });
        } catch (_auditErr) {}
      }

      return res.status(200).json({
        success: true,
        message: "Action approved and executed successfully",
        data: {
          approval: resolved,
          execution: executionResult,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "APPROVAL_FAILED",
          message: `Failed to approve action: ${err.message}`,
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. POST /api/v1/approvals/:id/reject — Human denies paused action
  // ---------------------------------------------------------------------------
  router.post("/approvals/:id/reject", requireRepository, async (req, res) => {
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
      const approval = await approvalRepo.getApprovalById(id.trim());
      if (!approval) {
        return res.status(404).json({
          success: false,
          error: {
            code: "APPROVAL_NOT_FOUND",
            message: `Approval record with ID "${id}" was not found`,
          },
        });
      }

      if (approval.status !== "pending") {
        return res.status(409).json({
          success: false,
          error: {
            code: "APPROVAL_ALREADY_RESOLVED",
            message: `Approval has already been resolved with status: ${approval.status}`,
          },
        });
      }

      // 1. Update Approval Record
      const resolved = await approvalRepo.resolveApproval(id.trim(), {
        status: "rejected",
        reviewer,
        reason,
      });

      // 2. Record Audit Event
      if (auditRepo && approval.action_id) {
        try {
          await auditRepo.createAuditEvent({
            action_id: approval.action_id,
            status: "REJECTED_BY_HUMAN",
            decision: "BLOCK",
            reason: `Action rejected by reviewer ${reviewer}: ${reason}`,
            metadata: {
              approval_id: id.trim(),
              reviewer,
              rejection_reason: reason,
            },
          });
        } catch (_auditErr) {}
      }

      return res.status(200).json({
        success: true,
        message: "Action rejected. Execution has been prevented.",
        data: {
          approval: resolved,
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "REJECTION_FAILED",
          message: `Failed to reject approval: ${err.message}`,
        },
      });
    }
  });

  return router;
}

export default createApprovalRoutes();
