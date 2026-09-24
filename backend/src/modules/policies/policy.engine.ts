import type { Action } from "../../types/action.js";
import type { DecisionOutcome } from "../../types/decision.js";
import type {
  Policy,
  PolicyConditions,
  PolicyEvaluationResult,
} from "../../types/policy.js";
import type { RiskAssessment, RiskLevel } from "../../types/risk.js";

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const OUTCOME_PRECEDENCE: Record<DecisionOutcome, number> = {
  ALLOW: 0,
  REQUIRE_APPROVAL: 1,
  BLOCK: 2,
};

// These starter policies are data, not special cases in the evaluator. Their
// explicit priorities make administration predictable as policies expand.
export const DEFAULT_POLICIES: readonly Policy[] = [
  {
    id: "sensitive_export_guard",
    name: "Sensitive export guard",
    description: "Exports containing sensitive data are blocked",
    enabled: true,
    priority: 100,
    conditions: {
      actionTypeIncludes: ["export"],
      requiredRiskFactors: ["SENSITIVE_DATA"],
    },
    action: "BLOCK",
  },
  {
    id: "bulk_delete_guard",
    name: "Bulk delete guard",
    description: "Destructive actions affecting a large scope are blocked",
    enabled: true,
    priority: 90,
    conditions: {
      actionTypeIncludes: ["delete", "remove", "destroy", "purge", "wipe"],
      requiredRiskFactors: ["BULK_SCOPE"],
      minimumFactorPoints: { BULK_SCOPE: 55 },
    },
    action: "BLOCK",
  },
  {
    id: "external_email_review",
    name: "External email review",
    description: "Messages sent to external recipients require approval",
    enabled: true,
    priority: 80,
    conditions: {
      actionTypeIncludes: ["send", "email"],
      requiredRiskFactors: ["EXTERNAL_DESTINATION"],
    },
    action: "REQUIRE_APPROVAL",
  },
  {
    id: "production_change_review",
    name: "Production change review",
    description: "Production-targeted actions require approval",
    enabled: true,
    priority: 70,
    conditions: { requiredRiskFactors: ["PRODUCTION_ENVIRONMENT"] },
    action: "REQUIRE_APPROVAL",
  },
  {
    id: "financial_threshold_review",
    name: "Financial threshold review",
    description: "Financial actions of 1,000 or more require approval",
    enabled: true,
    priority: 60,
    conditions: {
      requiredRiskFactors: ["FINANCIAL_IMPACT"],
      minimumFactorPoints: { FINANCIAL_IMPACT: 25 },
    },
    action: "REQUIRE_APPROVAL",
  },
  {
    id: "internal_read_allow",
    name: "Internal read allow",
    description: "Explicit low-risk internal reads are allowed",
    enabled: true,
    priority: 10,
    conditions: {
      actionTypeIncludes: ["read"],
      maximumRiskLevel: "LOW",
    },
    action: "ALLOW",
  },
];

// Risk describes potential danger; policy decides the authorization response.
// Keeping them separate prevents authorization logic from changing risk scores.
export class PolicyEngine {
  evaluate(
    action: Action,
    risk: RiskAssessment,
    policies: readonly Policy[] = DEFAULT_POLICIES,
  ): PolicyEvaluationResult {
    // Stable sorting avoids insertion-order behavior when priorities are equal.
    const matchedPolicies = policies
      .filter((policy) => policy.enabled && this.matches(policy.conditions, action, risk))
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

    if (matchedPolicies.length === 0) {
      // Unknown actions require human review rather than becoming implicit allows.
      return {
        outcome: "REQUIRE_APPROVAL",
        matchedPolicies,
        reason: "No explicit policy matched; approval is required by default",
      };
    }

    // Blocking controls always win conflicts, then priority resolves policies
    // with the same outcome. This makes security-critical precedence explicit.
    const selectedPolicy = [...matchedPolicies].sort((left, right) => {
      const outcomeDifference = OUTCOME_PRECEDENCE[right.action] - OUTCOME_PRECEDENCE[left.action];
      return outcomeDifference || right.priority - left.priority || left.id.localeCompare(right.id);
    })[0];

    return {
      outcome: selectedPolicy.action,
      matchedPolicies,
      selectedPolicy,
      reason: selectedPolicy.description,
    };
  }

  private matches(conditions: PolicyConditions, action: Action, risk: RiskAssessment): boolean {
    const actionType = action.type.toLowerCase();
    if (conditions.actionTypeIncludes && !conditions.actionTypeIncludes.some((value) => actionType.includes(value.toLowerCase()))) {
      return false;
    }
    if (conditions.toolIds && !conditions.toolIds.includes(action.toolId)) return false;
    if (conditions.minimumRiskLevel && RISK_LEVEL_ORDER[risk.level] < RISK_LEVEL_ORDER[conditions.minimumRiskLevel]) return false;
    if (conditions.maximumRiskLevel && RISK_LEVEL_ORDER[risk.level] > RISK_LEVEL_ORDER[conditions.maximumRiskLevel]) return false;
    if (conditions.minimumRiskScore !== undefined && risk.score < conditions.minimumRiskScore) return false;
    if (conditions.requiredRiskFactors && !conditions.requiredRiskFactors.every((factor) => risk.factors.some((item) => item.factor === factor))) {
      return false;
    }
    if (conditions.minimumFactorPoints && !Object.entries(conditions.minimumFactorPoints).every(([factor, points]) => {
      const contribution = risk.factors.find((item) => item.factor === factor);
      return contribution !== undefined && contribution.points >= points;
    })) {
      return false;
    }
    return true;
  }
}
