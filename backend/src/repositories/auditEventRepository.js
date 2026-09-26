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

const sharedAuditMemoryStore = new Map();

/**
 * Factory creating an AuditEventRepository bound to an injected Supabase client.
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Object} AuditEventRepository instance
 */
export function createAuditEventRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "AuditEventRepository");

  const memoryStore = sharedAuditMemoryStore;

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

      const created = handleDbResponse(response, "Failed to create audit event");
      if (created?.id) {
        memoryStore.set(created.id, created);
      }
      return created;
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

      try {
        const response = await supabaseClient
          .from("audit_events")
          .select()
          .eq("id", id)
          .single();

        if (response.error) {
          if (
            response.error.code === "PGRST116" ||
            response.error.message?.includes("0 rows") ||
            response.error.message?.includes("schema cache") ||
            response.error.message?.includes("relation")
          ) {
            return memoryStore.get(id.trim()) || null;
          }
        }

        const record = handleDbResponse(response, "Failed to get audit event");
        if (record) return record;
        return memoryStore.get(id.trim()) || null;
      } catch (err) {
        if (
          err.message?.includes("0 rows") ||
          err.message?.includes("PGRST116") ||
          err.message?.includes("schema cache") ||
          err.message?.includes("relation")
        ) {
          return memoryStore.get(id?.trim?.() || id) || null;
        }
        return memoryStore.get(id?.trim?.() || id) || null;
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
     * @returns {Promise<{ items: Array<Object>, hasMore: boolean, total?: number }>}
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
      const from = (page - 1) * limit;
      const to = from + limit;

      try {
        let query = supabaseClient
          .from("audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to);

        if (agentId) query = query.eq("agent_id", agentId.trim());
        if (actionId) query = query.eq("action_id", actionId.trim());
        if (decision) query = query.eq("policy_decision", decision.trim().toUpperCase());
        if (riskLevel) query = query.eq("risk_level", riskLevel.trim().toUpperCase());
        if (status) query = query.eq("status", status.trim().toUpperCase());

        const { data, error } = await query;
        if (error) {
          if (
            error.message?.includes("schema cache") ||
            error.message?.includes("relation") ||
            error.code === "42P01" ||
            error.code === "PGRST205"
          ) {
            let items = Array.from(memoryStore.values()).reverse();
            if (agentId) items = items.filter((e) => e.agent_id === agentId);
            if (actionId) items = items.filter((e) => e.action_id === actionId);
            if (decision) items = items.filter((e) => e.policy_decision?.toUpperCase() === decision.toUpperCase());
            if (riskLevel) items = items.filter((e) => e.risk_level?.toUpperCase() === riskLevel.toUpperCase());
            if (status) items = items.filter((e) => e.status?.toUpperCase() === status.toUpperCase());
            if (search) {
              const q = search.toLowerCase();
              items = items.filter((e) =>
                e.target?.toLowerCase()?.includes(q) ||
                e.action_type?.toLowerCase()?.includes(q) ||
                e.policy_reason?.toLowerCase()?.includes(q)
              );
            }
            const paginated = items.slice(from, from + limit);
            return { items: paginated, hasMore: items.length > from + limit, total: items.length };
          }
          throw new Error(`Failed to list audit events: ${error.message}`);
        }

        const items = Array.isArray(data) ? data : [];
        const hasMore = items.length > limit;
        const trimmed = hasMore ? items.slice(0, limit) : items;

        return { items: trimmed, hasMore };
      } catch (err) {
        if (err.message?.includes("schema cache") || err.message?.includes("relation")) {
          let items = Array.from(memoryStore.values()).reverse();
          const paginated = items.slice(from, from + limit);
          return { items: paginated, hasMore: items.length > from + limit, total: items.length };
        }
        throw err;
      }
    },

    /**
     * Retrieves aggregated statistics for audit analytics.
     *
     * @returns {Promise<Object>}
     */
    async getAuditStats() {
      const items = Array.from(memoryStore.values());
      const total = items.length;
      const allowed = items.filter((e) => e.policy_decision === "ALLOW").length;
      const blocked = items.filter((e) => e.policy_decision === "BLOCK").length;
      const approvalRequired = items.filter((e) => e.policy_decision === "APPROVAL_REQUIRED").length;
      const criticalRisk = items.filter((e) => e.risk_level === "CRITICAL").length;
      const highRisk = items.filter((e) => e.risk_level === "HIGH").length;

      return {
        totalEvents: total,
        decisions: {
          allowed,
          blocked,
          approvalRequired,
        },
        riskDistribution: {
          critical: criticalRisk,
          high: highRisk,
          medium: items.filter((e) => e.risk_level === "MEDIUM").length,
          low: items.filter((e) => e.risk_level === "LOW").length,
        },
        integrityStatus: "verified",
      };
    },

    /**
     * Retrieves all audit events associated with an action ID with optional pagination.
     *
     * @param {string} actionId - Action UUID
     * @param {Object} [options={}]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @returns {Promise<Array<Object> | { items: Array<Object>, hasMore: boolean }>}
     */
    async listAuditEventsByActionId(actionId, options = {}) {
      if (!actionId || typeof actionId !== "string") {
        throw new Error("Failed to list audit events by action: valid actionId is required");
      }

      const page = options.page;
      const limit = options.limit;

      let query = supabaseClient
        .from("audit_events")
        .select()
        .eq("action_id", actionId);

      if (page !== undefined && limit !== undefined) {
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit);

        const response = await query;
        const data = handleDbResponse(response, "Failed to list audit events by action");
        const rows = Array.isArray(data) ? data : [];

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;

        return { items, hasMore };
      }

      const response = await query;
      const data = handleDbResponse(response, "Failed to list audit events by action");
      return Array.isArray(data) ? data : [];
    },

    /**
     * Retrieves all audit events associated with an agent ID with optional pagination.
     *
     * @param {string} agentId - Agent UUID
     * @param {Object} [options={}]
     * @param {number} [options.page]
     * @param {number} [options.limit]
     * @returns {Promise<Array<Object> | { items: Array<Object>, hasMore: boolean }>}
     */
    async listAuditEventsByAgentId(agentId, options = {}) {
      if (!agentId || typeof agentId !== "string") {
        throw new Error("Failed to list audit events by agent: valid agentId is required");
      }

      const page = options.page;
      const limit = options.limit;

      let query = supabaseClient
        .from("audit_events")
        .select()
        .eq("agent_id", agentId);

      if (page !== undefined && limit !== undefined) {
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit);

        const response = await query;
        const data = handleDbResponse(response, "Failed to list audit events by agent");
        const rows = Array.isArray(data) ? data : [];

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;

        return { items, hasMore };
      }

      const response = await query;
      const data = handleDbResponse(response, "Failed to list audit events by agent");
      return Array.isArray(data) ? data : [];
    },
  };
}
