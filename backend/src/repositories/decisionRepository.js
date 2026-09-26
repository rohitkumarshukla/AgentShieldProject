import { validateSupabaseClient, handleDbResponse } from "./repositoryHelper.js";

/**
 * Maps an application decision object to a database row for the decisions table.
 *
 * Flattens structured decision components:
 * - decision.action.id (or decision.actionId) -> action_id
 * - decision.risk.score -> risk_score
 * - decision.risk.level -> risk_level
 * - decision.risk.factors -> risk_factors
 * - decision.policy.decision (or decision.policyDecision) -> policy_decision
 * - decision.policy.policyCode (or decision.policyCode) -> policy_code
 * - decision.policy.reason (or decision.policyReason) -> policy_reason
 * - decision.policy.requiresHumanApproval -> requires_human_approval
 *
 * Preserves input immutability.
 *
 * @param {Object} decision
 * @returns {Object} Database row
 */
export function toDecisionRow(decision = {}) {
  const row = {};

  if (decision.id !== undefined) row.id = decision.id;

  // action_id resolution
  const actionId = decision.action?.id ?? decision.actionId ?? decision.action_id;
  if (actionId !== undefined) row.action_id = actionId;

  // risk attributes
  const risk = decision.risk || {};
  const riskScore = risk.score !== undefined ? risk.score : decision.risk_score;
  if (riskScore !== undefined) row.risk_score = riskScore;

  const riskLevel = risk.level !== undefined ? risk.level : decision.risk_level;
  if (riskLevel !== undefined) row.risk_level = riskLevel;

  const riskFactors = risk.factors !== undefined ? risk.factors : decision.risk_factors;
  if (riskFactors !== undefined) {
    row.risk_factors = Array.isArray(riskFactors)
      ? riskFactors.map((f) => ({ ...f }))
      : riskFactors;
  }

  // policy attributes
  const policy = decision.policy || {};
  const policyCode = policy.policyCode !== undefined
    ? policy.policyCode
    : (decision.policyCode !== undefined ? decision.policyCode : decision.policy_code);
  if (policyCode !== undefined) row.policy_code = policyCode;

  const policyDecision = policy.decision !== undefined
    ? policy.decision
    : (decision.policyDecision !== undefined ? decision.policyDecision : decision.policy_decision);
  if (policyDecision !== undefined) row.policy_decision = policyDecision;

  const reason = policy.reason !== undefined
    ? policy.reason
    : (decision.policyReason !== undefined ? decision.policyReason : (decision.reason !== undefined ? decision.reason : decision.policy_reason));
  if (reason !== undefined) row.policy_reason = reason;

  const requiresHumanApproval = policy.requiresHumanApproval !== undefined
    ? policy.requiresHumanApproval
    : (decision.requiresHumanApproval !== undefined ? decision.requiresHumanApproval : decision.requires_human_approval);
  if (requiresHumanApproval !== undefined) row.requires_human_approval = Boolean(requiresHumanApproval);

  // metadata & created_at
  if (decision.metadata !== undefined) {
    row.metadata = typeof decision.metadata === "object" && decision.metadata !== null && !Array.isArray(decision.metadata)
      ? { ...decision.metadata }
      : decision.metadata;
  }

  const createdAt = decision.createdAt !== undefined ? decision.createdAt : decision.created_at;
  if (createdAt !== undefined) row.created_at = createdAt;

  return row;
}

/**
 * Factory creating a DecisionRepository bound to an injected Supabase client.
 *
 * @param {Object} supabaseClient - Supabase client instance
 * @returns {Object} DecisionRepository instance
 */
export function createDecisionRepository(supabaseClient) {
  validateSupabaseClient(supabaseClient, "DecisionRepository");

  return {
    /**
     * Persists a new decision record into the database.
     *
     * @param {Object} decision - Application decision object
     * @returns {Promise<Object>} Created database record
     */
    async createDecision(decision) {
      if (!decision || typeof decision !== "object") {
        throw new Error("Failed to create decision: decision object is required");
      }

      const row = toDecisionRow(decision);

      const response = await supabaseClient
        .from("decisions")
        .insert(row)
        .select()
        .single();

      return handleDbResponse(response, "Failed to create decision");
    },

    /**
     * Retrieves a decision record by its primary key ID.
     *
     * @param {string} id - Decision UUID
     * @returns {Promise<Object|null>} Found record or null
     */
    async getDecisionById(id) {
      if (!id || typeof id !== "string") {
        throw new Error("Failed to get decision: valid id is required");
      }

      const response = await supabaseClient
        .from("decisions")
        .select()
        .eq("id", id)
        .single();

      return handleDbResponse(response, "Failed to get decision");
    },

    /**
     * Retrieves a decision record by its associated action ID.
     * Since action_id is UNIQUE, at most one decision matches.
     *
     * @param {string} actionId - Action UUID
     * @returns {Promise<Object|null>} Found record or null
     */
    async getDecisionByActionId(actionId) {
      if (!actionId || typeof actionId !== "string") {
        throw new Error("Failed to get decision by action: valid actionId is required");
      }

      const response = await supabaseClient
        .from("decisions")
        .select()
        .eq("action_id", actionId)
        .single();

      return handleDbResponse(response, "Failed to get decision by action");
    },
  };
}
