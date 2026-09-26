import { PolicyEngine } from "./policyEngine.js";

export class PolicyServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=400]
   * @param {string} [code='INVALID_POLICY_EVALUATION']
   * @param {Object} [details={}]
   */
  constructor(message, statusCode = 400, code = "INVALID_POLICY_EVALUATION", details = {}) {
    super(message);
    this.name = "PolicyServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Baseline System Policy Definitions.
 */
export const SYSTEM_POLICIES = Object.freeze([
  {
    code: "bulk_delete_guard",
    name: "Bulk Deletion Guardrail",
    priority: 10,
    decision: "BLOCK",
    requiresHumanApproval: false,
    description: "Blocks destructive actions deleting 100 or more resources to prevent catastrophic data loss.",
    conditions: { actionType: "delete", minCount: 100 },
  },
  {
    code: "critical_risk_block",
    name: "Critical Risk Containment",
    priority: 20,
    decision: "BLOCK",
    requiresHumanApproval: false,
    description: "Blocks any action evaluated at CRITICAL risk (score 80–100) automatically without approval bypass.",
    conditions: { riskLevel: "CRITICAL" },
  },
  {
    code: "external_email_review",
    name: "External Communications Review",
    priority: 30,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Requires human-in-the-loop review for outbound messages or emails sent to external recipients at high risk.",
    conditions: { actionType: "send", destination: "external", riskLevel: "HIGH" },
  },
  {
    code: "financial_guardrail",
    name: "Financial Transaction Authorization",
    priority: 40,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Requires human review when transactions exceed high-value monetary thresholds.",
    conditions: { minFinancialImpact: 1000 },
  },
  {
    code: "production_infra_guard",
    name: "Production Infrastructure Review",
    priority: 50,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Gates high-impact production infrastructure modifications behind human authorization.",
    conditions: { environment: "production", actionType: "execute", riskLevel: "HIGH" },
  },
  {
    code: "high_risk_human_approval",
    name: "High-Risk Human Approval",
    priority: 60,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Default fallback policy gating all other HIGH risk actions for human reviewer authorization.",
    conditions: { riskLevel: "HIGH" },
  },
  {
    code: "internal_read_allow",
    name: "Internal Knowledge Auto-Allow",
    priority: 70,
    decision: "ALLOW",
    requiresHumanApproval: false,
    description: "Allows non-destructive internal read queries to proceed automatically without human friction.",
    conditions: { actionType: "read", destination: "internal", riskLevel: "LOW" },
  },
  {
    code: "standard_risk_allow",
    name: "Standard Risk Automatic Allow",
    priority: 80,
    decision: "ALLOW",
    requiresHumanApproval: false,
    description: "Permits routine LOW and standard MEDIUM risk actions to execute automatically under policy.",
    conditions: { riskLevels: ["LOW", "MEDIUM"] },
  },
]);

/**
 * Creates an instance of PolicyService.
 *
 * @param {Object} [options={}]
 * @param {PolicyEngine} [options.policyEngine]
 * @param {Array<Object>} [options.systemPolicies]
 * @returns {Object}
 */
export function createPolicyService(options = {}) {
  const policyEngine = options.policyEngine || new PolicyEngine();
  const policies = Array.isArray(options.systemPolicies) ? options.systemPolicies : SYSTEM_POLICIES;

  return {
    /**
     * Lists all registered system policies.
     *
     * @returns {Array<Object>}
     */
    listPolicies() {
      return [...policies];
    },

    /**
     * Looks up a specific policy by its unique policyCode.
     *
     * @param {string} code
     * @returns {Object|null}
     */
    getPolicyByCode(code) {
      if (!code || typeof code !== "string") return null;
      return policies.find((p) => p.code === code.trim()) || null;
    },

    /**
     * Evaluates action and risk assessment against policy rules.
     *
     * @param {Object} action - Canonical Action object
     * @param {Object} riskAssessment - Evaluated risk { score, level, factors }
     * @param {Array<Object>} [customPolicies=[]] - Optional agent-specific custom policy overrides
     * @returns {{
     *   decision: "ALLOW" | "APPROVAL_REQUIRED" | "BLOCK",
     *   policyCode: string,
     *   policyName: string,
     *   reason: string,
     *   requiresHumanApproval: boolean,
     *   timestamp: string
     * }}
     */
    evaluatePolicy(action, riskAssessment, customPolicies = []) {
      try {
        if (!action || typeof action !== "object") {
          throw new PolicyServiceError("Action object is required for policy evaluation", 400, "INVALID_ACTION");
        }

        if (!riskAssessment || typeof riskAssessment !== "object" || !riskAssessment.level) {
          throw new PolicyServiceError("Valid riskAssessment is required for policy evaluation", 400, "INVALID_RISK_ASSESSMENT");
        }

        // Check custom policies first if provided
        if (Array.isArray(customPolicies) && customPolicies.length > 0) {
          for (const custom of customPolicies) {
            if (custom.match && typeof custom.match === "function") {
              if (custom.match(action, riskAssessment)) {
                return {
                  decision: custom.decision || "APPROVAL_REQUIRED",
                  policyCode: custom.code || "custom_agent_policy",
                  policyName: custom.name || "Custom Agent Policy",
                  reason: custom.reason || "Custom agent policy condition matched",
                  requiresHumanApproval: custom.decision === "APPROVAL_REQUIRED",
                  timestamp: new Date().toISOString(),
                };
              }
            }
          }
        }

        // Standard PolicyEngine evaluation
        const decision = policyEngine.evaluate(action, riskAssessment);
        const policyMeta = this.getPolicyByCode(decision.policyCode);

        return {
          decision: decision.decision,
          policyCode: decision.policyCode,
          policyName: policyMeta?.name || decision.policyCode,
          reason: decision.reason,
          requiresHumanApproval: decision.requiresHumanApproval,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        if (error instanceof PolicyServiceError) throw error;
        throw new PolicyServiceError(`Policy evaluation error: ${error.message}`, 500, "POLICY_EVALUATION_FAILED");
      }
    },
  };
}

export default {
  PolicyServiceError,
  SYSTEM_POLICIES,
  createPolicyService,
};
