import { isValidUuid } from "../domain/agentValidator.js";

export class ApprovalServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [code='APPROVAL_SERVICE_ERROR']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 500, code = "APPROVAL_SERVICE_ERROR", details = {}) {
    super(message);
    this.name = "ApprovalServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Creates an ApprovalService instance for Human-in-the-Loop governance.
 *
 * @param {Object} dependencies
 * @param {Object} dependencies.approvalRepository
 * @param {Object} [dependencies.actionRepository]
 * @param {Object} [dependencies.auditEventRepository]
 * @param {Object} [dependencies.toolRegistry]
 * @returns {Object}
 */
export function createApprovalService({
  approvalRepository,
  actionRepository = null,
  auditEventRepository = null,
  toolRegistry = null,
} = {}) {
  if (!approvalRepository) {
    throw new ApprovalServiceError(
      "createApprovalService requires an approvalRepository instance",
      500,
      "MISSING_REPOSITORY"
    );
  }

  return {
    /**
     * Lists approvals with optional status filtering and pagination.
     *
     * @param {Object} [options={}]
     * @param {string} [options.status] - 'pending' | 'approved' | 'rejected'
     * @param {number} [options.page=1]
     * @param {number} [options.limit=20]
     * @returns {Promise<{ approvals: Array<Object>, pagination: Object }>}
     */
    async listApprovals({ status, page = 1, limit = 20 } = {}) {
      try {
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const normalizedStatus = status ? String(status).trim().toLowerCase() : undefined;

        const result = await approvalRepository.listApprovals({
          status: normalizedStatus,
          page: safePage,
          limit: safeLimit,
        });

        return {
          approvals: result?.items || [],
          pagination: {
            page: safePage,
            limit: safeLimit,
            hasMore: result?.hasMore || false,
          },
        };
      } catch (err) {
        throw new ApprovalServiceError(
          `Failed to list approvals: ${err.message}`,
          500,
          "APPROVAL_LIST_FAILED"
        );
      }
    },

    /**
     * Retrieves an approval record by ID and enriches it with Action details if available.
     *
     * @param {string} id - Approval UUID
     * @returns {Promise<{ approval: Object, action: Object|null }>}
     */
    async getApprovalById(id) {
      if (!id || !isValidUuid(id)) {
        throw new ApprovalServiceError(
          "Invalid approval ID format. Expected standard UUID.",
          400,
          "INVALID_APPROVAL_ID"
        );
      }

      try {
        const approval = await approvalRepository.getApprovalById(id.trim());
        if (!approval) {
          throw new ApprovalServiceError(
            `Approval record with ID "${id}" was not found`,
            404,
            "APPROVAL_NOT_FOUND"
          );
        }

        let actionDetails = null;
        if (actionRepository && approval.action_id) {
          try {
            actionDetails = await actionRepository.getActionById(approval.action_id);
          } catch (_err) {
            // Non-blocking enrichment failure
          }
        }

        return {
          approval,
          action: actionDetails,
        };
      } catch (err) {
        if (err instanceof ApprovalServiceError) throw err;
        throw new ApprovalServiceError(
          `Failed to retrieve approval: ${err.message}`,
          500,
          "APPROVAL_RETRIEVAL_FAILED"
        );
      }
    },

    /**
     * Creates a new pending approval record.
     *
     * @param {Object} payload
     * @param {string} payload.actionId
     * @param {string} [payload.decisionId]
     * @param {string} [payload.reason]
     * @param {Object} [payload.metadata]
     * @returns {Promise<Object>}
     */
    async createPendingApproval(payload = {}) {
      if (!payload.actionId) {
        throw new ApprovalServiceError(
          "actionId is required to create an approval record",
          400,
          "INVALID_APPROVAL_PAYLOAD"
        );
      }

      try {
        const record = await approvalRepository.createApproval({
          actionId: payload.actionId,
          decisionId: payload.decisionId || null,
          status: "pending",
          reason: payload.reason || "Action paused pending human authorization",
          metadata: payload.metadata || {},
        });

        if (auditEventRepository) {
          try {
            await auditEventRepository.createAuditEvent({
              action_id: payload.actionId,
              status: "AWAITING_APPROVAL",
              decision: "APPROVAL_REQUIRED",
              reason: payload.reason || "Awaiting human review",
              metadata: {
                approval_id: record.id,
                ...payload.metadata,
              },
            });
          } catch (_auditErr) {}
        }

        return record;
      } catch (err) {
        if (err instanceof ApprovalServiceError) throw err;
        throw new ApprovalServiceError(
          `Failed to create approval record: ${err.message}`,
          500,
          "APPROVAL_CREATION_FAILED"
        );
      }
    },

    /**
     * Approves a pending action, resumes tool execution if applicable, and records audit history.
     *
     * @param {string} id - Approval UUID
     * @param {Object} [options={}]
     * @param {string} [options.reviewer='human_reviewer']
     * @param {string} [options.notes]
     * @param {boolean} [options.executeTool=true]
     * @returns {Promise<{ approval: Object, execution: Object|null }>}
     */
    async approveAction(id, { reviewer = "human_reviewer", notes = "Approved by operator", executeTool = true } = {}) {
      if (!id || !isValidUuid(id)) {
        throw new ApprovalServiceError(
          "Invalid approval ID format. Expected standard UUID.",
          400,
          "INVALID_APPROVAL_ID"
        );
      }

      try {
        const approval = await approvalRepository.getApprovalById(id.trim());
        if (!approval) {
          throw new ApprovalServiceError(
            `Approval record with ID "${id}" was not found`,
            404,
            "APPROVAL_NOT_FOUND"
          );
        }

        if (approval.status !== "pending") {
          throw new ApprovalServiceError(
            `Approval has already been resolved with status: ${approval.status}`,
            409,
            "APPROVAL_ALREADY_RESOLVED"
          );
        }

        // 1. Update Approval Record in DB
        const resolved = await approvalRepository.resolveApproval(id.trim(), {
          status: "approved",
          reviewer: reviewer || "human_reviewer",
          reason: notes || "Approved by security operator",
        });

        // 2. Execute Downstream Tool Operation if requested & Action exists
        let executionResult = null;
        let action = null;

        if (actionRepository && approval.action_id) {
          try {
            action = await actionRepository.getActionById(approval.action_id);
          } catch (_actErr) {}
        }

        if (executeTool && toolRegistry) {
          try {
            const toolId = approval.metadata?.toolId || action?.tool || action?.metadata?.toolId;
            const operation = approval.metadata?.operation || action?.target?.split(".")?.[1] || action?.metadata?.operation;
            const params = approval.metadata?.parameters || action?.scope?.parameters || action?.parameters || {};

            if (toolId && operation) {
              if (typeof toolRegistry.executeOperation === "function") {
                executionResult = await toolRegistry.executeOperation(toolId, operation, params);
              } else if (typeof toolRegistry.execute === "function") {
                executionResult = await toolRegistry.execute(toolId, operation, params);
              }
            }
          } catch (execErr) {
            executionResult = {
              success: false,
              error: execErr.message,
              executionTimeMs: 0,
            };
          }
        }

        if (!executionResult && executeTool) {
          executionResult = {
            success: true,
            status: "executed_after_authorization",
            message: "Action authorized and simulated downstream execution completed",
          };
        }

        // 3. Record Audit Event
        if (auditEventRepository && approval.action_id) {
          try {
            await auditEventRepository.createAuditEvent({
              action_id: approval.action_id,
              action_type: action?.action_type || action?.actionType || "write",
              actor_id: action?.agent_id || action?.agentId || "00000000-0000-0000-0000-000000000000",
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

        return {
          approval: resolved,
          execution: executionResult,
        };
      } catch (err) {
        if (err instanceof ApprovalServiceError) throw err;
        throw new ApprovalServiceError(
          `Failed to approve action: ${err.message}`,
          500,
          "APPROVAL_FAILED"
        );
      }
    },

    /**
     * Rejects a pending action, preventing tool execution, and records rejection audit event.
     *
     * @param {string} id - Approval UUID
     * @param {Object} [options={}]
     * @param {string} [options.reviewer='human_reviewer']
     * @param {string} [options.reason='Rejected by security operator']
     * @returns {Promise<{ approval: Object }>}
     */
    async rejectAction(id, { reviewer = "human_reviewer", reason = "Rejected by security operator" } = {}) {
      if (!id || !isValidUuid(id)) {
        throw new ApprovalServiceError(
          "Invalid approval ID format. Expected standard UUID.",
          400,
          "INVALID_APPROVAL_ID"
        );
      }

      try {
        const approval = await approvalRepository.getApprovalById(id.trim());
        if (!approval) {
          throw new ApprovalServiceError(
            `Approval record with ID "${id}" was not found`,
            404,
            "APPROVAL_NOT_FOUND"
          );
        }

        if (approval.status !== "pending") {
          throw new ApprovalServiceError(
            `Approval has already been resolved with status: ${approval.status}`,
            409,
            "APPROVAL_ALREADY_RESOLVED"
          );
        }

        // 1. Update Approval Record to rejected
        const resolved = await approvalRepository.resolveApproval(id.trim(), {
          status: "rejected",
          reviewer: reviewer || "human_reviewer",
          reason: reason || "Rejected by security operator",
        });

        // 2. Record Audit Event
        if (auditEventRepository && approval.action_id) {
          try {
            await auditEventRepository.createAuditEvent({
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

        return {
          approval: resolved,
        };
      } catch (err) {
        if (err instanceof ApprovalServiceError) throw err;
        throw new ApprovalServiceError(
          `Failed to reject approval: ${err.message}`,
          500,
          "REJECTION_FAILED"
        );
      }
    },
  };
}

export default {
  ApprovalServiceError,
  createApprovalService,
};
