import { AUDIT_STATUSES } from "./auditEvent.js";

const VALID_ACTION_TYPES = new Set([
  "read",
  "write",
  "delete",
  "send",
  "execute",
  "export",
]);

const VALID_RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const VALID_POLICY_DECISIONS = new Set(["ALLOW", "APPROVAL_REQUIRED", "BLOCK"]);
const VALID_STATUSES = new Set(AUDIT_STATUSES);

/**
 * Validates an audit event object deterministically against AgentShield domain and consistency rules.
 *
 * @param {unknown} event - The audit event to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAuditEvent(event) {
  const errors = [];

  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return {
      valid: false,
      errors: ["AuditEvent must be a valid non-null object."],
    };
  }

  // 1. id
  if (typeof event.id !== "string" || event.id.trim().length === 0) {
    errors.push("id is required and must be a non-empty string.");
  }

  // 2. actionId
  if (typeof event.actionId !== "string" || event.actionId.trim().length === 0) {
    errors.push("actionId is required and must be a non-empty string.");
  }

  // 3. agentId
  if (typeof event.agentId !== "string" || event.agentId.trim().length === 0) {
    errors.push("agentId is required and must be a non-empty string.");
  }

  // 4. actionType
  if (typeof event.actionType !== "string" || !VALID_ACTION_TYPES.has(event.actionType)) {
    errors.push(
      `actionType must be one of: ${Array.from(VALID_ACTION_TYPES).join(", ")}.`,
    );
  }

  // 5. target
  if (typeof event.target !== "string" || event.target.trim().length === 0) {
    errors.push("target is required and must be a non-empty string.");
  }

  // 6 - 9. risk structure
  if (!event.risk || typeof event.risk !== "object" || Array.isArray(event.risk)) {
    errors.push("risk is required and must be an object.");
  } else {
    // 7. risk.score (0 - 100)
    if (
      typeof event.risk.score !== "number" ||
      Number.isNaN(event.risk.score) ||
      event.risk.score < 0 ||
      event.risk.score > 100
    ) {
      errors.push("risk.score must be a number between 0 and 100 inclusive.");
    }

    // 8. risk.level
    if (typeof event.risk.level !== "string" || !VALID_RISK_LEVELS.has(event.risk.level)) {
      errors.push(
        `risk.level must be one of: ${Array.from(VALID_RISK_LEVELS).join(", ")}.`,
      );
    }

    // 9. risk.factors
    if (!Array.isArray(event.risk.factors)) {
      errors.push("risk.factors must be an array.");
    } else {
      for (let i = 0; i < event.risk.factors.length; i++) {
        const factor = event.risk.factors[i];
        if (!factor || typeof factor !== "object") {
          errors.push(`risk.factors[${i}] must be an object.`);
          continue;
        }
        if (typeof factor.code !== "string" || factor.code.trim().length === 0) {
          errors.push(`risk.factors[${i}].code must be a non-empty string.`);
        }
        if (typeof factor.description !== "string" || factor.description.trim().length === 0) {
          errors.push(`risk.factors[${i}].description must be a non-empty string.`);
        }
        if (typeof factor.points !== "number" || Number.isNaN(factor.points)) {
          errors.push(`risk.factors[${i}].points must be a valid number.`);
        }
      }
    }
  }

  // 10 - 14. policy structure
  if (!event.policy || typeof event.policy !== "object" || Array.isArray(event.policy)) {
    errors.push("policy is required and must be an object.");
  } else {
    // 11. policy.decision
    if (typeof event.policy.decision !== "string" || !VALID_POLICY_DECISIONS.has(event.policy.decision)) {
      errors.push(
        `policy.decision must be one of: ${Array.from(VALID_POLICY_DECISIONS).join(", ")}.`,
      );
    }

    // 12. policy.policyCode
    if (typeof event.policy.policyCode !== "string" || event.policy.policyCode.trim().length === 0) {
      errors.push("policy.policyCode is required and must be a non-empty string.");
    }

    // 13. policy.reason
    if (typeof event.policy.reason !== "string" || event.policy.reason.trim().length === 0) {
      errors.push("policy.reason is required and must be a non-empty string.");
    }

    // 14. policy.requiresHumanApproval
    if (typeof event.policy.requiresHumanApproval !== "boolean") {
      errors.push("policy.requiresHumanApproval must be a boolean.");
    }
  }

  // 15. status
  if (typeof event.status !== "string" || !VALID_STATUSES.has(event.status)) {
    errors.push(
      `status must be one of: ${Array.from(VALID_STATUSES).join(", ")}.`,
    );
  }

  // 16. createdAt: valid ISO timestamp
  if (typeof event.createdAt !== "string" || Number.isNaN(Date.parse(event.createdAt))) {
    errors.push("createdAt must be a valid ISO timestamp string.");
  }

  // 17. metadata: object
  if (!event.metadata || typeof event.metadata !== "object" || Array.isArray(event.metadata)) {
    errors.push("metadata must be an object.");
  }

  // Consistency checks (Part I)
  if (event.policy && typeof event.policy === "object") {
    if (event.policy.decision === "ALLOW") {
      if (event.policy.requiresHumanApproval !== false) {
        errors.push("Consistency error: policy.decision ALLOW requires requiresHumanApproval to be false.");
      }
      if (event.status !== "DECISION_MADE") {
        errors.push("Consistency error: policy.decision ALLOW requires status to be DECISION_MADE.");
      }
    } else if (event.policy.decision === "APPROVAL_REQUIRED") {
      if (event.policy.requiresHumanApproval !== true) {
        errors.push("Consistency error: policy.decision APPROVAL_REQUIRED requires requiresHumanApproval to be true.");
      }
      if (event.status !== "AWAITING_APPROVAL") {
        errors.push("Consistency error: policy.decision APPROVAL_REQUIRED requires status to be AWAITING_APPROVAL.");
      }
    } else if (event.policy.decision === "BLOCK") {
      if (event.policy.requiresHumanApproval !== false) {
        errors.push("Consistency error: policy.decision BLOCK requires requiresHumanApproval to be false.");
      }
      if (event.status !== "BLOCKED") {
        errors.push("Consistency error: policy.decision BLOCK requires status to be BLOCKED.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
