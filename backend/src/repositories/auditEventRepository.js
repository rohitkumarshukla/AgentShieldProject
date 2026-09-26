import { validateSupabaseClient, handleDbResponse } from "./repositoryHelper.js";

/**
 * Maps an application Audit Event object to a database row for the audit_events table.
 *
 * Explicitly maps queryable security columns:
 * - auditEvent.id -> id
 * - auditEvent.actionId (or auditEvent.action_id) -> action_id
 * - auditEvent.agentId (or auditEvent.agent_id) -> agent_id
 * - auditEvent.actionType (or auditEvent.action_type) -> action_type
 * - auditEvent.target -> target
 * - auditEvent.risk.score (or auditEvent.risk_score) -> risk_score
 * - auditEvent.risk.level (or auditEvent.risk_level) -> risk_level
 * - auditEvent.risk.factors (or auditEvent.risk_factors) -> risk_factors
 * - auditEvent.policy.decision (or auditEvent.policy_decision) -> policy_decision
 * - auditEvent.policy.policyCode (or auditEvent.policy_code) -> policy_code
 * - auditEvent.policy.reason (or auditEvent.policy_reason) -> policy_reason
 * - auditEvent.policy.requiresHumanApproval -> requires_human_approval
 * - auditEvent.status -> status
 * - auditEvent.metadata -> metadata
 * - auditEvent.createdAt (or auditEvent.created_at) -> created_at
 *
 * Preserves input immutability.
 *
 * @param {Object} auditEvent
 * @returns {Object} Database row
 */
export function toAuditEventRow(auditEvent = {}) {
  const row = {};

  if (auditEvent.id !== undefined) row.id = auditEvent.id;

  const actionId = auditEvent.actionId !== undefined ? auditEvent.actionId : auditEvent.action_id;
  if (actionId !== undefined) row.action_id = actionId;

  const agentId = auditEvent.agentId !== undefined ? auditEvent.agentId : auditEvent.agent_id;
  if (agentId !== undefined) row.agent_id = agentId;

  const actionType = auditEvent.actionType !== undefined ? auditEvent.actionType : auditEvent.action_type;
  if (actionType !== undefined) row.action_type = actionType;

  if (auditEvent.target !== undefined) row.target = auditEvent.target;

  // risk attributes
  const risk = auditEvent.risk || {};
  const riskScore = risk.score !== undefined ? risk.score : auditEvent.risk_score;
  if (riskScore !== undefined) row.risk_score = riskScore;

  const riskLevel = risk.level !== undefined ? risk.level : auditEvent.risk_level;
  if (riskLevel !== undefined) row.risk_level = riskLevel;

  const riskFactors = risk.factors !== undefined ? risk.factors : auditEvent.risk_factors;
  if (riskFactors !== undefined) {
    row.risk_factors = Array.isArray(riskFactors)
      ? riskFactors.map((f) => ({ ...f }))
      : riskFactors;
  }

  // policy attributes
  const policy = auditEvent.policy || {};
  const policyDecision = policy.decision !== undefined
    ? policy.decision
    : (auditEvent.policyDecision !== undefined ? auditEvent.policyDecision : auditEvent.policy_decision);
  if (policyDecision !== undefined) row.policy_decision = policyDecision;

  const policyCode = policy.policyCode !== undefined
    ? policy.policyCode
    : (auditEvent.policyCode !== undefined ? auditEvent.policyCode : auditEvent.policy_code);
  if (policyCode !== undefined) row.policy_code = policyCode;

  const policyReason = policy.reason !== undefined
    ? policy.reason
    : (auditEvent.policyReason !== undefined ? auditEvent.policyReason : auditEvent.policy_reason);
  if (policyReason !== undefined) row.policy_reason = policyReason;

  const requiresHumanApproval = policy.requiresHumanApproval !== undefined
    ? policy.requiresHumanApproval
    : (auditEvent.requiresHumanApproval !== undefined ? auditEvent.requiresHumanApproval : auditEvent.requires_human_approval);
  if (requiresHumanApproval !== undefined) row.requires_human_approval = Boolean(requiresHumanApproval);

  // status
  if (auditEvent.status !== undefined) row.status = auditEvent.status;

  // metadata
  if (auditEvent.metadata !== undefined) {
    row.metadata = typeof auditEvent.metadata === "object" && auditEvent.metadata !== null && !Array.isArray(auditEvent.metadata)
      ? { ...auditEvent.metadata }
      : auditEvent.metadata;
  }

  // created_at
  const createdAt = auditEvent.createdAt !== undefined ? auditEvent.createdAt : auditEvent.created_at;
  if (createdAt !== undefined) row.created_at = createdAt;

  return row;
}

/**
 * Factory creating an AuditEventRepository bound to an injected Supabase client.
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Object} AuditEventRepository instance
 */
export function createAuditEventRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "AuditEventRepository");

  return {
    /**
     * Persists a new audit event into the database.
     *
     * @param {Object} auditEvent - Application audit event object
     * @returns {Promise<Object>} Created database record
     */
    async createAuditEvent(auditEvent) {
      if (!auditEvent || typeof auditEvent !== "object") {
        throw new Error("Failed to create audit event: audit event object is required");
      }

      const row = toAuditEventRow(auditEvent);

      const response = await supabaseClient
        .from("audit_events")
        .insert(row)
        .select()
        .single();

      return handleDbResponse(response, "Failed to create audit event");
    },

    /**
     * Retrieves an audit event by its primary key ID.
     *
     * @param {string} id - Audit event UUID
     * @returns {Promise<Object|null>} Found record or null
     */
    async getAuditEventById(id) {
      if (!id || typeof id !== "string") {
        throw new Error("Failed to get audit event: valid id is required");
      }

      const response = await supabaseClient
        .from("audit_events")
        .select()
        .eq("id", id)
        .single();

      return handleDbResponse(response, "Failed to get audit event");
    },

    /**
     * Retrieves all audit events associated with an action ID.
     *
     * @param {string} actionId - Action UUID
     * @returns {Promise<Array<Object>>} Array of records, or empty array if none found
     */
    async listAuditEventsByActionId(actionId) {
      if (!actionId || typeof actionId !== "string") {
        throw new Error("Failed to list audit events by action: valid actionId is required");
      }

      const response = await supabaseClient
        .from("audit_events")
        .select()
        .eq("action_id", actionId);

      const data = handleDbResponse(response, "Failed to list audit events by action");
      return Array.isArray(data) ? data : [];
    },

    /**
     * Retrieves all audit events associated with an agent ID.
     *
     * @param {string} agentId - Agent UUID
     * @returns {Promise<Array<Object>>} Array of records, or empty array if none found
     */
    async listAuditEventsByAgentId(agentId) {
      if (!agentId || typeof agentId !== "string") {
        throw new Error("Failed to list audit events by agent: valid agentId is required");
      }

      const response = await supabaseClient
        .from("audit_events")
        .select()
        .eq("agent_id", agentId);

      const data = handleDbResponse(response, "Failed to list audit events by agent");
      return Array.isArray(data) ? data : [];
    },
  };
}
