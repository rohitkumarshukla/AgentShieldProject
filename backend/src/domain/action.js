import crypto from "node:crypto";

/**
 * Normalized factory function to produce a canonical AgentShield Action object.
 *
 * An Action is a normalized descriptor representing a real-world tool execution
 * requested by an AI agent. Crucially, the action model contains NO risk scoring,
 * authorization decisions, or tool execution side effects.
 *
 * @param {Object} input - Raw parameters describing the action
 * @returns {Object} Canonical action object
 */
export function createAction(input = {}) {
  return {
    id: typeof input.id === "string" && input.id.trim().length > 0
      ? input.id
      : crypto.randomUUID(),
    agentId: input.agentId,
    actionType: input.actionType,
    target: input.target,
    description: input.description,
    scope: {
      type: input.scope?.type ?? "single",
      count: input.scope?.count ?? 1,
    },
    destination: {
      type: input.destination?.type ?? "none",
      value: input.destination?.value !== undefined ? input.destination.value : null,
    },
    environment: input.environment ?? "development",
    sensitivity: {
      level: input.sensitivity?.level ?? "internal",
    },
    financialImpact: input.financialImpact ?? 0,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? { ...input.metadata }
      : {},
    createdAt: typeof input.createdAt === "string" && input.createdAt.trim().length > 0
      ? input.createdAt
      : new Date().toISOString(),
  };
}
