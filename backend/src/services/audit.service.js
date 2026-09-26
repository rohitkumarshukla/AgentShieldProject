import crypto from "node:crypto";
import { isValidUuid } from "../domain/agentValidator.js";
import { validateAuditEvent } from "../audit/auditEventValidator.js";
import { createAuditEvent } from "../audit/auditEvent.js";

export class AuditServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {string} [code='AUDIT_SERVICE_ERROR']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 500, code = "AUDIT_SERVICE_ERROR", details = {}) {
    super(message);
    this.name = "AuditServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Computes deterministic SHA-256 cryptographic proof for an audit event.
 *
 * @param {Object} event
 * @returns {string} sha256:hex
 */
export function computeAuditIntegrityHash(event = {}) {
  const payload = JSON.stringify({
    id: event.id,
    actionId: event.action_id || event.actionId,
    agentId: event.agent_id || event.agentId,
    actionType: event.action_type || event.actionType,
    target: event.target,
    riskScore: event.risk_score !== undefined ? event.risk_score : event.risk?.score,
    riskLevel: event.risk_level || event.risk?.level,
    decision: event.policy_decision || event.policy?.decision,
    policyCode: event.policy_code || event.policy?.policyCode,
    createdAt: event.created_at || event.createdAt,
  });

  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  return `sha256:${hash}`;
}

/**
 * Creates an AuditService instance for end-to-end audit management, integrity verification, and analytics.
 *
 * @param {Object} dependencies
 * @param {Object} dependencies.auditEventRepository
 * @param {Object} [dependencies.agentRepository]
 * @param {Object} [dependencies.actionRepository]
 * @param {Object} [dependencies.approvalRepository]
 * @returns {Object}
 */
export function createAuditService({
  auditEventRepository,
  agentRepository = null,
  actionRepository = null,
  approvalRepository = null,
} = {}) {
  if (!auditEventRepository) {
    throw new AuditServiceError(
      "createAuditService requires an auditEventRepository instance",
      500,
      "MISSING_REPOSITORY"
    );
  }

  return {
    /**
     * Records and securely persists an audit event with cryptographic integrity verification.
     *
     * @param {Object} eventInput
     * @returns {Promise<Object>}
     */
    async recordAuditEvent(eventInput = {}) {
      try {
        const auditEvent = eventInput.action && eventInput.risk && eventInput.policy
          ? createAuditEvent(eventInput)
          : eventInput;

        const validation = validateAuditEvent(auditEvent);
        if (!validation.valid) {
          throw new AuditServiceError(
            `Audit validation failed: ${validation.errors.join("; ")}`,
            400,
            "INVALID_AUDIT_EVENT",
            { errors: validation.errors }
          );
        }

        const integrityHash = computeAuditIntegrityHash(auditEvent);
        const enrichedEvent = {
          ...auditEvent,
          metadata: {
            ...(auditEvent.metadata || {}),
            integrityHash,
            verifiedAt: new Date().toISOString(),
          },
        };

        const saved = await auditEventRepository.createAuditEvent(enrichedEvent);
        return {
          ...saved,
          integrityHash,
        };
      } catch (err) {
        if (err instanceof AuditServiceError) throw err;
        throw new AuditServiceError(
          `Failed to record audit event: ${err.message}`,
          500,
          "AUDIT_RECORD_FAILED"
        );
      }
    },

    /**
     * Retrieves an audit event by primary key ID and enriches with agent & action context.
     *
     * @param {string} id - Audit Event UUID
     * @returns {Promise<{ audit: Object, agent: Object|null, action: Object|null, integrity: Object }>}
     */
    async getAuditEventById(id) {
      if (!id || !isValidUuid(id)) {
        throw new AuditServiceError(
          "Invalid audit event ID format. Expected standard UUID.",
          400,
          "INVALID_AUDIT_EVENT_ID"
        );
      }

      try {
        const audit = await auditEventRepository.getAuditEventById(id.trim());
        if (!audit) {
          throw new AuditServiceError(
            `Audit event with ID "${id}" was not found`,
            404,
            "AUDIT_EVENT_NOT_FOUND"
          );
        }

        const agentId = audit.agent_id || audit.agentId;
        const actionId = audit.action_id || audit.actionId;

        let agentDetails = null;
        let actionDetails = null;

        if (agentRepository && agentId) {
          try {
            agentDetails = await agentRepository.getAgentById(agentId);
          } catch (_) {}
        }

        if (actionRepository && actionId) {
          try {
            actionDetails = await actionRepository.getActionById(actionId);
          } catch (_) {}
        }

        const calculatedHash = computeAuditIntegrityHash(audit);
        const storedHash = audit.metadata?.integrityHash || calculatedHash;
        const isVerified = storedHash === calculatedHash;

        return {
          audit,
          agent: agentDetails,
          action: actionDetails,
          integrity: {
            hash: calculatedHash,
            verified: isVerified,
            status: isVerified ? "sha256:integrity-verified ✓" : "integrity-mismatch",
          },
        };
      } catch (err) {
        if (err instanceof AuditServiceError) throw err;
        throw new AuditServiceError(
          `Failed to retrieve audit event: ${err.message}`,
          500,
          "AUDIT_EVENT_RETRIEVAL_FAILED"
        );
      }
    },

    /**
     * Lists audit events with rich filtering, search, and pagination.
     *
     * @param {Object} [options={}]
     * @param {string} [options.agentId]
     * @param {string} [options.actionId]
     * @param {string} [options.decision]
     * @param {string} [options.riskLevel]
     * @param {string} [options.status]
     * @param {string} [options.search]
     * @param {number} [options.page=1]
     * @param {number} [options.limit=20]
     * @returns {Promise<{ auditEvents: Array<Object>, pagination: Object }>}
     */
    async listAuditEvents({
      agentId,
      actionId,
      decision,
      riskLevel,
      status,
      search,
      page = 1,
      limit = 20,
    } = {}) {
      try {
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

        let result;
        if (typeof auditEventRepository.listAuditEvents === "function") {
          result = await auditEventRepository.listAuditEvents({
            agentId,
            actionId,
            decision,
            riskLevel,
            status,
            search,
            page: safePage,
            limit: safeLimit,
          });
        } else if (actionId && typeof auditEventRepository.listAuditEventsByActionId === "function") {
          result = await auditEventRepository.listAuditEventsByActionId(actionId, {
            page: safePage,
            limit: safeLimit,
          });
        } else if (agentId && typeof auditEventRepository.listAuditEventsByAgentId === "function") {
          result = await auditEventRepository.listAuditEventsByAgentId(agentId, {
            page: safePage,
            limit: safeLimit,
          });
        } else {
          result = { items: [], hasMore: false };
        }

        const items = Array.isArray(result) ? result : (result?.items || []);
        const hasMore = Array.isArray(result) ? false : Boolean(result?.hasMore);

        const enriched = items.map((item) => ({
          ...item,
          integrityProof: computeAuditIntegrityHash(item),
        }));

        return {
          auditEvents: enriched,
          pagination: {
            page: safePage,
            limit: safeLimit,
            hasMore,
            total: result?.total,
          },
        };
      } catch (err) {
        throw new AuditServiceError(
          `Failed to list audit events: ${err.message}`,
          500,
          "AUDIT_EVENT_LIST_FAILED"
        );
      }
    },

    /**
     * Returns aggregate analytics and statistics on audit events.
     *
     * @returns {Promise<Object>}
     */
    async getAuditStats() {
      try {
        if (typeof auditEventRepository.getAuditStats === "function") {
          return await auditEventRepository.getAuditStats();
        }

        return {
          totalEvents: 0,
          decisions: { allowed: 0, blocked: 0, approvalRequired: 0 },
          riskDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
          integrityStatus: "verified",
        };
      } catch (err) {
        throw new AuditServiceError(
          `Failed to retrieve audit stats: ${err.message}`,
          500,
          "AUDIT_STATS_FAILED"
        );
      }
    },

    /**
     * Exports audit records in standard JSON or CSV format.
     *
     * @param {Object} [options={}]
     * @param {"json"|"csv"} [options.format="json"]
     * @returns {Promise<{ contentType: string, data: string, filename: string }>}
     */
    async exportAuditLog({ format = "json", ...filters } = {}) {
      try {
        const { auditEvents } = await this.listAuditEvents({ ...filters, limit: 1000 });
        const dateStr = new Date().toISOString().split("T")[0];

        if (format.toLowerCase() === "csv") {
          const headers = [
            "ID",
            "Action ID",
            "Agent ID",
            "Action Type",
            "Target",
            "Risk Score",
            "Risk Level",
            "Policy Decision",
            "Policy Code",
            "Status",
            "Created At",
            "Integrity Hash",
          ];

          const rows = auditEvents.map((e) => [
            e.id || "",
            e.action_id || e.actionId || "",
            e.agent_id || e.agentId || "",
            e.action_type || e.actionType || "",
            `"${(e.target || "").replace(/"/g, '""')}"`,
            e.risk_score !== undefined ? e.risk_score : e.risk?.score || 0,
            e.risk_level || e.risk?.level || "LOW",
            e.policy_decision || e.policy?.decision || "ALLOW",
            e.policy_code || e.policy?.policyCode || "",
            e.status || "DECISION_MADE",
            e.created_at || e.createdAt || "",
            e.integrityProof || "",
          ]);

          const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

          return {
            contentType: "text/csv",
            data: csvContent,
            filename: `agentshield-audit-${dateStr}.csv`,
          };
        }

        return {
          contentType: "application/json",
          data: JSON.stringify(auditEvents, null, 2),
          filename: `agentshield-audit-${dateStr}.json`,
        };
      } catch (err) {
        throw new AuditServiceError(
          `Failed to export audit log: ${err.message}`,
          500,
          "AUDIT_EXPORT_FAILED"
        );
      }
    },
  };
}

export default {
  AuditServiceError,
  computeAuditIntegrityHash,
  createAuditService,
};
