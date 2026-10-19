/**
 * AgentShield Policy Engine (Step 3)
 *
 * Evaluates actions and their deterministic risk assessments against governance policies.
 * Rules are evaluated in strict priority order, producing one of:
 * - ALLOW: Action is permitted to proceed automatically.
 * - APPROVAL_REQUIRED: Action is held pending authorized human review.
 * - BLOCK: Action is blocked from downstream tool execution.
 *
 * Guarantees:
 * - Fail-closed: Invalid or unsupported inputs never produce an ALLOW decision.
 * - Pure and deterministic: No side effects, no mutation of inputs.
 */

export const DECISIONS = Object.freeze({
  ALLOW: "ALLOW",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  BLOCK: "BLOCK",
});

export const POLICY_IDS = Object.freeze({
  BULK_DELETE_GUARD: "bulk_delete_guard",
  CRITICAL_RISK_BLOCK: "critical_risk_block",
  EXTERNAL_EMAIL_REVIEW: "external_email_review",
  HIGH_RISK_HUMAN_APPROVAL: "high_risk_human_approval",
  STANDARD_RISK_ALLOW: "standard_risk_allow",
});

const VALID_RISK_LEVELS = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/**
 * Checks whether an operation indicates sending emails.
 * Inspects both action.operation and action.toolId case-insensitively.
 *
 * @param {object} action
 * @returns {boolean}
 */
function isEmailOperation(action) {
  const op = typeof action.operation === "string" ? action.operation.toLowerCase() : "";
  const tool = typeof action.toolId === "string" ? action.toolId.toLowerCase() : "";

  if (op.includes("email") || op.includes("mail")) {
    return true;
  }
  if ((tool.includes("email") || tool.includes("mail")) && (op.includes("send") || op.includes("batch"))) {
    return true;
  }
  return false;
}

/**
 * Checks whether the destination parameter is 'external' case-insensitively.
 *
 * @param {object} [parameters]
 * @returns {boolean}
 */
function isExternalDestination(parameters) {
  if (!parameters || typeof parameters !== "object") return false;
  return (
    typeof parameters.destination === "string" &&
    parameters.destination.trim().toLowerCase() === "external"
  );
}

/**
 * Evaluates governance policy rules against an action and its risk assessment.
 *
 * Rules are evaluated in strict priority order:
 * 1. bulk_delete_guard: If operation contains 'delete' and count >= 100 -> BLOCK
 * 2. critical_risk_block: If risk level is CRITICAL -> BLOCK
 * 3. external_email_review: If operation indicates sending emails and destination is external -> APPROVAL_REQUIRED
 * 4. high_risk_human_approval: If risk level is HIGH -> APPROVAL_REQUIRED
 * 5. standard_risk_allow: If risk level is LOW or MEDIUM -> ALLOW
 *
 * Validates inputs and fails closed: invalid or unsupported inputs never produce an ALLOW decision.
 *
 * @param {object} action - Normalized action object.
 * @param {object} riskAssessment - Risk assessment containing score, level, and factors.
 * @returns {{ decision: string, policyId: string, reason: string }}
 */
export function evaluatePolicy(action, riskAssessment) {
  // Input validation - fail closed
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new TypeError("Action must be a valid plain object.");
  }

  if (typeof action.operation !== "string" || action.operation.trim().length === 0) {
    throw new TypeError("Action must contain a valid non-empty operation string.");
  }

  if (!riskAssessment || typeof riskAssessment !== "object" || Array.isArray(riskAssessment)) {
    throw new TypeError("Risk assessment must be a valid plain object.");
  }

  if (!VALID_RISK_LEVELS.includes(riskAssessment.level)) {
    throw new Error(
      `Invalid or unsupported risk level: "${riskAssessment.level}". Cannot evaluate policy.`
    );
  }

  const params = action.parameters || {};

  // Rule 1: bulk_delete_guard (Priority 1)
  // If the operation contains 'delete' and parameters.count >= 100, return BLOCK
  const opLower = action.operation.toLowerCase();
  const count = params.count;
  if (opLower.includes("delete") && typeof count === "number" && count >= 100) {
    return {
      decision: DECISIONS.BLOCK,
      policyId: POLICY_IDS.BULK_DELETE_GUARD,
      reason: "Bulk delete operations affecting 100 or more records are blocked by security policy.",
    };
  }

  // Rule 2: critical_risk_block (Priority 2)
  // If the risk level is CRITICAL, return BLOCK
  if (riskAssessment.level === "CRITICAL") {
    return {
      decision: DECISIONS.BLOCK,
      policyId: POLICY_IDS.CRITICAL_RISK_BLOCK,
      reason: "Action evaluated to CRITICAL risk and is blocked by security policy.",
    };
  }

  // Rule 3: external_email_review (Priority 3)
  // If the operation indicates sending emails and the destination is external, return APPROVAL_REQUIRED
  if (isEmailOperation(action) && isExternalDestination(params)) {
    return {
      decision: DECISIONS.APPROVAL_REQUIRED,
      policyId: POLICY_IDS.EXTERNAL_EMAIL_REVIEW,
      reason: "Sending emails to an external destination requires human review and approval.",
    };
  }

  // Rule 4: high_risk_human_approval (Priority 4)
  // If the risk level is HIGH, return APPROVAL_REQUIRED
  if (riskAssessment.level === "HIGH") {
    return {
      decision: DECISIONS.APPROVAL_REQUIRED,
      policyId: POLICY_IDS.HIGH_RISK_HUMAN_APPROVAL,
      reason: "Action evaluated to HIGH risk and requires human review and approval.",
    };
  }

  // Rule 5: standard_risk_allow (Priority 5)
  // If the risk level is LOW or MEDIUM, return ALLOW
  if (riskAssessment.level === "LOW" || riskAssessment.level === "MEDIUM") {
    return {
      decision: DECISIONS.ALLOW,
      policyId: POLICY_IDS.STANDARD_RISK_ALLOW,
      reason: "Action evaluated to acceptable risk level (LOW or MEDIUM) and is allowed under standard policy.",
    };
  }

  // Defensive fallback: Fail closed
  throw new Error("Unable to determine policy decision. Failing closed.");
}
