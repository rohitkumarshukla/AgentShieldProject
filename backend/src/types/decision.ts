import type { Action } from "./action.js";
import type { PolicyEvaluationResult } from "./policy.js";
import type { RiskAssessment } from "./risk.js";

// Decision represents AgentShield's authorization outcome. The decision-making
// logic that produces it will be implemented independently later.
export type DecisionOutcome = "ALLOW" | "REQUIRE_APPROVAL" | "BLOCK";

export interface Decision {
  outcome: DecisionOutcome;
  reason: string;
  riskScore: number;
  policyId?: string;
  timestamp: Date;
}

// DecisionResult represents the complete aggregate output of the DecisionPipeline,
// exposing the action evaluated, the risk assessment, the policy evaluation,
// and the final governance decision.
export interface DecisionResult {
  action: Action;
  riskAssessment: RiskAssessment;
  policyEvaluation: PolicyEvaluationResult;
  finalOutcome: DecisionOutcome;
  reason: string;
}
