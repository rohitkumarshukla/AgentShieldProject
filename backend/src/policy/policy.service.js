import crypto from "node:crypto";
import { PolicyEngine } from "./policyEngine.js";
import { RiskEngine } from "../risk/riskEngine.js";

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
 * Order of priority: Lower priority number = higher precedence.
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
    code: "agent_threshold_guard",
    name: "Agent Risk Threshold Review",
    priority: 25,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Requires human review when action risk score meets or exceeds agent's configured approval threshold.",
    conditions: { dynamicThreshold: true },
  },
  {
    code: "financial_guardrail",
    name: "Financial Transaction Authorization",
    priority: 30,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Requires human review when transactions exceed high-value monetary thresholds (>= $1,000).",
    conditions: { minFinancialImpact: 1000 },
  },
  {
    code: "production_infra_guard",
    name: "Production Infrastructure Review",
    priority: 40,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Gates high-impact production infrastructure modifications behind human authorization.",
    conditions: { environment: "production", actionType: "execute", riskLevel: "HIGH" },
  },
  {
    code: "external_email_review",
    name: "External Communications Review",
    priority: 50,
    decision: "APPROVAL_REQUIRED",
    requiresHumanApproval: true,
    description: "Requires human-in-the-loop review for outbound messages or emails sent to external recipients at high risk.",
    conditions: { actionType: "send", destination: "external", riskLevel: "HIGH" },
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
 * @param {RiskEngine} [options.riskEngine]
 * @param {Array<Object>} [options.systemPolicies]
 * @returns {Object}
 */
export function createPolicyService(options = {}) {
  const policyEngine = options.policyEngine || new PolicyEngine();
  const riskEngine = options.riskEngine || new RiskEngine();
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
     * Evaluates action and risk assessment synchronously against policy rules.
     * Policy acts as the final authority on all governance decisions.
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

        // 1. Check custom agent policy overrides first (Fail-Closed on error)
        if (Array.isArray(customPolicies) && customPolicies.length > 0) {
          for (const custom of customPolicies) {
            try {
              if (custom && typeof custom.match === "function") {
                if (custom.match(action, riskAssessment)) {
                  const decision = custom.decision || "APPROVAL_REQUIRED";
                  return {
                    decision,
                    policyCode: custom.code || "custom_agent_policy",
                    policyName: custom.name || "Custom Agent Policy",
                    reason: custom.reason || "Custom agent policy condition matched",
                    requiresHumanApproval: decision === "APPROVAL_REQUIRED",
                    timestamp: new Date().toISOString(),
                  };
                }
              }
            } catch (customErr) {
              // Fail-closed if a custom policy rule crashes
              return {
                decision: "BLOCK",
                policyCode: "custom_policy_evaluation_error",
                policyName: "Custom Policy Failure",
                reason: `Custom policy evaluation failed: ${customErr.message}`,
                requiresHumanApproval: false,
                timestamp: new Date().toISOString(),
              };
            }
          }
        }

        // 2. Evaluate High-Precedence Explicit Policy Rules

        // Policy Precedence 1: bulk_delete_guard
        if (action.actionType === "delete" && (action.scope?.count ?? 0) >= 100) {
          const meta = this.getPolicyByCode("bulk_delete_guard");
          return {
            decision: "BLOCK",
            policyCode: "bulk_delete_guard",
            policyName: meta?.name || "Bulk Deletion Guardrail",
            reason: "Large-scale deletion is blocked to prevent destructive bulk operations",
            requiresHumanApproval: false,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 2: critical_risk_block
        if (riskAssessment.level === "CRITICAL" || (typeof riskAssessment.score === "number" && riskAssessment.score >= 80)) {
          const meta = this.getPolicyByCode("critical_risk_block");
          return {
            decision: "BLOCK",
            policyCode: "critical_risk_block",
            policyName: meta?.name || "Critical Risk Containment",
            reason: "Critical-risk actions are blocked automatically to protect system integrity",
            requiresHumanApproval: false,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 3: agent_threshold_guard (Agent-Specific approval threshold)
        const agentThreshold =
          action.metadata?.permissions?.requiresApprovalThreshold ??
          action.agent?.metadata?.permissions?.requiresApprovalThreshold ??
          null;

        if (
          typeof agentThreshold === "number" &&
          typeof riskAssessment.score === "number" &&
          riskAssessment.score >= agentThreshold &&
          riskAssessment.score > 0
        ) {
          const meta = this.getPolicyByCode("agent_threshold_guard");
          return {
            decision: "APPROVAL_REQUIRED",
            policyCode: "agent_threshold_guard",
            policyName: meta?.name || "Agent Risk Threshold Review",
            reason: `Action risk score (${riskAssessment.score}) meets or exceeds agent approval threshold (${agentThreshold})`,
            requiresHumanApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 4: financial_guardrail
        const financialImpact = action.financialImpact ?? action.parameters?.amount ?? action.parameters?.financialImpact ?? 0;
        if (typeof financialImpact === "number" && financialImpact >= 1000) {
          const meta = this.getPolicyByCode("financial_guardrail");
          return {
            decision: "APPROVAL_REQUIRED",
            policyCode: "financial_guardrail",
            policyName: meta?.name || "Financial Transaction Authorization",
            reason: `High-value financial impact ($${financialImpact.toLocaleString()}) requires human authorization`,
            requiresHumanApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 5: production_infra_guard
        if (
          action.environment === "production" &&
          (action.actionType === "execute" || action.metadata?.toolId === "infrastructure_ops") &&
          riskAssessment.level === "HIGH"
        ) {
          const meta = this.getPolicyByCode("production_infra_guard");
          return {
            decision: "APPROVAL_REQUIRED",
            policyCode: "production_infra_guard",
            policyName: meta?.name || "Production Infrastructure Review",
            reason: "High-impact production infrastructure modifications require human authorization",
            requiresHumanApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 6: external_email_review
        if (
          action.actionType === "send" &&
          action.destination?.type === "external" &&
          riskAssessment.level === "HIGH"
        ) {
          const meta = this.getPolicyByCode("external_email_review");
          return {
            decision: "APPROVAL_REQUIRED",
            policyCode: "external_email_review",
            policyName: meta?.name || "External Communications Review",
            reason: "External communication at high risk requires human review",
            requiresHumanApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 7: high_risk_human_approval (Default HIGH risk fallback)
        if (riskAssessment.level === "HIGH") {
          const meta = this.getPolicyByCode("high_risk_human_approval");
          return {
            decision: "APPROVAL_REQUIRED",
            policyCode: "high_risk_human_approval",
            policyName: meta?.name || "High-Risk Human Approval",
            reason: "High-risk actions require human approval before execution",
            requiresHumanApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        // Policy Precedence 8: standard_risk_allow
        if (riskAssessment.level === "LOW" || riskAssessment.level === "MEDIUM") {
          const meta = this.getPolicyByCode("standard_risk_allow");
          return {
            decision: "ALLOW",
            policyCode: "standard_risk_allow",
            policyName: meta?.name || "Standard Risk Automatic Allow",
            reason: "Action is within the automatic execution risk threshold",
            requiresHumanApproval: false,
            timestamp: new Date().toISOString(),
          };
        }

        // 3. Fallback to PolicyEngine evaluation
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

    /**
     * Asynchronously evaluates action and risk assessment against policy rules.
     * Supports asynchronous custom policy matchers and async rules.
     *
     * @param {Object} action
     * @param {Object} riskAssessment
     * @param {Array<Object>} [customPolicies=[]]
     * @returns {Promise<Object>}
     */
    async evaluatePolicyAsync(action, riskAssessment, customPolicies = []) {
      try {
        if (!action || typeof action !== "object") {
          throw new PolicyServiceError("Action object is required for policy evaluation", 400, "INVALID_ACTION");
        }

        if (!riskAssessment || typeof riskAssessment !== "object" || !riskAssessment.level) {
          throw new PolicyServiceError("Valid riskAssessment is required for policy evaluation", 400, "INVALID_RISK_ASSESSMENT");
        }

        // Handle async custom matchers if any
        if (Array.isArray(customPolicies) && customPolicies.length > 0) {
          for (const custom of customPolicies) {
            try {
              if (custom && typeof custom.match === "function") {
                const matched = await Promise.resolve(custom.match(action, riskAssessment));
                if (matched) {
                  const decision = custom.decision || "APPROVAL_REQUIRED";
                  return {
                    decision,
                    policyCode: custom.code || "custom_agent_policy",
                    policyName: custom.name || "Custom Agent Policy",
                    reason: custom.reason || "Custom agent policy condition matched",
                    requiresHumanApproval: decision === "APPROVAL_REQUIRED",
                    timestamp: new Date().toISOString(),
                  };
                }
              }
            } catch (err) {
              return {
                decision: "BLOCK",
                policyCode: "custom_policy_evaluation_error",
                policyName: "Custom Policy Failure",
                reason: `Custom policy async evaluation failed: ${err.message}`,
                requiresHumanApproval: false,
                timestamp: new Date().toISOString(),
              };
            }
          }
        }

        return this.evaluatePolicy(action, riskAssessment, []);
      } catch (error) {
        if (error instanceof PolicyServiceError) throw error;
        throw new PolicyServiceError(`Async policy evaluation error: ${error.message}`, 500, "POLICY_EVALUATION_FAILED");
      }
    },

    /**
     * Complete pipeline helper: evaluates risk and then policy for a given action.
     *
     * @param {Object} action
     * @param {Array<Object>} [customPolicies=[]]
     * @returns {Promise<{
     *   action: Object,
     *   risk: Object,
     *   policy: Object
     * }>}
     */
    async evaluateActionAsync(action, customPolicies = []) {
      try {
        if (!action || typeof action !== "object") {
          throw new PolicyServiceError("Action object is required", 400, "INVALID_ACTION");
        }

        const canonical = {
          id: action.id || crypto.randomUUID(),
          agentId: action.agentId || "00000000-0000-0000-0000-000000000001",
          actionType: action.actionType || "read",
          target: action.target || "system.resource",
          description: action.description || "System action evaluation",
          scope: {
            type: action.scope?.type || (action.scope?.count && action.scope.count > 1 ? "bulk" : "single"),
            count: typeof action.scope?.count === "number" ? action.scope.count : 1,
          },
          destination: {
            type: action.destination?.type || "internal",
            value: action.destination?.value || null,
          },
          environment: action.environment || "development",
          sensitivity: {
            level: action.sensitivity?.level || "internal",
          },
          financialImpact: typeof action.financialImpact === "number" ? action.financialImpact : 0,
          metadata: action.metadata || {},
        };

        const risk = riskEngine.evaluate(canonical);
        const policy = await this.evaluatePolicyAsync(canonical, risk, customPolicies);

        return {
          action: canonical,
          risk,
          policy,
        };
      } catch (error) {
        if (error instanceof PolicyServiceError) throw error;
        throw new PolicyServiceError(`Action evaluation failed: ${error.message}`, 500, "ACTION_EVALUATION_FAILED");
      }
    },
  };
}

export default {
  PolicyServiceError,
  SYSTEM_POLICIES,
  createPolicyService,
};
