const VALID_RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

/**
 * Deterministic Policy Engine for AgentShield.
 *
 * Architecture:
 *   Action + RiskAssessment -> PolicyEngine.evaluate(action, riskAssessment) -> PolicyDecision
 *
 * Responsibilities:
 * - Decides the governance outcome: ALLOW | APPROVAL_REQUIRED | BLOCK.
 * - Applies explicit policy rules in strict, deterministic precedence.
 * - Explains the reasoning and whether human approval is required.
 * - Does NOT calculate risk scores or execute real-world tools.
 */
export class PolicyEngine {
  /**
   * Evaluates an action alongside its risk assessment against baseline policies.
   *
   * @param {Object} action - Normalized action object
   * @param {Object} riskAssessment - Output from RiskEngine.evaluate()
   * @returns {{
   *   decision: "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK",
   *   policyCode: string,
   *   reason: string,
   *   requiresHumanApproval: boolean
   * }}
   */
  evaluate(action, riskAssessment) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error("PolicyEngine.evaluate requires a valid action object");
    }

    if (!riskAssessment || typeof riskAssessment !== "object" || Array.isArray(riskAssessment)) {
      throw new Error("PolicyEngine.evaluate requires a valid riskAssessment object");
    }

    if (!riskAssessment.level || typeof riskAssessment.level !== "string") {
      throw new Error("PolicyEngine.evaluate requires a risk level on riskAssessment");
    }

    if (!VALID_RISK_LEVELS.has(riskAssessment.level)) {
      throw new Error(
        `PolicyEngine.evaluate encountered unsupported risk level: "${riskAssessment.level}"`,
      );
    }

    // Policy Precedence 1: bulk_delete_guard
    // Large-scale deletions (>=100 resources) are blocked outright to prevent catastrophic data loss.
    // Checked before generic critical risk to preserve explicit audit explanation.
    if (action.actionType === "delete" && (action.scope?.count ?? 0) >= 100) {
      return {
        decision: "BLOCK",
        policyCode: "bulk_delete_guard",
        reason: "Large-scale deletion is blocked to prevent destructive bulk operations",
        requiresHumanApproval: false,
      };
    }

    // Policy Precedence 2: critical_risk_block
    // Critical-risk actions are blocked automatically without human approval options.
    if (riskAssessment.level === "CRITICAL") {
      return {
        decision: "BLOCK",
        policyCode: "critical_risk_block",
        reason: "Critical-risk actions are blocked automatically to protect system integrity",
        requiresHumanApproval: false,
      };
    }

    // Policy Precedence 3: external_email_review
    // External outbound communications at HIGH risk require explicit human review.
    // Checked before generic high-risk approval to give specific audit attribution.
    if (
      action.actionType === "send" &&
      action.destination?.type === "external" &&
      riskAssessment.level === "HIGH"
    ) {
      return {
        decision: "APPROVAL_REQUIRED",
        policyCode: "external_email_review",
        reason: "External communication at high risk requires human review",
        requiresHumanApproval: true,
      };
    }

    // Policy Precedence 4: high_risk_human_approval
    // High-risk actions require human authorization before execution.
    if (riskAssessment.level === "HIGH") {
      return {
        decision: "APPROVAL_REQUIRED",
        policyCode: "high_risk_human_approval",
        reason: "High-risk actions require human approval before execution",
        requiresHumanApproval: true,
      };
    }

    // Policy Precedence 5: standard_risk_allow
    // Low and medium risk actions operate within the automatic execution threshold.
    if (riskAssessment.level === "LOW" || riskAssessment.level === "MEDIUM") {
      return {
        decision: "ALLOW",
        policyCode: "standard_risk_allow",
        reason: "Action is within the automatic execution risk threshold",
        requiresHumanApproval: false,
      };
    }

    // Defensive fallback (unreachable under current VALID_RISK_LEVELS validation)
    throw new Error(`Unhandled risk level: ${riskAssessment.level}`);
  }
}
