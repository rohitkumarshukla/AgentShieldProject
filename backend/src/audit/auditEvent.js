import crypto from "node:crypto";

/**
 * Valid audit event lifecycle statuses.
 */
export const AUDIT_STATUSES = Object.freeze([
  "DECISION_MADE",
  "AWAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "EXECUTED",
  "BLOCKED",
  "FAILED",
]);

/**
 * Derives the initial audit status directly from a policy decision.
 *
 * @param {string} decision - "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK"
 * @returns {"DECISION_MADE" | "AWAITING_APPROVAL" | "BLOCKED"}
 */
export function deriveAuditStatus(decision) {
  switch (decision) {
    case "ALLOW":
      return "DECISION_MADE";
    case "APPROVAL_REQUIRED":
      return "AWAITING_APPROVAL";
    case "BLOCK":
      return "BLOCKED";
    default:
      throw new Error(`Unsupported policy decision for audit status derivation: "${decision}"`);
  }
}

/**
 * Creates an immutable, normalized Audit Event representing the governance evaluation of an action.
 *
 * Can receive either:
 * - Direct action/risk/policy container: `{ action, risk, policy, status?, id?, createdAt?, metadata? }`
 * - Or individual properties: `{ actionId, agentId, actionType, target, risk, policy, status?, id?, createdAt?, metadata? }`
 *
 * Deeply clones nested structures so caller objects are never mutated.
 *
 * @param {Object} input
 * @returns {Object} Normalized Audit Event
 */
export function createAuditEvent(input = {}) {
  const action = input.action || {};

  const actionId = input.actionId || action.id;
  const agentId = input.agentId || action.agentId;
  const actionType = input.actionType || action.actionType;
  const target = input.target || action.target;

  const rawRisk = input.risk || {};
  const risk = {
    score: rawRisk.score,
    level: rawRisk.level,
    factors: Array.isArray(rawRisk.factors)
      ? rawRisk.factors.map((f) => ({ ...f }))
      : [],
  };

  const rawPolicy = input.policy || {};
  const policy = {
    decision: rawPolicy.decision,
    policyCode: rawPolicy.policyCode,
    reason: rawPolicy.reason,
    requiresHumanApproval: rawPolicy.requiresHumanApproval,
  };

  // Derive status from policy.decision if not explicitly supplied
  const status = input.status || (policy.decision ? deriveAuditStatus(policy.decision) : undefined);

  return {
    id: typeof input.id === "string" && input.id.trim().length > 0
      ? input.id
      : crypto.randomUUID(),
    actionId,
    agentId,
    actionType,
    target,
    risk,
    policy,
    status,
    createdAt: typeof input.createdAt === "string" && input.createdAt.trim().length > 0
      ? input.createdAt
      : new Date().toISOString(),
    metadata: input.metadata !== undefined
      ? input.metadata
      : {},
  };
}

