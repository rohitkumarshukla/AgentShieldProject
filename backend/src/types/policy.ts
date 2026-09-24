import type { DecisionOutcome } from "./decision.js";
import type { RiskFactorType, RiskLevel } from "./risk.js";

// Policies are declarative domain records. Their interpretation belongs to the
// policy engine, keeping persistence and authorization concerns separate.
export interface PolicyConditions {
  actionTypeIncludes?: readonly string[];
  toolIds?: readonly string[];
  minimumRiskLevel?: RiskLevel;
  maximumRiskLevel?: RiskLevel;
  minimumRiskScore?: number;
  requiredRiskFactors?: readonly RiskFactorType[];
  minimumFactorPoints?: Partial<Record<RiskFactorType, number>>;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: PolicyConditions;
  action: DecisionOutcome;
}

// Results retain both the matches and the selected policy so future audit
// records can explain why AgentShield chose an authorization outcome.
export interface PolicyEvaluationResult {
  outcome: DecisionOutcome;
  matchedPolicies: Policy[];
  selectedPolicy?: Policy;
  reason: string;
}
